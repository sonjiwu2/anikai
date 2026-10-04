import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Captions,
  Check,
  ChevronsRight,
  CircleAlert,
  Gauge,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { MediaSource, OpeningMark, SubtitleTrack } from '../../types'
import { Menu, MenuItem } from '../ui/Menu'
import { actions, getUserData } from '../../lib/store'
import { clamp, formatTime } from '../../lib/format'
import { PLAYBACK_RATES } from '../../lib/userData'
import type Hls from 'hls.js'
import { resolvePublicHls } from '../../lib/publicVideo'

export interface VideoPlayerHandle {
  seek: (seconds: number) => void
  getTime: () => number
  play: () => void
}

interface Props {
  /** Accessible name, e.g. «Фрирен, серия 6» */
  label: string
  sources: MediaSource[]
  tracks: SubtitleTrack[]
  poster?: string
  /** Shown inside the frame while the controls are visible */
  title: string
  subtitle?: string
  /** Seconds to start from (already validated by the caller) */
  startAt: number
  autoPlay: boolean
  /** Opening boundaries; the skip control exists only when they are known */
  opening?: OpeningMark
  /** Moments to mark on the timeline (note timecodes), in seconds */
  markers?: number[]
  /** Go to the next episode; the button is shown only when this is set */
  onNext?: () => void
  /** Persist position. Called every few seconds, on pause, when the tab is hidden and on unmount. */
  onPersist: (position: number, duration: number, completed: boolean) => void
  onEnded: () => void
  /** Playback (re)started — lets the page dismiss its end-of-episode overlay */
  onPlay?: () => void
  theater?: boolean
  onToggleTheater?: () => void
  /** Rendered on top of the video (e.g. the "next episode" countdown) */
  overlay?: ReactNode
}

const SAVE_INTERVAL_MS = 5000
const HIDE_CONTROLS_MS = 2800
/** Reaching this share of the runtime by ordinary playback counts as "watched". */
const COMPLETE_AT = 0.92

