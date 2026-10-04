import type { Anime, CollectionStatus, Episode, UserData, UserList, WatchProgress } from '../types'
import { CATALOG, getAnime } from '../data/catalog'
import { allEpisodes } from './episodes'
import { progressKey } from './userData'

type Progress = UserData['progress']

export interface AnimeSummary {
  total: number
  watched: number
  /** Episode to continue with, or to start from; undefined when everything is watched */
  next?: Episode
  nextProgress?: WatchProgress
  /** True once any real playback happened */
  started: boolean
  lastWatchedAt?: string
}

/** Where the viewer is in a title. Derived on demand, never stored. */
export function summarize(anime: Anime, progress: Progress): AnimeSummary {
  const episodes = allEpisodes(anime)
  let watched = 0
  let latestIndex = -1
  let latestAt = ''
  episodes.forEach((ep, i) => {
    const p = progress[progressKey(anime.id, ep.id)]
    if (!p) return
    if (p.completed) watched++
    if (p.watchedAt && p.watchedAt > latestAt) {
      latestAt = p.watchedAt
      latestIndex = i
    }
  })
  const isDone = (ep: Episode) => !!progress[progressKey(anime.id, ep.id)]?.completed

  let next: Episode | undefined
  if (latestIndex >= 0 && !isDone(episodes[latestIndex]!)) {
    next = episodes[latestIndex]
  } else {
    next = episodes.slice(latestIndex + 1).find((ep) => !isDone(ep)) ?? episodes.find((ep) => !isDone(ep))
  }
  return {
    total: episodes.length,
    watched,
    next,
    nextProgress: next ? progress[progressKey(anime.id, next.id)] : undefined,
    started: latestIndex >= 0,
    lastWatchedAt: latestAt || undefined,
  }
}

export interface ContinueItem {
  anime: Anime
  episode: Episode
  progress?: WatchProgress
  lastWatchedAt: string
}

/** One entry per title the viewer actually started and has not finished, most recent first. */
export function continueWatching(progress: Progress): ContinueItem[] {
  const animeIds = new Set<string>()
  for (const p of Object.values(progress)) if (p.watchedAt) animeIds.add(p.animeId)
  const items: ContinueItem[] = []
  for (const id of animeIds) {
    const anime = getAnime(id)
    if (!anime) continue
    const s = summarize(anime, progress)
    if (!s.next || !s.lastWatchedAt) continue
    items.push({ anime, episode: s.next, progress: s.nextProgress, lastWatchedAt: s.lastWatchedAt })
  }
  return items.sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
}

export interface HistoryItem {
  anime: Anime
  episode: Episode
  progress: WatchProgress & { watchedAt: string }
}

export function history(progress: Progress): HistoryItem[] {
  const items: HistoryItem[] = []
  for (const p of Object.values(progress)) {
    if (!p.watchedAt) continue
    const anime = getAnime(p.animeId)
    const episode = anime && allEpisodes(anime).find((e) => e.id === p.episodeId)
    if (anime && episode) items.push({ anime, episode, progress: p as HistoryItem['progress'] })
  }
  return items.sort((a, b) => b.progress.watchedAt.localeCompare(a.progress.watchedAt))
}

export function statusCounts(collection: UserData['collection']): Record<CollectionStatus, number> {
  const counts: Record<CollectionStatus, number> = { watching: 0, planned: 0, completed: 0, paused: 0 }
  for (const entry of Object.values(collection)) if (getAnime(entry.animeId)) counts[entry.status]++
  return counts
}

/** Cover for a list: the chosen title, else the first one in the list. */
export function listCover(list: UserList): Anime | undefined {
  return getAnime(list.coverAnimeId) ?? list.animeIds.map((id) => getAnime(id)).find((a) => !!a)
}

export function watchedEpisodeCount(progress: Progress): number {
  let n = 0
  for (const p of Object.values(progress)) if (p.completed) n++
  return n
}

// ---------- Recommendations ----------

const STATUS_WEIGHT: Record<CollectionStatus, number> = { watching: 3, completed: 2, planned: 1, paused: 1 }

const byRating = (a: Anime, b: Anime) => b.rating - a.rating || a.titleRu.localeCompare(b.titleRu, 'ru')

/** Most watched first: by the number of AniList users who have the title in their lists. */
export function popular(): Anime[] {
  return [...CATALOG].sort((a, b) => b.popularity - a.popularity || byRating(a, b))
}

/**
 * "Для тебя": titles outside the collection ranked by how well their genres match what the viewer
 * collects and favourites. With no signal it is an editorial mix. No machine learning involved.
 */
export function forYou(user: Pick<UserData, 'collection' | 'favorites'>): { items: Anime[]; personalized: boolean } {
  const weights = new Map<string, number>()
  const add = (animeId: string, weight: number) => {
    for (const g of getAnime(animeId)?.genres ?? []) weights.set(g, (weights.get(g) ?? 0) + weight)
  }
  for (const entry of Object.values(user.collection)) add(entry.animeId, STATUS_WEIGHT[entry.status])
  for (const id of user.favorites) add(id, 3)

  const candidates = CATALOG.filter((a) => !user.collection[a.id])
  if (weights.size === 0) return { items: [...candidates].sort(byRating), personalized: false }

  const score = (a: Anime) => a.genres.reduce((sum, g) => sum + (weights.get(g) ?? 0), 0) / Math.sqrt(a.genres.length)
  return {
    items: candidates.map((a) => ({ a, s: score(a) })).sort((x, y) => y.s - x.s || byRating(x.a, y.a)).map((x) => x.a),
    personalized: true,
  }
}

export function similar(anime: Anime, limit = 6): Anime[] {
  const genres = new Set(anime.genres)
  return CATALOG.filter((a) => a.id !== anime.id)
    .map((a) => ({ a, shared: a.genres.filter((g) => genres.has(g)).length }))
    .filter((x) => x.shared > 0)
    .sort((x, y) => y.shared - x.shared || byRating(x.a, y.a))
    .slice(0, limit)
    .map((x) => x.a)
}
