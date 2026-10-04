import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /** 'wide' for forms with more content, 'full' takes the whole screen on phones */
  size?: 'default' | 'wide' | 'full'
  className?: string
  /** Hide the visual title but keep it for assistive tech */
  hideTitle?: boolean
}

let lockCount = 0

/**
 * Modal built on the native <dialog>: the browser provides the focus trap, Escape handling,
 * an inert background and focus return. On phones it docks to the bottom as a sheet.
 */
export function Dialog({ open, onClose, title, children, footer, size = 'default', className, hideTitle }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !open) return
    if (!dialog.open) dialog.showModal()
    // showModal() focuses the first focusable element, which is the close button. When the dialog
    // has a text field, the viewer came to type, so start there instead.
    dialog.querySelector<HTMLElement>('.dialog__body :is(input:is([type=text], [type=search], :not([type])), textarea)')?.focus()
    lockCount++
    document.documentElement.classList.add('is-locked')
    return () => {
      if (dialog.open) dialog.close()
      lockCount--
      if (lockCount === 0) document.documentElement.classList.remove('is-locked')
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className={['dialog', size === 'wide' ? 'dialog--wide' : '', size === 'full' ? 'dialog--full' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: let React own the open state instead of the browser closing it behind our back.
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog__head">
        <h2 id={titleId} className={hideTitle ? 'visually-hidden' : 'dialog__title'}>
          {title}
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть" style={{ marginLeft: 'auto' }}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="dialog__body">{children}</div>
      {footer ? <div className="dialog__foot">{footer}</div> : null}
    </dialog>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onClose }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Dialog>
  )
}
