import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { matchVideo } from '../scripts/video-matching.mjs'
const { titles } = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url), 'utf8'))
const video = (title, extra = {}) => ({ id: 'a'.repeat(32), title, duration: 1450, author: { id: 32420212, name: 'Анимач' }, ...extra })

test('season identities, split parts and long premieres are mapped to the catalog', () => {
  assert.equal(matchVideo('jujutsu-kaisen', video('Магическая битва: Смертельная миграция 1 серия'), titles['jujutsu-kaisen']), 's3e01')
  assert.equal(matchVideo('haikyu', video('Волейбол!! К вершине 2 1 серия'), titles.haikyu), 's5e01')
  assert.equal(matchVideo('haikyu', video('Волейбол!! К вершине 2 серия'), titles.haikyu), 's4e02')
  assert.equal(matchVideo('spy-family', video('Семья шпиона 1 сезон 13 серия'), titles['spy-family']), 's2e01')
  assert.equal(matchVideo('spy-family', video('Семья шпиона 2 сезон 1 серия'), titles['spy-family']), 's3e01')
  assert.equal(matchVideo('demon-slayer', video('Клинок, рассекающий демонов: Деревня кузнецов 1 серия', { duration: 3000 }), titles['demon-slayer']), 's3e01')
})

test('reaction uploads, truncated reactions, ranges, films and unrelated adaptations are rejected', () => {
  for (const title of ['Тетрадь смерти 1 сезон 1 серия', 'ДАНДАДАН 1-3 СЕРИЯ', 'Монолог фармацевта 2 сезон 5 серия рекция',
    'Впервые смотрю Дандадан 1 серия', 'Дандадан 1 сезон 1 серия | реакц']) {
    const slug = title.includes('Тетрадь') ? 'death-note' : title.includes('Монолог') ? 'apothecary-diaries' : 'dandadan'
    assert.equal(matchVideo(slug, video(title, title.includes('Тетрадь') ? { duration: 4276 } : {}), titles[slug]), null)
  }
  assert.equal(matchVideo('dandadan', video('Дандадан 1 серия', { author: { name: 'Аниме Реакции' } }), titles.dandadan), null)
  assert.equal(matchVideo('dandadan', video('Дандадан 2 серия', { author: { id: 30337371, name: 'Erdoms' } }), titles.dandadan), null)
  assert.equal(matchVideo('apothecary-diaries', video('Монолог фармацевта 2 сезон 7 серия', { author: { id: 57124951, name: 'channel57124951' } }), titles['apothecary-diaries']), null)
  assert.equal(matchVideo('jujutsu-kaisen', video('Магическая битва 0 фильм'), titles['jujutsu-kaisen']), null)
})

test('generated sources cover only real catalog episode ids and do not persist signed streams', async () => {
  const { sources, missing } = JSON.parse(await readFile(new URL('../src/data/generated/video-sources.json', import.meta.url), 'utf8'))
  const ids = new Set(Object.entries(titles).flatMap(([slug, title]) => title.seasons.flatMap((season, i) => season.episodes.map(ep => `${slug}/s${i + 1}e${String(ep.n).padStart(2, '0')}`))))
  for (const [key, source] of Object.entries(sources)) {
    assert.ok(ids.has(key), key)
    assert.ok(['rutube', 'aniliberty', 'local', 'ok'].includes(source.provider))
    if (source.provider === 'local') {
      assert.equal(source.fileUrl, `/media/video/${key}.mp4`)
      assert.ok(source.cutEnd > source.cutStart)
      assert.ok(Math.abs(source.duration - (source.cutEnd - source.cutStart)) < 0.25)
    }
    assert.ok(source.verifiedAt)
    assert.ok(!source.url.includes('sign='))
    assert.ok(!missing.includes(key))
    ids.delete(key)
  }
  assert.deepEqual(new Set(missing), ids)
})
