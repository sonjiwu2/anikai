// Generates ASSET_SOURCES.md from src/data/generated/anilist.json.
// Run after `npm run assets` (it is chained into that script).
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AVATARS, DEMO_VIDEOS } from './titles.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'generated', 'anilist.json'), 'utf8'))
const titles = Object.entries(data.titles)

async function dirSize(dir) {
  let bytes = 0
  let files = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const sub = await dirSize(full)
      bytes += sub.bytes
      files += sub.files
    } else {
      bytes += (await stat(full)).size
      files++
    }
  }
  return { bytes, files }
}
const mb = (bytes) => (bytes / 1048576).toFixed(1).replace('.', ',')
const media = path.join(ROOT, 'public', 'media')
const sizes = {}
for (const dir of ['posters', 'backdrops', 'episodes', 'avatars', 'video', 'subs']) sizes[dir] = await dirSize(path.join(media, dir))

const HOST_NAMES = { 'media.kitsu.app': 'Kitsu', 'img1.ak.crunchyroll.com': 'AniList → Crunchyroll', 'media.kitsu.io': 'Kitsu' }
const stills = (t) => {
  const entries = Object.entries(t.stillSources ?? {})
  if (!entries.length) return '—'
  return entries.map(([host, n]) => `${HOST_NAMES[host] ?? host}: ${n}`).join(', ')
}
const episodes = (t) => t.seasons.reduce((sum, s) => sum + s.episodes.length, 0)

const lines = []
const add = (...l) => lines.push(...l)