function pickSource(sources: MediaSource[], preferredHeight: number): number {
  if (preferredHeight <= 0) return 0
  const index = sources.findIndex((s) => s.height <= preferredHeight)
  return index >= 0 ? index : sources.length - 1
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { label, title, subtitle, sources, tracks, poster, startAt, autoPlay, opening, markers, onNext, onPersist, onEnded, onPlay: onPlayProp, theater, onToggleTheater, overlay },
  ref,
) {
  // Media listeners are bound once per source, so they read the latest props through this ref.
  // The opening in particular can change mid-playback, when the viewer marks it.
  const callbacks = useRef({ onEnded, onPlay: onPlayProp, opening })
  useEffect(() => {
    callbacks.current = { onEnded, onPlay: onPlayProp, opening }
  })
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const ordered = useMemo(() => [...sources].sort((a, b) => b.height - a.height), [sources])
  // Preferences are read once per mount: the player then owns its state and writes changes back.
  const initial = useRef(getUserData().preferences).current

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // The settings menu is portalled into the player so it stays visible in fullscreen.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const attachContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el
    setContainerEl(el)
  }, [])
  const lastSave = useRef(0)
  const lastTime = useRef(0)
  const completed = useRef(false)
  const hideTimer = useRef<number | undefined>(undefined)
  const resumeAt = useRef<{ time: number; play: boolean } | null>({ time: startAt, play: autoPlay })
  const menuOpen = useRef(false)
  const persistRef = useRef(onPersist)
  useEffect(() => {
    persistRef.current = onPersist
  })

  const [sourceIndex, setSourceIndex] = useState(() => pickSource(ordered, initial.preferredQuality))
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(startAt)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState(false)
  const [volume, setVolume] = useState(initial.volume)
  const [muted, setMuted] = useState(initial.muted)
  const [rate, setRate] = useState(initial.playbackRate)
  const [captions, setCaptions] = useState(initial.subtitles && tracks.length > 0)
  const [controls, setControls] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [pip, setPip] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const hlsRef = useRef<Hls | null>(null)
  const [hlsLevels, setHlsLevels] = useState<{ index: number; height: number }[]>([])
  const [hlsQuality, setHlsQuality] = useState(-1)
  const [retryCount, setRetryCount] = useState(0)

  const current = ordered[sourceIndex] ?? ordered[0]
  const isHls = !!current && (/mpegurl/i.test(current.type) || /\.m3u8(?:\?|$)/i.test(current.src))

  // HLS uses the same video element, events and controls as ordinary MP4 files.
  // Prefer hls.js for manual quality selection; fall back to native HLS on browsers without MSE.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !current || !isHls) return
    let disposed = false
    let instance: Hls | undefined
    const controller = new AbortController()
    void resolvePublicHls(current.src, controller.signal).then(async sourceUrl => {
        const { default: HlsEngine } = await import('hls.js')
        if (disposed) return
        setWaiting(true)
        if (!HlsEngine.isSupported()) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = sourceUrl; video.load() }
          else { setError(true); setWaiting(false) }
          return
        }
        instance = new HlsEngine({ maxBufferLength: 30, maxMaxBufferLength: 60, capLevelToPlayerSize: false })
        hlsRef.current = instance
        let recovered = false
        instance.on(HlsEngine.Events.MANIFEST_PARSED, () => {
          if (!instance || disposed) return
          const unique = new Map<number, { index: number; height: number }>()
          instance.levels.forEach((level, index) => { if (!unique.has(level.height)) unique.set(level.height, { index, height: level.height }) })
          const levels = [...unique.values()].sort((a, b) => b.height - a.height)
          setHlsLevels(levels)
          const preferred = initial.preferredQuality > 0 ? levels.find(l => l.height <= initial.preferredQuality) ?? levels.at(-1) : undefined
          instance.currentLevel = preferred?.index ?? -1
          setHlsQuality(preferred?.index ?? -1)
          setError(false)
        })
        instance.on(HlsEngine.Events.ERROR, (_, data) => {
          if (!data.fatal || disposed || !instance) return
          if (data.type === HlsEngine.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true
            instance.recoverMediaError()
          } else { setError(true); setWaiting(false) }
        })
        instance.loadSource(sourceUrl)
        instance.attachMedia(video)
    }).catch(() => { if (!disposed) { setError(true); setWaiting(false) } })
    return () => {
      disposed = true
      controller.abort()
      instance?.destroy()
      hlsRef.current = null
      video.removeAttribute('src')
      video.load()
    }
  }, [current, isHls, retryCount, initial.preferredQuality])

  // Capability detection: buttons exist only for what this browser can actually do.
  const canFullscreen = typeof document !== 'undefined' && (document.fullscreenEnabled || 'webkitEnterFullscreen' in HTMLVideoElement.prototype)
  const canPip = typeof document !== 'undefined' && document.pictureInPictureEnabled === true

  const persist = useCallback(() => {
    const v = videoRef.current
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return
    if (!getUserData().preferences.saveProgress) return
    // Nothing worth recording until playback actually moved.
    if (v.currentTime < 1 && !completed.current) return
    lastSave.current = performance.now()
    persistRef.current(v.currentTime, v.duration, completed.current)
  }, [])

  // ---------- Commands ----------

  const play = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.play().then(
      () => setBlocked(false),
      // Autoplay was refused (or the load was interrupted): offer an explicit start instead.
      () => setBlocked(true),
    )
  }, [])

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused || v.ended) play()
    else v.pause()
  }, [play])

  const seekTo = useCallback((seconds: number) => {
    const v = videoRef.current
    if (!v) return
    const max = Number.isFinite(v.duration) ? v.duration : seconds
    v.currentTime = clamp(seconds, 0, max)
    lastTime.current = v.currentTime
    setTime(v.currentTime)
  }, [])

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current
      if (v) seekTo(v.currentTime + delta)
    },
    [seekTo],
  )

  const changeVolume = useCallback((next: number) => {
    const v = videoRef.current
    if (!v) return
    v.volume = clamp(next, 0, 1)
    v.muted = v.volume === 0
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    if (!v.muted && v.volume === 0) v.volume = 0.5
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!container || !v) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else if (container.requestFullscreen) void container.requestFullscreen().catch(() => undefined)
    // iOS Safari only supports fullscreen on the <video> itself, with its native controls.
    else v.webkitEnterFullscreen?.()
  }, [])

  const togglePip = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (document.pictureInPictureElement) void document.exitPictureInPicture()
    else void v.requestPictureInPicture().catch(() => undefined)
  }, [])

  const toggleCaptions = useCallback(() => {
    setCaptions((on) => {
      actions.setPreference('subtitles', !on)
      return !on
    })
  }, [])

  const changeRate = (next: number) => {
    const v = videoRef.current
    if (v) v.playbackRate = next
    actions.setPreference('playbackRate', next)
  }

  const changeQuality = (index: number) => {
    const v = videoRef.current
    if (!v || index === sourceIndex) return
    // Keep position and play state across the source swap.
    resumeAt.current = { time: v.currentTime, play: !v.paused }
    setSourceIndex(index)
    actions.setPreference('preferredQuality', ordered[index]?.height ?? 0)
  }

  const retry = () => {
    const v = videoRef.current
    if (!v) return
    resumeAt.current = { time, play: true }
    setError(false)
    if (isHls) setRetryCount(count => count + 1)
    else v.load()
  }

  useImperativeHandle(ref, () => ({ seek: seekTo, getTime: () => videoRef.current?.currentTime ?? 0, play }), [seekTo, play])

  // ---------- Controls visibility ----------

  const wake = useCallback(() => {
    setControls(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(function hide() {
      const v = videoRef.current
      const container = containerRef.current
      // Never hide while paused, while a menu is open, or while the keyboard focus is on a control.
      if (!v || v.paused || menuOpen.current || container?.querySelector(':focus-visible')) {
        hideTimer.current = window.setTimeout(hide, HIDE_CONTROLS_MS)
        return
      }
      setControls(false)
    }, HIDE_CONTROLS_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  // ---------- Media events ----------

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onLoadedMetadata = () => {
      setDuration(v.duration)
      v.volume = volume
      v.muted = muted
      v.playbackRate = rate
      const pending = resumeAt.current
      resumeAt.current = null
      if (pending) {
        // Clamp so a stale position never lands past the end of a shorter file.
        const safe = clamp(pending.time, 0, Math.max(0, v.duration - 1))
        if (safe > 0) v.currentTime = safe
        lastTime.current = safe
        setTime(safe)
        if (pending.play) play()
      }
    }
    const onTimeUpdate = () => {
      const t = v.currentTime
      const previous = lastTime.current
      const continuous = !v.seeking && Math.abs(t - previous) < 2
      lastTime.current = t
      setTime(t)
      // "Watched" means playback itself crossed the threshold. Dragging the slider past it does
      // not count; an episode skipped to its last seconds is completed only by reaching the end.
      const threshold = v.duration * COMPLETE_AT
      if (continuous && v.duration > 0 && previous < threshold && t >= threshold && !completed.current) {
        completed.current = true
        persist()
      } else if (performance.now() - lastSave.current > SAVE_INTERVAL_MS && !v.paused) {
        persist()
      }
      const mark = callbacks.current.opening
      if (mark && getUserData().preferences.autoSkipOpening && continuous && t >= mark.start && t < mark.end - 1) {
        v.currentTime = mark.end
      }
    }
    const onProgress = () => {
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= v.currentTime + 0.5 && v.buffered.end(i) >= v.currentTime) {
          setBuffered(v.buffered.end(i))
          return
        }
      }
    }
    const onPlay = () => {
      setPlaying(true)
      setBlocked(false)
      wake()
      callbacks.current.onPlay?.()
    }
    const onPause = () => {
      setPlaying(false)
      setControls(true)
      persist()
    }
    const onEndedEvent = () => {
      completed.current = true
      persist()
      callbacks.current.onEnded()
    }
    const onVolumeChange = () => {
      setVolume(v.volume)
      setMuted(v.muted)
      actions.setPreference('volume', v.volume)
      actions.setPreference('muted', v.muted)
    }
    const onWaiting = () => setWaiting(true)
    const onCanPlay = () => setWaiting(false)
    const onError = () => {
      setError(true)
      setWaiting(false)
    }
    const onRateChange = () => setRate(v.playbackRate)
    const onEnterPip = () => setPip(true)
    const onLeavePip = () => setPip(false)

    v.addEventListener('loadedmetadata', onLoadedMetadata)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('progress', onProgress)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEndedEvent)
    v.addEventListener('volumechange', onVolumeChange)
    v.addEventListener('waiting', onWaiting)
    v.addEventListener('canplay', onCanPlay)
    v.addEventListener('playing', onCanPlay)
    v.addEventListener('error', onError)
    v.addEventListener('ratechange', onRateChange)
    v.addEventListener('enterpictureinpicture', onEnterPip)
    v.addEventListener('leavepictureinpicture', onLeavePip)
    // Metadata may already be there when the effect attaches (cached file) — and so may a failure.
    if (v.readyState >= 1 && resumeAt.current) onLoadedMetadata()
    if (v.error) onError()

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMetadata)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('progress', onProgress)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEndedEvent)
      v.removeEventListener('volumechange', onVolumeChange)
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('canplay', onCanPlay)
      v.removeEventListener('playing', onCanPlay)
      v.removeEventListener('error', onError)
      v.removeEventListener('ratechange', onRateChange)
      v.removeEventListener('enterpictureinpicture', onEnterPip)
      v.removeEventListener('leavepictureinpicture', onLeavePip)
    }
    // Listeners are bound once per source; they read live values through refs and the element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.src])

  // Save when the tab goes to the background, the page is being closed, or the player unmounts.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    const onFullscreen = () => setFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', persist)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('fullscreenchange', onFullscreen)
      persist()
    }
  }, [persist])

  // Subtitles: a real <track>; we only switch its mode.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const apply = () => {
      for (const track of Array.from(v.textTracks)) track.mode = captions ? 'showing' : 'disabled'
    }
    apply()
    v.textTracks.addEventListener('addtrack', apply)
    return () => v.textTracks.removeEventListener('addtrack', apply)
  }, [captions, current?.src])

  // ---------- Keyboard ----------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement
      // Typing, native sliders, dialogs and menus keep their own keys.
      if (target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="menu"]')) return
      const inPlayer = !!containerRef.current?.contains(target)
      const onControl = !!target.closest('button, a, summary')
      const free = target === document.body || target.id === 'main'
      const key = event.key.toLowerCase()

      if (key === ' ' || key === 'spacebar') {
        if (onControl || !(inPlayer || free)) return
        toggle()
      } else if (key === 'k') toggle()
      else if (key === 'j') seekBy(-10)
      else if (key === 'l') seekBy(10)
      else if (key === 'arrowleft' && (inPlayer || free)) seekBy(-5)
      else if (key === 'arrowright' && (inPlayer || free)) seekBy(5)
      else if (key === 'arrowup' && inPlayer) changeVolume((videoRef.current?.volume ?? 1) + 0.05)
      else if (key === 'arrowdown' && inPlayer) changeVolume((videoRef.current?.volume ?? 1) - 0.05)
      else if (key === 'm') toggleMute()
      else if (key === 'f' && canFullscreen) toggleFullscreen()
      else if (key === 'c' && tracks.length > 0) toggleCaptions()
      else return
      event.preventDefault()
      wake()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [toggle, seekBy, changeVolume, toggleMute, toggleFullscreen, toggleCaptions, wake, canFullscreen, tracks.length])

  // ---------- Render ----------

  if (!current) return null

  const inOpening = !!opening && time >= opening.start && time < opening.end
  const pct = (seconds: number) => (duration > 0 ? clamp((seconds / duration) * 100, 0, 100) : 0)
  const playedPct = duration > 0 ? (time / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const visible = controls || !playing

  return (
    <div
      ref={attachContainer}
      className={`player ${visible ? '' : 'is-idle'} ${playing ? 'is-playing' : ''} ${fullscreen ? 'is-fullscreen' : ''}`}
      role="region"
      aria-label={`Плеер: ${label}`}
      onPointerMove={wake}
      onPointerDown={wake}
      onFocus={wake}
    >
      <video
        ref={videoRef}
        className="player__video"
        src={isHls ? undefined : current.src}
        poster={poster}
        preload="metadata"
        playsInline
        onClick={(event) => {
          // Touch: the first tap only reveals the controls; mouse: a click toggles playback.
          const touch = (event.nativeEvent as PointerEvent).pointerType === 'touch'
          if (touch && !visible) wake()
          else toggle()
        }}
        onDoubleClick={() => {
          if (canFullscreen) toggleFullscreen()
        }}
      >
        {tracks.map((t) => (
          <track key={t.src} kind="subtitles" src={t.src} srcLang={t.lang} label={t.label} />
        ))}
      </video>

      {waiting && !error ? <div className="player__spinner" aria-hidden="true" /> : null}

      {error ? (
        <div className="player__message" role="alert">
          <CircleAlert size={28} aria-hidden="true" />
          <p className="player__message-title">Видео не загрузилось</p>
          <p>Проверь соединение и попробуй ещё раз. Позиция просмотра сохранена.</p>
          <button type="button" className="btn btn--primary" onClick={retry}>
            <RefreshCw size={18} aria-hidden="true" />
            Повторить
          </button>
        </div>
      ) : null}

      {!error ? (
        <div className="player__center">
          <button type="button" className="player__skip" onClick={() => seekBy(-10)} aria-label="Назад на 10 секунд">
            <RotateCcw size={26} aria-hidden="true" />
          </button>
          <button type="button" className="player__big" onClick={toggle} aria-label={playing ? 'Пауза' : blocked ? 'Запустить видео' : 'Воспроизвести'}>
            {playing ? <Pause size={30} fill="currentColor" aria-hidden="true" /> : <Play size={30} fill="currentColor" aria-hidden="true" />}
          </button>
          <button type="button" className="player__skip" onClick={() => seekBy(10)} aria-label="Вперёд на 10 секунд">
            <RotateCw size={26} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {!error ? (
        <div className="player__top">
          <p className="player__title">{title}</p>
          {subtitle ? <p className="player__subtitle">{subtitle}</p> : null}
        </div>
      ) : null}

      {inOpening && opening && !error ? (
        <button type="button" className="btn player__opening" onClick={() => seekTo(opening.end)}>
          Пропустить опенинг
          <ChevronsRight size={20} aria-hidden="true" />
        </button>
      ) : null}

      {overlay}

      {!error ? (
        <div className="player__controls">
          <div
            className="player__timeline"
            style={{ '--played': `${playedPct}%`, '--buffered': `${bufferedPct}%` } as React.CSSProperties}
            onPointerMove={(event) => {
              if (duration <= 0) return
              const rect = event.currentTarget.getBoundingClientRect()
              const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
              setHover({ x: ratio * 100, time: ratio * duration })
            }}
            onPointerLeave={() => setHover(null)}
          >
            {opening && duration > 0 ? (
              <span className="player__segment" style={{ left: `${pct(opening.start)}%`, width: `${pct(opening.end) - pct(opening.start)}%` }} aria-hidden="true" />
            ) : null}
            {duration > 0
              ? markers?.map((m) => <span key={m} className="player__marker" style={{ left: `${pct(m)}%` }} aria-hidden="true" />)
              : null}
            {hover ? (
              <span className="player__tip tabular" style={{ left: `${hover.x}%` }} aria-hidden="true">
                {formatTime(hover.time)}
                {opening && hover.time >= opening.start && hover.time < opening.end ? ' · опенинг' : ''}
              </span>
            ) : null}
            <input
              type="range"
              className="player__seek"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(time, duration || time)}
              disabled={duration === 0}
              aria-label="Перемотка"
              aria-valuetext={`${formatTime(time)} из ${formatTime(duration)}`}
              onChange={(e) => seekTo(Number(e.target.value))}
            />
          </div>
          <div className="player__row">
            <button type="button" className="player__btn" onClick={toggle} aria-label={playing ? 'Пауза' : 'Воспроизвести'}>
              {playing ? <Pause size={22} fill="currentColor" aria-hidden="true" /> : <Play size={22} fill="currentColor" aria-hidden="true" />}
            </button>
            <button type="button" className="player__btn player__btn--wide" onClick={() => seekBy(-10)} aria-label="Назад на 10 секунд">
              <RotateCcw size={22} aria-hidden="true" />
            </button>
            <button type="button" className="player__btn player__btn--wide" onClick={() => seekBy(10)} aria-label="Вперёд на 10 секунд">
              <RotateCw size={22} aria-hidden="true" />
            </button>
            {onNext ? (
              <button type="button" className="player__btn" onClick={onNext} aria-label="Следующая серия">
                <SkipForward size={22} aria-hidden="true" />
              </button>
            ) : null}
            <div className="player__volume">
              <button type="button" className="player__btn" onClick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'} aria-pressed={muted}>
                <VolumeIcon size={22} aria-hidden="true" />
              </button>
              <input
                type="range"
                className="player__vol"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                aria-label="Громкость"
                aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
                style={{ '--played': `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
                onChange={(e) => changeVolume(Number(e.target.value))}
              />
            </div>
            <span className="player__time tabular">
              {formatTime(time)} <span aria-hidden="true">/</span> <span className="visually-hidden">из</span> {formatTime(duration)}
            </span>

            <span className="player__spacer" />

            {tracks.length > 0 ? (
              <button
                type="button"
                className={`player__btn ${captions ? 'is-on' : ''}`}
                onClick={toggleCaptions}
                aria-pressed={captions}
                aria-label={captions ? 'Выключить субтитры' : `Включить субтитры: ${tracks[0]?.label}`}
              >
                <Captions size={22} aria-hidden="true" />
              </button>
            ) : null}

            <Menu
              label="Настройки воспроизведения"
              triggerClassName="player__btn"
              trigger={<Settings size={22} aria-hidden="true" />}
              placement="top"
              container={containerEl}
              onOpenChange={(open) => {
                menuOpen.current = open
              }}
            >
              {(close) => (
                <>
                  <div className="menu__label">
                    <Gauge size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                    Скорость
                  </div>
                  <div className="menu__grid">
                    {PLAYBACK_RATES.map((r) => (
                      <MenuItem
                        key={r}
                        checked={rate === r}
                        onSelect={() => {
                          changeRate(r)
                          close()
                        }}
                      >
                        {r === 1 ? 'Обычная' : `${r}×`}
                      </MenuItem>
                    ))}
                  </div>
                  <div className="menu__sep" />
                  <div className="menu__label">Качество</div>
                  {isHls && hlsLevels.length > 0 ? (
                    [{ index: -1, height: 0 }, ...hlsLevels].map(level => (
                      <MenuItem
                        key={level.index}
                        checked={hlsQuality === level.index}
                        onSelect={() => {
                          if (hlsRef.current) hlsRef.current.currentLevel = level.index
                          setHlsQuality(level.index)
                          actions.setPreference('preferredQuality', level.height)
                          close()
                        }}
                      >
                        {level.index === -1 ? 'Авто' : `${level.height}p`}
                      </MenuItem>
                    ))
                  ) : ordered.length > 1 ? (
                    ordered.map((s, i) => (
                      <MenuItem
                        key={s.src}
                        checked={i === sourceIndex}
                        icon={<Check size={18} aria-hidden="true" style={{ visibility: i === sourceIndex ? 'visible' : 'hidden' }} />}
                        onSelect={() => {
                          changeQuality(i)
                          close()
                        }}
                      >
                        {s.label}
                      </MenuItem>
                    ))
                  ) : (
                    <p className="menu__note">Доступно одно качество: {current.label}</p>
                  )}
                  {canPip ? (
                    <div className="player__menu-pip">
                      <div className="menu__sep" />
                      <MenuItem
                        icon={<PictureInPicture2 size={18} aria-hidden="true" />}
                        onSelect={() => {
                          togglePip()
                          close()
                        }}
                      >
                        {pip ? 'Вернуть из мини-плеера' : 'Мини-плеер'}
                      </MenuItem>
                    </div>
                  ) : null}
                </>
              )}
            </Menu>

            {canPip ? (
              <button type="button" className="player__btn player__btn--wide" onClick={togglePip} aria-pressed={pip} aria-label={pip ? 'Вернуть из мини-плеера' : 'Мини-плеер'}>
                <PictureInPicture2 size={22} aria-hidden="true" />
              </button>
            ) : null}
            {onToggleTheater ? (
              <button
                type="button"
                className={`player__btn player__btn--theater ${theater ? 'is-on' : ''}`}
                onClick={onToggleTheater}
                aria-pressed={theater}
                aria-label={theater ? 'Выйти из режима кино' : 'Режим кино'}
              >
                <RectangleHorizontal size={22} aria-hidden="true" />
              </button>
            ) : null}
            {canFullscreen ? (
              <button type="button" className="player__btn" onClick={toggleFullscreen} aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'Во весь экран'}>
                {fullscreen ? <Minimize size={22} aria-hidden="true" /> : <Maximize size={22} aria-hidden="true" />}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
})
