import { readFile, writeFile } from 'node:fs/promises'
import { VIDEO_TITLES } from './video-titles.mjs'
import { normalize } from './video-matching.mjs'

const base='https://v13.vost.pw'
const data=JSON.parse(await readFile(new URL('../src/data/generated/video-sources.json',import.meta.url)))
const slugs=[...new Set(data.missing.map(k=>k.split('/')[0]))]
const results={}
let index=0
await Promise.all(Array.from({length:3},async()=>{
  while(index<slugs.length){
    const slug=slugs[index++]
    const query=VIDEO_TITLES[slug].names[0]
    try{
      const response=await fetch(base+'/',{method:'POST',body:new URLSearchParams({do:'search',subaction:'search',story:query}),signal:AbortSignal.timeout(20000)})
      if(!response.ok)throw new Error(`HTTP ${response.status}`)
      const html=await response.text()
      await writeFile(new URL(`./.cache/vost-${slug}.html`,import.meta.url),html)
      results[slug]=[...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g)].map(m=>({url:m[1],title:m[2].replace(/<[^>]+>/g,'').trim()})).filter(a=>a.url.includes('/tip/')&&VIDEO_TITLES[slug].names.some(n=>normalize(a.title).includes(normalize(n))))
      results[slug]=[...new Map(results[slug].map(a=>[a.url,a])).values()]
      console.log(slug,JSON.stringify(results[slug]))
    }catch(error){console.log(slug,error.message);results[slug]=[]}
  }
}))
await writeFile(new URL('./.cache/animevost-candidates.json',import.meta.url),JSON.stringify(results,null,2))
