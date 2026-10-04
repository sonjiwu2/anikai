/** AniLiberty explicitly allows browser CORS access to its public API. */
export async function resolvePublicHls(src: string, signal: AbortSignal): Promise<string> {
  const match = /^aniliberty:([1-9]\d*)\/([1-9]\d*)$/.exec(src)
  if (!match) return src
  const response = await fetch(`https://anilibria.top/api/v1/anime/releases/${match[1]}`, { signal })
  if (!response.ok) throw new Error('Source unavailable')
  const release = await response.json() as { is_blocked_by_copyrights: boolean; is_blocked_by_geo: boolean;
    episodes: { ordinal: number; hls_720?: string; hls_480?: string; hls_1080?: string }[] }
  if (release.is_blocked_by_copyrights !== false || release.is_blocked_by_geo !== false) throw new Error('Source unavailable')
  const episode = release.episodes.find(e => e.ordinal === Number(match[2]))
  const url = new URL(episode?.hls_720 ?? episode?.hls_480 ?? episode?.hls_1080 ?? '')
  if (url.protocol !== 'https:' || !/(^|\.)libria\.fun$/.test(url.hostname) || url.username || url.password || url.port) throw new Error('Unexpected media host')
  return url.href
}
