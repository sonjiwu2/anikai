import { useId, useMemo, useState } from 'react'
import type { Anime, Episode } from '../../types'
import { Dialog } from '../ui/Dialog'
import { actions, useUser } from '../../lib/store'
import { PROVIDER_LABEL, parseVideoLink, type ParsedLink } from '../../lib/embeds'
import { allEpisodes, episodeTitle, openingKey, type ResolvedOpening } from '../../lib/episodes'
import { EPISODES, count, formatTime } from '../../lib/format'
import { MAX_OPENING_SECONDS } from '../../lib/userData'
import { toast } from '../../lib/toast'

// ---------- Attaching videos ----------

interface LinkProps {
  anime: Anime
  /** Episode the first link goes to; further links continue in watch order */
  episode: Episode
  open: boolean
  onClose: () => void
}

export function LinkVideoDialog(props: LinkProps) {
  return props.open ? <LinkVideoForm key={props.episode.id} {...props} /> : null
}

function LinkVideoForm({ anime, episode, onClose }: LinkProps) {
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const id = useId()

  const episodes = useMemo(() => {
    const flat = allEpisodes(anime)
    return flat.slice(flat.indexOf(episode))
  }, [anime, episode])

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const parsed = lines.map((line) => parseVideoLink(line))
  const badLines = parsed.flatMap((p, i) => (p ? [] : [i + 1]))
  const usable = parsed.slice(0, episodes.length)
  const extra = Math.max(0, lines.length - episodes.length)
  const valid = lines.length > 0 && badLines.length === 0

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!valid) return
    const entries = usable.map((link, i) => ({ animeId: anime.id, episodeId: episodes[i]!.id, source: link as ParsedLink }))
    actions.setSources(entries)
    toast(entries.length === 1 ? `Видео привязано: ${episodeTitle(episodes[0]!, anime).toLowerCase()}` : `Видео привязано к ${count(entries.length, EPISODES)}`)
    onClose()
  }

  const last = episodes[Math.min(usable.length, episodes.length) - 1]

  return (
    <Dialog
      open
      onClose={onClose}
      title="Привязать видео"
      size="wide"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form={`${id}-form`} className="btn btn--primary">
            {usable.length > 1 ? `Привязать: ${count(usable.length, EPISODES)}` : 'Привязать видео'}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} className="form-stack" onSubmit={submit} noValidate>
        <p className="muted">
          Вставь ссылку на видео с Rutube или VK Видео. Оно останется на площадке и будет показано её плеером прямо здесь. Привязывай то, что
          разрешено смотреть и встраивать.
        </p>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-links`}>
            Ссылки — по одной на строку
          </label>
          <textarea
            id={`${id}-links`}
            name="video-links"
            className="textarea"
            rows={5}
            spellCheck={false}
            autoComplete="off"
            placeholder={'https://rutube.ru/video/…\nhttps://vkvideo.ru/video-…'}
            value={text}
            aria-invalid={touched && !valid ? true : undefined}
            aria-describedby={`${id}-hint`}
            onChange={(e) => setText(e.target.value)}
          />
          <p id={`${id}-hint`} className="field__hint">
            Первая ссылка пойдёт на «{episodeTitle(episode, anime)}», следующие — на серии дальше по порядку. Так можно привязать сезон за один
            раз.
          </p>
          {touched && lines.length === 0 ? (
            <p className="field__error" role="alert">
              Вставь хотя бы одну ссылку.
            </p>
          ) : null}
          {badLines.length > 0 ? (
            <p className="field__error" role="alert">
              Не распознаны строки: {badLines.join(', ')}. Нужна ссылка вида rutube.ru/video/… или vkvideo.ru/video-…
            </p>
          ) : null}
        </div>
        {valid ? (
          <p className="link-preview" role="status">
            {usable.length === 1
              ? `${PROVIDER_LABEL[usable[0]!.provider]} → ${episodeTitle(episode, anime).toLowerCase()}`
              : `Распознано ссылок: ${usable.length}. Серии с ${episode.number} по ${last?.number}${last && last.seasonId !== episode.seasonId ? ' следующего сезона' : ''}.`}
            {extra > 0 ? ` Лишних ссылок: ${extra} — серий в каталоге столько нет, они не будут использованы.` : ''}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}

// ---------- Marking the opening ----------

/** "1:20" or "80" → seconds; null when it is neither. */
function parseTime(text: string): number | null {
  const value = text.trim()
  const clock = /^(\d{1,3}):([0-5]?\d)$/.exec(value)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  return /^\d{1,5}$/.test(value) ? Number(value) : null
}

interface OpeningProps {
  anime: Anime
  episode: Episode
  current?: ResolvedOpening
  /** Current playback position; null when nothing is playing */
  getTime: (() => number) | null
  open: boolean
  onClose: () => void
}

export function OpeningDialog(props: OpeningProps) {
  return props.open ? <OpeningForm {...props} /> : null
}

function OpeningForm({ anime, episode, current, getTime, onClose }: OpeningProps) {
  const openings = useUser((u) => u.openings)
  const [start, setStart] = useState(current ? formatTime(current.start) : '')
  const [end, setEnd] = useState(current ? formatTime(current.end) : '')
  const [scope, setScope] = useState<'episode' | 'season'>(current?.scope === 'episode' ? 'episode' : 'season')
  const [error, setError] = useState('')
  const id = useId()
  const isMovie = anime.format === 'movie'

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const from = parseTime(start)
    const to = parseTime(end)
    if (from === null || to === null) return setError('Время указывается как минуты:секунды, например 1:20.')
    if (to <= from) return setError('Конец опенинга должен быть позже начала.')
    if (to - from > MAX_OPENING_SECONDS) return setError('Опенинг длиннее 10 минут — проверь время.')
    const target = isMovie ? 'episode' : scope
    actions.setOpening(openingKey[target](anime, episode), { start: from, end: to })
    // A mark for this one episode would override the season mark, so it is dropped when the viewer chooses the season.
    if (target === 'season' && openings[openingKey.episode(anime, episode)]) actions.setOpening(openingKey.episode(anime, episode), null)
    toast(target === 'season' ? 'Опенинг отмечен для всех серий сезона' : 'Опенинг отмечен для этой серии')
    onClose()
  }

  const remove = () => {
    if (!current || current.scope === 'catalog') return
    actions.setOpening(openingKey[current.scope](anime, episode), null)
    toast('Отметка опенинга убрана')
    onClose()
  }

  const stamp = (set: (value: string) => void) => {
    if (!getTime) return
    set(formatTime(getTime()))
    setError('')
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Опенинг"
      footer={
        <>
          {current && current.scope !== 'catalog' ? (
            <button type="button" className="btn btn--danger" onClick={remove} style={{ marginRight: 'auto' }}>
              Убрать отметку
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form={`${id}-form`} className="btn btn--primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id={`${id}-form`} className="form-stack" onSubmit={submit} noValidate>
        <p className="muted">
          Отметь, где начинается и заканчивается заставка. В это время в плеере появится кнопка «Пропустить опенинг», а с настройкой «Пропускать
          опенинги» плеер перемотает сам.
        </p>
        <div className="opening-fields">
          {(
            [
              ['Начало', start, setStart],
              ['Конец', end, setEnd],
            ] as const
          ).map(([label, value, set]) => (
            <div key={label} className="field">
              <label className="field__label" htmlFor={`${id}-${label}`}>
                {label}
              </label>
              <input
                id={`${id}-${label}`}
                name={`opening-${label === 'Начало' ? 'start' : 'end'}`}
                className="input tabular"
                inputMode="numeric"
                autoComplete="off"
                placeholder="1:20…"
                value={value}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => {
                  set(e.target.value)
                  setError('')
                }}
              />
              {getTime ? (
                <button type="button" className="btn btn--sm" onClick={() => stamp(set)}>
                  Взять текущий момент
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {error ? (
          <p id={`${id}-error`} className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        {!isMovie ? (
          <fieldset className="choice">
            <legend className="field__label">Для каких серий</legend>
            <label className="choice__option">
              <input type="radio" name={`${id}-scope`} checked={scope === 'season'} onChange={() => setScope('season')} />
              <span>
                <strong>Все серии сезона</strong>
                <span className="muted">Подходит, когда заставка идёт в одно и то же время. Отдельную серию потом можно поправить.</span>
              </span>
            </label>
            <label className="choice__option">
              <input type="radio" name={`${id}-scope`} checked={scope === 'episode'} onChange={() => setScope('episode')} />
              <span>
                <strong>Только эта серия</strong>
                <span className="muted">Для серий, где заставка сдвинута или её нет на обычном месте.</span>
              </span>
            </label>
          </fieldset>
        ) : null}
      </form>
    </Dialog>
  )
}
