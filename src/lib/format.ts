/** Russian plural: plural(5, ['серия', 'серии', 'серий']) → 'серий' */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export const EPISODES: [string, string, string] = ['серия', 'серии', 'серий']
export const ANIME_WORD: [string, string, string] = ['аниме', 'аниме', 'аниме']
export const MINUTES: [string, string, string] = ['минута', 'минуты', 'минут']

/** Non-breaking space: keeps a number and its unit on one line. */
const NBSP = ' '

export function count(n: number, forms: [string, string, string]): string {
  return `${n}${NBSP}${plural(n, forms)}`
}

/** 75 → "1:15", 3700 → "1:01:40" */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** "Осталось 12 мин" / "Осталось 40 с" */
export function formatRemaining(position: number, duration: number): string {
  const left = Math.max(0, duration - position)
  if (left < 60) return `Осталось ${Math.max(1, Math.round(left))}${NBSP}с`
  return `Осталось ${Math.round(left / 60)}${NBSP}мин`
}

export function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}${NBSP}мин`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}${NBSP}ч ${m}${NBSP}мин` : `${h}${NBSP}ч`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ---------- Dates ----------

const dtfCache = new Map<string, Intl.DateTimeFormat>()

function dtf(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = timeZone + JSON.stringify(options)
  let f = dtfCache.get(key)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('ru-RU', { ...options, timeZone })
    } catch {
      f = new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'Europe/Moscow' })
    }
    dtfCache.set(key, f)
  }
  return f
}

export function formatClock(iso: string, timeZone: string): string {
  return dtf(timeZone, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** "16 апреля" */
export function formatDayMonth(iso: string | Date, timeZone: string): string {
  return dtf(timeZone, { day: 'numeric', month: 'long' }).format(typeof iso === 'string' ? new Date(iso) : iso)
}

/** "26 марта 2026 г." */
export function formatFullDate(iso: string | Date, timeZone: string): string {
  return dtf(timeZone, { day: 'numeric', month: 'long', year: 'numeric' }).format(typeof iso === 'string' ? new Date(iso) : iso)
}

/** "Среда" */
export function formatWeekday(iso: string | Date, timeZone: string, style: 'long' | 'short' = 'long'): string {
  const text = dtf(timeZone, { weekday: style }).format(typeof iso === 'string' ? new Date(iso) : iso)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Calendar day key "2026-04-16" in the given time zone. */
export function dayKey(date: Date | string, timeZone: string): string {
  const parts = dtf(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    typeof date === 'string' ? new Date(date) : date,
  )
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** "Через 3 ч 12 мин" / "Через 1 д 3 ч" / null when the moment has passed. */
export function formatUntil(iso: string, now: number): string | null {
  const diff = new Date(iso).getTime() - now
  if (diff <= 0) return null
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `Через ${Math.max(1, minutes)}${NBSP}мин`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Через ${hours}${NBSP}ч ${minutes % 60}${NBSP}мин`
  const days = Math.floor(hours / 24)
  return `Через ${days}${NBSP}д ${hours % 24}${NBSP}ч`
}

/** "Сегодня" / "Вчера" / "14 апреля" for history grouping. */
export function formatRelativeDay(iso: string, timeZone: string, now = new Date()): string {
  const key = dayKey(iso, timeZone)
  if (key === dayKey(now, timeZone)) return 'Сегодня'
  if (key === dayKey(new Date(now.getTime() - 86400000), timeZone)) return 'Вчера'
  const sameYear = key.slice(0, 4) === dayKey(now, timeZone).slice(0, 4)
  return dtf(timeZone, sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso),
  )
}

export function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
