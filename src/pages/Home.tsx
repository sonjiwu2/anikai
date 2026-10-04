import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, ChevronLeft, ChevronRight, CirclePlay, Play, Shuffle } from 'lucide-react'
import type { Anime } from '../types'
import { CATALOG, FORMAT_LABEL, HERO_SLUGS, getAnime } from '../data/catalog'
import { AnimePosterCard, ContinueWatchingCard } from '../components/cards/cards'
import { CollectionControl } from '../components/collection/CollectionControl'
import { useUser } from '../lib/store'
import { continueWatching, forYou, popular, summarize } from '../lib/selectors'
import { watchPath } from '../lib/episodes'
import { useDocumentTitle } from '../lib/hooks'

type TabId = 'for-you' | 'popular' | 'library'
const TABS: { id: TabId; label: string }[] = [
  { id: 'for-you', label: 'Для тебя' },
  { id: 'popular', label: 'Популярное' },
  { id: 'library', label: 'Библиотека' },
]
const SHELF_SIZE = 12
const HERO: Anime[] = HERO_SLUGS.map((slug) => getAnime(slug)).filter((a): a is Anime => !!a)

export function Home() {
  useDocumentTitle()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const progress = useUser((u) => u.progress)
  const collection = useUser((u) => u.collection)
  const favorites = useUser((u) => u.favorites)

  const tab: TabId = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as TabId) : 'for-you'
  const continueItems = useMemo(() => continueWatching(progress).slice(0, 3), [progress])
  const recommended = useMemo(() => forYou({ collection, favorites }), [collection, favorites])

  const openRandom = () => {
    // Prefer something the viewer has not collected yet.
    const pool = CATALOG.filter((a) => !collection[a.id])
    const from = pool.length ? pool : CATALOG
    const pick = from[Math.floor(Math.random() * from.length)]
    if (pick) navigate(`/anime/${pick.slug}`)
  }

  return (
    <div className="container page home">
      <h1 className="visually-hidden">Anikai — главная</h1>
      <Hero />

      <div className="home__bar">
        <div className="tabs" role="tablist" aria-label="Подборки">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`home-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="home-shelf"
              className="tab"
              onClick={() => setParams(t.id === 'for-you' ? {} : { tab: t.id }, { replace: true, preventScrollReset: true })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost home__random" onClick={openRandom}>
          <Shuffle size={20} aria-hidden="true" />
          Случайное аниме
        </button>
      </div>

      {continueItems.length > 0 ? (
        <section className="section" aria-labelledby="home-continue">
          <div className="section-head">
            <h2 id="home-continue" className="section-title">
              Продолжить просмотр
            </h2>
            <Link to="/profile/history" className="section-link">
              Вся история
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="continue-strip">
            {continueItems.map((item) => (
              <ContinueWatchingCard key={item.anime.id} anime={item.anime} episode={item.episode} progress={item.progress} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section" id="home-shelf" role="tabpanel" aria-labelledby={`home-tab-${tab}`}>
        {tab === 'for-you' ? (
          <Shelf
            title={recommended.personalized ? 'Подобрано для тебя' : 'С чего начать'}
            hint={recommended.personalized ? 'по жанрам из твоей коллекции' : 'добавь аниме в коллекцию — подборка подстроится'}
            items={recommended.items.slice(0, SHELF_SIZE).map((anime) => ({ anime }))}
          />
        ) : tab === 'popular' ? (
          <Shelf title="Популярное" hint="по числу зрителей на AniList" items={popular().slice(0, SHELF_SIZE).map((anime) => ({ anime }))} />
        ) : (
          <Shelf
            title="Библиотека аниме"
            hint="выбирай историю и смотри в своём темпе"
            items={CATALOG.map((anime) => ({ anime }))}
          />
        )}
      </section>
    </div>
  )
}

function Shelf({ title, hint, items }: { title: string; hint: string; items: { anime: Anime; note?: string }[] }) {
  return (
    <>
      <div className="section-head">
        <h2 className="section-title">
          {title}
          <small>{hint}</small>
        </h2>
        <Link to="/catalog" className="section-link">
          В каталог
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className="poster-grid">
        {items.map(({ anime, note }) => (
          <AnimePosterCard key={anime.id} anime={anime} note={note} />
        ))}
      </div>
    </>
  )
}

function Hero() {
  const [index, setIndex] = useState(0)
  const progress = useUser((u) => u.progress)
  const anime = HERO[index] ?? HERO[0]
  if (!anime) return null

  const summary = summarize(anime, progress)
  const target = summary.next ?? anime.seasons[0]?.episodes[0]
  const step = (delta: number) => setIndex((i) => (i + delta + HERO.length) % HERO.length)

  return (
    <section className="hero" aria-roledescription="карусель" aria-label="Рекомендуем">
      {/* Only the active slide's artwork is in the DOM, so only one large image loads. */}
      <div className="hero__art" key={anime.id}>
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
      <div className="hero__content">
        <div className="hero__top">
          <p className="hero__label">Выбор редакции</p>
          <div className="hero__pager">
            <button type="button" className="icon-btn hero__arrow" onClick={() => step(-1)} aria-label="Предыдущее аниме">
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <span className="hero__count tabular" aria-label={`Слайд ${index + 1} из ${HERO.length}`}>
              {index + 1} / {HERO.length}
            </span>
            <button type="button" className="icon-btn hero__arrow" onClick={() => step(1)} aria-label="Следующее аниме">
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <h2 className="hero__title" aria-live="polite">
          {anime.titleRu}
        </h2>
        <p className="meta hero__meta">
          {anime.genres.slice(0, 2).map((g) => (
            <span key={g}>{g}</span>
          ))}
          <span>{anime.year}</span>
          <span>{FORMAT_LABEL[anime.format]}</span>
        </p>
        <p className="hero__tagline">{anime.tagline}</p>
        <div className="hero__actions">
          {target ? (
            <Link to={watchPath(anime, target)} className="btn btn--primary hero__watch">
              <Play size={20} fill="currentColor" aria-hidden="true" />
              {summary.started ? 'Продолжить' : 'Смотреть'}
            </Link>
          ) : null}
          <CollectionControl anime={anime} variant="button" />
          {anime.trailerUrl ? (
            <a href={anime.trailerUrl} target="_blank" rel="noreferrer" className="btn btn--ghost">
              <CirclePlay size={22} aria-hidden="true" />
              Трейлер
            </a>
          ) : null}
          <Link to={`/anime/${anime.slug}`} className="btn btn--ghost">
            Подробнее
          </Link>
        </div>
      </div>
    </section>
  )
}
