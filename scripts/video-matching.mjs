import { VIDEO_TITLES } from './video-titles.mjs'

export const normalize = value => value.normalize('NFC').toLowerCase().replaceAll('ё', 'е').replace(/[!«»"']/g, '').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim()
// Reviewed frames: these channels contain reactions or a static cover instead of the episode.
const EXCLUDED_CHANNELS = new Set([30337371, 57125156, 58316807, 57124951, 58760368, 57125367])
const unrelated = /реак|рекци|пересказ|обзор|анонс|трейлер|опенинг|эндинг|amv|нарезк|тизер|разбор|как я (?:смотрел|посмотрел)|спецвыпуск|ova|компиляци|аудиокниг|прохождение|once human|музык|piano|тема \d|ost|пересматриваю|озвучка.*серии|чтение.*арк|стрим|манга|озвучива|смотрит|впервые смотрю/i

/** Match only explicit episode numbers. Playlist order is never used as an episode number. */
export function matchVideo(slug, video, title) {
  const config = VIDEO_TITLES[slug]
  if (EXCLUDED_CHANNELS.has(video.author?.id)) return null
  const text = normalize(video.title)
  if (unrelated.test(text) || unrelated.test(video.author?.name ?? '') || /(?:моя реакция|реакция на аниме|пересказ аниме)/i.test(video.description ?? '') || video.is_deleted || video.is_hidden || video.is_paid || video.is_locked) return null
  const identity = text.replace(/^(?:аниме|смотреть|фильм|мультфильм)\s*[:-]?\s*/u, '')
  if (!config.names.some(name => identity.startsWith(normalize(name)))) return null
  if (!/^[a-f0-9]{32}$/.test(video.id)) return null
  if (config.movie) {
    const runtime = title.seasons[0].duration * 60
    if (video.duration < runtime * 0.94 || video.duration > runtime * 1.07 || /серия|сезон/.test(text)) return null
    return 's1e01'
  }
  const episodeMatch = /(?:^|\s)(\d+)\s*(?:серия|серии|эпизод)(?:\b|\s|$)/u.exec(text)
  if (!episodeMatch || /\d\s*[-–—,]\s*\d+\s*(?:серия|серии)/i.test(video.title)) return null
  let episode = Number(episodeMatch[1])
  if (episode === 0) return null
  let season = Number(/(\d+)\s*сезон/.exec(text)?.[1] ?? /сезон\s*(\d+)/.exec(text)?.[1] ?? 1)
  if (slug === 'jujutsu-kaisen' && /смертельная миграция/.test(text)) season = 3
  const prefix = text.slice(0, episodeMatch.index).trim()
  if (slug === 'haikyu') {
    if (/к вершине 2/.test(prefix)) season = 5
    else if (/к вершине/.test(prefix)) season = 4
    else if (/волейбол\s+([23])$/.test(prefix)) season = Number(/([23])$/.exec(prefix)[1])
  }
  if (slug === 'solo-leveling' && /в одиночку 2/.test(prefix)) season = 2
  if (slug === 'apothecary-diaries' && /фармацевта 2/.test(prefix)) season = 2
  if (slug === 'demon-slayer') {
    if (/бесконечный поезд/.test(text)) return null // This arc is not in the site's catalog.
    if (/тренировка столпов/.test(text)) season = 4
    else if (/деревн[яюе] кузнецов/.test(text)) season = 3
    else if (/квартал красных фонарей/.test(text)) season = 2
  }
  if (slug === 'spy-family') {
    if (season === 1 && episode > 12) { season = 2; episode -= 12 }
    else if (season === 1 && /(?:часть|part)\s*2/.test(text)) season = 2
    else if (season === 2) season = 3
    else if (season === 3) season = 4
  }
  if (slug === 'attack-on-titan' && season === 3 && episode > 12) { season = 4; episode -= 12 }
  else if (slug === 'attack-on-titan' && season === 3 && /часть\s*2/.test(text)) season = 4
  if (slug === 're-zero' && season === 2 && episode > 13) { season = 3; episode -= 13 }
  else if (slug === 're-zero' && season === 2 && /часть\s*2/.test(text)) season = 3
  const catalogSeason = title.seasons[season - 1]
  if (!catalogSeason?.episodes.some(e => e.n === episode)) return null
  const runtime = (catalogSeason.duration ?? 24) * 60
  const key = `s${season}e${String(episode).padStart(2, '0')}`
  const doubleEpisode = (slug === 'made-in-abyss' && ((season === 1 && episode === 13) || (season === 2 && episode === 12))) ||
    (slug === 'demon-slayer' && ['s3e01', 's3e11', 's4e01'].includes(key))
  if (video.duration < runtime * 0.72 || video.duration > runtime * (doubleEpisode ? 2.4 : 1.55)) return null
  return key
}
