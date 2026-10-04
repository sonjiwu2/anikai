import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createVideoMiddleware } from './video-api.mjs'

const project = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(project, 'dist')
const catalog = JSON.parse(await readFile(resolve(project, 'src/data/generated/video-sources.json'), 'utf8'))
const videos = Object.values(catalog.sources)
const videoApi = createVideoMiddleware({
  allowedIds: new Set(videos.filter(s => s.provider === 'rutube').map(s => s.videoId)),
  allowedAniEpisodes: new Set(videos.filter(s => s.provider === 'aniliberty').map(s => `${s.releaseId}/${s.episodeNumber}`)),
  allowedOkIds: new Set(videos.filter(s => s.provider === 'ok').map(s => s.videoId)),
})
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.ico': 'image/x-icon' }
await stat(resolve(dist, 'index.html')).catch(() => { throw new Error('Run npm run build before npm start') })

const server = createServer(async (req, res) => {
  if ((req.url ?? '').startsWith('/api/video/')) { await videoApi(req, res); return }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    let path = resolve(dist, `.${pathname}`)
    if (path !== dist && !path.startsWith(dist + sep)) { res.writeHead(403); res.end(); return }
    if (pathname.startsWith('/api/')) { res.writeHead(404); res.end(); return }
    let info = await stat(path).catch(() => null)
    if (!info?.isFile()) {
      if (extname(pathname)) { res.writeHead(404); res.end(); return }
      path = resolve(dist, 'index.html')
      info = await stat(path)
    }
    let start = 0, end = info.size - 1, status = 200
    const range = req.headers.range
    if (extname(path) === '.mp4' && range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return }
      start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]))
      end = match[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return }
      status = 206
    }
    res.writeHead(status, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Content-Length': end - start + 1, 'X-Content-Type-Options': 'nosniff',
      ...(extname(path) === '.mp4' ? { 'Accept-Ranges': 'bytes' } : {}),
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {}),
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
    if (req.method === 'HEAD') res.end()
    else createReadStream(path, { start, end }).on('error', () => res.destroy()).pipe(res)
  } catch { if (!res.headersSent) res.writeHead(400); res.end() }
})
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '127.0.0.1'
server.listen(port, host, () => console.log(`Anikai: http://${host}:${port} (native video API enabled)`))
