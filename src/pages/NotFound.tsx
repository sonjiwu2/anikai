import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { EmptyState } from '../components/ui/basics'
import { useDocumentTitle } from '../lib/hooks'

interface Props {
  title?: string
  children?: ReactNode
}

/** Used for unknown URLs and for known routes whose title, episode or list does not exist. */
export function NotFound({ title = 'Такой страницы нет', children }: Props) {
  useDocumentTitle(title)
  return (
    <div className="container page">
      <h1 className="visually-hidden">{title}</h1>
      <EmptyState
        icon={<Compass size={26} />}
        title={title}
        actions={
          <>
            <Link to="/catalog" className="btn btn--primary">
              Открыть каталог
            </Link>
            <Link to="/" className="btn">
              На главную
            </Link>
          </>
        }
      >
        {children ?? 'Возможно, ссылка устарела или в адресе опечатка.'}
      </EmptyState>
    </div>
  )
}
