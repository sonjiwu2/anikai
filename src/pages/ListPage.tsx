import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ListPlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { Anime, UserList } from '../types'
import { CATALOG, getAnime } from '../data/catalog'
import { NotFound } from './NotFound'
import { AnimePosterCard, BackdropArt } from '../components/cards/cards'
import { ListFormDialog } from '../components/collection/ListDialogs'
import { ConfirmDialog, Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/basics'
import { actions, useUser } from '../lib/store'
import { searchAnime } from '../lib/search'
import { listCover } from '../lib/selectors'
import { ANIME_WORD, count } from '../lib/format'
import { toast } from '../lib/toast'
import { useDocumentTitle } from '../lib/hooks'

export default function ListPage() {
  const { listId } = useParams()
  const list = useUser((u) => u.lists).find((l) => l.id === listId)
  if (!list) {
    return (
      <NotFound title="Такого списка нет">
        Возможно, список удалён или ссылка открыта в другом браузере: списки хранятся только там, где созданы.{' '}
        <Link to="/collection" style={{ color: 'var(--accent)' }}>
          Перейти в коллекцию
        </Link>
      </NotFound>
    )
  }
  return <ListView list={list} />
}

function ListView({ list }: { list: UserList }) {
  useDocumentTitle(list.title)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const items = list.animeIds.map((id) => getAnime(id)).filter((a): a is Anime => !!a)
  const cover = listCover(list)

  return (
    <div className="container page listpage">
      <Link to="/collection" className="watch__back listpage__back">
        <ArrowLeft size={22} aria-hidden="true" />
        <span>Моя коллекция</span>
      </Link>

      <header className={cover ? 'listpage__head' : 'listpage__head listpage__head--plain'}>
        {cover ? (
          <div className="listpage__banner">
            <BackdropArt anime={cover} ratio="auto" priority />
          </div>
        ) : null}
        <div className="listpage__info">
          <h1 className="page-title">{list.title}</h1>
          {list.description ? <p className="listpage__desc">{list.description}</p> : null}
          <p className="muted">{count(items.length, ANIME_WORD)}</p>
          <div className="listpage__actions">
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              <Plus size={20} aria-hidden="true" />
              Добавить аниме
            </button>
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              <Pencil size={18} aria-hidden="true" />
              Изменить
            </button>
            <button type="button" className="btn btn--danger" onClick={() => setConfirming(true)}>
              <Trash2 size={18} aria-hidden="true" />
              Удалить
            </button>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={<ListPlus size={26} />}
          title="В списке пока нет аниме"
          actions={
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              Добавить аниме
            </button>
          }
        >
          Выбери аниме из каталога — список сохранится в этом браузере.
        </EmptyState>
      ) : (
        <div className="poster-grid">
          <h2 className="visually-hidden">Аниме в списке</h2>
          {items.map((anime) => (
            <div key={anime.id} className="listpage__item">
              <AnimePosterCard anime={anime} />
              <button
                type="button"
                className="btn btn--sm btn--ghost listpage__remove"
                onClick={() => {
                  actions.setInList(list.id, anime.id, false)
                  toast(`«${anime.titleRu}» убрано из списка`, {
                    action: { label: 'Вернуть', onClick: () => actions.setInList(list.id, anime.id, true) },
                  })
                }}
              >
                <X size={16} aria-hidden="true" />
                Убрать<span className="visually-hidden"> «{anime.titleRu}» из списка</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <ListFormDialog open={editing} onClose={() => setEditing(false)} list={list} />
      <AddAnimeDialog list={list} open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Удалить список «${list.title}»?`}
        message="Сам список исчезнет. Аниме из него останутся в коллекции и каталоге."
        confirmLabel="Удалить список"
        danger
        onConfirm={() => {
          const removed = actions.deleteList(list.id)
          navigate('/collection')
          if (removed) toast(`Список «${removed.title}» удалён`, { action: { label: 'Вернуть', onClick: () => actions.restoreList(removed) } })
        }}
      />
    </div>
  )
}

function AddAnimeDialog({ list, open, onClose }: { list: UserList; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => (query.trim() ? searchAnime(query) : CATALOG), [query])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Добавить в «${list.title}»`}
      size="wide"
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Готово
        </button>
      }
    >
      <div className="input-wrap" style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)', paddingBottom: 12 }}>
        <Search size={20} aria-hidden="true" style={{ top: 12 }} />
        <input
          className="input"
          type="search"
          name="list-add-search"
          aria-label="Поиск по каталогу"
          placeholder="Название аниме…"
          autoComplete="off"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {results.length === 0 ? (
        <p className="muted">По запросу «{query.trim()}» в каталоге ничего нет.</p>
      ) : (
        <ul className="pick-list">
          {results.map((anime) => {
            const inList = list.animeIds.includes(anime.id)
            return (
              <li key={anime.id}>
                <label className="pick-list__item">
                  <input type="checkbox" className="visually-hidden" checked={inList} onChange={(e) => actions.setInList(list.id, anime.id, e.target.checked)} />
                  <img src={anime.posterSm} alt="" width={40} height={60} loading="lazy" decoding="async" />
                  <span className="pick-list__text">
                    <span className="pick-list__title">{anime.titleRu}</span>
                    <span className="muted">{anime.year}</span>
                  </span>
                  <span className="pick-list__mark" aria-hidden="true" />
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
