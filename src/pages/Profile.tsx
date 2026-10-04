import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Bookmark, CircleCheck, Eye, Heart, History, Lock, Pencil, Play, Tv } from 'lucide-react'
import type { Anime } from '../types'
import { getAnime } from '../data/catalog'
import { AnimePosterCard, BackdropArt, EpisodeArt } from '../components/cards/cards'
import { EditProfileDialog, ProfileTabs } from '../components/profile/ProfileParts'
import { Avatar, EmptyState } from '../components/ui/basics'
import { useUser } from '../lib/store'
import { continueWatching, listCover, statusCounts, watchedEpisodeCount } from '../lib/selectors'
import { episodeTitle, watchPath } from '../lib/episodes'
import { ANIME_WORD, count, formatRemaining } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

export default function Profile() {
  useDocumentTitle('Профиль')
  const profile = useUser((u) => u.profile)
  const collection = useUser((u) => u.collection)
  const progress = useUser((u) => u.progress)
  const favorites = useUser((u) => u.favorites)
  const lists = useUser((u) => u.lists)
  const [editing, setEditing] = useState(false)

  const counts = useMemo(() => statusCounts(collection), [collection])
  const episodesWatched = useMemo(() => watchedEpisodeCount(progress), [progress])
  const recent = useMemo(() => continueWatching(progress).slice(0, 3), [progress])
  const favoriteAnime = favorites.map((id) => getAnime(id)).filter((a): a is Anime => !!a)

  const stats = [
    { icon: CircleCheck, value: counts.completed, label: 'просмотрено' },
    { icon: Eye, value: counts.watching, label: 'смотрю' },
    { icon: Bookmark, value: counts.planned, label: 'в планах' },
    { icon: Tv, value: episodesWatched, label: 'серий позади' },
  ]

  return (
    <div className="container page profile">
      <header className="profile__head">
        <Avatar avatar={profile.avatar} size={128} className="profile__avatar" />
        <div className="profile__who">
          <h1 className="page-title">{profile.name}</h1>
          <p className="profile__private">
            <Lock size={15} aria-hidden="true" />
            Личный профиль: его видишь только ты, данные хранятся в этом браузере
          </p>
          {profile.bio ? <p className="profile__bio">{profile.bio}</p> : null}
        </div>
        <dl className="profile__stats">
          {stats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="profile__stat">
              <Icon size={24} aria-hidden="true" />
              <div>
                <dd className="tabular">{value}</dd>
                <dt>{label}</dt>
              </div>
            </div>
          ))}
        </dl>
        <button type="button" className="btn profile__edit" onClick={() => setEditing(true)}>
          <Pencil size={18} aria-hidden="true" />
          Редактировать профиль
        </button>
      </header>

      <ProfileTabs current="overview" />

      <div className="profile__layout">
        <div className="profile__main">
          <section aria-labelledby="profile-recent">
            <div className="section-head">
              <h2 id="profile-recent" className="section-title">
                Недавно смотрел
              </h2>
              <Link to="/profile/history" className="section-link">
                Вся история
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            {recent.length > 0 ? (
              <ul className="recent">
                {recent.map(({ anime, episode, progress: p }) => {
                  const started = !!p && p.duration > 0 && p.position > 0
                  return (
                    <li key={anime.id} className="recent__item">
                      <div className="recent__art">
                        <EpisodeArt anime={anime} episode={episode} />
                      </div>
                      <div className="recent__text">
                        <h3 className="recent__title">
                          <Link to={`/anime/${anime.slug}`}>{anime.titleRu}</Link>
                        </h3>
                        <p className="meta">
                          <span>{episodeTitle(episode, anime)}</span>
                          <span>{started ? formatRemaining(p.position, p.duration) : 'ещё не начата'}</span>
                        </p>
                        <div className="progress recent__bar" aria-hidden="true">
                          <span style={{ width: `${started ? Math.min(100, (p.position / p.duration) * 100) : 0}%` }} />
                        </div>
                      </div>
                      <Link to={watchPath(anime, episode)} className="btn btn--sm btn--outline-accent recent__go">
                        <Play size={16} fill="currentColor" aria-hidden="true" />
                        {started ? 'Продолжить' : 'Смотреть'}
                        <span className="visually-hidden">: {anime.titleRu}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<History size={24} />}
                title="Истории пока нет"
                actions={
                  <Link to="/catalog" className="btn btn--primary">
                    Выбрать аниме
                  </Link>
                }
              >
                Начни смотреть любую серию — она появится здесь, и можно будет продолжить с того же места.
              </EmptyState>
            )}
          </section>

          <section className="section" aria-labelledby="profile-fav">
            <div className="section-head">
              <h2 id="profile-fav" className="section-title">
                Любимые аниме
              </h2>
              <Link to="/catalog" className="section-link">
                В каталог
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            {favoriteAnime.length > 0 ? (
              <div className="poster-grid profile__favorites">
                {favoriteAnime.map((anime) => (
                  <AnimePosterCard key={anime.id} anime={anime} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<Heart size={24} />} title="Любимых пока нет">
                Нажми «В любимые» на странице аниме, чтобы собрать здесь то, к чему хочется возвращаться.
              </EmptyState>
            )}
          </section>
        </div>

        <aside className="profile__side" aria-labelledby="profile-lists">
          <div className="section-head">
            <h2 id="profile-lists" className="section-title">
              Мои списки
            </h2>
            <Link to="/collection" className="section-link">
              Все
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          {lists.length > 0 ? (
            <ul className="profile__lists">
              {lists.slice(0, 4).map((list) => {
                const cover = listCover(list)
                return (
                  <li key={list.id}>
                    <Link to={`/collection/list/${list.id}`} className="list-banner">
                      {cover ? <BackdropArt anime={cover} ratio="2.4 / 1" /> : <span className="list-banner__blank" />}
                      <span className="list-banner__text">
                        <span className="list-banner__title">{list.title}</span>
                        <span>{count(list.animeIds.filter((id) => getAnime(id)).length, ANIME_WORD)}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="profile__lists-empty">
              Списков пока нет. Создать первый можно на странице{' '}
              <Link to="/collection" style={{ color: 'var(--accent)' }}>
                «Моя коллекция»
              </Link>
              .
            </p>
          )}
        </aside>
      </div>

      <EditProfileDialog open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}
