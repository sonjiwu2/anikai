import type { CollectionStatus, UserData, WatchProgress } from '../types'
import { getAnime } from './catalog'
import { allEpisodes } from '../lib/episodes'
import { createDefaultUserData, progressKey } from '../lib/userData'

/**
 * Example collection, loaded only when the viewer explicitly asks for it
 * (Settings → Данные, or the empty state of the collection).
 */

// Length of the demo video; watch positions below are expressed against it.
const DEMO_DURATION = 52

const WATCHING: { id: string; done: number; at: number; hoursAgo: number }[] = [
  { id: 'frieren', done: 5, at: 24, hoursAgo: 2 },
  { id: 'jujutsu-kaisen', done: 9, at: 31, hoursAgo: 26 },
  { id: 'dandadan', done: 3, at: 12, hoursAgo: 50 },
  { id: 'apothecary-diaries', done: 7, at: 40, hoursAgo: 75 },
]
const OTHER: Record<Exclude<CollectionStatus, 'watching'>, string[]> = {
  planned: ['vinland-saga', 'steins-gate', 'cyberpunk-edgerunners', 'made-in-abyss', 'suzume'],
  completed: ['death-note', 'bocchi-the-rock', 'your-name'],
  paused: ['one-piece'],
}

export function buildDemoData(now = Date.now()): UserData {
  const data = createDefaultUserData()
  const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString()

  for (const w of WATCHING) {
    const anime = getAnime(w.id)
    if (!anime) continue
    data.collection[w.id] = { animeId: w.id, status: 'watching', addedAt: iso(w.hoursAgo + 240), updatedAt: iso(w.hoursAgo) }
    const episodes = allEpisodes(anime)
    episodes.slice(0, w.done + 1).forEach((ep, i) => {
      const finished = i < w.done
      const entry: WatchProgress = {
        animeId: w.id,
        episodeId: ep.id,
        position: finished ? DEMO_DURATION : w.at,
        duration: DEMO_DURATION,
        completed: finished,
        watchedAt: iso(w.hoursAgo + (w.done - i) * 24),
      }
      data.progress[progressKey(w.id, ep.id)] = entry
    })
  }

  for (const [status, ids] of Object.entries(OTHER) as [CollectionStatus, string[]][]) {
    ids.forEach((id, i) => {
      const anime = getAnime(id)
      if (!anime) return
      data.collection[id] = { animeId: id, status, addedAt: iso(300 + i * 30), updatedAt: iso(200 + i * 30) }
      if (status === 'completed') {
        for (const ep of allEpisodes(anime)) {
          data.progress[progressKey(id, ep.id)] = { animeId: id, episodeId: ep.id, position: 0, duration: 0, completed: true }
        }
      }
    })
  }

  data.favorites = ['frieren', 'death-note', 'bocchi-the-rock', 'your-name'].filter((id) => getAnime(id))
  data.lists = [
    {
      id: 'demo-cozy',
      title: 'На уютный вечер',
      description: 'Спокойные истории, под которые хорошо выдохнуть.',
      coverAnimeId: 'frieren',
      animeIds: ['frieren', 'bocchi-the-rock', 'apothecary-diaries', 'violet-evergarden', 'spy-family'].filter((id) => getAnime(id)),
      createdAt: iso(500),
      updatedAt: iso(120),
    },
    {
      id: 'demo-friends',
      title: 'Смотреть с друзьями',
      description: '',
      coverAnimeId: 'one-piece',
      animeIds: ['one-piece', 'haikyu', 'dandadan', 'mob-psycho-100'].filter((id) => getAnime(id)),
      createdAt: iso(480),
      updatedAt: iso(90),
    },
  ]
  const frieren = getAnime('frieren')
  const sixth = frieren && allEpisodes(frieren)[5]
  if (frieren && sixth) {
    data.notes = [
      {
        id: 'demo-note-1',
        animeId: frieren.id,
        episodeId: sixth.id,
        time: 14,
        text: 'Пример заметки: нажми на таймкод, чтобы перейти к этому моменту.',
        createdAt: iso(2),
        updatedAt: iso(2),
      },
    ]
  }
  return data
}
