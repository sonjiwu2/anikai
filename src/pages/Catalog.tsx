import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, RotateCcw, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import type { Anime, AnimeFormat, ReleaseStatus } from '../types'
import { CATALOG, FORMAT_LABEL, GENRES, STATUS_LABEL } from '../data/catalog'
import { AnimePosterCard } from '../components/cards/cards'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/basics'
import { searchAnime } from '../lib/search'
import { ANIME_WORD, plural } from '../lib/format'
import { useDocumentTitle, useMediaQuery } from '../lib/hooks'

const PAGE_SIZE = 20
const FORMATS: AnimeFormat[] = ['tv', 'movie', 'ona']
const STATUSES: ReleaseStatus[] = ['finished', 'ongoing']
const YEARS = [...new Set(CATALOG.map((a) => a.year))].sort((a, b) => a - b)

type SortId = 'popular' | 'rating' | 'new' | 'old' | 'title'
const SORTS: { id: SortId; label: string }[] = [
  { id: 'popular', label: 'По популярности' },
  { id: 'rating', label: 'По оценке' },
  { id: 'new', label: 'Сначала новые' },
  { id: 'old', label: 'Сначала старые' },
  { id: 'title', label: 'По названию' },
]

const SORTERS: Record<SortId, (a: Anime, b: Anime) => number> = {
  // Popularity is the number of AniList users with the title in their lists; the score is a separate sort.
  popular: (a, b) => b.popularity - a.popularity || a.titleRu.localeCompare(b.titleRu, 'ru'),
  rating: (a, b) => b.rating - a.rating || a.titleRu.localeCompare(b.titleRu, 'ru'),
  new: (a, b) => b.year - a.year || b.rating - a.rating,
  old: (a, b) => a.year - b.year || b.rating - a.rating,
  title: (a, b) => a.titleRu.localeCompare(b.titleRu, 'ru'),
}

/** Quick format tabs. They write the same `format` parameter as the checkboxes in the filter panel. */
const TYPE_TABS: { label: string; formats: AnimeFormat[] }[] = [
  { label: 'Все', formats: [] },
  { label: 'Сериалы', formats: ['tv', 'ona'] },
  { label: 'Фильмы', formats: ['movie'] },
]

interface Filters {
  q: string
  genres: string[]
  formats: AnimeFormat[]
  statuses: ReleaseStatus[]
  from: number | null
  to: number | null
  sort: SortId
  page: number
}

const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : [])

function readFilters(params: URLSearchParams): Filters {
  const year = (key: string) => {
    const n = Number(params.get(key))
    return YEARS.includes(n) ? n : null
  }
  const sort = params.get('sort') as SortId
  return {
    q: params.get('q') ?? '',
    genres: list(params.get('genre')).filter((g) => GENRES.includes(g)),
    formats: list(params.get('format')).filter((f): f is AnimeFormat => FORMATS.includes(f as AnimeFormat)),
    statuses: list(params.get('status')).filter((s): s is ReleaseStatus => STATUSES.includes(s as ReleaseStatus)),
    from: year('from'),
    to: year('to'),
    sort: SORTS.some((s) => s.id === sort) ? sort : 'popular',
    page: Math.max(1, Math.floor(Number(params.get('page')) || 1)),
  }
}

/**
 * Filter rules: genres narrow (a title must have every selected genre); formats and statuses
 * widen within their group (any of the selected); the groups are combined with AND.
 */
function applyFilters(f: Filters): Anime[] {
  const base = f.q.trim() ? searchAnime(f.q) : CATALOG
  const filtered = base.filter(
    (a) =>
      f.genres.every((g) => a.genres.includes(g)) &&
      (f.formats.length === 0 || f.formats.includes(a.format)) &&
      (f.statuses.length === 0 || f.statuses.includes(a.releaseStatus)) &&
      (f.from === null || a.year >= f.from) &&
      (f.to === null || a.year <= f.to),
  )
  // A text search keeps its relevance order unless the viewer picked a sort explicitly.
  return f.q.trim() && f.sort === 'popular' ? filtered : [...filtered].sort(SORTERS[f.sort])
}

