// ---------- Catalog ----------

export type AnimeFormat = 'tv' | 'movie' | 'ona'
export type ReleaseStatus = 'finished' | 'ongoing'

export interface MediaSource {
  src: string
  /** MIME type, e.g. video/mp4 */
  type: string
  /** Human label shown in the quality menu, e.g. "720p" */
  label: string
  /** Vertical resolution, used to order and pick qualities */
  height: number
  /** True when the file is a stand-in, not the real episode */
  isDemo: boolean
}

export interface SubtitleTrack {
  src: string
  lang: string
  label: string
  isDemo: boolean
}

export interface Episode {
  /** Unique within the anime, e.g. "s1e06" */
  id: string
  number: number
  seasonId: string
  /** Official title from the catalog source (English); when absent the UI shows only "Серия N" */
  title?: string
  /** Scheduled runtime in minutes from the catalog source */
  durationMin?: number
  /** First air date, "YYYY-MM-DD" */
  airDate?: string
  /** A real still of this episode; when absent the title's backdrop is used */
  thumbnail?: string
  mediaSources: MediaSource[]
  subtitleTracks: SubtitleTrack[]
  /** Verified public episode, played with Anikai's own controls. */
  catalogSource?: CatalogVideoSource
  /** Seconds. The skip-opening control appears only when both are set */
  openingStart?: number
  openingEnd?: number
}

export interface CatalogVideoSource {
  provider: 'rutube' | 'aniliberty' | 'local' | 'ok'
  videoId: string
  releaseId?: number
  episodeNumber?: number
  url: string
  title: string
  duration: number
  channel: string
  channelId?: number
  playlistUrl?: string
  /** An independent episode file, with its own duration and timestamps from zero. */
  fileUrl?: string
  height?: number
  cutStart?: number
  cutEnd?: number
  verifiedAt: string
}

export interface Season {
  id: string
  number: number
  title: string
  year: number
  episodes: Episode[]
}

export interface Anime {
  id: string
  slug: string
  titleRu: string
  titleEn: string
  titleOriginal: string
  aliases: string[]
  /** One line for the hero */
  tagline: string
  /** Short editorial summary, one or two sentences */
  synopsis: string
  /** Full description for the "Об аниме" tab */
  description: string
  /** Where the full description comes from, when it is not editorial */
  descriptionSource?: { label: string; url: string }
  genres: string[]
  studios: string[]
  year: number
  format: AnimeFormat
  releaseStatus: ReleaseStatus
  /** Headline score on a 10-point scale, as of the catalog build date; 0 when unknown */
  rating: number
  /** Service the headline score comes from */
  ratingSource: 'Shikimori' | 'AniList'
  ratingShikimori?: number
  ratingAniList: number
  /** Page on the rating service */
  ratingUrl: string
  /** Number of AniList users who have the title in their lists */
  popularity: number
  poster: string
  posterSm: string
  /** Pixel width of the full-size poster file (up to 600), for srcset */
  posterWidth: number
  backdrop: string
  backdropSm: string
  /** width / height of the backdrop file */
  backdropRatio: number
  /** Horizontal focal point of the backdrop, 0–100 */
  focalX: number
  /** Vertical focal point of the backdrop, 0–100 */
  focalY: number
  seasons: Season[]
  /** Present only when the link was verified at build time */
  trailerUrl?: string
  sourceUrl: string
  /** Extra note about what the catalog covers, e.g. a partial saga */
  catalogNote?: string
}

// ---------- User data ----------

export type CollectionStatus = 'watching' | 'planned' | 'completed' | 'paused'

export interface CollectionEntry {
  animeId: string
  status: CollectionStatus
  addedAt: string
  updatedAt: string
}

export interface WatchProgress {
  animeId: string
  episodeId: string
  /** Seconds */
  position: number
  /** Seconds, taken from the real media */
  duration: number
  completed: boolean
  /** Set by real playback only; drives history. Manual "mark watched" leaves it empty */
  watchedAt?: string
}

export interface UserList {
  id: string
  title: string
  description: string
  /** Anime whose backdrop is used as the list cover */
  coverAnimeId?: string
  animeIds: string[]
  createdAt: string
  updatedAt: string
}

export interface EpisodeNote {
  id: string
  animeId: string
  episodeId: string
  /** Seconds */
  time: number
  text: string
  createdAt: string
  updatedAt: string
}

export type EmbedProvider = 'rutube' | 'vk'

/** A video on an external platform that the viewer attached to an episode. It plays in that platform's own embed player. */
export interface UserSource {
  provider: EmbedProvider
  /** Rutube: 32-character id. VK: "<ownerId>_<videoId>" */
  videoId: string
  /** Access hash some VK videos need for embedding */
  hash?: string
  /** The link the viewer pasted, for "open on the platform" */
  url: string
  addedAt: string
}

/** Opening boundaries in seconds, marked by the viewer */
export interface OpeningMark {
  start: number
  end: number
}

export type Avatar = { kind: 'preset'; id: string } | { kind: 'custom'; dataUrl: string }

export interface UserProfile {
  name: string
  bio: string
  avatar: Avatar
}

export interface UserPreferences {
  autoNext: boolean
  autoSkipOpening: boolean
  saveProgress: boolean
  /** 0 = best available, otherwise a maximum height such as 480 */
  preferredQuality: number
  subtitles: boolean
  playbackRate: number
  volume: number
  muted: boolean
  density: 'comfortable' | 'compact'
  reduceMotion: boolean
  timeZone: string
}

export interface UserData {
  schemaVersion: 1
  profile: UserProfile
  preferences: UserPreferences
  collection: Record<string, CollectionEntry>
  /** Keyed by `${animeId}/${episodeId}` */
  progress: Record<string, WatchProgress>
  lists: UserList[]
  notes: EpisodeNote[]
  favorites: string[]
  /** Attached videos, keyed by `${animeId}/${episodeId}` */
  sources: Record<string, UserSource>
  /** Opening marks, keyed by `${animeId}/${episodeId}` for one episode or `${animeId}/${seasonId}/*` for a season */
  openings: Record<string, OpeningMark>
}
