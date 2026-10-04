import { useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Search, SearchX, X } from 'lucide-react'
import { popular } from '../../lib/selectors'
import { searchAnime } from '../../lib/search'
import { FORMAT_LABEL } from '../../data/catalog'
import type { Anime } from '../../types'

interface SearchBoxProps {
  /** 'inline' = header field with a dropdown, 'panel' = always-open list inside the search dialog */
  variant: 'inline' | 'panel'
  autoFocus?: boolean
  /** Called after navigating to a result or to the catalog */
  onDone?: () => void
}

const MAX_RESULTS = 6
const SUGGESTIONS: Anime[] = popular().slice(0, 5)

/** Local catalog search with keyboard navigation (combobox pattern). No network involved. */
export function SearchBox({ variant, autoFocus, onDone }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const listId = useId()

  const trimmed = query.trim()
  const results = useMemo(() => (trimmed ? searchAnime(trimmed).slice(0, MAX_RESULTS) : []), [trimmed])
  const items = trimmed ? results : variant === 'panel' ? SUGGESTIONS : []
  const open = variant === 'panel' || (focused && trimmed.length > 0)

  const finish = () => {
    setQuery('')
    setActive(-1)
    inputRef.current?.blur()
    onDone?.()
  }

  const goToCatalog = () => {
    navigate(`/catalog?q=${encodeURIComponent(trimmed)}`)
    finish()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault()
      setActive((i) => (i + 1) % items.length)
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault()
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const picked = items[active]
      if (picked) {
        navigate(`/anime/${picked.slug}`)
        finish()
      } else if (trimmed) {
        goToCatalog()
      }
    } else if (event.key === 'Escape' && variant === 'inline' && (query || focused)) {
      event.preventDefault()
      setQuery('')
      setActive(-1)
      inputRef.current?.blur()
    }
  }

  return (
    <div
      className={`searchbox searchbox--${variant}`}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <div className={`input-wrap ${query ? 'input-wrap--clearable' : ''}`}>
        <Search size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          className="input"
          type="search"
          role="combobox"
          aria-label="Поиск аниме"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          name="search"
          placeholder="Поиск аниме…"
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(-1)
          }}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="icon-btn input-wrap__clear"
            aria-label="Очистить поиск"
            onClick={() => {
              setQuery('')
              setActive(-1)
              inputRef.current?.focus()
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="searchbox__panel">
          {!trimmed && variant === 'panel' ? <p className="searchbox__label">Часто смотрят</p> : null}
          {trimmed && results.length === 0 ? (
            <div className="searchbox__empty">
              <SearchX size={22} aria-hidden="true" />
              <p>
                По запросу «{trimmed}» ничего нет. Проверь написание или попробуй название на английском.
              </p>
            </div>
          ) : null}
          <ul id={listId} role="listbox" aria-label="Результаты поиска" className="searchbox__list">
            {items.map((anime, i) => (
              <li key={anime.id} role="presentation">
                <Link
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="searchbox__item"
                  to={`/anime/${anime.slug}`}
                  onClick={finish}
                  onMouseEnter={() => setActive(i)}
                >
                  <img src={anime.posterSm} alt="" width={40} height={60} loading="lazy" decoding="async" />
                  <span className="searchbox__text">
                    <span className="searchbox__title">{anime.titleRu}</span>
                    <span className="meta">
                      <span>{anime.year}</span>
                      <span>{FORMAT_LABEL[anime.format]}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {trimmed && results.length > 0 ? (
            <button type="button" className="searchbox__all" onClick={goToCatalog}>
              Все результаты в каталоге
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
