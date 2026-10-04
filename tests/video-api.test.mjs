import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createVideoMiddleware, publicPlaybackOptions } from '../server/video-api.mjs'
import { parseOkMetadata } from '../server/ok-video.mjs'

const id = 'a'.repeat(32)
test('OK metadata rejects external embeds, hidden uploads and non-video pages', () => {
  const html = metadata => `<div data-options="${JSON.stringify({flashvars:{metadata:JSON.stringify(metadata)}}).replaceAll('"', '&quot;')}"></div>`
  const value = {provider:'UPLOADED_ODKL',movie:{id:'12345',status:'OK'},videos:[{name:'full',url:'https://v.okcdn.ru/video.mp4'}]}
  assert.equal(parseOkMetadata(html(value)).movie.id, '12345')
  for (const changed of [{...value,provider:'OPEN_GRAPH'}, {...value,movie:{...value.movie,notPublished:true}}, {...value,videos:[]}]) assert.throws(() => parseOkMetadata(html(changed)))
  assert.throws(() => parseOkMetadata(''))
})

test('OK standalone MP4 preserves Range and only allows catalog IDs', async t => {
  let calls = 0
  const {base,requests} = await fixture(t, {allowedOkIds:new Set(['12345']),fetchOkOptions:async () => {calls++;return {url:'https://v.okcdn.ru/episode.ts'}}})
  assert.equal((await fetch(`${base}/api/video/ok/98765/video.mp4`)).status, 404)
  const r = await fetch(`${base}/api/video/ok/12345/video.mp4`, {headers:{Range:'bytes=0-3'}})
  assert.equal(r.status,206)
  assert.equal(r.headers.get('content-range'),'bytes 0-3/4')
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3,4])
  assert.equal(requests[0].headers.Range,'bytes=0-3')
  await (await fetch(`${base}/api/video/ok/12345/video.mp4`)).arrayBuffer()
  assert.equal(calls,1)
})
async function fixture(t, overrides = {}) {
  const requests = []
  const middleware = createVideoMiddleware({ allowedIds: new Set([id]),
    fetchOptions: async () => ({ video_balancer: { m3u8: `https://bl.rutube.ru/route/${id}.m3u8` } }),
    fetchUpstream: async (url, _signal, headers) => {
      requests.push({ url: String(url), headers })
      const path = new URL(url).pathname
      if (path.endsWith('.ts')) return new Response(new Uint8Array([1, 2, 3, 4]), { status: headers.Range ? 206 : 200,
        headers: { 'Content-Type': 'video/mp2t', ...(headers.Range ? { 'Content-Range': 'bytes 0-3/4' } : {}) } })
      return new Response(path.startsWith('/route/') ? '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100000\nhttps://cdn.rtbcdn.ru/hls/variant.m3u8\n'
        : '#EXTM3U\n#EXTINF:4,\nsegment.ts\n#EXT-X-ENDLIST\n', { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } })
    }, ...overrides })
  const server = createServer((req, res) => void middleware(req, res, () => { res.writeHead(404); res.end() }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => server.close(resolve)))
  return { base: `http://127.0.0.1:${server.address().port}`, requests }
}

test('master, variant and relative segments are signed and proxied; Range is preserved', async t => {
  const { base, requests } = await fixture(t)
  const master = await (await fetch(`${base}/api/video/rutube/${id}/master.m3u8`)).text()
  const variantUrl = master.split('\n').find(line => line.startsWith('/api/video/asset/'))
  assert.ok(variantUrl)
  assert.ok(!master.includes('https://cdn'))
  const variant = await (await fetch(base + variantUrl)).text()
  const segmentUrl = variant.split('\n').find(line => line.startsWith('/api/video/asset/'))
  const segment = await fetch(base + segmentUrl, { headers: { Range: 'bytes=0-3' } })
  assert.equal(segment.status, 206)
  assert.equal(segment.headers.get('content-range'), 'bytes 0-3/4')
  assert.deepEqual([...new Uint8Array(await segment.arrayBuffer())], [1, 2, 3, 4])
  assert.equal(requests[2].url, 'https://cdn.rtbcdn.ru/hls/segment.ts')
})

test('unknown video ids, arbitrary URLs, tampered signatures and expired links are refused', async t => {
  const { base, requests } = await fixture(t)
  assert.equal((await fetch(`${base}/api/video/rutube/${'b'.repeat(32)}/master.m3u8`)).status, 404)
  assert.equal((await fetch(`${base}/api/video/asset/${Buffer.from('http://127.0.0.1/secret').toString('base64url')}?until=1&sig=${'a'.repeat(64)}`)).status, 403)
  assert.equal(requests.length, 0)
  const master = await (await fetch(`${base}/api/video/rutube/${id}/master.m3u8`)).text()
  const uri = master.split('\n').find(line => line.startsWith('/api/video/asset/'))
  const bad = new URL(base + uri)
  bad.searchParams.set('sig', 'a'.repeat(64))
  assert.equal((await fetch(bad)).status, 403)
  bad.searchParams.set('until', '1')
  assert.equal((await fetch(bad)).status, 403)
  assert.equal(requests.length, 1)
  assert.equal((await fetch(`${base}/api/video/rutube/${id}/master.m3u8`, { method: 'POST' })).status, 405)
})

test('encrypted manifests are refused', async t => {
  const { base } = await fixture(t, { fetchUpstream: async () => new Response('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nsegment.ts\n') })
  assert.equal((await fetch(`${base}/api/video/rutube/${id}/master.m3u8`)).status, 502)
})

test('Rutube ACL, DRM and access limits are enforced before returning a stream', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  for (const restriction of [{ acl_access: { allowed: false } }, { drm_token: 'DRM' }, { limits: ['premium'] }, { is_hidden: true }]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ acl_access: { allowed: true }, limits: [], video_balancer: { m3u8: 'https://bl.rutube.ru/video.m3u8' }, ...restriction }))
    await assert.rejects(publicPlaybackOptions(id), error => error.status === 403)
  }
})

test('AniLiberty validates release access and generates quality choices without changing source URLs', async t => {
  const source = 'https://cache-rfn.libria.fun/videos/1.m3u8?isWithVideoAds=1'
  const { base } = await fixture(t, { allowedAniEpisodes: new Set(['8674/6']), fetchUpstream: async () => new Response(JSON.stringify({
    is_blocked_by_copyrights: false, is_blocked_by_geo: false, episodes: [{ ordinal: 6, hls_480: source, hls_720: source }],
  })) })
  const result = await fetch(`${base}/api/video/aniliberty/8674/6/master.m3u8`)
  assert.equal(result.status, 200)
  const manifest = await result.text()
  assert.match(manifest, /x480/)
  assert.match(manifest, /x720/)
  const path = manifest.split('\n').find(line => line.startsWith('/api/video/asset/'))
  const encoded = new URL(base + path).pathname.split('/').at(-1)
  assert.equal(Buffer.from(encoded, 'base64url').toString(), source)
  assert.equal((await fetch(`${base}/api/video/aniliberty/8674/5/master.m3u8`)).status, 404)
})
