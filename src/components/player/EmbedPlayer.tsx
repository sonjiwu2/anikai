import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { ChevronsRight } from 'lucide-react'
import type { OpeningMark, UserSource } from '../../types'
import type { VideoPlayerHandle } from './VideoPlayer'
import { EMBED_ORIGINS, PROVIDER_LABEL, embedUrl } from '../../lib/embeds'
import { getUserData } from '../../lib/store'

interface Props {
  /** Accessible name, e.g. «Фрирен, серия 6» */
  label: string
  source: UserSource
  startAt: number
  autoPlay: boolean
  opening?: OpeningMark
  onPersist: (position: number, duration: number, completed: boolean) => void
  onEnded: () => void
  onPlay?: () => void
  /** Rendered on top of the frame (e.g. the "next episode" countdown) */
  overlay?: ReactNode
}

const SAVE_INTERVAL_MS = 5000
const COMPLETE_AT = 0.92
const READY_TIMEOUT_MS = 15000

interface Snapshot {
  type: 'ready' | 'time' | 'playing' | 'paused' | 'ended'
  time?: number
  duration?: number
}

/** Translates a platform message into a common shape. Returns null for everything we do not use. */
function readMessage(provider: UserSource['provider'], raw: unknown): Snapshot | null {
  if (provider === 'rutube') {
    let message: { type?: string; data?: { time?: number; duration?: number; state?: string } }
    try {
      message = typeof raw === 'string' ? JSON.parse(raw) : (raw as typeof message)
    } catch {
      return null
    }
    const data = message?.data ?? {}
    switch (message?.type) {
      case 'player:ready':
        return { type: 'ready' }
      case 'player:durationChange':
        return { type: 'time', duration: data.duration }
      case 'player:currentTime':
        return { type: 'time', time: data.time, duration: data.duration }
      case 'player:playComplete':
        return { type: 'ended' }
      case 'player:changeState':
        // Observed on the live player: "playing", "pause", plus "advert", "seeking", "buffering" which we ignore.
        // While an advert runs the player sends no currentTime at all, so adverts never count as progress.
        if (data.state === 'playing') return { type: 'playing' }
        if (data.state === 'pause' || data.state === 'paused') return { type: 'paused' }
        if (data.state === 'stopped') return { type: 'ended' }
        return null
      default:
        return null
    }
  }
  const data = raw as { event?: string; time?: number; duration?: number } | null
  if (!data || typeof data !== 'object') return null
  switch (data.event) {
    case 'inited':
      return { type: 'ready', duration: data.duration }
    case 'timeupdate':
    case 'seeked':
      return { type: 'time', time: data.time, duration: data.duration }
    case 'started':
    case 'resumed':
      return { type: 'playing' }
    case 'paused':
      return { type: 'paused' }
    case 'ended':
      return { type: 'ended' }
    default:
      return null
  }
}

/**
 * A video the viewer attached from Rutube or VK Video, shown in that platform's own embed player.
 * The page only talks to the frame over postMessage: it reads time and state to keep progress,
 * and sends seek/play for resume, note timecodes and skipping the opening.
 */
