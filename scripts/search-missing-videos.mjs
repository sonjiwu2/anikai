import { readFile, writeFile } from 'node:fs/promises'
import { rutubeJson } from './rutube-api.mjs'
import { VIDEO_TITLES } from './video-titles.mjs'
import { matchVideo } from './video-matching.mjs'

const file = new URL('./.cache/video-candidates.json', import.meta.url)
const candidates = JSON.parse(await readFile(file, 'utf8'))
const { titles } = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url), 'utf8'))
const jobs = []
for (const [slug, title] of Object.entries(titles)) {
  const found = new Set(candidates[slug].map(v => matchVideo(slug, v, title)).filter(Boolean))
  const config = VIDEO_TITLES[slug]
  for (const [index, season] of title.seasons.entries()) {
    const missing = season.episodes.filter(e => !found.has(`s${index + 1}e${String(e.n).padStart(2, '0')}`))
    if (!missing.length) continue
    // Season-specific searches first, then individual episodes. The public search caps at 100 results.
    const queries = config.movie ? [`${config.names[0]} фильм`, `${title.titleEnglish ?? title.titleRomaji} movie`]
      : [`${config.names[0]} ${index + 1} сезон`, ...missing.map(e => `${config.names[0]} ${index + 1} сезон ${e.n} серия`)]
    for (const query of queries) jobs.push({ slug, query })
  }
}
let index = 0
let done = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (index < jobs.length) {
    const { slug, query } = jobs[index++]
    const result = await rutubeJson(`/api/search/video/?query=${encodeURIComponent(query)}`)
    candidates[slug].push(...result.results)
    if (++done % 50 === 0) console.log(`Search: ${done}/${jobs.length}`)
  }
}))
for (const slug of Object.keys(candidates)) candidates[slug] = [...new Map(candidates[slug].map(v => [v.id, v])).values()]
await writeFile(file, JSON.stringify(candidates, null, 2))
console.log(`Completed ${done} searches`)
