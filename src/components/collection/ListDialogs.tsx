import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import type { Anime, UserList } from '../../types'
import { Dialog } from '../ui/Dialog'
import { actions, useUser } from '../../lib/store'
import { toast } from '../../lib/toast'
import { getAnime } from '../../data/catalog'
import { ANIME_WORD, count } from '../../lib/format'

interface ListFormProps {
  open: boolean
  onClose: () => void
  /** Existing list to edit; omit to create */
  list?: UserList
  /** Title to put into a newly created list */
  initialAnimeId?: string
  /** Go to the list page after creating */
  navigateAfterCreate?: boolean
}

export function ListFormDialog(props: ListFormProps) {
  // Remount on open so the form always starts from the current list values.
  return props.open ? <ListForm key={props.list?.id ?? 'new'} {...props} /> : null
}

function ListForm({ open, onClose, list, initialAnimeId, navigateAfterCreate }: ListFormProps) {
  const collection = useUser((u) => u.collection)
  const navigate = useNavigate()
  const [title, setTitle] = useState(list?.title ?? '')
  const [description, setDescription] = useState(list?.description ?? '')
  const [cover, setCover] = useState(list?.coverAnimeId ?? '')
  const [error, setError] = useState('')
  const formId = useId()

  // Cover candidates: titles already in the list, then the rest of the collection.
  const candidates = [...new Set([...(list?.animeIds ?? []), ...(initialAnimeId ? [initialAnimeId] : []), ...Object.keys(collection)])]
    .map((id) => getAnime(id))
    .filter((a): a is Anime => !!a)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const name = title.trim()
    if (!name) {
      setError('Введи название списка.')
      return
    }
    if (list) {
      actions.updateList(list.id, { title: name, description: description.trim(), coverAnimeId: cover || undefined })
      toast('Список сохранён')
    } else {
      const created = actions.createList({
        title: name,
        description,
        coverAnimeId: cover || initialAnimeId,
        animeIds: initialAnimeId ? [initialAnimeId] : [],
      })
      toast(`Список «${created.title}» создан`)
      if (navigateAfterCreate) navigate(`/collection/list/${created.id}`)
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={list ? 'Изменить список' : 'Новый список'}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form={formId} className="btn btn--primary">
            {list ? 'Сохранить' : 'Создать список'}
          </button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor={`${formId}-title`}>
            Название
          </label>
          <input
            id={`${formId}-title`}
            className="input"
            value={title}
            name="list-title"
            autoComplete="off"
            maxLength={80}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${formId}-error` : undefined}
            onChange={(e) => {
              setTitle(e.target.value)
              setError('')
            }}
          />
          {error ? (
            <p id={`${formId}-error`} className="field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${formId}-desc`}>
            Описание <span className="muted" style={{ fontWeight: 400 }}>— необязательно</span>
          </label>
          <textarea
            id={`${formId}-desc`}
            className="textarea"
            value={description}
            maxLength={300}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${formId}-cover`}>
            Обложка
          </label>
          <select id={`${formId}-cover`} className="select" value={cover} onChange={(e) => setCover(e.target.value)} disabled={candidates.length === 0}>
            <option value="">Автоматически — первое аниме списка</option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titleRu}
              </option>
            ))}
          </select>
          {candidates.length === 0 ? <p className="field__hint">Обложку можно будет выбрать, когда в коллекции появятся аниме.</p> : null}
        </div>
      </form>
    </Dialog>
  )
}

interface AddToListProps {
  anime: Anime
  open: boolean
  onClose: () => void
}

/** Checklist of the viewer's lists for one title, with inline creation of a new list. */
export function AddToListDialog({ anime, open, onClose }: AddToListProps) {
  const lists = useUser((u) => u.lists)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <Dialog
        open={open && !creating}
        onClose={onClose}
        title="Добавить в список"
        footer={
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Готово
          </button>
        }
      >
        <p className="muted" style={{ marginBottom: 12 }}>
          {anime.titleRu}
        </p>
        {lists.length === 0 ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            Списков пока нет. Создай первый — например, «На выходные».
          </p>
        ) : (
          <ul style={{ marginBottom: 12 }}>
            {lists.map((list) => (
              <li key={list.id}>
                <label className="check" style={{ minHeight: 48 }}>
                  <input
                    type="checkbox"
                    checked={list.animeIds.includes(anime.id)}
                    onChange={(e) => actions.setInList(list.id, anime.id, e.target.checked)}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>{list.title}</span>
                  <span className="check__count">{count(list.animeIds.length, ANIME_WORD)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn--block" onClick={() => setCreating(true)}>
          <Plus size={20} aria-hidden="true" />
          Новый список
        </button>
        {lists.length > 0 ? (
          <p className="field__hint" style={{ marginTop: 12 }}>
            Списки собраны на странице{' '}
            <Link to="/collection" onClick={onClose} style={{ color: 'var(--accent)' }}>
              «Моя коллекция»
            </Link>
            .
          </p>
        ) : null}
      </Dialog>
      <ListFormDialog open={open && creating} onClose={() => setCreating(false)} initialAnimeId={anime.id} />
    </>
  )
}
