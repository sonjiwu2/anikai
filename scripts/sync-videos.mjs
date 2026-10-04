import { readFile, writeFile } from 'node:fs/promises'
import { matchVideo } from './video-matching.mjs'
import { publicPlaybackOptions } from '../server/video-api.mjs'

const catalog = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url), 'utf8'))
const candidates = JSON.parse(await readFile(new URL('./.cache/video-candidates.json', import.meta.url), 'utf8'))
const sourceFile = new URL('../src/data/generated/video-sources.json', import.meta.url)
const local = JSON.parse(await readFile(new URL('../src/data/generated/local-video-sources.json', import.meta.url), 'utf8'))
const previous = JSON.parse(await readFile(sourceFile, 'utf8').catch(() => '{"sources":{}}'))
const sources = {}
const jobs = []
for (const [slug, title] of Object.entries(catalog.titles)) {
  const matches = {}
  for (const video of candidates[slug] ?? []) {
    const episode = matchVideo(slug, video, title)
    if (episode) (matches[episode] ??= []).push(video)
  }
  for (const season of title.seasons.map((s, i) => ({ ...s, number: i + 1 }))) {
    for (const ep of season.episodes) {
      const episodeId = `s${season.number}e${String(ep.n).padStart(2, '0')}`
      jobs.push({ key: `${slug}/${episodeId}`, matches: (matches[episodeId] ?? []).sort((a, b) =>
        Number(b.author?.id === 32420212) - Number(a.author?.id === 32420212)) })
    }
  }
}
let index = 0
let done = 0
const rejected = []
await Promise.all(Array.from({ length: 4 }, async () => {
  while (index < jobs.length) {
    const { key, matches } = jobs[index++]
    for (const video of matches) {
      try {
        const cached = previous.sources[key]
        if (!process.argv.includes('--force') && cached?.videoId === video.id && Date.now() - Date.parse(cached.verifiedAt) < 3_600_000) {
          sources[key] = cached
          break
        }
        const options = await publicPlaybackOptions(video.id)
        // Search titles can be stale. Validate the current metadata against the same identity.
        const slug = key.split('/')[0]
        if (matchVideo(slug, { ...video, title: options.title, duration: options.duration / 1000 }, catalog.titles[slug]) !== key.split('/')[1]) continue
        const response = await fetch(options.video_balancer.m3u8, { signal: AbortSignal.timeout(15_000) })
        const manifest = await response.text()
        if (!response.ok || !manifest.startsWith('#EXTM3U') || /#EXT-X-(?:SESSION-)?KEY:.*METHOD=(?!NONE)/.test(manifest)) throw new Error('HLS unavailable')
        sources[key] = {
          provider: 'rutube', videoId: video.id, url: `https://rutube.ru/video/${video.id}/`,
          title: options.title, duration: options.duration / 1000, channel: video.author?.name ?? 'Rutube',
          channelId: video.author?.id, playlistUrl: video.playlistId ? `https://rutube.ru/plst/${video.playlistId}/` : undefined,
          verifiedAt: new Date().toISOString(),
        }
        break
      } catch (error) { rejected.push({ key, videoId: video.id, reason: error.message }) }
    }
    if (++done % 100 === 0) console.log(`Checked ${done}/${jobs.length}; connected ${Object.keys(sources).length}`)
  }
}))
Object.assign(sources, local.sources)
const missing = jobs.filter(j => !sources[j.key]).map(j => j.key)
const output = { fetchedAt: new Date().toISOString(), channelUrl: 'https://rutube.ru/u/animach/', sources: Object.fromEntries(Object.entries(sources).sort()), missing }
await writeFile(sourceFile, JSON.stringify(output, null, 2) + '\n')
await writeFile(new URL('./.cache/video-rejections.json', import.meta.url), JSON.stringify(rejected, null, 2))
console.log(`Connected ${Object.keys(sources).length}/${jobs.length}; missing ${missing.length}; rejected ${rejected.length}`)
for (const [slug, title] of Object.entries(catalog.titles)) {
  const total = title.seasons.reduce((n, s) => n + s.episodes.length, 0)
  console.log(slug, Object.keys(sources).filter(k => k.startsWith(`${slug}/`)).length, '/', total)
}
