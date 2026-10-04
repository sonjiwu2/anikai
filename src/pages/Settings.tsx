import { useId, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Database, Download, FolderPlus, Monitor, Play, RotateCcw, Unlink, Upload, type LucideIcon } from 'lucide-react'
import type { UserPreferences } from '../types'
import { buildDemoData } from '../data/demo'
import { ProfileStrip } from '../components/profile/ProfileParts'
import { ConfirmDialog, Dialog } from '../components/ui/Dialog'
import { Toggle } from '../components/ui/basics'
import { actions, getUserData, useUser } from '../lib/store'
import { downloadBackup, parseBackup, type BackupResult } from '../lib/backup'
import { ANIME_WORD, EPISODES, count, formatDayMonth } from '../lib/format'
import { PLAYBACK_RATES, TIME_ZONES } from '../lib/userData'
import { toast } from '../lib/toast'
import { useDocumentTitle } from '../lib/hooks'

type SectionId = 'playback' | 'appearance' | 'data'
const SECTIONS: { id: SectionId; label: string; title: string; icon: LucideIcon }[] = [
  { id: 'playback', label: 'Просмотр', title: 'Настройки просмотра', icon: Play },
  { id: 'appearance', label: 'Внешний вид', title: 'Внешний вид', icon: Monitor },
  { id: 'data', label: 'Данные', title: 'Твои данные', icon: Database },
]

export default function Settings() {
  const { section } = useParams()
  const current = SECTIONS.find((s) => s.id === (section ?? 'playback'))
  useDocumentTitle(current ? `Настройки: ${current.label.toLowerCase()}` : 'Настройки')
  if (!current) return <Navigate to="/settings" replace />

  return (
    <div className="container page settings">
      <ProfileStrip current="settings" />
      <header className="page-head">
        <div>
          <h1 className="page-title">Настройки</h1>
          <p className="page-lead">Изменения сохраняются сразу, отдельной кнопки нет</p>
        </div>
      </header>

      <div className="settings__layout">
        <nav className="settings__nav" aria-label="Разделы настроек">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <Link
                key={s.id}
                to={s.id === 'playback' ? '/settings' : `/settings/${s.id}`}
                className="settings__link"
                aria-current={s.id === current.id ? 'page' : undefined}
                preventScrollReset
              >
                <Icon size={22} aria-hidden="true" />
                {s.label}
              </Link>
            )
          })}
        </nav>

        <section className="settings__panel" aria-labelledby="settings-title">
          <h2 id="settings-title" className="settings__title">
            {current.title}
          </h2>
          {current.id === 'playback' ? <PlaybackSection /> : null}
          {current.id === 'appearance' ? <AppearanceSection /> : null}
          {current.id === 'data' ? <DataSection /> : null}
        </section>
      </div>
    </div>
  )
}

// ---------- Building blocks ----------

