import type {
  Avatar,
  CollectionEntry,
  CollectionStatus,
  EpisodeNote,
  OpeningMark,
  UserData,
  UserList,
  UserPreferences,
  UserProfile,
  UserSource,
  WatchProgress,
} from '../types'
import { RUTUBE_ID, VK_ID } from './embeds'

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'anikai:user:v1'
export const APP_ID = 'anikai'

export const AVATAR_PRESETS = [
  { id: 'frieren', label: 'Фрирен' },
  { id: 'anya', label: 'Аня' },
  { id: 'okarun', label: 'Окарун' },
  { id: 'momo', label: 'Момо' },
  { id: 'hinata', label: 'Хината' },
  { id: 'luffy', label: 'Луффи' },
  { id: 'bocchi', label: 'Бочи' },
] as const

export const TIME_ZONES = [
  { id: 'Europe/Kaliningrad', label: 'Калининград (МСК−1)' },
  { id: 'Europe/Moscow', label: 'Москва (МСК)' },
  { id: 'Europe/Samara', label: 'Самара (МСК+1)' },
  { id: 'Asia/Yekaterinburg', label: 'Екатеринбург (МСК+2)' },
  { id: 'Asia/Novosibirsk', label: 'Новосибирск (МСК+4)' },
  { id: 'Asia/Vladivostok', label: 'Владивосток (МСК+7)' },
] as const

export const STATUSES: CollectionStatus[] = ['watching', 'planned', 'completed', 'paused']
export const STATUS_TITLES: Record<CollectionStatus, string> = {
  watching: 'Смотрю',
  planned: 'В планах',
  completed: 'Просмотрено',
  paused: 'Отложено',
}

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export const DEFAULT_PREFERENCES: UserPreferences = {
  autoNext: true,
  autoSkipOpening: false,
  saveProgress: true,
  preferredQuality: 0,
  subtitles: false,
  playbackRate: 1,
  volume: 1,
  muted: false,
  density: 'comfortable',
  reduceMotion: false,
  timeZone: 'Europe/Moscow',
}

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Dmitriy',
  bio: 'Хорошая история — и ещё одна серия перед сном.',
  avatar: { kind: 'preset', id: 'frieren' },
}

export function createDefaultUserData(): UserData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { ...DEFAULT_PROFILE },
    preferences: { ...DEFAULT_PREFERENCES },
    collection: {},
    progress: {},
    lists: [],
    notes: [],
    favorites: [],
    sources: {},
    openings: {},
  }
}

export const progressKey = (animeId: string, episodeId: string) => `${animeId}/${episodeId}`

// ---------- Validation ----------

const LIMITS = { lists: 200, notes: 5000, sources: 5000, text: 2000, title: 80, bio: 200, avatarChars: 120_000 }

/** An opening longer than this is almost certainly a mistake in marking. */
export const MAX_OPENING_SECONDS = 600

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isId = (v: unknown): v is string => isStr(v) && v.length > 0 && v.length <= 120
const isDate = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v))

function sanitizeAvatar(v: unknown): Avatar {
  if (isObj(v)) {
    if (v.kind === 'preset' && AVATAR_PRESETS.some((p) => p.id === v.id)) return { kind: 'preset', id: v.id as string }
    if (
      v.kind === 'custom' &&
      isStr(v.dataUrl) &&
      v.dataUrl.length <= LIMITS.avatarChars &&
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.dataUrl)
    ) {
      return { kind: 'custom', dataUrl: v.dataUrl }
    }
  }
  return { ...DEFAULT_PROFILE.avatar }
}

function sanitizeProfile(v: unknown): UserProfile {
  if (!isObj(v)) return { ...DEFAULT_PROFILE }
  return {
    name: isStr(v.name) && v.name.trim() ? v.name.trim().slice(0, 40) : DEFAULT_PROFILE.name,
    bio: isStr(v.bio) ? v.bio.slice(0, LIMITS.bio) : '',
    avatar: sanitizeAvatar(v.avatar),
  }
}

function sanitizePreferences(v: unknown): UserPreferences {
  const d = DEFAULT_PREFERENCES
  if (!isObj(v)) return { ...d }
  const bool = (key: keyof UserPreferences) => (isBool(v[key]) ? (v[key] as boolean) : (d[key] as boolean))
  return {
    autoNext: bool('autoNext'),
    autoSkipOpening: bool('autoSkipOpening'),
    saveProgress: bool('saveProgress'),
    preferredQuality: isNum(v.preferredQuality) && v.preferredQuality >= 0 ? Math.round(v.preferredQuality) : d.preferredQuality,
    subtitles: bool('subtitles'),
    playbackRate: isNum(v.playbackRate) && PLAYBACK_RATES.includes(v.playbackRate) ? v.playbackRate : d.playbackRate,
    volume: isNum(v.volume) ? Math.min(1, Math.max(0, v.volume)) : d.volume,
    muted: bool('muted'),
    density: v.density === 'compact' ? 'compact' : 'comfortable',
    reduceMotion: bool('reduceMotion'),
    timeZone: isStr(v.timeZone) && TIME_ZONES.some((z) => z.id === v.timeZone) ? v.timeZone : d.timeZone,
  }
}

function sanitizeCollection(v: unknown): Record<string, CollectionEntry> {
  const out: Record<string, CollectionEntry> = {}
  if (!isObj(v)) return out
  for (const [key, e] of Object.entries(v)) {
    if (!isObj(e) || !isId(e.animeId) || e.animeId !== key) continue
    if (!STATUSES.includes(e.status as CollectionStatus) || !isDate(e.addedAt)) continue
    out[key] = {
      animeId: e.animeId,
      status: e.status as CollectionStatus,
      addedAt: e.addedAt,
      updatedAt: isDate(e.updatedAt) ? e.updatedAt : e.addedAt,
    }
  }
  return out
}

