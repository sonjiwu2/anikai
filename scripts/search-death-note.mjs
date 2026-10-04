import { readFile, writeFile } from 'node:fs/promises'
import { publicOkVideo } from '../server/ok-video.mjs'
import { matchVideo } from './video-matching.mjs'
const ids = new Set(['813059803721', '812701125193', '812702108233'])
const data = JSON.parse(await readFile(new URL('../src/data/generated/video-sources.json', import.meta.url)))
const missing = data.missing.filter(k => k.startsWith('death-note/'))
await Promise.all(missing.map(async key => {
  const n = Number(key.split('e').at(-1))
  const params = new URLSearchParams({ 'st.cmd': 'anonymVideo', 'st.ft': 'search', 'st.gsq': `Тетрадь смерти ${n} серия`, 'st.m': 'SEARCH' })
  const html = await (await fetch(`https://ok.ru/video/search?${params}`, { signal: AbortSignal.timeout(20_000) })).text()
  for (const match of html.matchAll(/\/video\/(\d{6,17})(?:[/?#"&]|$)/g)) ids.add(match[1])
}))
const reviewedFile = new URL('./ok-videos.json', import.meta.url)
const reviewed = JSON.parse(await readFile(reviewedFile))
const title = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url))).titles['death-note']
for (const id of ids) {
  try {
    const { metadata, url } = await publicOkVideo(id)
    const movie = metadata.movie
    const ep = matchVideo('death-note', { id: 'a'.repeat(32), title: movie.title, duration: Number(movie.duration) }, title)
    if (!ep || !missing.includes(`death-note/${ep}`)) continue
    const response = await fetch(url, { headers: { Range: 'bytes=0-4095' }, signal: AbortSignal.timeout(20_000) })
    await response.body?.cancel()
    if (!response.ok || response.headers.get('content-type') !== 'video/mp4') continue
    if (!reviewed.reviewedIds.includes(id)) reviewed.reviewedIds.push(id)
    console.log(id, ep, movie.title)
  } catch { /* Closed and external players cannot be imported. */ }
}
await writeFile(reviewedFile, JSON.stringify(reviewed, null, 2) + '\n')
