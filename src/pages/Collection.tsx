import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowUpDown, Bookmark, EllipsisVertical, FolderPlus, Pencil, Play, Plus, Search, SearchX, Trash2, X } from 'lucide-react'
import type { Anime, CollectionEntry, CollectionStatus, UserList } from '../types'
import { getAnime } from '../data/catalog'
import { buildDemoData } from '../data/demo'
import { BackdropArt } from '../components/cards/cards'
import { CollectionMenuItems } from '../components/collection/CollectionControl'
import { AddToListDialog, ListFormDialog } from '../components/collection/ListDialogs'
import { ConfirmDialog } from '../components/ui/Dialog'
import { Menu, MenuItem } from '../components/ui/Menu'
import { EmptyState } from '../components/ui/basics'
import { actions, useUser } from '../lib/store'
import { listCover, statusCounts, summarize, type AnimeSummary } from '../lib/selectors'
import { searchAnime } from '../lib/search'
import { watchPath } from '../lib/episodes'
import { ANIME_WORD, EPISODES, count, plural } from '../lib/format'
import { STATUSES, STATUS_TITLES } from '../lib/userData'
import { toast } from '../lib/toast'
import { useDocumentTitle } from '../lib/hooks'

type SortId = 'recent' | 'added' | 'title' | 'progress'
const SORTS: { id: SortId; label: string }[] = [
  { id: 'recent', label: 'Недавно смотрел' },
  { id: 'added', label: 'Недавно добавлено' },
  { id: 'title', label: 'По названию' },
  { id: 'progress', label: 'По прогрессу' },
]

interface Row {
  anime: Anime
  entry: CollectionEntry
  summary: AnimeSummary
}

export default function Collection() {
  useDocumentTitle('Моя коллекция')
  const [params, setParams] = useSearchParams()
  const collection = useUser((u) => u.collection)
  const progress = useUser((u) => u.progress)
  const lists = useUser((u) => u.lists)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const counts = useMemo(() => statusCounts(collection), [collection])
  const total = STATUSES.reduce((sum, s) => sum + counts[s], 0)
  const requested = params.get('status') as CollectionStatus
  // Open on the first non-empty status so the page never starts on an empty tab by accident.
  const status: CollectionStatus = STATUSES.includes(requested) ? requested : (STATUSES.find((s) => counts[s] > 0) ?? 'watching')
  const sort: SortId = SORTS.some((s) => s.id === params.get('sort')) ? (params.get('sort') as SortId) : 'recent'

  const rows = useMemo(() => {
    const all: Row[] = []
    for (const entry of Object.values(collection)) {
      const anime = getAnime(entry.animeId)
      if (anime && entry.status === status) all.push({ anime, entry, summary: summarize(anime, progress) })
    }
    const matches = query.trim() ? new Set(searchAnime(query).map((a) => a.id)) : null
    const filtered = matches ? all.filter((r) => matches.has(r.anime.id)) : all
    const lastSeen = (r: Row) => r.summary.lastWatchedAt ?? r.entry.updatedAt
    const ratio = (r: Row) => (r.summary.total ? r.summary.watched / r.summary.total : 0)
    const sorters: Record<SortId, (a: Row, b: Row) => number> = {
      recent: (a, b) => lastSeen(b).localeCompare(lastSeen(a)),
      added: (a, b) => b.entry.addedAt.localeCompare(a.entry.addedAt),
      title: (a, b) => a.anime.titleRu.localeCompare(b.anime.titleRu, 'ru'),
      progress: (a, b) => ratio(b) - ratio(a) || a.anime.titleRu.localeCompare(b.anime.titleRu, 'ru'),
    }
    return filtered.sort(sorters[sort])
  }, [collection, progress, status, query, sort])

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  const loadDemo = () => {
    actions.merge(buildDemoData())
    toast('Пример коллекции загружен. Убрать его можно в настройках, раздел «Данные».')
  }

  return (
    <div className="container page collection">
      <header className="page-head">
        <div>
          <h1 className="page-title">Моя коллекция</h1>
          <p className="page-lead">Твои истории и планы на вечер</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setFormOpen(true)}>
          <Plus size={20} aria-hidden="true" />
          Создать список
        </button>
      </header>

      {total === 0 ? (
        <EmptyState
          icon={<Bookmark size={26} />}
          title="В коллекции пока пусто"
          actions={
            <>
              <Link to="/catalog" className="btn btn--primary">
                Открыть каталог
              </Link>
              <button type="button" className="btn" onClick={loadDemo}>
                Загрузить пример коллекции
              </button>
            </>
          }
        >
          Нажми «В коллекцию» на карточке или странице аниме — оно появится здесь. Начатые серии попадают в «Смотрю» сами.
        </EmptyState>
      ) : (
        <>
          <div className="collection__bar">
            <div className="tabs" role="tablist" aria-label="Статус">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  id={`collection-tab-${s}`}
                  aria-selected={status === s}
                  aria-controls="collection-panel"
                  className="tab"
                  onClick={() => setParam('status', s)}
                >
                  {STATUS_TITLES[s]}
                  <span className="tab__count tabular">{counts[s]}</span>
                </button>
              ))}
            </div>
            <div className="collection__tools">
              <div className={`input-wrap ${query ? 'input-wrap--clearable' : ''}`}>
                <Search size={20} aria-hidden="true" />
                <input
                  className="input"
                  type="search"
                  name="collection-search"
                  aria-label="Поиск в коллекции"
                  placeholder="Поиск в коллекции…"
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
              <label className="collection__sort">
                <ArrowUpDown size={18} aria-hidden="true" />
                <span className="visually-hidden">Сортировка</span>
                <select className="select" value={sort} onChange={(e) => setParam('sort', e.target.value === 'recent' ? null : e.target.value)}>
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div id="collection-panel" role="tabpanel" aria-labelledby={`collection-tab-${status}`}>
            <h2 className="visually-hidden">{STATUS_TITLES[status]}</h2>
            {rows.length > 0 ? (
              <div className="collection__grid">
                {rows.map((row) => (
                  <CollectionCard key={row.anime.id} {...row} />
                ))}
              </div>
            ) : query.trim() ? (
              <EmptyState
                icon={<SearchX size={24} />}
                title={`В «${STATUS_TITLES[status]}» ничего не нашлось`}
                actions={
                  <button type="button" className="btn" onClick={() => setQuery('')}>
                    Очистить поиск
                  </button>
                }
              >
                По запросу «{query.trim()}» в этом статусе аниме нет. Возможно, оно лежит в другой вкладке.
              </EmptyState>
            ) : (
              <EmptyState
                icon={<Bookmark size={24} />}
                title={`В «${STATUS_TITLES[status]}» пока ничего нет`}
                actions={
                  <Link to="/catalog" className="btn">
                    Открыть каталог
                  </Link>
                }
              >
                Статус аниме меняется в меню «⋮» на его карточке или на странице аниме.
              </EmptyState>
            )}
          </div>
        </>
      )}

      <section className="section" aria-labelledby="collection-lists">
        <div className="section-head">
          <h2 id="collection-lists" className="section-title">
            Мои списки
          </h2>
        </div>
        <div className="lists-grid">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
          <button type="button" className="list-new" onClick={() => setFormOpen(true)}>
            <span className="list-new__icon" aria-hidden="true">
              <FolderPlus size={22} />
            </span>
            <span className="list-new__title">Создать список</span>
            <span className="muted">Собери аниме под настроение</span>
          </button>
        </div>
      </section>

      <ListFormDialog open={formOpen} onClose={() => setFormOpen(false)} navigateAfterCreate />
    </div>
  )
}

