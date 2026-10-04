import { useId, useMemo, useState } from 'react'
import { Clock, Pencil, StickyNote, Trash2 } from 'lucide-react'
import type { EpisodeNote } from '../../types'
import { actions, useUser } from '../../lib/store'
import { formatTime } from '../../lib/format'
import { toast } from '../../lib/toast'

interface Props {
  animeId: string
  episodeId: string
  /** Current playback position, or null when the episode has no video */
  getTime: (() => number) | null
  onSeek: ((seconds: number) => void) | null
}

const MAX_LENGTH = 2000

/** Private notes for one episode. Each note remembers the moment it was written at. */
export function EpisodeNotes({ animeId, episodeId, getTime, onSeek }: Props) {
  const allNotes = useUser((u) => u.notes)
  const notes = useMemo(
    () => allNotes.filter((n) => n.animeId === animeId && n.episodeId === episodeId).sort((a, b) => a.time - b.time),
    [allNotes, animeId, episodeId],
  )
  const [text, setText] = useState('')
  const [stamp, setStamp] = useState(0)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const id = useId()

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!text.trim()) {
      // Nothing to save yet: point at the field instead of leaving a dead button.
      event.currentTarget.querySelector('textarea')?.focus()
      return
    }
    actions.addNote(animeId, episodeId, stamp, text)
    setText('')
  }

  const remove = (note: EpisodeNote) => {
    const removed = actions.deleteNote(note.id)
    if (removed) toast('Заметка удалена', { action: { label: 'Вернуть', onClick: () => actions.restoreNote(removed) } })
  }

  return (
    <section className="notes" aria-labelledby={`${id}-title`}>
      <div className="notes__head">
        <h2 id={`${id}-title`} className="section-title">
          Мои заметки к серии
        </h2>
        <p className="muted">Видны только тебе и хранятся в этом браузере.</p>
      </div>

      <form className="notes__form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor={`${id}-new`}>
          Новая заметка
        </label>
        <textarea
          id={`${id}-new`}
          name="note"
          className="textarea"
          rows={2}
          maxLength={MAX_LENGTH}
          placeholder="Что запомнить об этом моменте…"
          value={text}
          // The timecode is taken when the viewer starts writing, not when they finish.
          onFocus={() => {
            if (!text && getTime) setStamp(Math.floor(getTime()))
          }}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="notes__form-row">
          <span className="notes__stamp">
            <Clock size={16} aria-hidden="true" />
            Таймкод <span className="tabular">{formatTime(stamp)}</span>
          </span>
          {getTime ? (
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setStamp(Math.floor(getTime()))}>
              Взять текущий момент
            </button>
          ) : null}
          <button type="submit" className="btn btn--sm btn--outline-accent notes__add">
            Добавить заметку
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="notes__empty">
          <StickyNote size={18} aria-hidden="true" />
          Заметок к этой серии пока нет.
        </p>
      ) : (
        <ul className="notes__list">
          {notes.map((note) => (
            <li key={note.id} className="notes__item">
              {onSeek ? (
                <button type="button" className="notes__time tabular" onClick={() => onSeek(note.time)} aria-label={`Перейти к ${formatTime(note.time)}`}>
                  {formatTime(note.time)}
                </button>
              ) : (
                <span className="notes__time notes__time--static tabular">{formatTime(note.time)}</span>
              )}
              {editing?.id === note.id ? (
                <form
                  className="notes__edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!editing.text.trim()) return
                    actions.updateNote(note.id, editing.text)
                    setEditing(null)
                  }}
                >
                  <label className="visually-hidden" htmlFor={`${id}-edit-${note.id}`}>
                    Текст заметки
                  </label>
                  <textarea
                    id={`${id}-edit-${note.id}`}
                    className="textarea"
                    rows={2}
                    maxLength={MAX_LENGTH}
                    autoFocus
                    value={editing.text}
                    onChange={(e) => setEditing({ id: note.id, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setEditing(null)
                      }
                    }}
                  />
                  <div className="notes__form-row">
                    <button type="button" className="btn btn--sm" onClick={() => setEditing(null)}>
                      Отмена
                    </button>
                    <button type="submit" className="btn btn--sm btn--primary" disabled={!editing.text.trim()}>
                      Сохранить
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="notes__text">{note.text}</p>
                  <div className="notes__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Изменить заметку на ${formatTime(note.time)}`}
                      onClick={() => setEditing({ id: note.id, text: note.text })}
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Удалить заметку на ${formatTime(note.time)}`} onClick={() => remove(note)}>
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
