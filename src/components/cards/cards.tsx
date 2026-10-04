import { Link, useNavigate } from 'react-router'
import { Check, EllipsisVertical, Info, Play, Star, Trash2, VideoOff } from 'lucide-react'
import type { Anime, Episode, WatchProgress } from '../../types'
import { Img } from '../ui/Img'
import { Menu, MenuItem } from '../ui/Menu'
import { CollectionControl } from '../collection/CollectionControl'
import { actions, useUser } from '../../lib/store'
import { summarize } from '../../lib/selectors'
import { episodeFocalX, episodeTitle, watchPath } from '../../lib/episodes'
import { formatRemaining, formatRuntime, formatTime } from '../../lib/format'
import { toast } from '../../lib/toast'
import { progressKey } from '../../lib/userData'

// ---------- Artwork helpers ----------

const POSTER_SIZES = '(min-width: 1280px) 220px, (min-width: 1024px) 19vw, (min-width: 768px) 23vw, (min-width: 520px) 31vw, 46vw'

/** Still of the episode when one exists, otherwise a crop of the title's backdrop. */
export function EpisodeArt({ anime, episode, priority }: { anime: Anime; episode: Episode; priority?: boolean }) {
  return (
    <Img
      src={episode.thumbnail ?? anime.backdropSm}
      alt=""
      ratio="16 / 9"
      position={episode.thumbnail ? undefined : `${episodeFocalX(anime, episode)}% ${anime.focalY}%`}
      priority={priority}
    />
  )
}

export function BackdropArt({ anime, ratio = '16 / 9', priority }: { anime: Anime; ratio?: string; priority?: boolean }) {
  return <Img src={anime.backdropSm} alt="" ratio={ratio} position={`${anime.focalX}% ${anime.focalY}%`} priority={priority} />
}

// ---------- Poster card ----------

interface PosterCardProps {
  anime: Anime
  /** Extra line under the genres, e.g. the year or an air date */
  note?: string
  priority?: boolean
}

export function AnimePosterCard({ anime, note, priority }: PosterCardProps) {
  const progress = useUser((u) => u.progress)
  const next = summarize(anime, progress).next ?? anime.seasons[0]?.episodes[0]

  return (
    <article className="poster-card">
      <div className="poster-card__art">
        <Img
          src={anime.poster}
          srcSet={`${anime.posterSm} 300w, ${anime.poster} ${anime.posterWidth}w`}
          sizes={POSTER_SIZES}
          alt={anime.titleRu}
          ratio="2 / 3"
          priority={priority}
        />
        {anime.rating > 0 ? (
          <span className="badge poster-card__rating" title={`Оценка ${anime.ratingSource}`}>
            <Star size={13} fill="currentColor" aria-hidden="true" />
            <span className="visually-hidden">Оценка {anime.ratingSource} </span>
            {anime.rating.toFixed(1)}
          </span>
        ) : null}
        {/* Hover shortcut for mouse users; the card itself always opens the title. */}
        {next ? (
          <Link to={watchPath(anime, next)} className="poster-card__play" aria-label={`Смотреть: ${anime.titleRu}`} tabIndex={-1}>
            <Play size={22} fill="currentColor" aria-hidden="true" />
          </Link>
        ) : null}
        <CollectionControl anime={anime} variant="icon" className="poster-card__add" />
      </div>
      <div className="poster-card__body">
        <h3 className="poster-card__title">
          <Link to={`/anime/${anime.slug}`} className="poster-card__link">
            {anime.titleRu}
          </Link>
        </h3>
        <p className="meta">
          {anime.genres.slice(0, 2).map((g) => (
            <span key={g}>{g}</span>
          ))}
        </p>
        {note ? <p className="poster-card__note">{note}</p> : null}
      </div>
    </article>
  )
}

// ---------- Continue watching card ----------

interface ContinueCardProps {
  anime: Anime
  episode: Episode
  progress?: WatchProgress
  priority?: boolean
}

