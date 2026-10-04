import type { ReactNode } from 'react'
import { CircleAlert, Info, X } from 'lucide-react'
import type { Avatar as AvatarData } from '../../types'
import { dismissToast, useToasts } from '../../lib/toast'
import { publicAsset } from '../../lib/hosting'

// ---------- Toggle ----------

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** Id of the element that labels the switch */
  labelledBy?: string
  label?: string
  describedBy?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, labelledBy, label, describedBy, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  )
}

// ---------- Empty state ----------

interface EmptyStateProps {
  icon: ReactNode
  title: string
  children?: ReactNode
  actions?: ReactNode
}

export function EmptyState({ icon, title, children, actions }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <p className="empty__title">{title}</p>
      {children ? <p className="empty__text">{children}</p> : null}
      {actions ? <div className="empty__actions">{actions}</div> : null}
    </div>
  )
}

// ---------- Toaster ----------

export function Toaster() {
  const toasts = useToasts()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={t.tone === 'error' ? 'toast toast--error' : 'toast'}>
          {t.tone === 'error' ? <CircleAlert size={20} aria-hidden="true" /> : <Info size={20} aria-hidden="true" />}
          <span className="toast__text">{t.message}</span>
          {t.action ? (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                t.action?.onClick()
                dismissToast(t.id)
              }}
            >
              {t.action.label}
            </button>
          ) : null}
          <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => dismissToast(t.id)} aria-label="Скрыть уведомление">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ---------- Avatar ----------

export function avatarSrc(avatar: AvatarData): string {
  return avatar.kind === 'custom' ? avatar.dataUrl : publicAsset(`/media/avatars/${avatar.id}.webp`)
}

export function Avatar({ avatar, size, className }: { avatar: AvatarData; size: number; className?: string }) {
  return (
    <img
      className={`avatar ${className ?? ''}`}
      src={avatarSrc(avatar)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      draggable={false}
    />
  )
}

// ---------- Logo ----------

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3.5 29 28.5h-7.3L16 16.7l-5.7 11.8H3L16 3.5Z" fill="currentColor" />
      <path d="m16 21 3.7 7.5h-7.4L16 21Z" fill="var(--accent)" />
    </svg>
  )
}