export function Catalog() {
  useDocumentTitle('Каталог')
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const results = useMemo(() => applyFilters(filters), [filters])
  const [sheetOpen, setSheetOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const topRef = useRef<HTMLDivElement>(null)

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const page = Math.min(filters.page, pageCount)
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeCount =
    filters.genres.length + filters.formats.length + filters.statuses.length + (filters.from !== null ? 1 : 0) + (filters.to !== null ? 1 : 0)
  const hasCriteria = activeCount > 0 || filters.q.trim() !== ''

  /** Writes one parameter. Any change of criteria returns to the first page. */
  const update = (key: string, value: string | null, options: { replace?: boolean; keepPage?: boolean } = {}) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        if (!options.keepPage) next.delete('page')
        return next
      },
      { replace: options.replace },
    )
  }

  const toggleIn = (key: string, current: string[], value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    update(key, next.join(','))
  }

  const reset = () => setParams(filters.sort === 'popular' ? {} : { sort: filters.sort })

  const goToPage = (n: number) => {
    update('page', n > 1 ? String(n) : null, { keepPage: true })
    topRef.current?.scrollIntoView({ block: 'start' })
  }

  const panel = (
    <FilterPanel
      filters={filters}
      onToggle={toggleIn}
      onYear={(key, value) => update(key, value)}
      onReset={reset}
      canReset={activeCount > 0}
      showAllGenres={!isDesktop}
    />
  )
  const activeTab = TYPE_TABS.findIndex(
    (t) => t.formats.length === filters.formats.length && t.formats.every((f) => filters.formats.includes(f)),
  )

  return (
    <div className="container page catalog">
      <header className="page-head">
        <div>
          <h1 className="page-title">Каталог аниме</h1>
          <p className="page-lead">Найди свою следующую историю</p>
        </div>
      </header>

      <div className="catalog__layout">
        {isDesktop ? (
          <aside className="catalog__side" aria-label="Фильтры">
            {panel}
          </aside>
        ) : null}

        <div className="catalog__main" ref={topRef}>
          <div className="tabs" role="group" aria-label="Тип">
            {TYPE_TABS.map((t, i) => (
              <button
                key={t.label}
                type="button"
                className="tab"
                aria-pressed={activeTab === i}
                onClick={() => update('format', t.formats.join(','))}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="catalog__toolbar">
            <div className={`input-wrap catalog__search ${filters.q ? 'input-wrap--clearable' : ''}`}>
              <Search size={20} aria-hidden="true" />
              <input
                className="input"
                type="search"
                name="q"
                aria-label="Поиск по каталогу"
                placeholder="Название на русском или английском…"
                autoComplete="off"
                enterKeyHint="search"
                value={filters.q}
                onChange={(e) => update('q', e.target.value, { replace: true })}
              />
              {filters.q ? (
                <button type="button" className="icon-btn input-wrap__clear" aria-label="Очистить поиск" onClick={() => update('q', null)}>
                  <X size={18} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {!isDesktop ? (
              <button type="button" className="btn catalog__filters-btn" onClick={() => setSheetOpen(true)}>
                <SlidersHorizontal size={20} aria-hidden="true" />
                Фильтры
                {activeCount > 0 ? <span className="catalog__count-dot">{activeCount}</span> : null}
              </button>
            ) : null}
            <label className="catalog__sort">
              <span className="visually-hidden">Сортировка</span>
              <select className="select" value={filters.sort} onChange={(e) => update('sort', e.target.value === 'popular' ? null : e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="catalog__found" role="status">
            {results.length > 0 ? `${plural(results.length, ['Найдено', 'Найдено', 'Найдено'])} ${results.length} ${plural(results.length, ANIME_WORD)}` : 'Ничего не найдено'}
            {pageCount > 1 ? ` · страница ${page} из ${pageCount}` : ''}
          </p>

          {activeCount > 0 ? (
            <ul className="chips catalog__chips" aria-label="Выбранные фильтры">
              {filters.genres.map((g) => (
                <FilterChip key={g} label={g} onRemove={() => toggleIn('genre', filters.genres, g)} />
              ))}
              {filters.formats.map((f) => (
                <FilterChip key={f} label={FORMAT_LABEL[f]} onRemove={() => toggleIn('format', filters.formats, f)} />
              ))}
              {filters.statuses.map((s) => (
                <FilterChip key={s} label={STATUS_LABEL[s]} onRemove={() => toggleIn('status', filters.statuses, s)} />
              ))}
              {filters.from !== null ? <FilterChip label={`с ${filters.from}`} onRemove={() => update('from', null)} /> : null}
              {filters.to !== null ? <FilterChip label={`по ${filters.to}`} onRemove={() => update('to', null)} /> : null}
            </ul>
          ) : null}

          <h2 className="visually-hidden">Результаты</h2>
          {visible.length > 0 ? (
            <div className="poster-grid poster-grid--aside">
              {visible.map((anime, i) => (
                <AnimePosterCard key={anime.id} anime={anime} note={String(anime.year)} priority={i < 4} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<SearchX size={26} />}
              title="Под такие условия ничего не подошло"
              actions={
                hasCriteria ? (
                  <button type="button" className="btn btn--primary" onClick={() => setParams({})}>
                    <RotateCcw size={18} aria-hidden="true" />
                    Сбросить поиск и фильтры
                  </button>
                ) : undefined
              }
            >
              {filters.q.trim()
                ? `По запросу «${filters.q.trim()}» с выбранными фильтрами аниме нет. Попробуй другое написание или убери часть фильтров.`
                : 'Убери часть фильтров: выбранные жанры должны встречаться в аниме одновременно.'}
            </EmptyState>
          )}

          {pageCount > 1 ? <Pagination page={page} pageCount={pageCount} onChange={goToPage} /> : null}
        </div>
      </div>

      <Dialog
        open={sheetOpen && !isDesktop}
        onClose={() => setSheetOpen(false)}
        title="Фильтры"
        footer={
          <>
            <button type="button" className="btn" onClick={reset} disabled={activeCount === 0}>
              Сбросить
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setSheetOpen(false)}>
              Показать {results.length} {plural(results.length, ANIME_WORD)}
            </button>
          </>
        }
      >
        {panel}
      </Dialog>
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <li>
      <button type="button" className="chip chip--removable" onClick={onRemove} aria-label={`Убрать фильтр: ${label}`}>
        {label}
        <X size={16} aria-hidden="true" />
      </button>
    </li>
  )
}

interface PanelProps {
  filters: Filters
  onToggle: (key: string, current: string[], value: string) => void
  onYear: (key: 'from' | 'to', value: string | null) => void
  onReset: () => void
  canReset: boolean
  /** The phone sheet has room for the whole list; the sidebar starts collapsed */
  showAllGenres: boolean
}

const GENRES_COLLAPSED = 7

function FilterPanel({ filters, onToggle, onYear, onReset, canReset, showAllGenres }: PanelProps) {
  const [expanded, setExpanded] = useState(false)
  // Collapsed: the most common genres plus anything already selected, so a choice is never hidden.
  const genres = expanded || showAllGenres ? GENRES : GENRES.filter((g, i) => i < GENRES_COLLAPSED || filters.genres.includes(g))
  return (
    <div className="filters">
      <fieldset className="filters__group">
        <legend className="filters__legend">Жанры</legend>
        <p className="filters__hint">Аниме, где есть все выбранные</p>
        <div className="filters__options">
          {genres.map((g) => (
            <label key={g} className="check">
              <input type="checkbox" checked={filters.genres.includes(g)} onChange={() => onToggle('genre', filters.genres, g)} />
              <span>{g}</span>
            </label>
          ))}
        </div>
        {!showAllGenres ? (
          <button type="button" className="filters__more" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Свернуть' : `Все жанры: ${GENRES.length}`}
          </button>
        ) : null}
      </fieldset>

      <fieldset className="filters__group">
        <legend className="filters__legend">Год выхода</legend>
        <div className="filters__years">
          <label>
            <span className="visually-hidden">Год, от</span>
            <select className="select" value={filters.from ?? ''} onChange={(e) => onYear('from', e.target.value || null)}>
              <option value="">От</option>
              {YEARS.filter((y) => filters.to === null || y <= filters.to).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Год, до</span>
            <select className="select" value={filters.to ?? ''} onChange={(e) => onYear('to', e.target.value || null)}>
              <option value="">До</option>
              {YEARS.filter((y) => filters.from === null || y >= filters.from).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="filters__group">
        <legend className="filters__legend">Формат</legend>
        <div className="filters__options">
          {FORMATS.map((f) => (
            <label key={f} className="check">
              <input type="checkbox" checked={filters.formats.includes(f)} onChange={() => onToggle('format', filters.formats, f)} />
              <span>{FORMAT_LABEL[f]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="filters__group">
        <legend className="filters__legend">Статус</legend>
        <div className="filters__options">
          {STATUSES.map((s) => (
            <label key={s} className="check">
              <input type="checkbox" checked={filters.statuses.includes(s)} onChange={() => onToggle('status', filters.statuses, s)} />
              <span>{STATUS_LABEL[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="button" className="btn btn--ghost filters__reset" onClick={onReset} disabled={!canReset}>
        <RotateCcw size={18} aria-hidden="true" />
        Сбросить фильтры
      </button>
    </div>
  )
}

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (n: number) => void }) {
  // Windowed page list: first, last and the neighbours of the current page.
  const pages: (number | 'gap')[] = []
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 1) pages.push(n)
    else if (pages[pages.length - 1] !== 'gap') pages.push('gap')
  }
  return (
    <nav className="pagination" aria-label="Страницы каталога">
      <button type="button" className="pagination__btn" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Предыдущая страница">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      {pages.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="pagination__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className="pagination__btn tabular"
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Страница ${p}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className="pagination__btn" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Следующая страница">
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </nav>
  )
}