function Row({ title, hint, children, id }: { title: string; hint?: ReactNode; children: ReactNode; id: string }) {
  return (
    <div className="setting">
      <div className="setting__text">
        <p id={id} className="setting__title">
          {title}
        </p>
        {hint ? (
          <p id={`${id}-hint`} className="setting__hint">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="setting__control">{children}</div>
    </div>
  )
}

function ToggleRow({ pref, title, hint }: { pref: keyof UserPreferences; title: string; hint?: ReactNode }) {
  const value = useUser((u) => u.preferences[pref]) as boolean
  const id = useId()
  return (
    <Row id={id} title={title} hint={hint}>
      <Toggle checked={value} onChange={(v) => actions.setPreference(pref, v as never)} labelledBy={id} describedBy={hint ? `${id}-hint` : undefined} />
    </Row>
  )
}

// ---------- Sections ----------

function PlaybackSection() {
  const quality = useUser((u) => u.preferences.preferredQuality)
  const rate = useUser((u) => u.preferences.playbackRate)
  const qId = useId()
  const rId = useId()
  return (
    <>
      <h3 className="settings__group">Плеер</h3>
      <Row id={qId} title="Качество видео" hint="Плеер возьмёт лучшее из доступных, но не выше выбранного. Список зависит от того, какие файлы есть у серии.">
        <select className="select" aria-labelledby={qId} value={quality} onChange={(e) => actions.setPreference('preferredQuality', Number(e.target.value))}>
          <option value={0}>Лучшее доступное</option>
          <option value={720}>До 720p</option>
          <option value={480}>До 480p</option>
        </select>
      </Row>
      <Row id={rId} title="Скорость воспроизведения" hint="С этой скоростью открывается каждая серия.">
        <select className="select" aria-labelledby={rId} value={rate} onChange={(e) => actions.setPreference('playbackRate', Number(e.target.value))}>
          {PLAYBACK_RATES.map((r) => (
            <option key={r} value={r}>
              {r === 1 ? 'Обычная' : `${r}×`}
            </option>
          ))}
        </select>
      </Row>
      <ToggleRow pref="subtitles" title="Субтитры" hint="Включать субтитры сразу, если у серии есть дорожка." />
      <ToggleRow pref="autoNext" title="Автопереход к следующей серии" hint="Через 5 секунд после конца серии открывать следующую, если для неё есть видео." />
      <ToggleRow
        pref="autoSkipOpening"
        title="Пропускать опенинги"
        hint="Перематывать заставку без нажатия кнопки. Работает у серий, где ты отметил опенинг: это делается под плеером, кнопкой «Отметить опенинг»."
      />
      <h3 className="settings__group">Прогресс</h3>
      <ToggleRow pref="saveProgress" title="Сохранять прогресс просмотра" hint="Запоминать позицию в серии и отмечать досмотренные. Если выключить, история перестанет пополняться." />
    </>
  )
}

function AppearanceSection() {
  const density = useUser((u) => u.preferences.density)
  const id = useId()
  const zoneId = useId()
  const timeZone = useUser((u) => u.preferences.timeZone)
  return (
    <>
      <Row id={zoneId} title="Часовой пояс истории" hint="Используется для дат и времени просмотренных серий.">
        <select className="select" aria-labelledby={zoneId} value={timeZone} onChange={(e) => actions.setPreference('timeZone', e.target.value)}>
          {TIME_ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
      </Row>
      <Row id={id} title="Размер карточек" hint="Компактные карточки помещают в ряд на одну обложку больше.">
        <div className="segmented" role="radiogroup" aria-labelledby={id}>
          {(
            [
              ['comfortable', 'Обычные'],
              ['compact', 'Компактные'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="segmented__option">
              <input type="radio" name="density" className="visually-hidden" checked={density === value} onChange={() => actions.setPreference('density', value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </Row>
      <ToggleRow
        pref="reduceMotion"
        title="Меньше анимации"
        hint="Убирает плавные переходы и появления. Если в системе уже включено «уменьшить движение», Anikai делает это сам."
      />
    </>
  )
}

function DataSection() {
  const collectionSize = useUser((u) => Object.keys(u.collection).length)
  const progressSize = useUser((u) => Object.keys(u.progress).length)
  const listCount = useUser((u) => u.lists.length)
  const noteCount = useUser((u) => u.notes.length)
  const sourceCount = useUser((u) => Object.keys(u.sources).length)
  const openingCount = useUser((u) => Object.keys(u.openings).length)
  const [confirmSources, setConfirmSources] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Extract<BackupResult, { ok: true }> | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [importError, setImportError] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setImportError('Файл не удалось прочитать.')
      return
    }
    const result = parseBackup(text)
    if (!result.ok) {
      // Nothing has been touched: current data stays exactly as it was.
      setImportError(result.error)
      return
    }
    setImportError('')
    setMode('merge')
    setPending(result)
  }

  const applyImport = () => {
    if (!pending) return
    if (mode === 'replace') actions.replaceAll(pending.data)
    else actions.merge(pending.data)
    toast(mode === 'replace' ? 'Данные заменены резервной копией' : 'Резервная копия добавлена к твоим данным')
    setPending(null)
  }

  return (
    <>
      <p className="settings__lead">
        Коллекция, прогресс, списки, заметки и настройки хранятся только в этом браузере. Между устройствами они не синхронизируются — для переноса
        используй резервную копию.
      </p>
      <dl className="settings__summary">
        <div>
          <dd className="tabular">{collectionSize}</dd>
          <dt>в коллекции</dt>
        </div>
        <div>
          <dd className="tabular">{progressSize}</dd>
          <dt>серий с прогрессом</dt>
        </div>
        <div>
          <dd className="tabular">{listCount}</dd>
          <dt>списков</dt>
        </div>
        <div>
          <dd className="tabular">{noteCount}</dd>
          <dt>заметок</dt>
        </div>
      </dl>

      <div className="setting">
        <div className="setting__text">
          <p className="setting__title">Резервная копия</p>
          <p className="setting__hint">Файл JSON со всеми твоими данными. Видео и каталог в него не входят.</p>
        </div>
        <div className="setting__control setting__control--buttons">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const name = downloadBackup(getUserData())
              toast(`Копия сохранена: ${name}`)
            }}
          >
            <Download size={18} aria-hidden="true" />
            Экспортировать
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={18} aria-hidden="true" />
            Импортировать
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={onFile} />
        </div>
      </div>
      {importError ? (
        <p className="field__error settings__error" role="alert">
          Импорт не выполнен: {importError} Твои данные не изменились.
        </p>
      ) : null}

      <div className="setting">
        <div className="setting__text">
          <p className="setting__title">Пример коллекции</p>
          <p className="setting__hint">Добавит к твоим данным готовый набор: несколько аниме с прогрессом, два списка и заметку. Удобно, чтобы посмотреть, как всё выглядит заполненным.</p>
        </div>
        <div className="setting__control">
          <button
            type="button"
            className="btn"
            onClick={() => {
              actions.merge(buildDemoData())
              toast('Пример коллекции добавлен')
            }}
          >
            <FolderPlus size={18} aria-hidden="true" />
            Загрузить пример
          </button>
        </div>
      </div>

      <div className="setting">
        <div className="setting__text">
          <p className="setting__title">Привязанные видео</p>
          <p className="setting__hint">
            Ссылки на Rutube и VK Видео, которые ты привязал к сериям: сейчас их {sourceCount}. Отметок опенинга: {openingCount}. Всё это входит в
            резервную копию.
          </p>
        </div>
        <div className="setting__control">
          <button type="button" className="btn btn--danger" onClick={() => setConfirmSources(true)} disabled={sourceCount === 0}>
            <Unlink size={18} aria-hidden="true" />
            Отвязать все
          </button>
        </div>
      </div>

      <div className="setting">
        <div className="setting__text">
          <p className="setting__title">Сбросить всё</p>
          <p className="setting__hint">Удалит коллекцию, историю, списки, заметки, профиль и настройки. Действие необратимо — сначала сделай копию.</p>
        </div>
        <div className="setting__control">
          <button type="button" className="btn btn--danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={18} aria-hidden="true" />
            Сбросить данные
          </button>
        </div>
      </div>

      <Dialog
        open={pending !== null && !confirmReplace}
        onClose={() => setPending(null)}
        title="Импорт резервной копии"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setPending(null)}>
              Отмена
            </button>
            <button type="button" className="btn btn--primary" onClick={() => (mode === 'replace' ? setConfirmReplace(true) : applyImport())}>
              {mode === 'replace' ? 'Заменить данные' : 'Добавить к моим данным'}
            </button>
          </>
        }
      >
        {pending ? (
          <div className="form-stack">
            <p>
              В копии{pending.exportedAt ? ` от ${formatDayMonth(pending.exportedAt, 'Europe/Moscow')}` : ''}: {count(pending.summary.titles, ANIME_WORD)} в
              коллекции, прогресс по {count(pending.summary.episodes, EPISODES)}, списков — {pending.summary.lists}, заметок — {pending.summary.notes}.
            </p>
            <fieldset className="choice">
              <legend className="field__label">Как импортировать</legend>
              <label className="choice__option">
                <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
                <span>
                  <strong>Добавить к моим данным</strong>
                  <span className="muted">Ничего не удаляется. Если запись есть и там, и здесь — остаётся более свежая. Профиль и настройки не меняются.</span>
                </span>
              </label>
              <label className="choice__option">
                <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                <span>
                  <strong>Заменить всё</strong>
                  <span className="muted">Текущие данные, профиль и настройки удаляются, вместо них встаёт копия.</span>
                </span>
              </label>
            </fieldset>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title="Заменить все данные копией?"
        message="Текущая коллекция, история, списки, заметки, профиль и настройки будут удалены и заменены содержимым файла."
        confirmLabel="Заменить"
        danger
        onConfirm={applyImport}
      />
      <ConfirmDialog
        open={confirmSources}
        onClose={() => setConfirmSources(false)}
        title="Отвязать все видео?"
        message="Серии вернутся к демонстрационному ролику или к состоянию «видео не добавлено». Прогресс просмотра и отметки опенинга останутся."
        confirmLabel="Отвязать все"
        danger
        onConfirm={() => {
          actions.removeAllSources()
          toast('Все видео отвязаны')
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Сбросить все данные?"
        message="Коллекция, история, списки, заметки, профиль и настройки вернутся к начальному состоянию. Восстановить их можно будет только из резервной копии."
        confirmLabel="Сбросить"
        danger
        onConfirm={() => {
          actions.reset()
          toast('Данные сброшены')
        }}
      />
    </>
  )
}