add(
  '# Источники медиа и данных Anikai',
  '',
  `Сформировано скриптом \`scripts/write-asset-sources.mjs\` по данным от ${data.fetchedAt}. Все файлы лежат в \`public/media/\` и отдаются локально: сайт не подгружает картинки и видео со сторонних адресов во время работы.`,
  '',
  '## Важно о правах',
  '',
  '- **Постеры, фоны и кадры серий — это официальные промо-материалы и кадры аниме.** Права на них принадлежат правообладателям (студиям, издателям, производственным комитетам). Они получены через открытые API каталогов для локальной демонстрации интерфейса. Лицензии на распространение у проекта нет: **перед публикацией сайта в открытом доступе изображения нужно заменить своими или получить разрешение.**',
  '- **Описания «Об аниме»** взяты с Shikimori (пользовательский контент сайта), источник указан на странице каждого аниме ссылкой. Короткие аннотации и слоганы написаны для проекта.',
  '- **Факты каталога** (число серий, годы, форматы, статусы, студии, популярность) получены из AniList; названия, даты выхода и кадры серий — из Kitsu, а где Kitsu пуст — из AniList. Данные верны на дату сборки и сами не обновляются.',
  '- **Оценки настоящие.** На карточках показана оценка Shikimori (10-балльная шкала), на странице аниме рядом с ней — оценка AniList. Обе взяты из API этих сервисов на дату сборки; значения по каждому тайтлу — в таблице ниже.',
  '- **Видео — не аниме.** Единственный воспроизводимый файл — трейлер открытого фильма Sintel; в плеере он подписан как демонстрационное видео.',
  '',
  '## Сводка по папкам',
  '',
  '| Папка | Файлов | Размер | Что это | Откуда |',
  '|---|---:|---:|---|---|',
  `| \`posters/\` | ${sizes.posters.files} | ${mb(sizes.posters.bytes)} МБ | Постеры 2:3, WebP, до 600 px и 300 px | Больший из двух: Kitsu \`posterImage\` или AniList \`coverImage\` |`,
  `| \`backdrops/\` | ${sizes.backdrops.files} | ${mb(sizes.backdrops.bytes)} МБ | Широкие фоны, WebP, до 1920 px и 960 px | Kitsu \`coverImage\` или AniList \`bannerImage\` — выбрано для каждого тайтла |`,
  `| \`episodes/\` | ${sizes.episodes.files} | ${mb(sizes.episodes.bytes)} МБ | Кадры серий 16:9, WebP, до 640 px, без увеличения | Kitsu, запасной источник — AniList |`,
  `| \`avatars/\` | ${sizes.avatars.files} | ${mb(sizes.avatars.bytes)} МБ | Пресеты аватаров 192×192 | Вырезки из фонов (см. ниже) |`,
  `| \`video/\` | ${sizes.video.files} | ${mb(sizes.video.bytes)} МБ | Демонстрационное видео | Blender Foundation |`,
  `| \`subs/\` | ${sizes.subs.files} | ${mb(sizes.subs.bytes)} МБ | Демонстрационные субтитры WebVTT | Написаны для проекта |`,
  '',
  '## Демонстрационное видео',
  '',
  '| Файл | Источник | Лицензия |',
  '|---|---|---|',
  ...DEMO_VIDEOS.map((v) => `| \`video/${v.file}\` | ${v.url} | CC BY 3.0 |`),
  '',
  'Трейлер фильма Sintel, © Blender Foundation, [durian.blender.org](https://durian.blender.org). Лицензия Creative Commons Attribution 3.0 разрешает использование при указании автора — оно указано рядом с плеером. Два файла — это одно и то же видео в 720p и 480p; поэтому переключатель качества в плеере настоящий. Длительность 52 секунды.',
  '',
  '`subs/sintel-demo.ru.vtt` — не перевод реплик, а пояснительные подписи, написанные для проекта, чтобы показать работу дорожки субтитров.',
  '',
  '## Аватары',
  '',
  '| Файл | Вырезан из фона |',
  '|---|---|',
  ...AVATARS.map((a) => `| \`avatars/${a.id}.webp\` | \`backdrops/${a.from}.webp\` (${data.titles[a.from]?.titleRomaji ?? a.from}) |`),
  '',
  'На аватары распространяются те же права, что и на исходные фоны.',
  '',
  '## Постеры, фоны и кадры по тайтлам',
  '',
  'Файлы названы по идентификатору тайтла: `posters/<id>.webp`, `posters/<id>-sm.webp`, `backdrops/<id>.webp`, `backdrops/<id>-sm.webp`, `episodes/<id>/s<сезон>e<серия>.webp`.',
  '',
  '| Тайтл (id) | AniList | Постер | Фон | Серий | Кадры серий | Описание | Оценка Shikimori | Оценка AniList |',
  '|---|---|---|---|---:|---|---|---:|---:|',
  ...titles.map(
    ([slug, t]) =>
      `| ${t.titleRomaji} (\`${slug}\`) | [страница](${t.anilistUrl}) | [${t.poster.from}](${t.poster.source}), ${t.poster.srcW}×${t.poster.srcH} | [${t.backdrop.from}](${t.backdrop.source}), ${t.backdrop.srcW}×${t.backdrop.srcH} | ${episodes(t)} | ${stills(t)} | ${t.shikimoriUrl ? `[Shikimori](${t.shikimoriUrl})` : 'редакционное'} | ${t.scoreShikimori ?? '—'} | ${t.score ?? '—'} |`,
  ),
  '',
  'Кадры меньше 320 px по ширине не используются: они выглядят хуже, чем фрагмент фона. Серии без собственного кадра показывают фон тайтла; таких серий ' +
    `${titles.reduce((sum, [, t]) => sum + t.seasons.reduce((s, season) => s + season.episodes.filter((e) => !e.thumb).length, 0), 0)} из ${titles.reduce((sum, [, t]) => sum + episodes(t), 0)}.`,
  '',
  '## Шрифт и иконки',
  '',
  '- Шрифт **Onest** (вариативный, с кириллицей) подключён пакетом `@fontsource-variable/onest` и отдаётся с того же домена. Лицензия SIL Open Font License 1.1.',
  '- Иконки — библиотека **Lucide** (`lucide-react`), лицензия ISC. Логотип и favicon Anikai нарисованы для проекта.',
  '',
  '## Как обновить',
  '',
  '```bash',
  'npm run assets',
  '```',
  '',
  'Скрипт заново запрашивает данные, пересобирает изображения из кеша `scripts/.cache/` и перезаписывает этот файл. Список тайтлов и их идентификаторы AniList — в `scripts/titles.mjs`.',
  '',
)

await writeFile(path.join(ROOT, 'ASSET_SOURCES.md'), lines.join('\n'))
console.log('ASSET_SOURCES.md written')
