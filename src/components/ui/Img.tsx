import { useState, type CSSProperties } from 'react'
import { ImageOff } from 'lucide-react'

interface ImgProps {
  src: string
  /** Title for meaningful artwork, empty string for decoration */
  alt: string
  /** Aspect ratio of the frame, e.g. "2 / 3" or "16 / 9" */
  ratio?: string
  srcSet?: string
  sizes?: string
  /** Focal point as CSS object-position, e.g. "47% 35%" */
  position?: string
  /** Above-the-fold image: load eagerly with high priority */
  priority?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * Artwork frame. The box reserves its size up front (no layout shift), the image covers it,
 * and a failed load swaps in a neutral placeholder once — no retry loop, no broken grid.
 */
export function Img({ src, alt, ratio, srcSet, sizes, position, priority, className, style }: ImgProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = failedSrc === src

  return (
    <span className={`img ${className ?? ''}`} style={{ aspectRatio: ratio, ...style }}>
      {failed ? (
        <span className="img__fallback" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
          <ImageOff size={24} aria-hidden="true" />
        </span>
      ) : (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          style={position ? { objectPosition: position } : undefined}
          onError={() => setFailedSrc(src)}
          draggable={false}
        />
      )}
    </span>
  )
}
