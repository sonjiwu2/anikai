import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CirclePlay, ExternalLink, Heart, Info, Link2, Play, Star, StickyNote, Trash2 } from 'lucide-react'
import { LinkVideoDialog } from '../components/player/SourceDialogs'
import type { Anime, EpisodeNote } from '../types'
import { CATALOG_DATE, FORMAT_LABEL, STATUS_LABEL, getAnime } from '../data/catalog'
import { NotFound } from './NotFound'
import { AnimePosterCard, EpisodeCard } from '../components/cards/cards'
import { CollectionControl } from '../components/collection/CollectionControl'
import { Img } from '../components/ui/Img'
import { EmptyState } from '../components/ui/basics'
import { actions, useUser } from '../lib/store'
import { similar, summarize } from '../lib/selectors'
import { allEpisodes, episodeTitle, findEpisode, isPlayable, watchPath } from '../lib/episodes'
import { EPISODES, count, formatFullDate, formatRuntime, formatTime } from '../lib/format'
import { toast } from '../lib/toast'
import { useDocumentTitle } from '../lib/hooks'

type TabId = 'episodes' | 'about' | 'notes' | 'similar'
const TABS: { id: TabId; label: string }[] = [
  { id: 'episodes', label: 'Серии' },
  { id: 'about', label: 'Об аниме' },
  { id: 'notes', label: 'Мои заметки' },
  { id: 'similar', label: 'Похожее' },
]

export default function AnimeDetail() {
  const { slug } = useParams()
  const anime = getAnime(slug)
  if (!anime) {
    return <NotFound title="Такого аниме нет в каталоге">Возможно, адрес набран с ошибкой. В каталоге можно найти аниме по названию.</NotFound>
  }
  return <AnimeView key={anime.id} anime={anime} />
}

