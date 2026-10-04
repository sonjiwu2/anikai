import { readFile, writeFile } from 'node:fs/promises'

// Reviewed API release identities; MAL ids ensure a film/remake cannot replace a TV season.
const releases = [
  { slug: 'steins-gate', season: 1, id: 8674, mal: 9253 },
  { slug: 'mob-psycho-100', season: 2, id: 8033, mal: 37510 },
  { slug: 'tokyo-ghoul', season: 2, id: 433, mal: 27899 },
  { slug: 'demon-slayer', season: 1, id: 8325, mal: 38000 },
  { slug: 'demon-slayer', season: 2, id: 9093, mal: 47778 },
]
const file = new URL('../src/data/generated/video-sources.json', import.meta.url)
const output = JSON.parse(await readFile(file, 'utf8'))
const { titles } = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url), 'utf8'))
let added = 0
for (const config of releases) {
  const response = await fetch(`https://anilibria.top/api/v1/anime/releases/${config.id}`, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`AniLiberty: ${response.status}`)
  const release = await response.json()
  if (release.mal?.id !== config.mal || release.type?.value !== 'TV' || release.is_blocked_by_copyrights !== false || release.is_blocked_by_geo !== false) continue
  const season = titles[config.slug].seasons[config.season - 1]
  for (const episode of release.episodes ?? []) {
    if (!season.episodes.some(e => e.n === episode.ordinal)) continue
    const key = `${config.slug}/s${config.season}e${String(episode.ordinal).padStart(2, '0')}`
    if (output.sources[key] && output.sources[key].provider !== 'aniliberty') continue
    if (episode.duration < season.duration * 60 * 0.7 || episode.duration > season.duration * 60 * 1.6) continue
    const streams = [480, 720, 1080].filter(height => episode[`hls_${height}`])
    if (!streams.length) continue
    for (const height of streams) {
      const url = new URL(episode[`hls_${height}`])
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.libria.fun')) throw new Error('Unexpected stream host')
      const manifest = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      const text = await manifest.text()
      if (!manifest.ok || !text.startsWith('#EXTM3U') || /#EXT-X-(?:SESSION-)?KEY:.*METHOD=(?!NONE)/.test(text)) throw new Error(`Unavailable episode: ${key}`)
    }
    output.sources[key] = { provider: 'aniliberty', videoId: episode.id, releaseId: config.id, episodeNumber: episode.ordinal,
      url: `https://anilibria.top/anime/releases/release/${release.alias}`, title: `${release.name.main} — серия ${episode.ordinal}`,
      duration: episode.duration, channel: 'AniLiberty', verifiedAt: new Date().toISOString() }
    added++
  }
}
output.sources = Object.fromEntries(Object.entries(output.sources).sort())
output.missing = output.missing.filter(key => !output.sources[key])
output.fetchedAt = new Date().toISOString()
await writeFile(file, JSON.stringify(output, null, 2) + '\n')
console.log(`AniLiberty: ${added} episodes; total ${Object.keys(output.sources).length}; missing ${output.missing.length}`)
