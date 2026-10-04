import { useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Upload } from 'lucide-react'
import type { Avatar as AvatarData } from '../../types'
import { Dialog } from '../ui/Dialog'
import { Avatar, avatarSrc } from '../ui/basics'
import { actions, useUser } from '../../lib/store'
import { AVATAR_PRESETS } from '../../lib/userData'
import { toast } from '../../lib/toast'

const TABS = [
  { id: 'overview', to: '/profile', label: 'Обзор' },
  { id: 'history', to: '/profile/history', label: 'История' },
  { id: 'settings', to: '/settings', label: 'Настройки' },
] as const

export type ProfileTab = (typeof TABS)[number]['id']

export function ProfileTabs({ current }: { current: ProfileTab }) {
  return (
    <nav className="tabs" aria-label="Личный кабинет">
      {TABS.map((t) => (
        <Link key={t.id} to={t.to} className="tab" aria-current={t.id === current ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

/** Compact identity strip with the profile tabs, used on History and Settings. */
export function ProfileStrip({ current }: { current: ProfileTab }) {
  const profile = useUser((u) => u.profile)
  return (
    <div className="profile-strip">
      <Link to="/profile" className="profile-strip__who">
        <Avatar avatar={profile.avatar} size={56} />
        <span>
          <span className="profile-strip__name">{profile.name}</span>
          <span className="muted">Личный профиль</span>
        </span>
      </Link>
      <ProfileTabs current={current} />
    </div>
  )
}

// ---------- Editing ----------

const AVATAR_SIZE = 160
const MAX_FILE_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/** Reads an image file and returns a small square JPEG data URL (about 10 KB), never the original. */
async function fileToAvatar(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Подойдёт картинка JPEG, PNG или WebP.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Файл больше 8 МБ. Выбери картинку поменьше.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    if (side < 32) throw new Error('Картинка слишком маленькая.')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Браузер не смог обработать картинку.')
    // Centre crop to a square, then scale down.
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
    return canvas.toDataURL('image/jpeg', 0.84)
  } catch (error) {
    throw error instanceof Error && error.message.match(/[А-Яа-я]/) ? error : new Error('Не получилось прочитать картинку. Попробуй другой файл.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function EditProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <EditProfileForm onClose={onClose} /> : null
}

function EditProfileForm({ onClose }: { onClose: () => void }) {
  const profile = useUser((u) => u.profile)
  const [name, setName] = useState(profile.name)
  const [bio, setBio] = useState(profile.bio)
  const [avatar, setAvatar] = useState<AvatarData>(profile.avatar)
  const [nameError, setNameError] = useState('')
  const [fileError, setFileError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setNameError('Введи имя — оно показывается в шапке и профиле.')
      return
    }
    actions.updateProfile({ name: name.trim().slice(0, 40), bio: bio.trim(), avatar })
    toast('Профиль сохранён')
    onClose()
  }

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setAvatar({ kind: 'custom', dataUrl: await fileToAvatar(file) })
      setFileError('')
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Не получилось прочитать картинку.')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Редактировать профиль"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form={`${id}-form`} className="btn btn--primary">
            Сохранить профиль
          </button>
        </>
      }
    >
      <form id={`${id}-form`} className="form-stack" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-name`}>
            Имя
          </label>
          <input
            id={`${id}-name`}
            className="input"
            value={name}
            maxLength={40}
            name="nickname"
            autoComplete="nickname"
            spellCheck={false}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
            onChange={(e) => {
              setName(e.target.value)
              setNameError('')
            }}
          />
          {nameError ? (
            <p id={`${id}-name-error`} className="field__error" role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${id}-bio`}>
            О себе
          </label>
          <textarea id={`${id}-bio`} name="bio" className="textarea" rows={2} maxLength={200} value={bio} onChange={(e) => setBio(e.target.value)} />
          <p className="field__hint tabular">{bio.length} / 200</p>
        </div>

        <fieldset className="avatar-picker">
          <legend className="field__label">Аватар</legend>
          <div className="avatar-picker__grid">
            {AVATAR_PRESETS.map((preset) => {
              const value: AvatarData = { kind: 'preset', id: preset.id }
              const checked = avatar.kind === 'preset' && avatar.id === preset.id
              return (
                <label key={preset.id} className="avatar-picker__option">
                  <input type="radio" name={`${id}-avatar`} className="visually-hidden" checked={checked} onChange={() => setAvatar(value)} />
                  <img src={avatarSrc(value)} alt={preset.label} width={56} height={56} />
                </label>
              )
            })}
            {avatar.kind === 'custom' ? (
              <label className="avatar-picker__option">
                <input type="radio" name={`${id}-avatar`} className="visually-hidden" checked readOnly />
                <img src={avatar.dataUrl} alt="Своя картинка" width={56} height={56} />
              </label>
            ) : null}
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={onFile} />
          <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()}>
            <Upload size={18} aria-hidden="true" />
            Загрузить свою картинку
          </button>
          <p className="field__hint">Картинка уменьшится до 160 × 160 и останется только в этом браузере.</p>
          {fileError ? (
            <p className="field__error" role="alert">
              {fileError}
            </p>
          ) : null}
        </fieldset>
      </form>
    </Dialog>
  )
}
