import { readFile, writeFile } from 'node:fs/promises'
import { VIDEO_TITLES } from './video-titles.mjs'
const catalog = JSON.parse(await readFile(new URL('../src/data/generated/video-sources.json', import.meta.url)))
const jobs = [...new Set(catalog.missing.map(key => key.split('/')[0]))].flatMap(slug => VIDEO_TITLES[slug].names.slice(0, 2).map(name => ({slug, name})))
const ids = new Set(JSON.parse(await readFile(new URL('./.cache/ok-candidates.json', import.meta.url))))
let index = 0
await Promise.all(Array.from({length:3}, async () => {
  while (index < jobs.length) {
    const {slug, name} = jobs[index++]
    const params = new URLSearchParams({'st.cmd':'anonymVideo','st.ft':'search','st.gsq':name,'st.m':'SEARCH'})
    try {
      const response = await fetch(`https://ok.ru/video/search?${params}`, {signal:AbortSignal.timeout(20_000)})
      const html = await response.text()
      await writeFile(new URL(`./.cache/ok-search-${slug}.html`,import.meta.url),html)
      const found = [...new Set([...html.matchAll(/\/video\/(\d{6,17})(?:[/?#"&]|$)/g)].map(m=>m[1]))]
      found.forEach(id=>ids.add(id))
      console.log(slug,response.status,found.length)
    } catch(error) { console.log(slug,error.message) }
  }
}))
await writeFile(new URL('./.cache/ok-candidates.json',import.meta.url),JSON.stringify([...ids],null,2))
console.log(`${ids.size} OK candidates`)