function CollectionCard({ anime, entry, summary }: Row) {
  const [listOpen, setListOpen] = useState(false)
  const isMovie = anime.format === 'movie'
  const percent = summary.total ? (summary.watched / summary.total) * 100 : 0
  const target = summary.next ?? anime.seasons[0]?.episodes[0]
  const action = !summary.next ? 'Пересмотреть' : summary.started || summary.watched > 0 ? 'Продолжить' : 'Смотреть'
  const badge = isMovie
    ? summary.watched > 0
      ? 'Просмотрен'
      : 'Фильм'
    : `${summary.watched} из ${summary.total} ${plural(summary.total, EPISODES)}`

  return (
    <article className="collection-card">
      <div className="collection-card__art">
        <BackdropArt anime={anime} />
        <span className="badge collection-card__badge tabular">{badge}</span>
        <div className="progress collection-card__bar" role="img" aria-label={`Просмотрено ${Math.round(percent)}%`}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="collection-card__body">
        <h3 className="collection-card__title">
          <Link to={`/anime/${anime.slug}`} className="collection-card__link">
            {anime.titleRu}
          </Link>
        </h3>
        {target ? (
          <Link to={watchPath(anime, target)} className="btn btn--sm btn--outline-accent collection-card__go">
            <Play size={16} fill="currentColor" aria-hidden="true" />
            {action}
            {!isMovie && summary.next && action === 'Продолжить' ? <span className="visually-hidden">: серия {summary.next.number}</span> : null}
          </Link>
        ) : null}
        <Menu label={`Действия: ${anime.titleRu}`} trigger={<EllipsisVertical size={20} aria-hidden="true" />} triggerClassName="icon-btn collection-card__menu">
          {(close) => <CollectionMenuItems anime={anime} status={entry.status} close={close} onAddToList={() => setListOpen(true)} />}
        </Menu>
      </div>
      <AddToListDialog anime={anime} open={listOpen} onClose={() => setListOpen(false)} />
    </article>
  )
}

function ListCard({ list }: { list: UserList }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const cover = listCover(list)
  const size = list.animeIds.filter((id) => getAnime(id)).length

  return (
    <article className="list-card">
      <div className="list-card__art">{cover ? <BackdropArt anime={cover} ratio="2.4 / 1" /> : <div className="list-card__blank" />}</div>
      <div className="list-card__body">
        <div className="list-card__text">
          <h3 className="list-card__title">
            <Link to={`/collection/list/${list.id}`} className="list-card__link">
              {list.title}
            </Link>
          </h3>
          <p className="muted">{count(size, ANIME_WORD)}</p>
        </div>
        <Menu label={`Действия со списком «${list.title}»`} trigger={<EllipsisVertical size={20} aria-hidden="true" />} triggerClassName="icon-btn list-card__menu">
          {(close) => (
            <>
              <MenuItem
                icon={<Pencil size={18} aria-hidden="true" />}
                onSelect={() => {
                  close()
                  setEditing(true)
                }}
              >
                Изменить
              </MenuItem>
              <MenuItem
                danger
                icon={<Trash2 size={18} aria-hidden="true" />}
                onSelect={() => {
                  close()
                  setConfirming(true)
                }}
              >
                Удалить список
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
      <ListFormDialog open={editing} onClose={() => setEditing(false)} list={list} />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Удалить список «${list.title}»?`}
        message="Сам список исчезнет. Аниме из него останутся в коллекции и каталоге."
        confirmLabel="Удалить список"
        danger
        onConfirm={() => {
          const removed = actions.deleteList(list.id)
          if (removed) toast(`Список «${removed.title}» удалён`, { action: { label: 'Вернуть', onClick: () => actions.restoreList(removed) } })
        }}
      />
    </article>
  )
}
