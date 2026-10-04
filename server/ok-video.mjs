/** Parse only public player metadata; login-gated and external embeds are not imported. */
export function parseOkMetadata(html) {
  const options = [...html.matchAll(/data-options="([^"]+)"/g)].map(match => {
    try { return JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&')) } catch { return null }
  })
  const raw = options.find(o => o?.flashvars?.metadata)?.flashvars.metadata
  const metadata = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!metadata || metadata.provider !== 'UPLOADED_ODKL' || metadata.movie?.status !== 'OK' ||
      metadata.movie.isLive || metadata.movie.notPublished || !metadata.videos?.length) throw new Error('OK video is unavailable')
  return metadata
}

export async function publicOkVideo(id, signal = AbortSignal.timeout(20_000)) {
  if (!/^[1-9]\d{4,16}$/.test(id)) throw new Error('Invalid OK video id')
  const response = await fetch(`https://ok.ru/videoembed/${id}`, { signal })
  if (!response.ok || response.status === 204) throw new Error(`OK metadata: ${response.status}`)
  const metadata = parseOkMetadata(await response.text())
  if (metadata.movie.id !== id) throw new Error('Unexpected video identity')
  const video = metadata.videos.find(v => v.name === 'full') ?? metadata.videos.at(-1)
  const url = new URL(video.url)
  if (url.protocol !== 'https:' || !/(^|\.)okcdn\.ru$/.test(url.hostname) || url.username || url.password || url.port) throw new Error('Unexpected OK media host')
  return { metadata, url: url.href }
}
