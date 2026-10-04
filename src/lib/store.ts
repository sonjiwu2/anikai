import { useSyncExternalStore } from 'react'
import type {
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
import { getAnime } from '../data/catalog'
import { allEpisodes } from './episodes'
import { uid } from './format'
import { STORAGE_KEY, createDefaultUserData, progressKey, sanitizeUserData } from './userData'

// ---------- Persistence ----------

export type PersistenceStatus = 'ok' | 'unavailable' | 'quota' | 'corrupt-recovered'

let persistence: PersistenceStatus = 'ok'

function readStorage(): UserData {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    persistence = 'unavailable'
    return createDefaultUserData()
  }
  if (raw === null) return createDefaultUserData()
  try {
    const data = sanitizeUserData(JSON.parse(raw))
    if (data) return data
  } catch {
    // fall through to recovery
  }
  // Unreadable payload: keep a copy so nothing is silently destroyed, then start clean.
  try {
    localStorage.setItem(`${STORAGE_KEY}:corrupt`, raw)
  } catch {
    // nothing else we can do
  }
  persistence = 'corrupt-recovered'
  return createDefaultUserData()
}

let state: UserData = readStorage()
const listeners = new Set<() => void>()
let saveTimer: number | undefined

function writeStorage(): void {
  saveTimer = undefined
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    if (persistence === 'quota' || persistence === 'unavailable') setPersistence('ok')
  } catch (error) {
    const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)
    setPersistence(quota ? 'quota' : 'unavailable')
  }
}

function setPersistence(next: PersistenceStatus): void {
  if (persistence === next) return
  persistence = next
  listeners.forEach((l) => l())
}

/** Writes are batched: many commits in one tick cause a single storage write. */
function scheduleSave(): void {
  if (saveTimer !== undefined) return
  saveTimer = window.setTimeout(writeStorage, 150)
}

export function flushStorage(): void {
  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer)
    writeStorage()
  }
}

function commit(next: UserData): void {
  if (next === state) return
  state = next
  scheduleSave()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushStorage)
  // Another tab changed the data: adopt it without writing it back.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    let next: UserData | null
    try {
      next = event.newValue === null ? createDefaultUserData() : sanitizeUserData(JSON.parse(event.newValue))
    } catch {
      next = null
    }
    if (next) {
      state = next
      listeners.forEach((l) => l())
    }
  })
}

// ---------- Hooks ----------

