import { Suspense, useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { CircleAlert } from 'lucide-react'
import { Header } from './Header'
import { NAV_ITEMS, activeSection } from './nav'
import { Toaster } from '../ui/basics'
import { acknowledgeRecovery, usePersistenceStatus, useUser } from '../../lib/store'
import { useRouteScrollAndFocus } from '../../lib/hooks'

export function AppShell() {
  const mainRef = useRef<HTMLElement>(null)
  const location = useLocation()
  useRouteScrollAndFocus(mainRef)
  usePreferenceAttributes()

  const section = activeSection(location.pathname)
  const isWatch = location.pathname.startsWith('/watch/')

  return (
    <div className="shell" data-route={isWatch ? 'watch' : undefined}>
      <a href="#main" className="skip-link">
        К содержимому
      </a>
      <Header />
      <StorageNotice />
      <main id="main" ref={mainRef} tabIndex={-1} className="shell__main">
        <Suspense fallback={<div className="shell__loading" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="bottom-nav" aria-label="Разделы">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const current = section === item.id
          return (
            <Link key={item.id} to={item.to} className="bottom-nav__item" aria-current={current ? 'page' : undefined}>
              <Icon size={22} aria-hidden="true" strokeWidth={current ? 2.25 : 1.9} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <Toaster />
    </div>
  )
}

/** Mirrors appearance preferences onto <html> so plain CSS can react to them. */
function usePreferenceAttributes(): void {
  const density = useUser((u) => u.preferences.density)
  const reduceMotion = useUser((u) => u.preferences.reduceMotion)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.density = density
    root.dataset.reduceMotion = String(reduceMotion)
  }, [density, reduceMotion])
}

/** Tells the viewer, once and concretely, when data cannot be saved or had to be recovered. */
function StorageNotice() {
  const status = usePersistenceStatus()
  if (status === 'ok') return null
  const text =
    status === 'corrupt-recovered'
      ? 'Сохранённые данные были повреждены и не прочитались. Anikai начал с чистого листа; повреждённая копия оставлена в хранилище браузера.'
      : status === 'quota'
        ? 'В хранилище браузера закончилось место. Изменения действуют до закрытия вкладки — сделай резервную копию в настройках.'
        : 'Браузер не даёт сохранять данные (например, приватный режим). Коллекция и прогресс действуют до закрытия вкладки.'
  return (
    <div className="container" style={{ marginTop: 12 }}>
      <div className="banner banner--warn" role="alert">
        <CircleAlert size={20} aria-hidden="true" />
        <p style={{ flex: 1 }}>{text}</p>
        {status === 'corrupt-recovered' ? (
          <button type="button" className="btn btn--sm" onClick={acknowledgeRecovery}>
            Понятно
          </button>
        ) : null}
      </div>
    </div>
  )
}
