// Builds the catalog data: artwork, episode lists, ratings, Russian descriptions and the demo video.
// Writes public/media/** and src/data/generated/anilist.json.
//
// Sources:   AniList   — facts, popularity, score, posters, banners, fallback episode stills
//            Kitsu     — higher-resolution posters and covers, episode titles, air dates and stills
//            Shikimori — Russian titles, descriptions and score
//            Blender   — the openly licensed demo video
//
// Usage: npm run assets            (reuses scripts/.cache)
//        npm run assets -- --force (re-downloads everything)
import { mkdir, writeFile, readFile, access, readdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { TITLES, DEMO_VIDEOS, AVATARS } from './titles.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MEDIA = path.join(ROOT, 'public', 'media')
const CACHE = path.join(ROOT, 'scripts', '.cache')
const OUT_JSON = path.join(ROOT, 'src', 'data', 'generated', 'anilist.json')
const FORCE = process.argv.includes('--force')
const UA = 'Anikai local catalog builder'
const execFileAsync = promisify(execFile)

/** Stills narrower than this look worse than a crop of the title's backdrop, so they are not used. */
const MIN_STILL_WIDTH = 320
const STILL_WIDTH = 640

const exists = (p) => access(p).then(() => true, () => false)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const hash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 16)

async function gql(query, variables) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`AniList ${res.status}: ${await res.text()}`)
  return (await res.json()).data
}

/** JSON GET with a disk cache and a few retries; returns null when the service has nothing or is down. */
async function getJson(url, cacheName, delay = 250) {
  const file = path.join(CACHE, `${cacheName}.json`)
  if (!FORCE && (await exists(file))) return JSON.parse(await readFile(file, 'utf8'))
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/vnd.api+json, application/json' } })
      if (res.status === 404) return null
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1))
        continue
      }
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      await writeFile(file, JSON.stringify(json))
      await sleep(delay)
      return json
    } catch {
      await sleep(800 * (attempt + 1))
    }
  }
  return null
}

/**
 * Shikimori redirects between its domains in a way Node's fetch does not survive on some networks,
 * while curl follows it fine. Returns { json, origin } or null. Cached like getJson.
 */
async function getJsonViaCurl(url, cacheName) {
  const file = path.join(CACHE, `${cacheName}.json`)
  if (!FORCE && (await exists(file))) return JSON.parse(await readFile(file, 'utf8'))
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { stdout } = await execFileAsync(
        'curl',
        ['-s', '-L', '-m', '30', '-A', UA, '-w', '\n%{http_code} %{url_effective}', url],
        { maxBuffer: 8 * 1024 * 1024 },
      )
      const cut = stdout.lastIndexOf('\n')
      const [status, effective] = stdout.slice(cut + 1).trim().split(' ')
      if (status === '404') return null
      if (status !== '200') throw new Error(status)
      const result = { json: JSON.parse(stdout.slice(0, cut)), origin: new URL(effective).origin }
      await writeFile(file, JSON.stringify(result))
      await sleep(450)
      return result
    } catch {
      await sleep(1500 * (attempt + 1))
    }
  }
  return null
}

/** Binary download with a disk cache keyed by URL; verifies HTTP status and content type. Returns null on failure. */
async function download(url, prefix = 'img', expectType = 'image/') {
  if (!url) return null
  const file = path.join(CACHE, `${prefix}-${hash(url)}`)
  if (!FORCE && (await exists(file))) return readFile(file)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(String(res.status))
      const type = res.headers.get('content-type') ?? ''
      if (!type.startsWith(expectType)) throw new Error(`content-type ${type}`)
      const buf = Buffer.from(await res.arrayBuffer())
      await writeFile(file, buf)
      return buf
    } catch {
      await sleep(500)
    }
  }
  return null
}

/** Runs async jobs with a fixed number of workers. */
async function pool(items, size, worker) {
  let next = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await worker(items[next++])
    }),
  )
}

