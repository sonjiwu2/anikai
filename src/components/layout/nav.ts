import { Bookmark, House, LayoutGrid, type LucideIcon } from 'lucide-react'

export type SectionId = 'home' | 'catalog' | 'collection'

export const NAV_ITEMS: { id: SectionId; to: string; label: string; headerLabel: string; icon: LucideIcon }[] = [
  { id: 'home', to: '/', label: 'Главная', headerLabel: 'Главная', icon: House },
  { id: 'catalog', to: '/catalog', label: 'Каталог', headerLabel: 'Каталог', icon: LayoutGrid },
  { id: 'collection', to: '/collection', label: 'Коллекция', headerLabel: 'Моя коллекция', icon: Bookmark },
]

/** A title page and the player belong to the catalog, not to the home page. */
export function activeSection(pathname: string): SectionId | null {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/catalog') || pathname.startsWith('/anime/') || pathname.startsWith('/watch/')) return 'catalog'
  if (pathname.startsWith('/collection')) return 'collection'
  return null
}
