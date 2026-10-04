import type { Anime, Episode, OpeningMark, Season, UserSource } from '../types'

const flatCache = new WeakMap<Anime, Episode[]>()

/** Every episode of a title in watch order. */
export function allEpisodes(anime: Anime): Episode[] {
  let flat = flatCache.get(anime)
  if (!flat) {
    flat = anime.seasons.flatMap((s) => s.episodes)
    flatCache.set(anime, flat)
  }
  return flat
}

export interface EpisodeContext {
  episode: Episode
  season: Season
  prev?: Episode
  next?: Episode
}

export function findEpisode(anime: Anime, episodeId: string | undefined): EpisodeContext | undefined {
  if (!episodeId) return undefined
  const flat = allEpisodes(anime)
  const index = flat.findIndex((e) => e.id === episodeId)
  if (index < 0) return undefined
  const episode = flat[index]!
  const season = anime.seasons.find((s) => s.id === episode.seasonId)!
  return { episode, season, prev: flat[index - 1], next: flat[index + 1] }
}

export function episodeTitle(episode: Episode, anime?: Anime): string {
  if (anime?.format === 'movie') return 'Фильм'
  return `Серия ${episode.number}`
}

const sourceKey = (anime: Anime, episode: Episode) => `${anime.id}/${episode.id}`

/** True when the episode can be played: it has a file in the catalog or a video the viewer attached. */
export function isPlayable(anime: Anime, episode: Episode, sources: Record<string, UserSource>): boolean {
  return episode.mediaSources.length > 0 || sourceKey(anime, episode) in sources
}

export const openingKey = {
  episode: (anime: Anime, episode: Episode) => `${anime.id}/${episode.id}`,
  season: (anime: Anime, episode: Episode) => `${anime.id}/${episode.seasonId}/*`,
}

export interface ResolvedOpening extends OpeningMark {
  /** Where the boundaries come from */
  scope: 'catalog' | 'episode' | 'season'
}

/** Opening boundaries for an episode: catalog data first, then the viewer's mark for the episode, then for its season. */
export function resolveOpening(anime: Anime, episode: Episode, openings: Record<string, OpeningMark>): ResolvedOpening | undefined {
  if (episode.openingStart !== undefined && episode.openingEnd !== undefined) {
    return { start: episode.openingStart, end: episode.openingEnd, scope: 'catalog' }
  }
  const own = openings[openingKey.episode(anime, episode)]
  if (own) return { ...own, scope: 'episode' }
  const season = openings[openingKey.season(anime, episode)]
  return season ? { ...season, scope: 'season' } : undefined
}

export function watchPath(anime: Anime, episode: Episode): string {
  return `/watch/${anime.slug}/${episode.id}`
}

/**
 * Episode artwork is the title's backdrop, not a frame from that episode.
 * Sliding the crop by episode number keeps a grid from looking like one repeated image.
 */
export function episodeFocalX(anime: Anime, episode: Episode): number {
  const spread = [0, -22, 22, -38, 38, -12, 12, -30, 30]
  const offset = spread[(episode.number - 1) % spread.length]!
  return Math.min(100, Math.max(0, anime.focalX + offset))
}
