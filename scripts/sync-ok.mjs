import { readFile, writeFile } from 'node:fs/promises'
import { publicOkVideo } from '../server/ok-video.mjs'
import { matchVideo } from './video-matching.mjs'
const file = new URL('../src/data/generated/video-sources.json', import.meta.url)
const reviewed = JSON.parse(await readFile(new URL('./ok-videos.json', import.meta.url)))
const ids = reviewed.reviewedIds.filter(id => !reviewed.excludedIds.includes(id))
const { titles } = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url)))
let index = 0
const found = {}
const rejected = {}
let done = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (index < ids.length) {
    const id = ids[index++]
    try {
      const { metadata, url } = await publicOkVideo(id)
      const movie = metadata.movie
      for (const [slug, title] of Object.entries(titles)) {
        const episode = matchVideo(slug, { id: 'a'.repeat(32), title: movie.title, duration: Number(movie.duration), author: { name: metadata.compilationTitle ?? '' } }, title)
        if (!episode) continue
        const key = `${slug}/${episode}`
        const response = await fetch(url, { headers: { Range: 'bytes=0-65535' }, signal: AbortSignal.timeout(20_000) })
        const type = response.headers.get('content-type')
        await response.body?.cancel()
        if (!response.ok || type !== 'video/mp4') throw new Error('No playable MP4')
        found[key] = { provider: 'ok', videoId: id, url: `https://ok.ru/video/${id}`, title: movie.title,
          duration: Number(movie.duration), channel: metadata.compilationTitle ?? 'Одноклассники', height: movie.height,
          playlistUrl: metadata.compilation ? `https://ok.ru${metadata.compilation}` : undefined, verifiedAt: new Date().toISOString() }
      }
    } catch (error) { rejected[error.message] = (rejected[error.message] ?? 0) + 1 }
    if (++done % 50 === 0) console.log(`Checked ${done}/${ids.length}: ${Object.keys(found).length} matched episodes`)
  }
}))
// Read after network checks: the compilation encoder may have finished more files in the meantime.
const data = JSON.parse(await readFile(file))
let added = 0
for (const [key, value] of Object.entries(found)) {
  if (data.sources[key]) continue
  data.sources[key] = value
  added++
}
data.missing = data.missing.filter(key => !data.sources[key])
data.fetchedAt = new Date().toISOString()
await writeFile(file, JSON.stringify(data, null, 2) + '\n')
console.log(`OK: connected ${added}; ${Object.keys(data.sources).length} total, missing ${data.missing.length}`)
console.log('Skipped', rejected)
