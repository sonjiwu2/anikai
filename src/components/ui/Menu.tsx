import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface MenuProps {
  /** Accessible name of the trigger button */
  label: string
  /** Trigger content (usually an icon) */
  trigger: ReactNode
  triggerClassName?: string
  /** Menu body. Receives `close` so items can dismiss the menu after acting. */
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  /** Open above the trigger (used inside the player's control bar) */
  placement?: 'bottom' | 'top'
  /** Render inside this element instead of <body> (needed in fullscreen) */
  container?: HTMLElement | null
  onOpenChange?: (open: boolean) => void
}

/**
 * Button + popover menu. The popover is portalled and positioned with fixed coordinates,
 * so it is never clipped by a scrolling strip or a card with overflow hidden.
 */
export function Menu({ label, trigger, triggerClassName = 'icon-btn', children, align = 'end', placement = 'bottom', container, onOpenChange }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  const close = useCallback(
    (returnFocus = true) => {
      setOpenState(false)
      if (returnFocus) triggerRef.current?.focus()
    },
    [setOpenState],
  )

  // Place the menu next to the trigger, flipping when it would leave the viewport.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect()
      const m = menuRef.current?.getBoundingClientRect()
      if (!t || !m) return
      const margin = 8
      let left = align === 'end' ? t.right - m.width : t.left
      left = Math.min(Math.max(margin, left), window.innerWidth - m.width - margin)
      const below = t.bottom + 6
      const above = t.top - m.height - 6
      const fitsBelow = below + m.height <= window.innerHeight - margin
      const wantTop = placement === 'top' ? above >= margin : !fitsBelow && above >= margin
      const top = wantTop ? above : Math.min(below, window.innerHeight - m.height - margin)
      setPos({ top: Math.max(margin, top), left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align, placement])

  useEffect(() => {
    if (!open) return
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])
    items()[0]?.focus()

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const list = items()
      const index = list.indexOf(document.activeElement as HTMLElement)
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        list[(index + 1) % list.length]?.focus()
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        list[(index - 1 + list.length) % list.length]?.focus()
      } else if (event.key === 'Home') {
        event.preventDefault()
        list[0]?.focus()
      } else if (event.key === 'End') {
        event.preventDefault()
        list[list.length - 1]?.focus()
      } else if (event.key === 'Tab') {
        close(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, close])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpenState(!open)}
      >
        {trigger}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              className="menu"
              // Until it is positioned the menu is transparent rather than hidden: a hidden element cannot take focus.
              style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
            >
              <MenuBody render={children} close={close} />
            </div>,
            container ?? document.body,
          )
        : null}
    </>
  )
}

/** Runs the render prop in its own component so the menu body re-renders independently of the trigger. */
function MenuBody({ render, close }: { render: (close: () => void) => ReactNode; close: (returnFocus?: boolean) => void }) {
  return <>{render(() => close())}</>
}

interface MenuItemProps {
  onSelect: () => void
  icon?: ReactNode
  children: ReactNode
  danger?: boolean
  disabled?: boolean
  /** Renders as a checkable item */
  checked?: boolean
}

export function MenuItem({ onSelect, icon, children, danger, disabled, checked }: MenuItemProps) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      className={danger ? 'menu__item menu__item--danger' : 'menu__item'}
      disabled={disabled}
      tabIndex={-1}
      onClick={onSelect}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}
