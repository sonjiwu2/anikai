import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const cacheDir = new URL('./.cache/rutube/', import.meta.url)

/** Public metadata only. Never stores expiring playback URLs. */
export async function rutubeJson(path, { fresh = process.argv.includes('--force') } = {}) {
  const url = new URL(path, 'https://rutube.ru')
  if (url.origin !== 'https://rutube.ru' || !url.pathname.startsWith('/api/')) throw new Error('Unexpected API URL')
  const file = new URL(`${createHash('sha256').update(url.href).digest('hex')}.json`, cacheDir)
  if (!fresh) {
    try { return JSON.parse(await readFile(file, 'utf8')) } catch { /* fetch below */ }
  }
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (!response.ok) throw new Error(`${response.status}: ${url.pathname}`)
      const json = await response.json()
      await mkdir(cacheDir, { recursive: true })
      await writeFile(file, JSON.stringify(json))
      return json
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  throw lastError
}

export async function rutubePages(path, options) {
  const results = []
  const visited = new Set()
  while (path) {
    if (visited.has(path)) throw new Error('Pagination loop')
    visited.add(path)
    const page = await rutubeJson(path, options)
    if (!Array.isArray(page.results)) throw new Error(`Missing results: ${path}`)
    results.push(...page.results)
    path = page.has_next ? page.next : null
  }
  return results
}
