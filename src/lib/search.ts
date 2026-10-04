import type { Anime } from '../types'
import { CATALOG } from '../data/catalog'
import { normalize } from './format'

const HAYSTACKS = new Map<string, string[]>(
  CATALOG.map((a) => [a.id, [a.titleRu, a.titleEn, a.titleOriginal, ...a.aliases].map(normalize)]),
)

/** 3 = a name starts with the query, 2 = a word starts with it, 1 = it appears anywhere, 0 = no match. */
function rank(names: string[], query: string): number {
  let best = 0
  for (const name of names) {
    if (name.startsWith(query)) return 3
    const at = name.indexOf(query)
    if (at < 0) continue
    best = Math.max(best, /[\s:;.,!?×\-—(]/.test(name[at - 1] ?? '') ? 2 : 1)
  }
  return best
}

/** Case-insensitive search over Russian, English and original names plus aliases. */
export function searchAnime(query: string, list: Anime[] = CATALOG): Anime[] {
  const q = normalize(query)
  if (!q) return list
  return list
    .map((a) => ({ a, r: rank(HAYSTACKS.get(a.id) ?? [], q) }))
    .filter((x) => x.r > 0)
    .sort((x, y) => y.r - x.r || y.a.rating - x.a.rating)
    .map((x) => x.a)
}
