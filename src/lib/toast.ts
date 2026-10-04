import { useSyncExternalStore } from 'react'

export interface ToastItem {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
  tone: 'info' | 'error'
}

const LIFETIME_MS = 5000
const MAX_VISIBLE = 3

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const timers = new Map<number, number>()

function emit(next: ToastItem[]): void {
  items = next
  listeners.forEach((l) => l())
}

export function dismissToast(id: number): void {
  const timer = timers.get(id)
  if (timer !== undefined) window.clearTimeout(timer)
  timers.delete(id)
  emit(items.filter((t) => t.id !== id))
}

export function toast(message: string, options: { action?: ToastItem['action']; tone?: ToastItem['tone'] } = {}): void {
  const id = nextId++
  const next = [...items, { id, message, action: options.action, tone: options.tone ?? 'info' }]
  // Oldest toasts give way so a burst of actions never stacks up the screen.
  for (const old of next.slice(0, Math.max(0, next.length - MAX_VISIBLE))) {
    const timer = timers.get(old.id)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.delete(old.id)
  }
  emit(next.slice(-MAX_VISIBLE))
  timers.set(id, window.setTimeout(() => dismissToast(id), LIFETIME_MS))
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
  )
}
