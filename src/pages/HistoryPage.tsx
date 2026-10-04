import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CircleCheck, History, Search, SearchX, Trash2, X } from 'lucide-react'
import { EpisodeArt } from '../components/cards/cards'
import { ProfileStrip } from '../components/profile/ProfileParts'
import { ConfirmDialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/basics'
import { actions, useUser } from '../lib/store'
import { history, type HistoryItem } from '../lib/selectors'
import { searchAnime } from '../lib/search'
import { episodeTitle, watchPath } from '../lib/episodes'
import { EPISODES, count, formatClock, formatRelativeDay, formatRemaining } from '../lib/format'
import { toast } from '../lib/toast'
import { useDocumentTitle } from '../lib/hooks'

export default function HistoryPage() {
  useDocumentTitle('История просмотра')
  const progress = useUser((u) => u.progress)
  const timeZone = useUser((u) => u.preferences.timeZone)
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState(false)

  const all = useMemo(() => history(progress), [progress])
  const groups = useMemo(() => {
    const matches = query.trim() ? new Set(searchAnime(query).map((a) => a.id)) : null
    const items = matches ? all.filter((i) => matches.has(i.anime.id)) : all
    // Items are already newest first, so consecutive items of one day form a group.
    const out: { day: string; items: HistoryItem[] }[] = []
    for (const item of items) {
      const day = formatRelativeDay(item.progress.watchedAt, timeZone)
      const last = out[out.length - 1]
      if (last?.day === day) last.items.push(item)
      else out.push({ day, items: [item] })
    }
    return out
  }, [all, query, timeZone])

  return (
    <div className="container page history">
      <ProfileStrip current="history" />

      <header className="page-head">
        <div>
          <h1 className="page-title">История просмотра</h1>
          <p className="page-lead">{all.length > 0 ? `${count(all.length, EPISODES)} с сохранённым прогрессом` : 'Здесь собираются серии, которые ты открывал в плеере'}</p>
        </div>
        {all.length > 0 ? (
          <button type="button" className="btn btn--danger" onClick={() => setConfirming(true)}>
            <Trash2 size={18} aria-hidden="true" />
            Очистить историю
          </button>
        ) : null}
      </header>

      {all.length === 0 ? (
        <EmptyState
          icon={<History size={26} />}
          title="История пуста"
          actions={
            <Link to="/catalog" className="btn btn--primary">
              Открыть каталог
            </Link>
          }
        >
          Запусти любую серию: Anikai запомнит, где ты остановился, и предложит продолжить.
        </EmptyState>
      ) : (
        <>
          <div className={`input-wrap history__search ${query ? 'input-wrap--clearable' : ''}`}>
            <Search size={20} aria-hidden="true" />
            <input
              className="input"
              type="search"
              name="history-search"
              aria-label="Поиск по истории"
              placeholder="Название аниме…"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button type="button" className="icon-btn input-wrap__clear" aria-label="Очистить поиск" onClick={() => setQuery('')}>
                <X size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={<SearchX size={24} />}
              title="В истории такого нет"
              actions={
                <button type="button" className="btn" onClick={() => setQuery('')}>
                  Очистить поиск
                </button>
              }
            >
              По запросу «{query.trim()}» просмотренных серий не нашлось.
            </EmptyState>
          ) : (
            groups.map((group) => (
              <section key={group.day} className="history__group" aria-label={group.day}>
                <h2 className="history__day">{group.day}</h2>
                <ul className="history__list">
                  {group.items.map(({ anime, episode, progress: p }) => {
                    const partial = !p.completed && p.duration > 0
                    return (
                      <li key={`${anime.id}/${episode.id}`} className="history__item">
                        <div className="history__art">
                          <EpisodeArt anime={anime} episode={episode} />
                          {partial ? (
                            <div className="progress history__bar" aria-hidden="true">
                              <span style={{ width: `${Math.min(100, (p.position / p.duration) * 100)}%` }} />
                            </div>
                          ) : null}
                        </div>
                        <div className="history__text">
                          <h3 className="history__title">
                            <Link to={watchPath(anime, episode)} className="history__link">
                              {anime.titleRu}
                            </Link>
                          </h3>
                          <p className="meta">
                            <span>{episodeTitle(episode, anime)}</span>
                            <span className="tabular">{formatClock(p.watchedAt, timeZone)}</span>
                          </p>
                          <p className={`history__state ${p.completed ? 'is-done' : ''}`}>
                            {p.completed ? (
                              <>
                                <CircleCheck size={16} aria-hidden="true" />
                                Просмотрена
                              </>
                            ) : partial ? (
                              formatRemaining(p.position, p.duration)
                            ) : (
                              'Начата'
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="icon-btn history__remove"
                          aria-label={`Убрать из истории: ${anime.titleRu}, ${episodeTitle(episode, anime).toLowerCase()}`}
                          onClick={() => {
                            const removed = actions.removeProgress(anime.id, episode.id)
                            if (removed) toast('Серия убрана из истории', { action: { label: 'Вернуть', onClick: () => actions.restoreProgress(removed) } })
                          }}
                        >
                          <X size={18} aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Очистить всю историю?"
        message="Сохранённые позиции и отметки «просмотрено» у всех серий удалятся. Коллекция, списки и заметки останутся. Вернуть историю можно будет только из резервной копии."
        confirmLabel="Очистить историю"
        danger
        onConfirm={() => {
          actions.clearHistory()
          toast('История очищена')
        }}
      />
    </div>
  )
}