const meta = async (buf) => {
  try {
    const m = await sharp(buf).metadata()
    return m.width && m.height ? m : null
  } catch {
    return null
  }
}

// ---------- Images ----------

/** Picks the larger of two poster candidates. A candidate must be portrait to count as a poster. */
async function bestPoster(candidates) {
  let best = null
  for (const c of candidates) {
    const buf = await download(c.url, 'poster')
    const m = buf && (await meta(buf))
    if (!m || m.height / m.width < 1.25) continue
    if (!best || m.width > best.m.width) best = { ...c, buf, m }
  }
  return best
}

async function writePoster(best, slug) {
  // 2:3 cover crop. Never upscale beyond the source.
  const w = Math.min(600, best.m.width, Math.floor((best.m.height * 2) / 3))
  for (const s of [
    { suffix: '', w },
    { suffix: '-sm', w: Math.min(300, w) },
  ]) {
    await sharp(best.buf)
      .resize({ width: s.w, height: Math.round(s.w * 1.5), fit: 'cover', position: 'attention' })
      .webp({ quality: 84 })
      .toFile(path.join(MEDIA, 'posters', `${slug}${s.suffix}.webp`))
  }
  return { w, h: Math.round(w * 1.5), srcW: best.m.width, srcH: best.m.height, source: best.url, from: best.from }
}

async function writeBackdrop(buf, slug, url, from) {
  const m = await meta(buf)
  const w = Math.min(1920, m.width)
  const h = Math.round((m.height / m.width) * w)
  await sharp(buf).resize({ width: w }).webp({ quality: 82 }).toFile(path.join(MEDIA, 'backdrops', `${slug}.webp`))
  await sharp(buf)
    .resize({ width: Math.min(960, w) })
    .webp({ quality: 80 })
    .toFile(path.join(MEDIA, 'backdrops', `${slug}-sm.webp`))
  return { w, h, srcW: m.width, srcH: m.height, source: url, from }
}

// ---------- Episodes ----------

/** AniList streaming entries look like "Episode 6 - Title". Returns { map: Map<number, {title, thumb}>, clean }. */
function parseStreaming(list, episodeCount) {
  const parsed = []
  for (const e of list ?? []) {
    const m = /^Episode\s+(\d+)(?:\s*[-–:]\s*(.*))?$/i.exec(e.title?.trim() ?? '')
    if (!m) continue
    parsed.push({ number: Number(m[1]), title: m[2]?.trim() || null, thumb: e.thumbnail || null })
  }
  const map = new Map()
  if (!parsed.length) return { map, clean: false }
  // Later seasons are often numbered continuously (25, 26, …): shift them to start at 1.
  const min = Math.min(...parsed.map((p) => p.number))
  const offset = min > 1 ? min - 1 : 0
  let duplicates = 0
  for (const p of parsed) {
    const n = p.number - offset
    if (n < 1 || n > episodeCount) continue
    if (map.has(n)) duplicates++
    else map.set(n, p)
  }
  // "Clean" = exactly one entry per episode. AniList sometimes merges several seasons into one
  // list, which silently assigns another season's titles and stills.
  return { map, clean: duplicates === 0 && parsed.length === episodeCount && map.size === episodeCount }
}

const normTitle = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Kitsu entries are tied to one season, so they are the reference. AniList is used only as a
 * fallback, and only when it agrees with Kitsu where both have titles (or, with nothing to
 * compare against, when its list is clean).
 */
function aniListTrusted(ani, kitsu) {
  let both = 0
  let same = 0
  for (const [n, a] of ani.map) {
    const k = kitsu.get(n)
    if (!a.title || !k?.title) continue
    both++
    if (normTitle(a.title) === normTitle(k.title)) same++
  }
  return both >= 3 ? same / both >= 0.6 : ani.clean
}