function AnimeView({ anime }: { anime: Anime }) {
  useDocumentTitle(anime.titleRu)
  const [params, setParams] = useSearchParams()
  const progress = useUser((u) => u.progress)
  const favorite = useUser((u) => u.favorites.includes(anime.id))
  const noteCount = useUser((u) => u.notes).filter((n) => n.animeId === anime.id).length

  const tab: TabId = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as TabId) : 'episodes'
  const summary = useMemo(() => summarize(anime, progress), [anime, progress])
  const episodes = allEpisodes(anime)
  const isMovie = anime.format === 'movie'
  const target = summary.next ?? episodes[0]
  const inProgress = summary.started || summary.watched > 0

  const setTab = (id: TabId) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id === 'episodes') next.delete('tab')
        else next.set('tab', id)
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  let watchLabel: string
  if (!summary.next) watchLabel = isMovie ? 'Смотреть ещё раз' : 'Смотреть с начала'
  else if (isMovie) watchLabel = inProgress ? 'Продолжить фильм' : 'Смотреть фильм'
  else watchLabel = inProgress ? `Продолжить · серия ${summary.next.number}` : 'Смотреть с начала'

  return (
    <div className="detail">
      <section className="detail__hero">
        <div className="detail__backdrop" aria-hidden="true">
          <img
            src={anime.backdrop}
            srcSet={`${anime.backdropSm} 960w, ${anime.backdrop} 1900w`}
            sizes="(min-width: 900px) 70vw, 100vw"
            width={1900}
            height={Math.round(1900 / anime.backdropRatio)}
            alt=""
            fetchPriority="high"
            decoding="async"
            style={{ objectPosition: `${anime.focalX}% ${anime.focalY}%` }}
          />
        </div>
        <div className="container detail__inner">
          <nav className="detail__crumbs" aria-label="Навигация">
            <Link to="/catalog">Каталог</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{anime.titleRu}</span>
          </nav>
          <div className="detail__main">
            <div className="detail__poster">
              <Img src={anime.poster} srcSet={`${anime.posterSm} 300w, ${anime.poster} ${anime.posterWidth}w`} sizes="(min-width: 768px) 210px, 116px" alt={`Постер: ${anime.titleRu}`} ratio="2 / 3" priority />
            </div>
            <div className="detail__text">
              <h1 className="detail__title">{anime.titleRu}</h1>
              <p className="detail__alt" lang="en">
                {anime.titleEn}
              </p>
              <div className="detail__facts">
                {anime.rating > 0 ? (
                  <a
                    href={anime.ratingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="badge detail__rating"
                    title={`Оценка ${anime.ratingSource} на ${formatCatalogDate()}. Открыть страницу на ${anime.ratingSource}`}
                  >
                    <Star size={15} fill="currentColor" aria-hidden="true" />
                    <span className="visually-hidden">Оценка </span>
                    {anime.rating.toFixed(1)}
                    <span className="detail__rating-source">{anime.ratingSource}</span>
                  </a>
                ) : null}
                <p className="meta">
                  <span>{anime.year}</span>
                  {anime.genres.slice(0, 3).map((g) => (
                    <span key={g}>{g}</span>
                  ))}
                  <span>{isMovie ? formatRuntime(episodes[0]?.durationMin ?? 0) : count(episodes.length, EPISODES)}</span>
                </p>
              </div>
            </div>
            <p className="detail__synopsis">{anime.synopsis}</p>
          </div>
          <div className="detail__actions">
            {target ? (
              <Link to={watchPath(anime, target)} className="btn btn--primary detail__watch">
                <Play size={20} fill="currentColor" aria-hidden="true" />
                {watchLabel}
              </Link>
            ) : null}
            <CollectionControl anime={anime} variant="button" />
            <button
              type="button"
              className={`btn ${favorite ? 'is-favorite' : ''}`}
              aria-pressed={favorite}
              onClick={() => {
                const now = actions.toggleFavorite(anime.id)
                toast(now ? `«${anime.titleRu}» в любимых` : `«${anime.titleRu}» убрано из любимых`)
              }}
            >
              <Heart size={20} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
              {favorite ? 'В любимых' : 'В любимые'}
            </button>
            {anime.trailerUrl ? (
              <a href={anime.trailerUrl} target="_blank" rel="noreferrer" className="btn btn--ghost">
                <CirclePlay size={22} aria-hidden="true" />
                Трейлер
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div className="container detail__body">
        <div className="tabs" role="tablist" aria-label="Разделы страницы">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`detail-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="detail-panel"
              className="tab"
              onClick={() => setTab(t.id)}
            >
              {t.id === 'episodes' && isMovie ? 'Фильм' : t.label}
              {t.id === 'notes' && noteCount > 0 ? <span className="tab__count">{noteCount}</span> : null}
            </button>
          ))}
        </div>

        <div id="detail-panel" role="tabpanel" aria-labelledby={`detail-tab-${tab}`} className="detail__panel">
          {tab === 'episodes' ? <EpisodesTab anime={anime} nextId={summary.next?.id} /> : null}
          {tab === 'about' ? <AboutTab anime={anime} /> : null}
          {tab === 'notes' ? <NotesTab anime={anime} /> : null}
          {tab === 'similar' ? <SimilarTab anime={anime} /> : null}
        </div>
      </div>
    </div>
  )
}

function formatCatalogDate(): string {
  return formatFullDate(CATALOG_DATE, 'UTC')
}

// ---------- Tabs ----------

function EpisodesTab({ anime, nextId }: { anime: Anime; nextId?: string }) {
  const [params, setParams] = useSearchParams()
  const sources = useUser((u) => u.sources)
  const [linking, setLinking] = useState(false)

  const nextSeasonId = nextId ? findEpisode(anime, nextId)?.season.id : undefined
  const season = anime.seasons.find((s) => s.id === params.get('season')) ?? anime.seasons.find((s) => s.id === nextSeasonId) ?? anime.seasons[0]
  if (!season) return null

  const withoutVideo = season.episodes.filter((e) => !isPlayable(anime, e, sources)).length
  const first = season.episodes[0]

  return (
    <>
      <h2 className="visually-hidden">{anime.format === 'movie' ? 'Фильм' : 'Серии'}</h2>
      <div className="detail__toolbar">
        {anime.seasons.length > 1 ? (
          <label className="detail__season">
            <span className="visually-hidden">Сезон</span>
            <select
              className="select"
              value={season.id}
              onChange={(e) =>
                setParams(
                  (prev) => {
                    const next = new URLSearchParams(prev)
                    next.set('season', e.target.value)
                    return next
                  },
                  { replace: true, preventScrollReset: true },
                )
              }
            >
              {anime.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {s.year}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted">
            {season.title}, {season.year}
          </p>
        )}
        {first ? (
          <button type="button" className="btn btn--sm" onClick={() => setLinking(true)}>
            <Link2 size={18} aria-hidden="true" />
            Привязать видео
          </button>
        ) : null}
      </div>
      {first ? <LinkVideoDialog anime={anime} episode={first} open={linking} onClose={() => setLinking(false)} /> : null}

      {anime.catalogNote || withoutVideo > 0 ? (
        <div className="banner detail__note">
          <Info size={20} aria-hidden="true" />
          <p>
            {anime.catalogNote}
            {anime.catalogNote && withoutVideo > 0 ? ' ' : ''}
            {withoutVideo > 0
              ? withoutVideo === season.episodes.length
                ? 'Видео для этого сезона пока не добавлено.'
                : `Без видео: ${count(withoutVideo, EPISODES)}.`
              : ''}
          </p>
        </div>
      ) : null}

      <div className="episode-grid">
        {season.episodes.map((ep) => (
          <EpisodeCard key={ep.id} anime={anime} episode={ep} current={ep.id === nextId} />
        ))}
      </div>
    </>
  )
}

function AboutTab({ anime }: { anime: Anime }) {
  const episodes = allEpisodes(anime)
  return (
    <div className="about">
      <div className="about__text">
        <h2 className="section-title">Описание</h2>
        {anime.description.split('\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {anime.descriptionSource ? (
          <p className="about__source">
            Описание:{' '}
            <a href={anime.descriptionSource.url} target="_blank" rel="noreferrer">
              {anime.descriptionSource.label}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </p>
        ) : null}
      </div>
      <dl className="about__facts">
        <div>
          <dt>Формат</dt>
          <dd>{FORMAT_LABEL[anime.format]}</dd>
        </div>
        <div>
          <dt>Год</dt>
          <dd>{anime.year}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>{STATUS_LABEL[anime.releaseStatus]}</dd>
        </div>
        <div>
          <dt>Жанры</dt>
          <dd>
            <ul className="chips">
              {anime.genres.map((g) => (
                <li key={g}>
                  <Link to={`/catalog?genre=${encodeURIComponent(g)}`} className="chip">
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        {anime.studios.length ? (
          <div>
            <dt>Студия</dt>
            <dd>{anime.studios.join(', ')}</dd>
          </div>
        ) : null}
        {anime.format !== 'movie' ? (
          <div>
            <dt>В каталоге</dt>
            <dd>
              <ul className="about__seasons">
                {anime.seasons.map((s) => (
                  <li key={s.id}>
                    <span>{s.title}</span>
                    <span className="muted">
                      {s.year} · {count(s.episodes.length, EPISODES)}
                    </span>
                  </li>
                ))}
              </ul>
              {anime.catalogNote ? <p className="muted about__note">{anime.catalogNote}</p> : null}
            </dd>
          </div>
        ) : (
          <div>
            <dt>Длительность</dt>
            <dd>{formatRuntime(episodes[0]?.durationMin ?? 0)}</dd>
          </div>
        )}
        <div>
          <dt>Оригинальное название</dt>
          <dd lang="ja">{anime.titleOriginal}</dd>
        </div>
        <div>
          <dt>Оценки зрителей</dt>
          <dd>
            <ul className="about__seasons">
              {anime.ratingShikimori ? (
                <li>
                  <span>
                    <a href={anime.ratingUrl} target="_blank" rel="noreferrer">
                      Shikimori
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  </span>
                  <span className="tabular">{anime.ratingShikimori.toFixed(2)} из 10</span>
                </li>
              ) : null}
              <li>
                <span>
                  <a href={anime.sourceUrl} target="_blank" rel="noreferrer">
                    AniList
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </span>
                <span className="tabular">{Math.round(anime.ratingAniList * 10)} из 100</span>
              </li>
            </ul>
            <p className="muted about__note">
              Данные на {formatCatalogDate()}. В списках у {new Intl.NumberFormat('ru-RU').format(anime.popularity)} зрителей AniList.
            </p>
          </dd>
        </div>
      </dl>
    </div>
  )
}

function NotesTab({ anime }: { anime: Anime }) {
  const allNotes = useUser((u) => u.notes)
  const groups = useMemo(() => {
    const mine = allNotes.filter((n) => n.animeId === anime.id)
    const order = new Map(allEpisodes(anime).map((e, i) => [e.id, i]))
    const byEpisode = new Map<string, EpisodeNote[]>()
    for (const n of mine) byEpisode.set(n.episodeId, [...(byEpisode.get(n.episodeId) ?? []), n])
    return [...byEpisode.entries()]
      .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
      .map(([episodeId, notes]) => ({ ctx: findEpisode(anime, episodeId), notes: notes.sort((a, b) => a.time - b.time) }))
  }, [allNotes, anime])

  if (groups.length === 0) {
    const first = allEpisodes(anime)[0]
    return (
      <EmptyState
        icon={<StickyNote size={24} />}
        title="Заметок к этому аниме пока нет"
        actions={
          first ? (
            <Link to={watchPath(anime, first)} className="btn btn--primary">
              Открыть плеер
            </Link>
          ) : undefined
        }
      >
        Заметки пишутся под плеером во время просмотра: каждая запоминает момент серии, к которому относится. Их видишь только ты.
      </EmptyState>
    )
  }

  return (
    <div className="notes-all">
      {groups.map(({ ctx, notes }) =>
        ctx ? (
          <section key={ctx.episode.id} className="notes-all__group">
            <h2 className="notes-all__title">
              <Link to={watchPath(anime, ctx.episode)}>
                {anime.format === 'movie' ? 'Фильм' : `${ctx.season.title}, ${episodeTitle(ctx.episode, anime).toLowerCase()}`}
              </Link>
            </h2>
            <ul className="notes__list" style={{ marginTop: 0 }}>
              {notes.map((note) => (
                <li key={note.id} className="notes__item">
                  <Link
                    to={`${watchPath(anime, ctx.episode)}?t=${Math.floor(note.time)}`}
                    className="notes__time tabular"
                    aria-label={`Открыть серию на ${formatTime(note.time)}`}
                  >
                    {formatTime(note.time)}
                  </Link>
                  <p className="notes__text">{note.text}</p>
                  <div className="notes__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Удалить заметку на ${formatTime(note.time)}`}
                      onClick={() => {
                        const removed = actions.deleteNote(note.id)
                        if (removed) toast('Заметка удалена', { action: { label: 'Вернуть', onClick: () => actions.restoreNote(removed) } })
                      }}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  )
}

function SimilarTab({ anime }: { anime: Anime }) {
  const items = similar(anime, 12)
  if (items.length === 0) {
    return (
      <EmptyState icon={<Info size={24} />} title="Похожих аниме в каталоге нет">
        У этого аниме нет общих жанров с остальными.
      </EmptyState>
    )
  }
  return (
    <>
      <h2 className="visually-hidden">Похожие аниме</h2>
      <p className="detail__hint" style={{ marginBottom: 16 }}>
        Аниме с теми же жанрами: {anime.genres.join(', ').toLowerCase()}.
      </p>
      <div className="poster-grid">
        {items.map((a) => (
          <AnimePosterCard key={a.id} anime={a} />
        ))}
      </div>
    </>
  )
}
