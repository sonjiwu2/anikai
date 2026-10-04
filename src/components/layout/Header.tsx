import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ChevronDown, CircleUserRound, History, Search, Settings } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { Menu, MenuItem } from '../ui/Menu'
import { Avatar, LogoMark } from '../ui/basics'
import { SearchBox } from './SearchBox'
import { NAV_ITEMS, activeSection } from './nav'
import { useUser } from '../../lib/store'
import { useMediaQuery } from '../../lib/hooks'

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const section = activeSection(location.pathname)
  const profile = useUser((u) => u.profile)
  const inlineSearch = useMediaQuery('(min-width: 1100px)')
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="logo" aria-label="Anikai — на главную">
          <LogoMark />
          <span className="logo__word" translate="no">
            anikai
          </span>
        </Link>

        <nav className="header__nav" aria-label="Разделы">
          {NAV_ITEMS.map((item) => (
            <Link key={item.id} to={item.to} className="header__link" aria-current={section === item.id ? 'page' : undefined}>
              {item.headerLabel}
            </Link>
          ))}
        </nav>

        <div className="header__tools">
          {inlineSearch ? (
            <div className="header__search">
              <SearchBox variant="inline" />
            </div>
          ) : (
            <button type="button" className="icon-btn" aria-label="Поиск" onClick={() => setSearchOpen(true)}>
              <Search size={22} aria-hidden="true" />
            </button>
          )}

          <Menu
            label={`Профиль: ${profile.name}`}
            triggerClassName="header__profile"
            trigger={
              <>
                <Avatar avatar={profile.avatar} size={40} />
                <ChevronDown size={18} aria-hidden="true" className="header__chevron" />
              </>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<CircleUserRound size={18} aria-hidden="true" />}
                  onSelect={() => {
                    close()
                    navigate('/profile')
                  }}
                >
                  Профиль
                </MenuItem>
                <MenuItem
                  icon={<History size={18} aria-hidden="true" />}
                  onSelect={() => {
                    close()
                    navigate('/profile/history')
                  }}
                >
                  История просмотра
                </MenuItem>
                <MenuItem
                  icon={<Settings size={18} aria-hidden="true" />}
                  onSelect={() => {
                    close()
                    navigate('/settings')
                  }}
                >
                  Настройки
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} title="Поиск аниме" size="full" className="dialog--search">
        <SearchBox variant="panel" autoFocus onDone={() => setSearchOpen(false)} />
      </Dialog>
    </header>
  )
}