/** The Kitsu record for a MyAnimeList id: { id, attributes } or null. */
async function kitsuAnime(idMal) {
  if (!idMal) return null
  const mapping = await getJson(
    `https://kitsu.io/api/edge/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${idMal}&include=item`,
    `kitsu-map-${idMal}`,
    150,
  )
  return mapping?.included?.find((i) => i.type === 'anime') ?? null
}

async function kitsuEpisodes(kitsuId, episodeCount) {
  const map = new Map()
  if (!kitsuId) return map
  for (let offset = 0; offset < episodeCount; offset += 20) {
    const page = await getJson(
      `https://kitsu.io/api/edge/anime/${kitsuId}/episodes?page[limit]=20&page[offset]=${offset}&sort=number`,
      `kitsu-ep-${kitsuId}-${offset}`,
      150,
    )
    if (!page?.data?.length) break
    for (const e of page.data) {
      const a = e.attributes
      if (!Number.isInteger(a.number) || a.number < 1 || a.number > episodeCount) continue
      const title = a.titles?.en_us || a.titles?.en || a.canonicalTitle || null
      map.set(a.number, {
        title: title && !/^Episode\s+\d+$/i.test(title) ? title : null,
        airdate: a.airdate || null,
        thumb: a.thumbnail?.original || null,
      })
    }
  }
  return map
}

// ---------- Russian text ----------

/** Shikimori descriptions use BB-style tags; keep the words, drop the markup and spoilers. */
function cleanDescription(text) {
  if (!text) return null
  const cleaned = text
    .replace(/\[spoiler[^\]]*\][\s\S]*?\[\/spoiler\]/gi, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[(?:url|character|anime|manga|person|ranobe)[^\]]*\]/gi, '')
    .replace(/\[\/?[a-z*]+(?:=[^\]]*)?\]/gi, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
  return cleaned.length >= 80 ? cleaned : null
}

