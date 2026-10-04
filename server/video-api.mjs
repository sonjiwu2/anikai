import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { publicOkVideo } from './ok-video.mjs'

const ROOT = '/api/video'
const MAX_MANIFEST_BYTES = 2_000_000
const LINK_LIFETIME = 2 * 60 * 60 * 1000

function permittedUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !(/(^|\.)rutube\.ru$/.test(url.hostname) || /\.rtbcdn\.ru$/.test(url.hostname) ||
        /(^|\.)anilibria\.top$/.test(url.hostname) || /\.libria\.fun$/.test(url.hostname) || /\.okcdn\.ru$/.test(url.hostname))) {
    throw new Error('Unsupported media host')
  }
  return url
}

async function upstream(url, signal, headers = {}) {
  let current = permittedUrl(url)
  // Check every redirect; arbitrary user URLs are never fetched.
  for (let i = 0; i < 4; i++) {
    const response = await fetch(current, { signal, headers, redirect: 'manual' })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel()
      current = permittedUrl(new URL(response.headers.get('location'), current))
      continue
    }
    return response
  }
  throw new Error('Too many redirects')
}

/** Also used by the import script: only publicly accessible, unencrypted HLS is accepted. */
export async function publicPlaybackOptions(videoId, signal = AbortSignal.timeout(15_000)) {
  if (!/^[a-f0-9]{32}$/.test(videoId)) throw new Error('Invalid video id')
  const response = await upstream(`https://rutube.ru/api/play/options/${videoId}/`, signal)
  if (!response.ok) throw new Error(`Rutube metadata: ${response.status}`)
  const options = await response.json()
  if (options.acl_access?.allowed !== true || options.drm_token || options.is_hidden ||
      (Array.isArray(options.limits) && options.limits.length > 0) || !options.video_balancer?.m3u8) {
    const error = new Error('Видео недоступно для воспроизведения в Anikai')
    error.status = 403
    throw error
  }
  permittedUrl(options.video_balancer.m3u8)
  return options
}

