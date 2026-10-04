import { writeFile } from 'node:fs/promises'
import { rutubeJson } from './rutube-api.mjs'
import { VIDEO_TITLES } from './video-titles.mjs'

export async function parallel(items, action, concurrency = 4) {
  let index = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const item = items[index++]
      await action(item)
    }
  }))
}

const candidates = {}
await parallel(Object.entries(VIDEO_TITLES), async ([slug, config]) => {
  const videos = []
  for (const playlist of config.playlists ?? (config.playlist ? [config.playlist] : [])) {
    const first = await rutubeJson(`/api/playlist/custom/${playlist}/videos/?page=1`)
    videos.push(...first.results.map(v => ({ ...v, playlistId: playlist })))
    let next = first.has_next ? first.next : null
    let pages = 1
    while (next && pages < (config.maxPages ?? 100)) {
      const result = await rutubeJson(next)
      videos.push(...result.results.map(v => ({ ...v, playlistId: playlist })))
      next = result.has_next ? result.next : null
      pages++
    }
  }
  // Missing playlists may have been removed; search also finds alternative public channels.
  if (!config.playlist || slug === 'demon-slayer') {
    for (const name of config.names.slice(0, 2)) {
      const result = await rutubeJson(`/api/search/video/?query=${encodeURIComponent(name + (config.movie ? ' полный фильм' : ' серия'))}`)
      videos.push(...result.results)
    }
  }
  candidates[slug] = [...new Map(videos.map(v => [v.id, v])).values()]
    .map(v => ({ id: v.id, title: v.title, duration: v.duration, author: v.author, playlistId: v.playlistId,
      is_hidden: v.is_hidden, is_deleted: v.is_deleted, is_paid: v.is_paid, is_locked: v.is_locked, is_licensed: v.is_licensed,
      description: v.description, thumbnail_url: v.thumbnail_url }))
  console.log(slug, candidates[slug].length, candidates[slug].slice(0, 2).map(v => v.title).join(' | '))
})
await writeFile(new URL('./.cache/video-candidates.json', import.meta.url), JSON.stringify(candidates, null, 2))
