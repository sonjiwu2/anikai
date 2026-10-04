import { readFile, writeFile } from 'node:fs/promises'
import { matchVideo } from './video-matching.mjs'
const candidates = JSON.parse(await readFile(new URL('./.cache/video-candidates.json', import.meta.url), 'utf8'))
const catalog = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url), 'utf8'))
const matches = {}
for (const [slug, videos] of Object.entries(candidates)) {
  matches[slug] = {}
  for (const video of videos) {
    const episode = matchVideo(slug, video, catalog.titles[slug])
    if (episode) (matches[slug][episode] ??= []).push(video)
  }
  console.log(slug, Object.keys(matches[slug]).length, '/', catalog.titles[slug].seasons.reduce((n, s) => n + s.episodes.length, 0))
}
await writeFile(new URL('./.cache/video-matches.json', import.meta.url), JSON.stringify(matches, null, 2))
