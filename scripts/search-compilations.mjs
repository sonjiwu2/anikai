import { readFile, writeFile } from 'node:fs/promises'
import { rutubeJson } from './rutube-api.mjs'
import { VIDEO_TITLES } from './video-titles.mjs'

const catalog = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url)))
const current = JSON.parse(await readFile(new URL('../src/data/generated/video-sources.json', import.meta.url)))
const missingSlugs = [...new Set(current.missing.map(key => key.split('/')[0]))]
const file = new URL('./.cache/video-candidates.json', import.meta.url)
const candidates = JSON.parse(await readFile(file))
const jobs = missingSlugs.flatMap(slug => {
  const names = [...new Set([...VIDEO_TITLES[slug].names, catalog.titles[slug].titleEnglish, catalog.titles[slug].titleRomaji].filter(Boolean))]
  return names.flatMap(name => ['все серии', '1 сезон', '2 сезон', '3 сезон', '1-12', 'полностью'].map(suffix => ({slug, query:`${name} ${suffix}`})))
})
let index = 0
let done = 0
await Promise.all(Array.from({length:4}, async () => {
  while (index < jobs.length) {
    const {slug, query} = jobs[index++]
    try {
      const result = await rutubeJson(`/api/search/video/?query=${encodeURIComponent(query)}`)
      candidates[slug].push(...result.results)
    } catch (error) { console.log(query, error.message) }
    if (++done % 25 === 0) console.log(`Search ${done}/${jobs.length}`)
  }
}))
for (const slug of missingSlugs) candidates[slug] = [...new Map(candidates[slug].map(v => [v.id,v])).values()]
await writeFile(file, JSON.stringify(candidates,null,2))
const compilations = Object.fromEntries(missingSlugs.map(slug => [slug,candidates[slug].filter(v => v.duration > (VIDEO_TITLES[slug].movie ? 5000 : 3600) && !/реак|пересказ|обзор|разбор|стрим|смотрю|смотрит|recap|reaction|аудиокниг|rpg|летсплей|прохождение/i.test(v.title+' '+v.author?.name))]))
await writeFile(new URL('./.cache/compilations.json',import.meta.url),JSON.stringify(compilations,null,2))
console.log(`Completed ${done} searches`)
for(const [slug,videos] of Object.entries(compilations)) console.log(slug, videos.map(v=>`${v.id} | ${Math.round(v.duration/60)}m | ${v.title}`).join('\n'))
