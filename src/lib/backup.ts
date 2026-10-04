import type { UserData } from '../types'
import { todayStamp } from './format'
import { APP_ID, SCHEMA_VERSION, sanitizeUserData } from './userData'

const MAX_BACKUP_BYTES = 2 * 1024 * 1024

interface BackupFile {
  app: typeof APP_ID
  schemaVersion: number
  exportedAt: string
  data: UserData
}

export function downloadBackup(data: UserData): string {
  const file: BackupFile = { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const name = `anikai-backup-${todayStamp()}.json`
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before the URL is released.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}

export type BackupResult =
  | { ok: true; data: UserData; exportedAt?: string; summary: { titles: number; episodes: number; lists: number; notes: number } }
  | { ok: false; error: string }

/** Validates a backup without touching current data. Anything questionable is rejected with a reason. */
export function parseBackup(text: string): BackupResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'Файл больше 2 МБ — это не похоже на резервную копию Anikai.' }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Файл повреждён: это не корректный JSON.' }
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { ok: false, error: 'В файле нет данных Anikai.' }
  }
  const file = json as Record<string, unknown>
  if (file.app !== APP_ID) return { ok: false, error: 'Это не резервная копия Anikai.' }
  if (typeof file.schemaVersion !== 'number') return { ok: false, error: 'В файле не указана версия данных.' }
  if (file.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: 'Копия сделана в более новой версии Anikai и здесь не откроется.' }
  }
  const data = sanitizeUserData(file.data)
  if (!data) return { ok: false, error: 'Структура данных в файле не распознана.' }
  return {
    ok: true,
    data,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : undefined,
    summary: {
      titles: Object.keys(data.collection).length,
      episodes: Object.keys(data.progress).length,
      lists: data.lists.length,
      notes: data.notes.length,
    },
  }
}
