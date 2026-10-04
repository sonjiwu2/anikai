import { writeFile } from 'node:fs/promises'
import { rutubeJson } from './rutube-api.mjs'

const playlists = []
let path = '/api/playlist/user/32420212/?page=1'
let pages = 0
while (path) {
  const page = await rutubeJson(path, { fresh: process.argv.includes('--force') })
  playlists.push(...page.results)
  path = page.has_next ? page.next : null
  if (++pages % 10 === 0) console.log(`Playlists: ${playlists.length}`)
}
await writeFile(new URL('./.cache/rutube-playlists.json', import.meta.url), JSON.stringify(playlists, null, 2))
console.log(`Complete: ${playlists.length} playlists`)
const words = /данда|фрирен|магическая битва|бензопила|клинок|шпиона|атака титанов|тетрадь смерти|ван-пис|волейбол|фармацевт|поднятие уровня|алхимик|штейна|винланд|моб психо|рокер|кагуя|киберпанк|идола|блю лок|кайдзю|бездне|жизнь с нуля|токийский гуль|код гиас|эвергарден|бибоп|евангелион|твое имя|твоё имя|форма голоса|судзум|призраками|мононоке|ходячий замок/i
for (const p of playlists.filter(p => words.test(p.title))) console.log(p.id, p.videos_count, p.title)
