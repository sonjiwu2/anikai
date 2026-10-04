import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const APP_NAME = 'Anikai'

/** «Каталог — Anikai». Pass nothing on the home page. */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} — ${APP_NAME}` : `${APP_NAME} — аниме онлайн`
  }, [title])
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Current time that re-renders on an interval; used for countdowns and "released" states. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Scroll and focus on navigation: a new page starts at the top with focus on <main>;
 * back/forward returns to where the viewer was. Query-only changes (filters) keep the position.
 */
export function useRouteScrollAndFocus(mainRef: React.RefObject<HTMLElement | null>): void {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const first = useRef(true)

  useEffect(() => {
    history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    const key = location.key
    const onScroll = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.key])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (navigationType === 'POP') {
      const y = positions.current.get(location.key) ?? 0
      requestAnimationFrame(() => window.scrollTo(0, y))
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
    // Only a path change counts as a new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
}
