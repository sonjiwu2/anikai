import { readFile, writeFile } from 'node:fs/promises'
import { VIDEO_TITLES } from './video-titles.mjs'
import { matchVideo } from './video-matching.mjs'
import { publicOkVideo } from '../server/ok-video.mjs'
const data = JSON.parse(await readFile(new URL('../src/data/generated/video-sources.json', import.meta.url)))
const { titles } = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url)))
const ids = new Set()
const jobs = data.missing.filter(k => !k.startsWith('death-note/') && !k.startsWith('apothecary-diaries/s1e'))
let index = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (index < jobs.length) {
    const key = jobs[index++]
    const [slug, episode] = key.split('/')
    const [, season, ep] = /s(\d+)e(\d+)/.exec(episode)
    const name = VIDEO_TITLES[slug].names[0]
    const query = VIDEO_TITLES[slug].movie ? name : `${name} ${Number(season)} сезон ${Number(ep)} серия`
    const params = new URLSearchParams({ 'st.cmd': 'anonymVideo', 'st.ft': 'search', 'st.gsq': query, 'st.m': 'SEARCH' })
    try {
      const html = await (await fetch(`https://ok.ru/video/search?${params}`, { signal: AbortSignal.timeout(20_000) })).text()
      for (const m of html.matchAll(/\/video\/(\d{6,17})(?:[/?#"&]|$)/g)) ids.add(m[1])
    } catch { /* Continue independent searches. */ }
    if (index % 30 === 0) console.log(`Search ${index}/${jobs.length}; ${ids.size} candidates`)
  }
}))
index = 0
const candidates = [...ids]
const found = {}
await Promise.all(Array.from({ length: 4 }, async () => {
  while (index < candidates.length) {
    const id = candidates[index++]
    try {
      const { metadata } = await publicOkVideo(id)
      for (const [slug, title] of Object.entries(titles)) {
        const episode = matchVideo(slug, { id: 'a'.repeat(32), title: metadata.movie.title, duration: Number(metadata.movie.duration), author: {name:metadata.compilationTitle ?? ''} }, title)
        const key = `${slug}/${episode}`
        if (!episode || !data.missing.includes(key)) continue
        ;(found[key] ??= []).push({ id, title: metadata.movie.title, duration: Number(metadata.movie.duration), channel:metadata.compilationTitle, album:metadata.compilation, group:metadata.movie.groupId })
      }
    } catch { /* Import only public native uploads. */ }
    if (index % 100 === 0) console.log(`Metadata ${index}/${candidates.length}; ${Object.keys(found).length} episodes`)
  }
}))
await writeFile(new URL('./.cache/ok-missing-found.json', import.meta.url), JSON.stringify(found, null, 2))
console.log(`${Object.keys(found).length} candidate episodes need content review`)