function sanitizeProgress(v: unknown): Record<string, WatchProgress> {
  const out: Record<string, WatchProgress> = {}
  if (!isObj(v)) return out
  for (const e of Object.values(v)) {
    if (!isObj(e) || !isId(e.animeId) || !isId(e.episodeId)) continue
    if (!isNum(e.position) || !isNum(e.duration) || !isBool(e.completed)) continue
    const duration = Math.max(0, e.duration)
    out[progressKey(e.animeId, e.episodeId)] = {
      animeId: e.animeId,
      episodeId: e.episodeId,
      position: Math.min(Math.max(0, e.position), duration || Math.max(0, e.position)),
      duration,
      completed: e.completed,
      ...(isDate(e.watchedAt) ? { watchedAt: e.watchedAt } : {}),
    }
  }
  return out
}

function sanitizeLists(v: unknown): UserList[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: UserList[] = []
  for (const e of v.slice(0, LIMITS.lists)) {
    if (!isObj(e) || !isId(e.id) || seen.has(e.id) || !isStr(e.title) || !e.title.trim()) continue
    seen.add(e.id)
    const now = new Date().toISOString()
    out.push({
      id: e.id,
      title: e.title.trim().slice(0, LIMITS.title),
      description: isStr(e.description) ? e.description.slice(0, 300) : '',
      ...(isId(e.coverAnimeId) ? { coverAnimeId: e.coverAnimeId } : {}),
      animeIds: Array.isArray(e.animeIds) ? [...new Set(e.animeIds.filter(isId))] : [],
      createdAt: isDate(e.createdAt) ? e.createdAt : now,
      updatedAt: isDate(e.updatedAt) ? e.updatedAt : now,
    })
  }
  return out
}

function sanitizeNotes(v: unknown): EpisodeNote[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: EpisodeNote[] = []
  for (const e of v.slice(0, LIMITS.notes)) {
    if (!isObj(e) || !isId(e.id) || seen.has(e.id) || !isId(e.animeId) || !isId(e.episodeId)) continue
    if (!isStr(e.text) || !e.text.trim() || !isNum(e.time) || !isDate(e.createdAt)) continue
    seen.add(e.id)
    out.push({
      id: e.id,
      animeId: e.animeId,
      episodeId: e.episodeId,
      time: Math.max(0, e.time),
      text: e.text.slice(0, LIMITS.text),
      createdAt: e.createdAt,
      updatedAt: isDate(e.updatedAt) ? e.updatedAt : e.createdAt,
    })
  }
  return out
}

function sanitizeSources(v: unknown): Record<string, UserSource> {
  const out: Record<string, UserSource> = {}
  if (!isObj(v)) return out
  for (const [key, e] of Object.entries(v).slice(0, LIMITS.sources)) {
    if (!isObj(e) || !isId(key) || !isStr(e.videoId) || !isStr(e.url) || e.url.length > 300) continue
    // Ids are checked against the exact shape each platform uses: they end up inside an iframe address.
    const valid = (e.provider === 'rutube' && RUTUBE_ID.test(e.videoId)) || (e.provider === 'vk' && VK_ID.test(e.videoId))
    if (!valid || !/^https:\/\//.test(e.url)) continue
    out[key] = {
      provider: e.provider as UserSource['provider'],
      videoId: e.videoId,
      ...(isStr(e.hash) && /^[a-f0-9]{8,32}$/.test(e.hash) ? { hash: e.hash } : {}),
      url: e.url,
      addedAt: isDate(e.addedAt) ? e.addedAt : new Date().toISOString(),
    }
  }
  return out
}

function sanitizeOpenings(v: unknown): Record<string, OpeningMark> {
  const out: Record<string, OpeningMark> = {}
  if (!isObj(v)) return out
  for (const [key, e] of Object.entries(v).slice(0, LIMITS.sources)) {
    if (!isObj(e) || !isId(key) || !isNum(e.start) || !isNum(e.end)) continue
    if (e.start < 0 || e.end <= e.start || e.end - e.start > MAX_OPENING_SECONDS) continue
    out[key] = { start: e.start, end: e.end }
  }
  return out
}

/** Upgrades older payloads step by step. Add a case per released schema version. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> | null {
  const version = raw.schemaVersion
  if (version === SCHEMA_VERSION) return raw
  // No earlier public versions exist yet; unknown or newer versions are rejected rather than guessed at.
  return null
}

/**
 * Turns untrusted input into valid UserData. Returns null when the payload is not Anikai data at all
 * (wrong type, unsupported version, or a top-level field of the wrong kind). Broken inner entries are dropped.
 */
export function sanitizeUserData(input: unknown): UserData | null {
  if (!isObj(input)) return null
  const raw = migrate(input)
  if (!raw) return null
  const containers: [string, (v: unknown) => boolean][] = [
    ['collection', isObj],
    ['progress', isObj],
    ['lists', Array.isArray],
    ['notes', Array.isArray],
    ['favorites', Array.isArray],
    ['sources', isObj],
    ['openings', isObj],
  ]
  for (const [key, check] of containers) {
    if (raw[key] !== undefined && !check(raw[key])) return null
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: sanitizeProfile(raw.profile),
    preferences: sanitizePreferences(raw.preferences),
    collection: sanitizeCollection(raw.collection),
    progress: sanitizeProgress(raw.progress),
    lists: sanitizeLists(raw.lists),
    notes: sanitizeNotes(raw.notes),
    favorites: Array.isArray(raw.favorites) ? [...new Set(raw.favorites.filter(isId))] : [],
    // Both were added after the first release; data saved before that simply has none.
    sources: sanitizeSources(raw.sources),
    openings: sanitizeOpenings(raw.openings),
  }
}