export function createVideoMiddleware({ allowedIds, allowedAniEpisodes = new Set(), allowedOkIds = new Set(), fetchOkOptions = publicOkVideo, fetchOptions = publicPlaybackOptions, fetchUpstream = upstream } = {}) {
  const secret = randomBytes(32)
  const optionsCache = new Map()
  const pending = new Map()
  const aniCache = new Map()
  const okCache = new Map()

  const sign = value => createHmac('sha256', secret).update(value).digest('hex')
  function mediaLink(value, base, until) {
    const url = permittedUrl(new URL(value, base)).href
    const encoded = Buffer.from(url).toString('base64url')
    const signature = sign(`${encoded}/${until}`)
    return `${ROOT}/asset/${encoded}?until=${until}&sig=${signature}`
  }
  function rewriteManifest(text, base, until) {
    if (!text.startsWith('#EXTM3U') || Buffer.byteLength(text) > MAX_MANIFEST_BYTES) throw new Error('Invalid HLS manifest')
    // Do not unwrap encrypted media, DRM or license endpoints.
    if (/#EXT-X-(?:SESSION-)?KEY:.*METHOD=(?!NONE)/.test(text)) throw new Error('Encrypted streams are unsupported')
    return text.split('\n').map(line => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${mediaLink(uri, base, until)}"`)
      return mediaLink(trimmed, base, until)
    }).join('\n')
  }
  async function optionsFor(id) {
    const cached = optionsCache.get(id)
    if (cached && cached.until > Date.now()) return cached.options
    if (pending.has(id)) return pending.get(id)
    const request = fetchOptions(id).then(options => {
      // Signed balancer URLs are short lived; cache for at most five minutes.
      const expires = Number(new URL(options.video_balancer.m3u8).searchParams.get('expire')) * 1000
      const until = Math.min(Date.now() + 300_000, expires > Date.now() ? expires - 30_000 : Date.now() + 30_000)
      if (optionsCache.size >= 128) optionsCache.delete(optionsCache.keys().next().value)
      optionsCache.set(id, { options, until })
      return options
    }).finally(() => pending.delete(id))
    pending.set(id, request)
    return request
  }

  return async function videoMiddleware(req, res, next = () => {}) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith(`${ROOT}/`)) return next()
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    const onClose = () => { if (!res.writableFinished) controller.abort() }
    res.on('close', onClose)
    try {
      let target
      let until = Date.now() + LINK_LIFETIME
      const master = /^\/api\/video\/rutube\/([a-f0-9]{32})\/master\.m3u8$/.exec(url.pathname)
      const ani = /^\/api\/video\/aniliberty\/([1-9]\d{0,5})\/([1-9]\d{0,3})\/master\.m3u8$/.exec(url.pathname)
      const ok = /^\/api\/video\/ok\/([1-9]\d{4,16})\/video\.mp4$/.exec(url.pathname)
      const asset = /^\/api\/video\/asset\/([A-Za-z0-9_-]{1,6000})$/.exec(url.pathname)
      if (ok) {
        if (!allowedOkIds.has(ok[1])) { res.writeHead(404); res.end(); return }
        let cached = okCache.get(ok[1])
        if (!cached || cached.until < Date.now()) {
          cached = { value: await fetchOkOptions(ok[1], controller.signal), until: Date.now() + 60_000 }
          if (okCache.size >= 128) okCache.delete(okCache.keys().next().value)
          okCache.set(ok[1], cached)
        }
        target = cached.value.url
      } else if (ani) {
        if (!allowedAniEpisodes.has(`${ani[1]}/${ani[2]}`)) { res.writeHead(404); res.end(); return }
        let release = aniCache.get(ani[1])
        if (!release || release.until < Date.now()) {
          const response = await fetchUpstream(`https://anilibria.top/api/v1/anime/releases/${ani[1]}`, controller.signal)
          if (!response.ok) throw new Error('Release unavailable')
          release = { value: await response.json(), until: Date.now() + 60_000 }
          if (aniCache.size >= 32) aniCache.delete(aniCache.keys().next().value)
          aniCache.set(ani[1], release)
        }
        const value = release.value
        if (value.is_blocked_by_copyrights !== false || value.is_blocked_by_geo !== false) {
          res.writeHead(403); res.end('Источник видео недоступен'); return
        }
        const episode = value.episodes?.find(e => e.ordinal === Number(ani[2]))
        if (!episode) { res.writeHead(404); res.end(); return }
        const streams = [480, 720, 1080].filter(height => episode[`hls_${height}`])
        if (!streams.length) throw new Error('No HLS streams')
        const manifest = '#EXTM3U\n' + streams.map(height => `#EXT-X-STREAM-INF:BANDWIDTH=${height * 3500},RESOLUTION=${Math.round(height * 16 / 9 / 2) * 2}x${height}\n${mediaLink(episode[`hls_${height}`], 'https://anilibria.top', until)}`).join('\n') + '\n'
        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        res.end(req.method === 'HEAD' ? undefined : manifest)
        return
      } else if (master) {
        if (allowedIds && !allowedIds.has(master[1])) { res.writeHead(404); res.end(); return }
        target = (await optionsFor(master[1])).video_balancer.m3u8
      } else if (asset) {
        until = Number(url.searchParams.get('until'))
        const sig = url.searchParams.get('sig') ?? ''
        const expected = sign(`${asset[1]}/${until}`)
        if (!Number.isSafeInteger(until) || until <= Date.now() || until > Date.now() + LINK_LIFETIME ||
            !/^[a-f0-9]{64}$/.test(sig) || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          res.writeHead(403); res.end(); return
        }
        target = permittedUrl(Buffer.from(asset[1], 'base64url').toString('utf8')).href
      } else { res.writeHead(404); res.end(); return }

      const range = req.headers.range
      const response = await fetchUpstream(target, controller.signal, range && /^bytes=\d+-\d*$/.test(range) ? { Range: range } : {})
      if (!response.ok) {
        if (master) optionsCache.delete(master[1])
        res.writeHead(response.status === 404 ? 404 : 502); res.end('Источник видео временно недоступен');
        await response.body?.cancel(); return
      }
      const type = response.headers.get('content-type') ?? 'application/octet-stream'
      const isManifest = master || new URL(target).pathname.endsWith('.m3u8') || /mpegurl/i.test(type)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cache-Control', 'no-store')
      if (isManifest) {
        const text = await response.text()
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
        res.end(req.method === 'HEAD' ? undefined : rewriteManifest(text, response.url || target, until))
      } else {
        res.statusCode = response.status
        res.setHeader('Content-Type', type)
        for (const name of ['content-length', 'content-range', 'accept-ranges']) {
          const value = response.headers.get(name)
          if (value) res.setHeader(name, value)
        }
        if (req.method === 'HEAD') { await response.body?.cancel(); res.end() }
        else if (response.body) await pipeline(Readable.fromWeb(response.body), res)
        else res.end()
      }
    } catch (error) {
      if (res.destroyed) return
      if (res.headersSent) { res.destroy(); return }
      res.writeHead(error.status === 403 ? 403 : 502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(error.status === 403 ? error.message : 'Не удалось загрузить источник видео. Попробуйте ещё раз.')
    } finally {
      clearTimeout(timer)
      res.off('close', onClose)
    }
  }
}