export const EmbedPlayer = forwardRef<VideoPlayerHandle, Props>(function EmbedPlayer(
  { label, source, startAt, autoPlay, opening, onPersist, onEnded, onPlay, overlay },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  // The address is fixed for the life of the component so re-renders never reload the frame.
  const [src] = useState(() => embedUrl(source, startAt))
  const [time, setTime] = useState(startAt)
  const [ready, setReady] = useState(false)
  const [stalled, setStalled] = useState(false)

  const live = useRef({ time: startAt, duration: 0, playing: false, completed: false, lastSave: 0, muted: false })
  const callbacks = useRef({ onPersist, onEnded, onPlay })
  useEffect(() => {
    callbacks.current = { onPersist, onEnded, onPlay }
  })

  const send = useCallback(
    (command: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'init', seconds?: number) => {
      const target = frameRef.current?.contentWindow
      if (!target) return
      if (source.provider === 'rutube') {
        const type = { play: 'player:play', pause: 'player:pause', seek: 'player:setCurrentTime', mute: 'player:mute', unmute: 'player:unMute', init: '' }[command]
        if (type) target.postMessage(JSON.stringify({ type, data: command === 'seek' ? { time: seconds } : {} }), 'https://rutube.ru')
      } else {
        target.postMessage(command === 'seek' ? { method: 'seek', time: seconds } : { method: command }, '*')
      }
    },
    [source.provider],
  )

  const persist = useCallback(() => {
    const s = live.current
    if (s.duration <= 0 || !getUserData().preferences.saveProgress) return
    if (s.time < 1 && !s.completed) return
    s.lastSave = performance.now()
    callbacks.current.onPersist(s.time, s.duration, s.completed)
  }, [])

  const seek = useCallback(
    (seconds: number) => {
      const s = live.current
      const target = Math.max(0, s.duration > 0 ? Math.min(seconds, s.duration) : seconds)
      s.time = target
      setTime(target)
      send('seek', target)
      // A deliberate jump (skip opening, note timecode) is worth remembering right away:
      // the platform may cut to an advert next and stay silent for a while.
      persist()
    },
    [send, persist],
  )

  useImperativeHandle(ref, () => ({ seek, getTime: () => live.current.time, play: () => send('play') }), [seek, send])

  // ---------- Messages from the frame ----------

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || !EMBED_ORIGINS[source.provider].test(event.origin)) return
      const message = readMessage(source.provider, event.data)
      if (!message) return
      const s = live.current
      if (message.duration && message.duration > 0) s.duration = message.duration

      if (message.type === 'ready') {
        setReady(true)
        setStalled(false)
        // VK has no start parameter in the address, so the saved position is applied here.
        if (source.provider === 'vk' && startAt > 0) send('seek', startAt)
        if (autoPlay) send('play')
      } else if (message.type === 'time' && message.time !== undefined) {
        const previous = s.time
        const continuous = Math.abs(message.time - previous) < 2
        s.time = message.time
        setTime(message.time)
        const threshold = s.duration * COMPLETE_AT
        // Same rule as for local files: playback has to cross the threshold, a jump does not count.
        if (continuous && s.duration > 0 && previous < threshold && message.time >= threshold && !s.completed) {
          s.completed = true
          persist()
        } else if (s.playing && performance.now() - s.lastSave > SAVE_INTERVAL_MS) {
          persist()
        }
        if (opening && continuous && getUserData().preferences.autoSkipOpening && message.time >= opening.start && message.time < opening.end - 1) {
          seek(opening.end)
        }
      } else if (message.type === 'playing') {
        s.playing = true
        callbacks.current.onPlay?.()
      } else if (message.type === 'paused') {
        s.playing = false
        persist()
      } else if (message.type === 'ended') {
        s.playing = false
        s.completed = true
        persist()
        callbacks.current.onEnded()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [source.provider, startAt, autoPlay, opening, persist, seek, send])

  // VK answers only after an explicit "init"; the frame may not be listening yet at load, so retry briefly.
  useEffect(() => {
    if (source.provider !== 'vk' || ready) return
    const id = window.setInterval(() => send('init'), 700)
    return () => window.clearInterval(id)
  }, [source.provider, ready, send])

  useEffect(() => {
    if (ready) return
    const id = window.setTimeout(() => setStalled(true), READY_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [ready])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', persist)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', persist)
      persist()
    }
  }, [persist])

  // Shortcuts work while focus is on the page. Once the viewer clicks inside the frame, the platform's own keys apply.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="menu"]')) return
      const free = target === document.body || target.id === 'main'
      const onControl = !!target.closest('button, a, summary')
      const key = event.key.toLowerCase()
      const s = live.current
      if (key === 'k' || ((key === ' ' || key === 'spacebar') && free && !onControl)) send(s.playing ? 'pause' : 'play')
      else if (key === 'j') seek(s.time - 10)
      else if (key === 'l') seek(s.time + 10)
      else if (key === 'arrowleft' && free) seek(s.time - 5)
      else if (key === 'arrowright' && free) seek(s.time + 5)
      else if (key === 'm') {
        s.muted = !s.muted
        send(s.muted ? 'mute' : 'unmute')
      } else return
      event.preventDefault()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [send, seek])

  const inOpening = !!opening && time >= opening.start && time < opening.end

  return (
    <>
      <div className="player player--embed" role="region" aria-label={`Плеер ${PROVIDER_LABEL[source.provider]}: ${label}`}>
        <iframe
          ref={frameRef}
          className="player__frame"
          src={src}
          title={`${label} — ${PROVIDER_LABEL[source.provider]}`}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {inOpening ? (
          <button type="button" className="btn player__opening player__opening--embed" onClick={() => seek(opening.end)}>
            Пропустить опенинг
            <ChevronsRight size={20} aria-hidden="true" />
          </button>
        ) : null}
        {overlay}
      </div>
      {stalled ? (
        <p className="player__stalled" role="status">
          Плеер {PROVIDER_LABEL[source.provider]} не отвечает. Видео могло быть удалено, закрыто для встраивания или недоступно в твоей сети. Прогресс и
          пропуск опенинга для него не работают.
        </p>
      ) : null}
    </>
  )
})
