import { useState } from 'react'
import { Check, ListPlus, Plus, Trash2 } from 'lucide-react'
import type { Anime, CollectionStatus } from '../../types'
import { Menu, MenuItem } from '../ui/Menu'
import { actions, useUser } from '../../lib/store'
import { toast } from '../../lib/toast'
import { STATUSES, STATUS_TITLES } from '../../lib/userData'
import { AddToListDialog } from './ListDialogs'

interface Props {
  anime: Anime
  /** 'button' = labelled control for hero areas, 'icon' = compact control for cards */
  variant: 'button' | 'icon'
  className?: string
}

/** Adds a title to the collection (as "В планах") or, once it is there, changes its status. */
export function CollectionControl({ anime, variant, className }: Props) {
  const entry = useUser((u) => u.collection[anime.id])
  const [listOpen, setListOpen] = useState(false)

  if (!entry) {
    const add = () => {
      actions.setStatus(anime.id, 'planned')
      toast(`«${anime.titleRu}» добавлено в планы`, {
        action: { label: 'Отменить', onClick: () => actions.removeFromCollection(anime.id) },
      })
    }
    return variant === 'button' ? (
      <button type="button" className={`btn ${className ?? ''}`} onClick={add}>
        <Plus size={20} aria-hidden="true" />В коллекцию
      </button>
    ) : (
      <button type="button" className={`icon-btn card-action ${className ?? ''}`} aria-label={`Добавить в коллекцию: ${anime.titleRu}`} onClick={add}>
        <Plus size={20} aria-hidden="true" />
      </button>
    )
  }

  return (
    <>
      <Menu
        label={variant === 'icon' ? `В коллекции: ${anime.titleRu}. Изменить статус` : 'Изменить статус в коллекции'}
        triggerClassName={variant === 'button' ? `btn ${className ?? ''}` : `icon-btn card-action is-active ${className ?? ''}`}
        trigger={
          variant === 'button' ? (
            <>
              <Check size={20} aria-hidden="true" />
              {STATUS_TITLES[entry.status]}
            </>
          ) : (
            <Check size={20} aria-hidden="true" />
          )
        }
      >
        {(close) => <CollectionMenuItems anime={anime} status={entry.status} close={close} onAddToList={() => setListOpen(true)} />}
      </Menu>
      <AddToListDialog anime={anime} open={listOpen} onClose={() => setListOpen(false)} />
    </>
  )
}

interface ItemsProps {
  anime: Anime
  status: CollectionStatus
  close: () => void
  onAddToList: () => void
}

/** Shared menu body: status radio group, add to list, remove. */
export function CollectionMenuItems({ anime, status, close, onAddToList }: ItemsProps) {
  return (
    <>
      <div className="menu__label">Статус</div>
      {STATUSES.map((s) => (
        <MenuItem
          key={s}
          checked={s === status}
          icon={<Check size={18} aria-hidden="true" style={{ visibility: s === status ? 'visible' : 'hidden' }} />}
          onSelect={() => {
            close()
            if (s === status) return
            actions.setStatus(anime.id, s)
            toast(s === 'completed' ? `Все серии «${anime.titleRu}» отмечены просмотренными` : `«${anime.titleRu}»: ${STATUS_TITLES[s].toLowerCase()}`)
          }}
        >
          {STATUS_TITLES[s]}
        </MenuItem>
      ))}
      <div className="menu__sep" />
      <MenuItem
        icon={<ListPlus size={18} aria-hidden="true" />}
        onSelect={() => {
          close()
          onAddToList()
        }}
      >
        Добавить в список
      </MenuItem>
      <MenuItem
        danger
        icon={<Trash2 size={18} aria-hidden="true" />}
        onSelect={() => {
          close()
          const removed = actions.removeFromCollection(anime.id)
          if (removed) {
            toast(`«${anime.titleRu}» убрано из коллекции`, {
              action: { label: 'Вернуть', onClick: () => actions.restoreEntry(removed) },
            })
          }
        }}
      >
        Убрать из коллекции
      </MenuItem>
    </>
  )
}
