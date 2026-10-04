import { readFile, writeFile } from 'node:fs/promises'
const { titles } = JSON.parse(await readFile(new URL('../src/data/generated/anilist.json', import.meta.url), 'utf8'))
const { sources, missing, fetchedAt } = JSON.parse(await readFile(new URL('../src/data/generated/video-sources.json', import.meta.url), 'utf8'))
const rows = ['# Источники серий Anikai', '', `Проверено: ${fetchedAt}.`, '',
  'В версии с Node-сервером видео воспроизводятся в собственном плеере Anikai. На GitHub Pages файлы отдельных серий и AniLiberty используют собственный плеер, Rutube и Одноклассники — встроенные плееры платформ. Основной источник — [Анимач](https://rutube.ru/u/animach/), дополнительные — публичные каналы Rutube, Одноклассники и API [AniLiberty](https://anilibria.top/api/docs/v1).', '',
  'Сохранены идентификаторы видео и эпизодов. Временные подписанные адреса HLS выдаются сервером при просмотре. Закрытые, платные, удалённые и защищённые DRM видео не подключаются.', '',
  `Подключено **${Object.keys(sources).length}** эпизодов и фильмов; не найдено **${missing.length}**. Отсутствующие серии показывают «Видео не добавлено».`, '',
  '| Аниме | Подключено | В каталоге | Отсутствуют |', '|---|---:|---:|---|']
for (const [slug, title] of Object.entries(titles)) {
  const keys = Object.keys(sources).filter(key => key.startsWith(`${slug}/`))
  const absent = missing.filter(key => key.startsWith(`${slug}/`)).map(key => key.split('/')[1])
  const total = title.seasons.reduce((n, s) => n + s.episodes.length, 0)
  rows.push(`| ${title.titleRuShikimori ?? title.titleRomaji} | ${keys.length} | ${total} | ${absent.join(', ') || '—'} |`)
}
rows.push('', '## Все ссылки по сериям', '', '| Аниме / серия | Видео | Источник |', '|---|---|---|')
for (const [key, source] of Object.entries(sources)) rows.push(`| ${key} | [${source.title.replaceAll('|', '\\|')}](${source.url}) | ${source.channel.replaceAll('|', '\\|')} |`)
await writeFile(new URL('../VIDEO_SOURCES.md', import.meta.url), rows.join('\n') + '\n')
