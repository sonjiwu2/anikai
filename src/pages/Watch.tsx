import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  ChevronsRight,
  Circle,
  CircleCheck,
  CirclePlay,
  ExternalLink,
  Info,
  Link2,
  RotateCcw,
  Unlink,
  VideoOff,
} from 'lucide-react'
import type { Anime } from '../types'
import { DEMO_VIDEO_CREDIT, getAnime } from '../data/catalog'
import { NotFound } from './NotFound'
import { VideoPlayer, type VideoPlayerHandle } from '../components/player/VideoPlayer'
import { EmbedPlayer } from '../components/player/EmbedPlayer'
import { EpisodeNotes } from '../components/player/EpisodeNotes'
import { LinkVideoDialog, OpeningDialog } from '../components/player/SourceDialogs'
import { BackdropArt, EpisodeArt } from '../components/cards/cards'
import { Toggle } from '../components/ui/basics'
import { actions, getUserData, useUser } from '../lib/store'
import { PROVIDER_LABEL } from '../lib/embeds'
import { episodeTitle, findEpisode, isPlayable, resolveOpening, watchPath, type EpisodeContext } from '../lib/episodes'
import { formatRuntime, formatTime } from '../lib/format'
import { progressKey } from '../lib/userData'
import { toast } from '../lib/toast'
import { useDocumentTitle, useMediaQuery } from '../lib/hooks'
import { staticHosting, videoApiBase } from '../lib/hosting'

const NEXT_COUNTDOWN_S = 5
const COLLAPSED_COUNT = 6

export default function Watch() {
  const { slug, episodeId } = useParams()
  const anime = getAnime(slug)
  const ctx = anime && findEpisode(anime, episodeId)

  if (!anime) {
    return <NotFound title="Такого аниме нет в каталоге">Проверь адрес или найди аниме через каталог.</NotFound>
  }
  if (!ctx) {
    return (
      <NotFound title="Такой серии нет">
        У «{anime.titleRu}» нет серии с таким номером.{' '}
        <Link to={`/anime/${anime.slug}`} style={{ color: 'var(--accent)' }}>
          Открыть список серий
        </Link>
      </NotFound>
    )
  }
  // A new key per episode gives the player and the page a clean state.
  return <WatchView key={`${anime.id}/${ctx.episode.id}`} anime={anime} ctx={ctx} />
}