/** Subscribe to a slice. The selector must return a stable reference for unchanged state. */
export function useUser<T>(selector: (data: UserData) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export function usePersistenceStatus(): PersistenceStatus {
  return useSyncExternalStore(subscribe, () => persistence)
}

export function getUserData(): UserData {
  return state
}

export function acknowledgeRecovery(): void {
  if (persistence === 'corrupt-recovered') setPersistence('ok')
}

// ---------- Actions ----------

const now = () => new Date().toISOString()

function withCompletedEpisodes(progress: UserData['progress'], animeId: string): UserData['progress'] {
  const anime = getAnime(animeId)
  if (!anime) return progress
  const next = { ...progress }
  for (const ep of allEpisodes(anime)) {
    const key = progressKey(animeId, ep.id)
    const existing = next[key]
    if (existing?.completed) continue
    // Position, duration and watchedAt are kept, so undoing "completed" loses nothing.
    next[key] = existing
      ? { ...existing, completed: true }
      : { animeId, episodeId: ep.id, position: 0, duration: 0, completed: true }
  }
  return next
}

function isFullyWatched(progress: UserData['progress'], animeId: string): boolean {
  const anime = getAnime(animeId)
  return !!anime && allEpisodes(anime).every((ep) => progress[progressKey(animeId, ep.id)]?.completed)
}

function entryWith(collection: UserData['collection'], animeId: string, status: CollectionStatus): UserData['collection'] {
  const existing = collection[animeId]
  const stamp = now()
  return {
    ...collection,
    [animeId]: existing ? { ...existing, status, updatedAt: stamp } : { animeId, status, addedAt: stamp, updatedAt: stamp },
  }
}

export const actions = {
  setStatus(animeId: string, status: CollectionStatus): void {
    if (state.collection[animeId]?.status === status) return
    commit({
      ...state,
      collection: entryWith(state.collection, animeId, status),
      progress: status === 'completed' ? withCompletedEpisodes(state.progress, animeId) : state.progress,
    })
  },

  removeFromCollection(animeId: string): CollectionEntry | undefined {
    const entry = state.collection[animeId]
    if (!entry) return undefined
    const collection = { ...state.collection }
    delete collection[animeId]
    commit({ ...state, collection })
    return entry
  },

  restoreEntry(entry: CollectionEntry): void {
    commit({ ...state, collection: { ...state.collection, [entry.animeId]: entry } })
  },

  toggleFavorite(animeId: string): boolean {
    const has = state.favorites.includes(animeId)
    commit({ ...state, favorites: has ? state.favorites.filter((id) => id !== animeId) : [animeId, ...state.favorites] })
    return !has
  },

  /** Called by the player. `completed` is sticky: re-watching never un-completes an episode. */
  savePlayback(animeId: string, episodeId: string, position: number, duration: number, completed: boolean): void {
    const key = progressKey(animeId, episodeId)
    const prev = state.progress[key]
    const entry: WatchProgress = {
      animeId,
      episodeId,
      position,
      duration,
      completed: completed || !!prev?.completed,
      watchedAt: now(),
    }
    const progress = { ...state.progress, [key]: entry }
    let collection = state.collection
    const status = collection[animeId]?.status
    if (entry.completed && !prev?.completed && isFullyWatched(progress, animeId)) {
      collection = entryWith(collection, animeId, 'completed')
    } else if (status === undefined || status === 'planned') {
      // Starting to watch puts the title into "Смотрю".
      collection = entryWith(collection, animeId, 'watching')
    }
    commit({ ...state, progress, collection })
  },

  setEpisodeWatched(animeId: string, episodeId: string, watched: boolean): void {
    const key = progressKey(animeId, episodeId)
    const prev = state.progress[key]
    if (!!prev?.completed === watched) return
    const entry: WatchProgress = prev
      ? { ...prev, completed: watched }
      : { animeId, episodeId, position: 0, duration: 0, completed: watched }
    commit({ ...state, progress: { ...state.progress, [key]: entry } })
  },

  removeProgress(animeId: string, episodeId: string): WatchProgress | undefined {
    const key = progressKey(animeId, episodeId)
    const prev = state.progress[key]
    if (!prev) return undefined
    const progress = { ...state.progress }
    delete progress[key]
    commit({ ...state, progress })
    return prev
  },

  restoreProgress(entry: WatchProgress): void {
    commit({ ...state, progress: { ...state.progress, [progressKey(entry.animeId, entry.episodeId)]: entry } })
  },

  clearHistory(): void {
    commit({ ...state, progress: {} })
  },

  createList(input: { title: string; description: string; coverAnimeId?: string; animeIds?: string[] }): UserList {
    const stamp = now()
    const list: UserList = {
      id: uid(),
      title: input.title.trim(),
      description: input.description.trim(),
      coverAnimeId: input.coverAnimeId,
      animeIds: input.animeIds ?? [],
      createdAt: stamp,
      updatedAt: stamp,
    }
    commit({ ...state, lists: [...state.lists, list] })
    return list
  },

  updateList(id: string, patch: Partial<Pick<UserList, 'title' | 'description' | 'coverAnimeId'>>): void {
    commit({
      ...state,
      lists: state.lists.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: now() } : l)),
    })
  },

  deleteList(id: string): UserList | undefined {
    const list = state.lists.find((l) => l.id === id)
    if (!list) return undefined
    commit({ ...state, lists: state.lists.filter((l) => l.id !== id) })
    return list
  },

  restoreList(list: UserList): void {
    if (state.lists.some((l) => l.id === list.id)) return
    commit({ ...state, lists: [...state.lists, list] })
  },

  setInList(listId: string, animeId: string, inList: boolean): void {
    commit({
      ...state,
      lists: state.lists.map((l) => {
        if (l.id !== listId || l.animeIds.includes(animeId) === inList) return l
        const animeIds = inList ? [...l.animeIds, animeId] : l.animeIds.filter((id) => id !== animeId)
        // A removed cover falls back to the first remaining title.
        const coverAnimeId = l.coverAnimeId && animeIds.includes(l.coverAnimeId) ? l.coverAnimeId : undefined
        return { ...l, animeIds, coverAnimeId: coverAnimeId ?? l.coverAnimeId, updatedAt: now() }
      }),
    })
  },

  addNote(animeId: string, episodeId: string, time: number, text: string): EpisodeNote {
    const stamp = now()
    const note: EpisodeNote = { id: uid(), animeId, episodeId, time, text: text.trim(), createdAt: stamp, updatedAt: stamp }
    commit({ ...state, notes: [...state.notes, note] })
    return note
  },

  updateNote(id: string, text: string): void {
    commit({ ...state, notes: state.notes.map((n) => (n.id === id ? { ...n, text: text.trim(), updatedAt: now() } : n)) })
  },

  deleteNote(id: string): EpisodeNote | undefined {
    const note = state.notes.find((n) => n.id === id)
    if (!note) return undefined
    commit({ ...state, notes: state.notes.filter((n) => n.id !== id) })
    return note
  },

  restoreNote(note: EpisodeNote): void {
    if (state.notes.some((n) => n.id === note.id)) return
    commit({ ...state, notes: [...state.notes, note] })
  },

  /** Attach platform videos to episodes. Each entry replaces whatever that episode had. */
  setSources(entries: { animeId: string; episodeId: string; source: Omit<UserSource, 'addedAt'> }[]): void {
    if (!entries.length) return
    const stamp = now()
    const sources = { ...state.sources }
    for (const e of entries) sources[progressKey(e.animeId, e.episodeId)] = { ...e.source, addedAt: stamp }
    commit({ ...state, sources })
  },

  removeSource(animeId: string, episodeId: string): UserSource | undefined {
    const key = progressKey(animeId, episodeId)
    const prev = state.sources[key]
    if (!prev) return undefined
    const sources = { ...state.sources }
    delete sources[key]
    commit({ ...state, sources })
    return prev
  },

  restoreSource(animeId: string, episodeId: string, source: UserSource): void {
    commit({ ...state, sources: { ...state.sources, [progressKey(animeId, episodeId)]: source } })
  },

  removeAllSources(): void {
    commit({ ...state, sources: {} })
  },

  /** `key` comes from openingKey(); pass null to remove the mark. */
  setOpening(key: string, mark: OpeningMark | null): void {
    const openings = { ...state.openings }
    if (mark) openings[key] = mark
    else delete openings[key]
    commit({ ...state, openings })
  },

  updateProfile(patch: Partial<UserProfile>): void {
    commit({ ...state, profile: { ...state.profile, ...patch } })
  },

  setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    if (state.preferences[key] === value) return
    commit({ ...state, preferences: { ...state.preferences, [key]: value } })
  },

  replaceAll(data: UserData): void {
    commit(data)
  },

  /** Adds imported data to the current data. On conflicts the more recent record wins; profile and settings stay. */
  merge(incoming: UserData): void {
    const collection = { ...state.collection }
    for (const [id, entry] of Object.entries(incoming.collection)) {
      const mine = collection[id]
      if (!mine || entry.updatedAt > mine.updatedAt) collection[id] = entry
    }
    const progress = { ...state.progress }
    for (const [key, entry] of Object.entries(incoming.progress)) {
      const mine = progress[key]
      if (!mine) progress[key] = entry
      else if ((entry.watchedAt ?? '') > (mine.watchedAt ?? '')) progress[key] = { ...entry, completed: entry.completed || mine.completed }
      else if (entry.completed && !mine.completed) progress[key] = { ...mine, completed: true }
    }
    const byId = <T extends { id: string; updatedAt: string }>(mine: T[], theirs: T[]): T[] => {
      const map = new Map(mine.map((x) => [x.id, x]))
      for (const x of theirs) {
        const own = map.get(x.id)
        if (!own || x.updatedAt > own.updatedAt) map.set(x.id, x)
      }
      return [...map.values()]
    }
    commit({
      ...state,
      collection,
      progress,
      lists: byId(state.lists, incoming.lists),
      notes: byId(state.notes, incoming.notes),
      favorites: [...new Set([...state.favorites, ...incoming.favorites])],
      // What is already attached or marked here wins; the import only fills the gaps.
      sources: { ...incoming.sources, ...state.sources },
      openings: { ...incoming.openings, ...state.openings },
    })
  },

  reset(): void {
    commit(createDefaultUserData())
  },
}
