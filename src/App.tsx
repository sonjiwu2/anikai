import { lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { Home } from './pages/Home'
import { Catalog } from './pages/Catalog'
import { NotFound } from './pages/NotFound'

// Everything beyond the two landing screens is split by route; the player is the heaviest.
const routes = {
  AnimeDetail: () => import('./pages/AnimeDetail'),
  Watch: () => import('./pages/Watch'),
  Collection: () => import('./pages/Collection'),
  ListPage: () => import('./pages/ListPage'),
  Profile: () => import('./pages/Profile'),
  HistoryPage: () => import('./pages/HistoryPage'),
  Settings: () => import('./pages/Settings'),
}

const AnimeDetail = lazy(routes.AnimeDetail)
const Watch = lazy(routes.Watch)
const Collection = lazy(routes.Collection)
const ListPage = lazy(routes.ListPage)
const Profile = lazy(routes.Profile)
const HistoryPage = lazy(routes.HistoryPage)
const Settings = lazy(routes.Settings)

/** Once the first screen is up and the browser is idle, fetch the other route chunks so navigation is instant. */
function usePreloadRoutes(): void {
  useEffect(() => {
    const load = () => Object.values(routes).forEach((load) => void load().catch(() => undefined))
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(load, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(load, 1500)
    return () => clearTimeout(id)
  }, [])
}

export function App() {
  usePreloadRoutes()
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="schedule" element={<Navigate to="/catalog" replace />} />
        <Route path="collection" element={<Collection />} />
        <Route path="collection/list/:listId" element={<ListPage />} />
        <Route path="anime/:slug" element={<AnimeDetail />} />
        <Route path="watch/:slug/:episodeId" element={<Watch />} />
        <Route path="profile" element={<Profile />} />
        <Route path="profile/history" element={<HistoryPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/:section" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