function WatchView({ anime, ctx }: { anime: Anime; ctx: EpisodeContext }) {
  const { episode, season, prev, next } = ctx
  const isMovie = anime.format === 'movie'
  const name = episodeTitle(episode, anime)
  useDocumentTitle(isMovie ? anime.titleRu : `${anime.titleRu}, серия ${episode.number}`)

  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const autoNext = useUser((u) => u.preferences.autoNext)
  const sources = useUser((u) => u.sources)
  const openings = useUser((u) => u.openings)
  const allNotes = useUser((u) => u.notes)
  const playerRef = useRef<VideoPlayerHandle>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [theater, setTheater] = useState(false)
  const [ended, setEnded] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [linking, setLinking] = useState(false)
  const [marking, setMarking] = useState(false)

  // Where to start: an explicit ?t= (from a note) wins; otherwise the saved position,
  // unless the episode was finished or stopped in its last seconds.
  const [startAt] = useState(() => {
    const requested = Number(params.get('t'))
    if (params.has('t') && Number.isFinite(requested) && requested >= 0) return requested
    const saved = getUserData().progress[progressKey(anime.id, episode.id)]
    if (!saved || saved.completed || saved.duration <= 0) return 0
    return saved.position < saved.duration * 0.92 ? saved.position : 0
  })
  const autoPlay = (location.state as { autoplay?: boolean } | null)?.autoplay === true

  // A video the viewer attached takes priority over the catalog's stream.
  const original = episode.catalogSource
  const hostedRutube = staticHosting && !videoApiBase && original?.provider === 'rutube'
    ? { provider: 'rutube' as const, videoId: original.videoId, url: original.url, addedAt: original.verifiedAt } : undefined
  const attached = sources[progressKey(anime.id, episode.id)] ?? hostedRutube
  const hostedOk = !attached && staticHosting && !videoApiBase && original?.provider === 'ok'
  const hasFile = episode.mediaSources.length > 0
  const playable = !!attached || hasFile
  const nextPlayable = !!next && isPlayable(anime, next, sources)
  const isDemo = !attached && episode.mediaSources.some((s) => s.isDemo)
  const opening = resolveOpening(anime, episode, openings)
  const markers = useMemo(
    () => allNotes.filter((n) => n.animeId === anime.id && n.episodeId === episode.id).map((n) => n.time),
    [allNotes, anime.id, episode.id],
  )

  const handlePersist = useCallback(
    (position: number, duration: number, completed: boolean) => actions.savePlayback(anime.id, episode.id, position, duration, completed),
    [anime.id, episode.id],
  )

  const handleEnded = useCallback(() => {
    setEnded(true)
    // Auto-advance needs the setting, a next episode and a video for it. The last episode never loops.
    if (getUserData().preferences.autoNext && nextPlayable) setCountdown(NEXT_COUNTDOWN_S)
  }, [nextPlayable])

  const handlePlay = useCallback(() => {
    setEnded(false)
    setCountdown(null)
  }, [])

  useEffect(() => {
    if (countdown === null || !next) return
    if (countdown <= 0) {
      navigate(watchPath(anime, next), { state: { autoplay: true } })
      return
    }
    const id = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [countdown, next, anime, navigate])

  const seekFromNote = (seconds: number) => {
    playerRef.current?.seek(seconds)
    stageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const detach = () => {
    const removed = actions.removeSource(anime.id, episode.id)
    if (removed) toast('Видео отвязано от серии', { action: { label: 'Вернуть', onClick: () => actions.restoreSource(anime.id, episode.id, removed) } })
  }

  const overlay = ended ? (
    <div className="player__end" role="status">
      {countdown !== null && next ? (
        <>
          <p className="player__end-title">
            Следующая серия через <span className="tabular">{countdown}</span> с
          </p>
          <div className="player__end-actions">
            <button type="button" className="btn" onClick={() => setCountdown(null)}>
              Отмена
            </button>
            <Link to={watchPath(anime, next)} state={{ autoplay: true }} className="btn btn--primary">
              Смотреть сейчас
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="player__end-title">{next ? 'Серия закончилась' : isMovie ? 'Фильм закончился' : 'Это последняя серия'}</p>
          <div className="player__end-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                playerRef.current?.seek(0)
                playerRef.current?.play()
                setEnded(false)
              }}
            >
              <RotateCcw size={18} aria-hidden="true" />
              Смотреть заново
            </button>
            {next ? (
              <Link to={watchPath(anime, next)} state={{ autoplay: nextPlayable }} className="btn btn--primary">
                Следующая серия
              </Link>
            ) : (
              <Link to={`/anime/${anime.slug}?tab=similar`} className="btn btn--primary">
                Похожие аниме
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  ) : null

  const label = `${anime.titleRu}, ${name.toLowerCase()}`

  return (
    <div className={`container page watch ${theater && isWide ? 'is-theater' : ''}`}>
      <nav className="watch__crumbs" aria-label="Навигация">
        <Link to={`/anime/${anime.slug}`} className="watch__back">
          <ArrowLeft size={22} aria-hidden="true" />
          <span>{anime.titleRu}</span>
        </Link>
        {!isMovie ? (
          <p className="meta">
            <span>{season.title}</span>
            <span>{name}</span>
          </p>
        ) : null}
      </nav>

      <div className="watch__layout">
        <div className="watch__stage" ref={stageRef}>
          {attached ? (
            <EmbedPlayer
              // Re-attaching another video must start a fresh frame.
              key={`${attached.provider}:${attached.videoId}`}
              ref={playerRef}
              label={label}
              source={attached}
              startAt={startAt}
              autoPlay={autoPlay}
              opening={opening}
              onPersist={handlePersist}
              onEnded={handleEnded}
              onPlay={handlePlay}
              overlay={overlay}
            />
          ) : hostedOk ? (
            <div className="player player--embed" role="region" aria-label={`Плеер Одноклассников: ${label}`}>
              <iframe className="player__frame" src={`https://ok.ru/videoembed/${original!.videoId}`} title={`${label} — Одноклассники`}
                allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          ) : hasFile ? (
            <VideoPlayer
              ref={playerRef}
              label={label}
              title={anime.titleRu}
              subtitle={isMovie ? undefined : `${season.title} · ${name}`}
              sources={episode.mediaSources}
              tracks={episode.subtitleTracks}
              poster={episode.thumbnail}
              startAt={startAt}
              autoPlay={autoPlay}
              opening={opening}
              markers={markers}
              onNext={next ? () => navigate(watchPath(anime, next), { state: { autoplay: nextPlayable } }) : undefined}
              onPersist={handlePersist}
              onEnded={handleEnded}
              onPlay={handlePlay}
              theater={theater}
              onToggleTheater={isWide ? () => setTheater((t) => !t) : undefined}
              overlay={overlay}
            />
          ) : (
            <div className="nosource">
              <BackdropArt anime={anime} />
              <div className="nosource__body">
                <VideoOff size={30} aria-hidden="true" />
                <p className="nosource__title">Видео для этой серии пока не добавлено</p>
                <p>Привяжи ссылку на видео с Rutube или VK Видео — серия будет открываться здесь.</p>
                <div className="nosource__actions">
                  <button type="button" className="btn btn--primary" onClick={() => setLinking(true)}>
                    <Link2 size={18} aria-hidden="true" />
                    Привязать видео
                  </button>
                  <Link to={`/anime/${anime.slug}`} className="btn">
                    К списку серий
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="watch__info">
          <div className="watch__heading">
            <h1 className="watch__title">{isMovie ? anime.titleRu : name}</h1>
            {episode.title ? (
              <p className="watch__subtitle" lang="en">
                {episode.title}
              </p>
            ) : null}
          </div>

          {playable && startAt > 0 ? (
            <p className="watch__resume">
              Продолжаем с <span className="tabular">{formatTime(startAt)}</span>
              <button type="button" className="watch__restart" onClick={() => playerRef.current?.seek(0)}>
                Начать сначала
              </button>
            </p>
          ) : null}

          <div className="watch__actions">
            {!isMovie ? (
              <div className="watch__nav">
                {prev ? (
                  <Link to={watchPath(anime, prev)} className="btn">
                    <ArrowLeft size={20} aria-hidden="true" />
                    Предыдущая
                  </Link>
                ) : (
                  <button type="button" className="btn" disabled>
                    <ArrowLeft size={20} aria-hidden="true" />
                    Предыдущая
                  </button>
                )}
                {next ? (
                  <Link to={watchPath(anime, next)} className="btn btn--primary">
                    Следующая
                    <ArrowRight size={20} aria-hidden="true" />
                  </Link>
                ) : (
                  <button type="button" className="btn" disabled>
                    Следующая
                    <ArrowRight size={20} aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : null}
            {!isMovie ? (
              <div className="toggle-row watch__autonext">
                <span id="watch-autonext">Автопереход</span>
                <Toggle checked={autoNext} onChange={(v) => actions.setPreference('autoNext', v)} labelledBy="watch-autonext" />
              </div>
            ) : null}
          </div>

          <div className="watch__tools">
            <button type="button" className="btn btn--sm" onClick={() => setLinking(true)}>
              <Link2 size={18} aria-hidden="true" />
              {attached ? 'Заменить видео' : 'Привязать видео'}
            </button>
            {playable && opening?.scope !== 'catalog' ? (
              <button type="button" className="btn btn--sm" onClick={() => setMarking(true)}>
                <ChevronsRight size={18} aria-hidden="true" />
                {opening ? 'Изменить опенинг' : 'Отметить опенинг'}
              </button>
            ) : null}
            {opening ? (
              <p className="watch__opening tabular">
                Опенинг {formatTime(opening.start)}–{formatTime(opening.end)}
                {opening.scope === 'season' ? ' · весь сезон' : ''}
              </p>
            ) : null}
          </div>

          {attached ? (
            <div className="banner watch__demo">
              <Info size={20} aria-hidden="true" />
              <div className="watch__source">
                <p>
                  <strong>Видео с {PROVIDER_LABEL[attached.provider]}.</strong> Его показывает плеер площадки; за содержимое отвечают она и автор
                  загрузки. Реклама и качество — на стороне площадки.
                </p>
                <div className="watch__source-actions">
                  <a href={attached.url} target="_blank" rel="noreferrer" className="btn btn--sm btn--ghost">
                    <ExternalLink size={16} aria-hidden="true" />
                    Открыть на {PROVIDER_LABEL[attached.provider]}
                  </a>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={detach}>
                    <Unlink size={16} aria-hidden="true" />
                    Отвязать
                  </button>
                </div>
              </div>
            </div>
          ) : episode.catalogSource ? (
            <div className="banner watch__demo">
              <Info size={20} aria-hidden="true" />
              <div className="watch__source">
                <p>Источник: <strong>{episode.catalogSource.channel}</strong> · Серия воспроизводится в плеере Anikai.</p>
                <a href={episode.catalogSource.url} target="_blank" rel="noreferrer" className="btn btn--sm btn--ghost">
                  <ExternalLink size={16} aria-hidden="true" />
                  Открыть источник
                </a>
              </div>
            </div>
          ) : isDemo ? (
            <div className="banner watch__demo">
              <Info size={20} aria-hidden="true" />
              <p>
                <strong>Демонстрационное видео.</strong> Вместо {isMovie ? 'фильма' : 'серии'} показан {DEMO_VIDEO_CREDIT}. К «{anime.titleRu}» ролик
                отношения не имеет.
              </p>
            </div>
          ) : null}
        </div>

        {!isMovie ? (
          <aside className="watch__episodes" aria-label="Серии">
            <EpisodeList anime={anime} ctx={ctx} collapsible={!isWide || theater} />
          </aside>
        ) : null}

        <div className="watch__notes">
          <EpisodeNotes
            animeId={anime.id}
            episodeId={episode.id}
            getTime={playable ? () => playerRef.current?.getTime() ?? 0 : null}
            onSeek={playable ? seekFromNote : null}
          />
        </div>
      </div>

      <LinkVideoDialog anime={anime} episode={episode} open={linking} onClose={() => setLinking(false)} />
      <OpeningDialog
        anime={anime}
        episode={episode}
        current={opening}
        getTime={playable ? () => playerRef.current?.getTime() ?? 0 : null}
        open={marking}
        onClose={() => setMarking(false)}
      />
    </div>
  )
}

function EpisodeList({ anime, ctx, collapsible }: { anime: Anime; ctx: EpisodeContext; collapsible: boolean }) {
  const progress = useUser((u) => u.progress)
  const sources = useUser((u) => u.sources)
  const [seasonId, setSeasonId] = useState(ctx.season.id)
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)

  const season = anime.seasons.find((s) => s.id === seasonId) ?? ctx.season
  const currentInSeason = season.episodes.indexOf(ctx.episode)

  // On narrow screens show a window around the current episode until the viewer asks for everything.
  const collapsed = collapsible && !expanded && season.episodes.length > COLLAPSED_COUNT
  const from = collapsed ? Math.max(0, Math.min((currentInSeason < 0 ? 0 : currentInSeason) - 1, season.episodes.length - COLLAPSED_COUNT)) : 0
  const shown = collapsed ? season.episodes.slice(from, from + COLLAPSED_COUNT) : season.episodes

  // Bring the current episode into view inside the list without scrolling the page.
  useEffect(() => {
    const list = listRef.current
    const active = list?.querySelector<HTMLElement>('[aria-current="true"]')
    if (list && active && list.scrollHeight > list.clientHeight) {
      list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2
    }
  }, [seasonId, collapsible])

  return (
    <div className="eplist">
      <div className="eplist__head">
        <h2 className="eplist__title">Серии</h2>
        {anime.seasons.length > 1 ? (
          <label className="eplist__season">
            <span className="visually-hidden">Сезон</span>
            <select className="select" value={season.id} onChange={(e) => setSeasonId(e.target.value)}>
              {anime.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <ol className="eplist__items" ref={listRef}>
        {shown.map((ep) => {
          const active = ep === ctx.episode
          const watched = !!progress[progressKey(anime.id, ep.id)]?.completed
          const playable = isPlayable(anime, ep, sources)
          return (
            <li key={ep.id}>
              <Link to={watchPath(anime, ep)} className="eplist__item" aria-current={active ? 'true' : undefined}>
                <span className="eplist__thumb">
                  <EpisodeArt anime={anime} episode={ep} />
                </span>
                <span className="eplist__text">
                  <span className="eplist__name">{episodeTitle(ep, anime)}</span>
                  <span className="eplist__sub" lang="en">
                    {ep.title ?? ''}
                  </span>
                  <span className="eplist__dur">
                    {ep.durationMin ? formatRuntime(ep.durationMin) : ''}
                    {!playable ? ' · видео не добавлено' : ''}
                  </span>
                </span>
                <span className={`eplist__state ${watched || active ? 'is-on' : ''}`}>
                  {watched ? (
                    <CircleCheck size={24} aria-label="Просмотрена" />
                  ) : active ? (
                    <CirclePlay size={24} aria-label="Сейчас открыта" />
                  ) : !playable ? (
                    <VideoOff size={20} aria-hidden="true" />
                  ) : (
                    <Circle size={24} aria-hidden="true" />
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      {collapsed ? (
        <button type="button" className="btn btn--block eplist__more" onClick={() => setExpanded(true)}>
          Показать все серии: {season.episodes.length}
        </button>
      ) : null}
    </div>
  )
}