async function trailerWorks(id) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`)
    return res.ok
  } catch {
    // YouTube unreachable means "not verified", so no trailer button is shown.
    return false
  }
}

// ---------- Main ----------

async function main() {
  for (const dir of ['posters', 'backdrops', 'episodes', 'video', 'subs', 'avatars']) {
    await mkdir(path.join(MEDIA, dir), { recursive: true })
  }
  await mkdir(CACHE, { recursive: true })
  await mkdir(path.dirname(OUT_JSON), { recursive: true })

  const ids = TITLES.flatMap((t) => t.seasons)
  const media = []
  for (let i = 0; i < ids.length; i += 50) {
    const data = await gql(
      `query($ids:[Int]){ Page(perPage:50){ media(id_in:$ids, type:ANIME){
        id idMal title { romaji english native } format episodes duration status season seasonYear averageScore popularity
        coverImage { extraLarge } bannerImage trailer { id site } siteUrl
        studios(isMain:true){ nodes { name } }
        streamingEpisodes { title thumbnail } } } }`,
      { ids: ids.slice(i, i + 50) },
    )
    media.push(...data.Page.media)
  }
  const byId = new Map(media.map((m) => [m.id, m]))
  const missing = ids.filter((id) => !byId.has(id))
  if (missing.length) throw new Error(`AniList ids not found: ${missing.join(', ')}`)

  const out = { fetchedAt: new Date().toISOString().slice(0, 10), titles: {} }
  const stillJobs = []
  const stats = { episodes: 0, titled: 0, dated: 0, distrusted: [] }

  for (const t of TITLES) {
    const first = byId.get(t.seasons[0])
    const kitsuFirst = await kitsuAnime(first.idMal)

    const posterBest = await bestPoster([
      { from: 'Kitsu', url: kitsuFirst?.attributes?.posterImage?.original },
      { from: 'AniList', url: first.coverImage.extraLarge },
    ])
    if (!posterBest) throw new Error(`No poster for ${t.slug}`)
    const poster = await writePoster(posterBest, t.slug)

    // Wide artwork: the Kitsu cover where it was chosen for this title, otherwise the AniList banner.
    const bannerBuf = await download(first.bannerImage, 'banner')
    const coverUrl = t.backdrop === 'kitsu' ? kitsuFirst?.attributes?.coverImage?.original : null
    const coverBuf = coverUrl ? await download(coverUrl, 'cover') : null
    const backdrop = coverBuf
      ? await writeBackdrop(coverBuf, t.slug, coverUrl, 'Kitsu')
      : bannerBuf
        ? await writeBackdrop(bannerBuf, t.slug, first.bannerImage, 'AniList')
        : // A title with no wide artwork at all falls back to its poster so the layout never has a hole.
          await writeBackdrop(posterBest.buf, t.slug, posterBest.url, posterBest.from)
    // Avatar presets are cut from the AniList banner regardless of which backdrop is shown.
    if (bannerBuf) await writeFile(path.join(CACHE, `${t.slug}-banner`), bannerBuf)

    const trailer = first.trailer?.site === 'youtube' && (await trailerWorks(first.trailer.id)) ? first.trailer.id : null
    const shikiRes = first.idMal ? await getJsonViaCurl(`https://shikimori.one/api/animes/${first.idMal}`, `shiki-${first.idMal}`) : null
    const shiki = shikiRes?.json ?? null
    const shikiScore = Number(shiki?.score)

    await mkdir(path.join(MEDIA, 'episodes', t.slug), { recursive: true })
    const seasons = []
    for (const [si, id] of t.seasons.entries()) {
      const m = byId.get(id)
      const count = t.episodes?.[id] ?? m.episodes
      const isMovie = m.format === 'MOVIE'
      const kitsu = isMovie ? null : si === 0 ? kitsuFirst : await kitsuAnime(m.idMal)
      const ani = isMovie ? { map: new Map(), clean: false } : parseStreaming(m.streamingEpisodes, count)
      const fromKitsu = isMovie ? new Map() : await kitsuEpisodes(kitsu?.id, count)
      const trusted = aniListTrusted(ani, fromKitsu)
      if (ani.map.size && !trusted) stats.distrusted.push(`${t.slug} s${si + 1}`)
      const episodes = []
      for (let n = 1; n <= count; n++) {
        const a = trusted ? ani.map.get(n) : undefined
        const k = fromKitsu.get(n)
        const epId = `s${si + 1}e${String(n).padStart(2, '0')}`
        const ep = { n, title: k?.title ?? a?.title ?? null, airdate: k?.airdate ?? null, thumb: false }
        const urls = [k?.thumb, a?.thumb].filter(Boolean)
        if (urls.length) stillJobs.push({ slug: t.slug, epId, urls, ep })
        episodes.push(ep)
        stats.episodes++
        if (ep.title) stats.titled++
        if (ep.airdate) stats.dated++
      }
      seasons.push({
        anilistId: id,
        titleRomaji: m.title.romaji,
        format: m.format,
        duration: m.duration,
        status: m.status,
        season: m.season,
        year: m.seasonYear,
        score: m.averageScore,
        episodes,
      })
    }

    out.titles[t.slug] = {
      anilistUrl: first.siteUrl,
      idMal: first.idMal,
      titleRomaji: first.title.romaji,
      titleEnglish: first.title.english,
      titleNative: first.title.native,
      titleRuShikimori: shiki?.russian ?? null,
      descriptionRu: cleanDescription(shiki?.description),
      shikimoriUrl: shiki?.url ? `${shikiRes.origin}${shiki.url}` : null,
      score: first.averageScore,
      scoreShikimori: Number.isFinite(shikiScore) && shikiScore > 0 ? shikiScore : null,
      // Number of AniList users who have the title in their lists.
      popularity: first.popularity ?? 0,
      studios: [...new Set(t.seasons.flatMap((id) => byId.get(id).studios.nodes.map((s) => s.name)))],
      trailerYoutubeId: trailer,
      trailerCandidate: first.trailer?.site === 'youtube' ? first.trailer.id : null,
      poster,
      backdrop,
      stillSources: {},
      seasons,
    }
    console.log(
      `${t.slug.padEnd(32)} poster ${poster.from} ${poster.srcW}x${poster.srcH}`.padEnd(64) +
        `backdrop ${backdrop.from} ${backdrop.srcW}x${backdrop.srcH}`.padEnd(30) +
        `score AniList ${first.averageScore} / Shikimori ${out.titles[t.slug].scoreShikimori ?? '—'}  pop ${first.popularity}`,
    )
  }

  // Episode stills: take the largest candidate, never upscale, skip ones too small to be worth showing.
  const kept = new Set()
  const widths = {}
  let done = 0
  await pool(stillJobs, 8, async (job) => {
    let best = null
    for (const url of job.urls) {
      const buf = await download(url, 'ep')
      const m = buf && (await meta(buf))
      if (m && (!best || m.width > best.m.width)) best = { url, buf, m }
      // The first candidate is good enough: no need to fetch the fallback.
      if (best && best.m.width >= STILL_WIDTH) break
    }
    if (best && best.m.width >= MIN_STILL_WIDTH) {
      const w = Math.min(STILL_WIDTH, best.m.width, Math.floor((best.m.height * 16) / 9))
      const file = path.join(MEDIA, 'episodes', job.slug, `${job.epId}.webp`)
      try {
        await sharp(best.buf)
          .resize({ width: w, height: Math.round((w * 9) / 16), fit: 'cover' })
          .webp({ quality: 80 })
          .toFile(file)
        job.ep.thumb = true
        kept.add(file)
        widths[w] = (widths[w] ?? 0) + 1
        const host = new URL(best.url).hostname
        const tally = out.titles[job.slug].stillSources
        tally[host] = (tally[host] ?? 0) + 1
      } catch {
        job.ep.thumb = false
      }
    }
    if (++done % 100 === 0) console.log(`  stills ${done}/${stillJobs.length}`)
  })

  // Remove stills that are no longer part of the catalog. Files are replaced in place above,
  // so a running dev server never sees the folder empty.
  for (const dir of await readdir(path.join(MEDIA, 'episodes'), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    for (const name of await readdir(path.join(MEDIA, 'episodes', dir.name))) {
      const file = path.join(MEDIA, 'episodes', dir.name, name)
      if (!kept.has(file)) await rm(file, { force: true })
    }
  }

  console.log(`episodes ${stats.episodes}: titles ${stats.titled}, air dates ${stats.dated}, stills ${kept.size}`)
  console.log(`still widths: ${Object.entries(widths).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w}px×${n}`).join(', ')}`)
  if (stats.distrusted.length) console.log(`AniList episode lists ignored (did not match Kitsu): ${stats.distrusted.join(', ')}`)

  await writeFile(OUT_JSON, JSON.stringify(out) + '\n')

  for (const a of AVATARS) {
    const buf = await readFile(path.join(CACHE, `${a.from}-banner`))
    await sharp(buf)
      .extract({ left: a.left, top: a.top, width: a.size, height: a.size })
      .resize(192, 192)
      .webp({ quality: 84 })
      .toFile(path.join(MEDIA, 'avatars', `${a.id}.webp`))
  }

  for (const v of DEMO_VIDEOS) {
    const target = path.join(MEDIA, 'video', v.file)
    if (!FORCE && (await exists(target))) continue
    const res = await fetch(v.url)
    if (!res.ok) throw new Error(`${res.status} for ${v.url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    // An MP4 starts with a box whose type (bytes 4..8) is "ftyp".
    if (buf.subarray(4, 8).toString('latin1') !== 'ftyp') throw new Error(`${v.file} is not an MP4 container`)
    await writeFile(target, buf)
    console.log(`${v.file} ${(buf.length / 1048576).toFixed(1)} MB`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