export function ContinueWatchingCard({ anime, episode, progress, priority }: ContinueCardProps) {
  const navigate = useNavigate()
  const started = !!progress && progress.duration > 0 && progress.position > 0
  const percent = started ? Math.min(100, (progress.position / progress.duration) * 100) : 0

  return (
    <article className="continue-card">
      <div className="continue-card__art">
        <EpisodeArt anime={anime} episode={episode} priority={priority} />
        {started ? (
          <span className="badge continue-card__time tabular">
            {formatTime(progress.position)} / {formatTime(progress.duration)}
          </span>
        ) : null}
        <div className="progress continue-card__bar" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="continue-card__body">
        <div className="continue-card__text">
          <p className="meta">
            <span>{episodeTitle(episode, anime)}</span>
            <span>{started ? formatRemaining(progress.position, progress.duration) : 'Следующая серия'}</span>
          </p>
          <h3 className="continue-card__title">
            <Link to={watchPath(anime, episode)} className="continue-card__link">
              {anime.titleRu}
            </Link>
          </h3>
        </div>
        <Menu label={`Действия: ${anime.titleRu}`} trigger={<EllipsisVertical size={20} aria-hidden="true" />} triggerClassName="icon-btn continue-card__menu">
          {(close) => (
            <>
              <MenuItem
                icon={<Info size={18} aria-hidden="true" />}
                onSelect={() => {
                  close()
                  navigate(`/anime/${anime.slug}`)
                }}
              >
                Страница аниме
              </MenuItem>
              <MenuItem
                icon={<Check size={18} aria-hidden="true" />}
                onSelect={() => {
                  close()
                  actions.setEpisodeWatched(anime.id, episode.id, true)
                  toast(`${episodeTitle(episode, anime)} отмечена просмотренной`)
                }}
              >
                Отметить серию просмотренной
              </MenuItem>
              {progress ? (
                <MenuItem
                  danger
                  icon={<Trash2 size={18} aria-hidden="true" />}
                  onSelect={() => {
                    close()
                    const removed = actions.removeProgress(anime.id, episode.id)
                    if (removed) {
                      toast('Прогресс серии сброшен', { action: { label: 'Вернуть', onClick: () => actions.restoreProgress(removed) } })
                    }
                  }}
                >
                  Сбросить прогресс серии
                </MenuItem>
              ) : null}
            </>
          )}
        </Menu>
      </div>
    </article>
  )
}

// ---------- Episode card ----------

interface EpisodeCardProps {
  anime: Anime
  episode: Episode
  /** The episode the viewer would continue with */
  current?: boolean
}

export function EpisodeCard({ anime, episode, current }: EpisodeCardProps) {
  const progress = useUser((u) => u.progress[progressKey(anime.id, episode.id)])
  const attached = useUser((u) => u.sources[progressKey(anime.id, episode.id)])
  const watched = !!progress?.completed
  const partial = !watched && !!progress && progress.duration > 0 && progress.position > 0
  const name = episodeTitle(episode, anime)
  const playable = episode.mediaSources.length > 0 || !!attached

  return (
    <article className={`episode-card ${current ? 'is-current' : ''}`}>
      <div className="episode-card__art">
        <EpisodeArt anime={anime} episode={episode} />
        {episode.durationMin ? <span className="badge episode-card__time">{formatRuntime(episode.durationMin)}</span> : null}
        {partial ? (
          <div className="progress episode-card__bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (progress.position / progress.duration) * 100)}%` }} />
          </div>
        ) : null}
        <button
          type="button"
          className={`episode-card__check ${watched ? 'is-on' : ''}`}
          aria-pressed={watched}
          aria-label={watched ? `${name}: снять отметку «просмотрено»` : `${name}: отметить просмотренной`}
          onClick={() => actions.setEpisodeWatched(anime.id, episode.id, !watched)}
        >
          {watched ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Play size={13} fill="currentColor" aria-hidden="true" />}
        </button>
      </div>
      <div className="episode-card__body">
        <h3 className="episode-card__title">
          <Link to={watchPath(anime, episode)} className="episode-card__link">
            {name}
          </Link>
          {current ? <span className="episode-card__now">{partial ? 'Продолжить' : 'Дальше'}</span> : null}
        </h3>
        <p className="episode-card__sub">
          <span lang="en">{episode.title ?? ''}</span>
          {!playable ? (
            <span className="episode-card__nosrc">
              <VideoOff size={14} aria-hidden="true" />
              Видео не добавлено
            </span>
          ) : null}
        </p>
      </div>
    </article>
  )
}
