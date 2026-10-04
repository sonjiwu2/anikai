import type { EmbedProvider, UserSource } from '../types'

export const PROVIDER_LABEL: Record<EmbedProvider, string> = { rutube: 'Rutube', vk: 'VK Видео' }

export const RUTUBE_ID = /^[a-f0-9]{32}$/
export const VK_ID = /^-?\d+_\d+$/
const VK_HASH = /^[a-f0-9]{8,32}$/

export type ParsedLink = Pick<UserSource, 'provider' | 'videoId' | 'hash' | 'url'>

/**
 * Recognises a Rutube or VK Video link (page, share or embed form).
 * Returns null for anything else, including private Rutube links that cannot be embedded by id alone.
 */
export function parseVideoLink(input: string): ParsedLink | null {
  const text = input.trim()
  if (!text) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^(www|m)\./, '')

  if (host === 'rutube.ru') {
    const match = /^\/(?:video|play\/embed|shorts)\/([a-f0-9]{32})\/?$/.exec(url.pathname)
    return match ? { provider: 'rutube', videoId: match[1]!, url: `https://rutube.ru/video/${match[1]}/` } : null
  }

  if (host === 'vk.com' || host === 'vk.ru' || host === 'vkvideo.ru') {
    let id: string | undefined
    let hash: string | undefined
    if (/^\/video_e(?:xt|mbed)\.php$/.test(url.pathname)) {
      const oid = url.searchParams.get('oid')
      const vid = url.searchParams.get('id')
      if (oid && vid) id = `${oid}_${vid}`
      hash = url.searchParams.get('hash') ?? undefined
    } else {
      // /video-123_456, /clip-123_456, or a "z=video-123_456%2F..." overlay parameter
      const fromPath = /^\/(?:video|clip)(-?\d+_\d+)/.exec(url.pathname)
      const fromQuery = /(?:video|clip)(-?\d+_\d+)/.exec(url.searchParams.get('z') ?? '')
      id = fromPath?.[1] ?? fromQuery?.[1]
    }
    if (!id || !VK_ID.test(id)) return null
    return {
      provider: 'vk',
      videoId: id,
      hash: hash && VK_HASH.test(hash) ? hash : undefined,
      url: `https://vkvideo.ru/video${id}`,
    }
  }
  return null
}

/** Address of the platform's embed player. Only ids validated above ever reach this. */
export function embedUrl(source: Pick<UserSource, 'provider' | 'videoId' | 'hash'>, startAt: number): string {
  if (source.provider === 'rutube') {
    const start = Math.floor(startAt)
    return `https://rutube.ru/play/embed/${source.videoId}${start > 0 ? `?t=${start}` : ''}`
  }
  const [oid, id] = source.videoId.split('_')
  const params = new URLSearchParams({ oid: oid ?? '', id: id ?? '', hd: '2', js_api: '1' })
  if (source.hash) params.set('hash', source.hash)
  return `https://vk.com/video_ext.php?${params}`
}

export const EMBED_ORIGINS: Record<EmbedProvider, RegExp> = {
  rutube: /^https:\/\/([a-z0-9-]+\.)?rutube\.ru$/,
  vk: /^https:\/\/([a-z0-9-]+\.)?(vk\.com|vk\.ru|vkvideo\.ru)$/,
}
