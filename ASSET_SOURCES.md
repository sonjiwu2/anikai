# Источники медиа и данных Anikai

Сформировано скриптом `scripts/write-asset-sources.mjs` по данным от 2026-10-03. Все файлы лежат в `public/media/` и отдаются локально: сайт не подгружает картинки и видео со сторонних адресов во время работы.

## Важно о правах

- **Постеры, фоны и кадры серий — это официальные промо-материалы и кадры аниме.** Права на них принадлежат правообладателям (студиям, издателям, производственным комитетам). Они получены через открытые API каталогов для локальной демонстрации интерфейса. Лицензии на распространение у проекта нет: **перед публикацией сайта в открытом доступе изображения нужно заменить своими или получить разрешение.**
- **Описания «Об аниме»** взяты с Shikimori (пользовательский контент сайта), источник указан на странице каждого аниме ссылкой. Короткие аннотации и слоганы написаны для проекта.
- **Факты каталога** (число серий, годы, форматы, статусы, студии, популярность) получены из AniList; названия, даты выхода и кадры серий — из Kitsu, а где Kitsu пуст — из AniList. Данные верны на дату сборки и сами не обновляются.
- **Оценки настоящие.** На карточках показана оценка Shikimori (10-балльная шкала), на странице аниме рядом с ней — оценка AniList. Обе взяты из API этих сервисов на дату сборки; значения по каждому тайтлу — в таблице ниже.
- **Видео — не аниме.** Единственный воспроизводимый файл — трейлер открытого фильма Sintel; в плеере он подписан как демонстрационное видео.

## Сводка по папкам

| Папка | Файлов | Размер | Что это | Откуда |
|---|---:|---:|---|---|
| `posters/` | 70 | 4,2 МБ | Постеры 2:3, WebP, до 600 px и 300 px | Больший из двух: Kitsu `posterImage` или AniList `coverImage` |
| `backdrops/` | 70 | 6,0 МБ | Широкие фоны, WebP, до 1920 px и 960 px | Kitsu `coverImage` или AniList `bannerImage` — выбрано для каждого тайтла |
| `episodes/` | 865 | 14,9 МБ | Кадры серий 16:9, WebP, до 640 px, без увеличения | Kitsu, запасной источник — AniList |
| `avatars/` | 7 | 0,1 МБ | Пресеты аватаров 192×192 | Вырезки из фонов (см. ниже) |
| `video/` | 2 | 11,4 МБ | Демонстрационное видео | Blender Foundation |
| `subs/` | 1 | 0,0 МБ | Демонстрационные субтитры WebVTT | Написаны для проекта |

## Демонстрационное видео

| Файл | Источник | Лицензия |
|---|---|---|
| `video/sintel-trailer-480p.mp4` | https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4 | CC BY 3.0 |
| `video/sintel-trailer-720p.mp4` | https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4 | CC BY 3.0 |

Трейлер фильма Sintel, © Blender Foundation, [durian.blender.org](https://durian.blender.org). Лицензия Creative Commons Attribution 3.0 разрешает использование при указании автора — оно указано рядом с плеером. Два файла — это одно и то же видео в 720p и 480p; поэтому переключатель качества в плеере настоящий. Длительность 52 секунды.

`subs/sintel-demo.ru.vtt` — не перевод реплик, а пояснительные подписи, написанные для проекта, чтобы показать работу дорожки субтитров.

## Аватары

| Файл | Вырезан из фона |
|---|---|
| `avatars/frieren.webp` | `backdrops/frieren.webp` (Sousou no Frieren) |
| `avatars/anya.webp` | `backdrops/spy-family.webp` (SPY×FAMILY) |
| `avatars/okarun.webp` | `backdrops/dandadan.webp` (Dandadan) |
| `avatars/momo.webp` | `backdrops/dandadan.webp` (Dandadan) |
| `avatars/hinata.webp` | `backdrops/haikyu.webp` (Haikyuu!!) |
| `avatars/luffy.webp` | `backdrops/one-piece.webp` (ONE PIECE) |
| `avatars/bocchi.webp` | `backdrops/bocchi-the-rock.webp` (Bocchi the Rock!) |

На аватары распространяются те же права, что и на исходные фоны.

## Постеры, фоны и кадры по тайтлам

Файлы названы по идентификатору тайтла: `posters/<id>.webp`, `posters/<id>-sm.webp`, `backdrops/<id>.webp`, `backdrops/<id>-sm.webp`, `episodes/<id>/s<сезон>e<серия>.webp`.

| Тайтл (id) | AniList | Постер | Фон | Серий | Кадры серий | Описание | Оценка Shikimori | Оценка AniList |
|---|---|---|---|---:|---|---|---:|---:|
| Dandadan (`dandadan`) | [страница](https://anilist.co/anime/171018) | [Kitsu](https://media.kitsu.app/anime/48269/poster_image/4ca623665992a9df00c5bb2a21063aaf.jpg), 2048×2896 | [Kitsu](https://media.kitsu.app/anime/48269/cover_image/da32721ee7cba725cc2ddf6884f22bb1.jpg), 2048×730 | 24 | Kitsu: 24 | [Shikimori](https://shikimori.io/animes/57334-dandadan) | 8.38 | 83 |
| Sousou no Frieren (`frieren`) | [страница](https://anilist.co/anime/154587) | [Kitsu](https://media.kitsu.app/anime/46474/poster_image/99d7df09d8cb9360b1e02825372ce612.jpg), 460×649 | [Kitsu](https://media.kitsu.app/anime/46474/cover_image/883c308356a4db76a9c0af900ada96ed.jpg), 3072×984 | 38 | Kitsu: 38 | [Shikimori](https://shikimori.io/animes/52991-sousou-no-frieren) | 9.25 | 91 |
| Jujutsu Kaisen (`jujutsu-kaisen`) | [страница](https://anilist.co/anime/113415) | [Kitsu](https://media.kitsu.app/anime/42765/poster_image/5f099d83883544fc6200be91706d70e0.jpg), 686×1024 | [Kitsu](https://media.kitsu.app/anime/cover_images/42765/original.jpeg), 1981×544 | 59 | Kitsu: 59 | [Shikimori](https://shikimori.io/animes/40748-jujutsu-kaisen) | 8.49 | 84 |
| Chainsaw Man (`chainsaw-man`) | [страница](https://anilist.co/anime/127230) | [Kitsu](https://media.kitsu.app/anime/43806/poster_image/cefec27a530ff9faac1b2fc238acad13.jpg), 4800×6816 | [Kitsu](https://media.kitsu.app/anime/43806/cover_image/1b642a40124b8cbb1b13b97597c0b6f1.jpg), 1696×536 | 12 | Kitsu: 12 | [Shikimori](https://shikimori.io/animes/44511-chainsaw-man) | 8.42 | 83 |
| Kimetsu no Yaiba (`demon-slayer`) | [страница](https://anilist.co/anime/101922) | [Kitsu](https://media.kitsu.app/anime/poster_images/41370/original.jpg), 1280×1619 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-33MtJGsUSxga.jpg), 1800×550 | 56 | Kitsu: 56 | [Shikimori](https://shikimori.io/animes/z38000-kimetsu-no-yaiba) | 8.4 | 82 |
| SPY×FAMILY (`spy-family`) | [страница](https://anilist.co/anime/140960) | [Kitsu](https://media.kitsu.app/anime/45398/poster_image/cc0bbc0dd2a123fb79b041078fce6f89.jpg), 766×1080 | [Kitsu](https://media.kitsu.app/anime/45398/cover_image/7584152e78b582a70fc68013d91aad67.jpg), 1920×586 | 50 | Kitsu: 50 | [Shikimori](https://shikimori.io/animes/50265-spy-x-family) | 8.41 | 83 |
| Shingeki no Kyojin (`attack-on-titan`) | [страница](https://anilist.co/anime/16498) | [Kitsu](https://media.kitsu.app/anime/poster_images/7442/original.jpg), 920×1270 | [Kitsu](https://media.kitsu.app/anime/cover_images/7442/original.png), 1920×1080 | 59 | Kitsu: 36 | [Shikimori](https://shikimori.io/animes/16498-shingeki-no-kyojin) | 8.58 | 85 |
| DEATH NOTE (`death-note`) | [страница](https://anilist.co/anime/1535) | [Kitsu](https://media.kitsu.app/anime/poster_images/1376/original.png), 569×825 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/1535.jpg), 1721×391 | 37 | AniList → Crunchyroll: 37 | [Shikimori](https://shikimori.io/animes/1535-death-note) | 8.62 | 84 |
| ONE PIECE (`one-piece`) | [страница](https://anilist.co/anime/21) | [Kitsu](https://media.kitsu.app/anime/poster_images/12/original.png), 508×785 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg), 1900×400 | 61 | Kitsu: 8 | [Shikimori](https://shikimori.io/animes/21-one-piece) | 8.72 | 87 |
| Haikyuu!! (`haikyu`) | [страница](https://anilist.co/anime/20464) | [Kitsu](https://media.kitsu.app/anime/poster_images/8133/original.jpg), 868×1242 | [Kitsu](https://media.kitsu.app/anime/cover_images/8133/original.jpg), 1280×720 | 85 | Kitsu: 50 | [Shikimori](https://shikimori.io/animes/z20583-haikyuu) | 8.43 | 83 |
| Kusuriya no Hitorigoto (`apothecary-diaries`) | [страница](https://anilist.co/anime/161645) | [Kitsu](https://media.kitsu.app/anime/47083/poster_image/1e25d26e74707ada861514620f630da8.jpg), 1600×2273 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/161645-oqzTZYIvviWI.jpg), 1900×400 | 48 | Kitsu: 48 | [Shikimori](https://shikimori.io/animes/54492-kusuriya-no-hitorigoto) | 8.84 | 88 |
| Ore dake Level Up na Ken (`solo-leveling`) | [страница](https://anilist.co/anime/151807) | [Kitsu](https://media.kitsu.app/anime/46231/poster_image/63b0009b44fcba44e86701d7c30c93d5.png), 460×651 | [Kitsu](https://media.kitsu.app/anime/46231/cover_image/3889183203c74864e499990fce30cadf.jpg), 2048×502 | 25 | Kitsu: 25 | [Shikimori](https://shikimori.io/animes/52299-ore-dake-level-up-na-ken) | 8.14 | 80 |
| Hagane no Renkinjutsushi: FULLMETAL ALCHEMIST (`fullmetal-alchemist-brotherhood`) | [страница](https://anilist.co/anime/5114) | [Kitsu](https://media.kitsu.app/anime/poster_images/3936/original.png), 569×798 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/5114-q0V5URebphSG.jpg), 1900×1188 | 64 | Kitsu: 10, AniList → Crunchyroll: 54 | [Shikimori](https://shikimori.io/animes/z5114-fullmetal-alchemist-brotherhood) | 9.11 | 90 |
| Steins;Gate (`steins-gate`) | [страница](https://anilist.co/anime/9253) | [Kitsu](https://media.kitsu.app/anime/poster_images/5646/original.jpg), 720×1052 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/n9253-JIhmKgBKsWUN.jpg), 1900×400 | 24 | AniList → Crunchyroll: 22, Kitsu: 2 | [Shikimori](https://shikimori.io/animes/z9253-steins-gate) | 9.07 | 89 |
| VINLAND SAGA (`vinland-saga`) | [страница](https://anilist.co/anime/101348) | [Kitsu](https://media.kitsu.app/anime/poster_images/41084/original.jpg), 849×1200 | [Kitsu](https://media.kitsu.app/anime/41084/cover_image/014f53ca7ccec3ad25ccd37f02143ddb.jpg), 1798×579 | 48 | Kitsu: 48 | [Shikimori](https://shikimori.io/animes/37521-vinland-saga) | 8.78 | 87 |
| Mob Psycho 100 (`mob-psycho-100`) | [страница](https://anilist.co/anime/21507) | [Kitsu](https://media.kitsu.app/anime/11578/poster_image/eb491c185d46b275e17fb82204d9a53b.jpg), 1460×2048 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/21507-Qx8bGsLXUgLo.jpg), 1900×400 | 37 | Kitsu: 35, AniList → Crunchyroll: 2 | [Shikimori](https://shikimori.io/animes/z32182-mob-psycho-100) | 8.49 | 84 |
| Bocchi the Rock! (`bocchi-the-rock`) | [страница](https://anilist.co/anime/130003) | [Kitsu](https://media.kitsu.app/anime/44196/poster_image/8a882ca91a826640364578a7c0289fa7.jpg), 2159×2981 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/130003-5F90a7BtsPQN.jpg), 1900×400 | 12 | Kitsu: 12 | [Shikimori](https://shikimori.io/animes/47917-bocchi-the-rock) | 8.72 | 87 |
| Kaguya-sama wa Kokurasetai: Tensaitachi no Renai Zunousen (`kaguya-sama`) | [страница](https://anilist.co/anime/101921) | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101921-ufrjLzhSz7L1.jpg), 460×655 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/101921-GgvvFhlNhzlF.jpg), 1900×534 | 37 | Kitsu: 25 | [Shikimori](https://shikimori.io/animes/37999-kaguya-sama-wa-kokurasetai-tensai-tachi-no-renai-zunousen) | 8.4 | 83 |
| Cyberpunk: Edgerunners (`cyberpunk-edgerunners`) | [страница](https://anilist.co/anime/120377) | [Kitsu](https://media.kitsu.app/anime/43248/poster_image/15bde2e7e34cfe1df761535a69faffb8.png), 2926×4096 | [Kitsu](https://media.kitsu.app/anime/43248/cover_image/e58e4ae375916ea43e3bfd43371fd5b2.jpg), 1920×492 | 10 | Kitsu: 10 | [Shikimori](https://shikimori.io/animes/42310-cyberpunk-edgerunners) | 8.62 | 85 |
| [Oshi no Ko] (`oshi-no-ko`) | [страница](https://anilist.co/anime/150672) | [Kitsu](https://media.kitsu.app/anime/46170/poster_image/69740efb4ce6d03bf1e8cee121ff77f8.jpg), 2000×2640 | [Kitsu](https://media.kitsu.app/anime/46170/cover_image/b6f21b20a7413da4930af6dff99877ad.jpg), 2152×743 | 24 | Kitsu: 24 | [Shikimori](https://shikimori.io/animes/52034-oshi-no-ko) | 8.53 | 84 |
| Blue Lock (`blue-lock`) | [страница](https://anilist.co/anime/137822) | [Kitsu](https://media.kitsu.app/anime/44973/poster_image/84ee75dbae67c4817c2bb4b9943fe90c.png), 460×644 | [Kitsu](https://media.kitsu.app/anime/44973/cover_image/46d59e2fa0087c76ad47d3bea7207391.jpg), 2000×601 | 38 | AniList → Crunchyroll: 14 | [Shikimori](https://shikimori.io/animes/49596-blue-lock) | 8.11 | 79 |
| Kaijuu 8-gou (`kaiju-no-8`) | [страница](https://anilist.co/anime/153288) | [Kitsu](https://media.kitsu.app/anime/46300/poster_image/c8a7d985608494c388e9aa1a5fa66428.jpg), 2200×3111 | [Kitsu](https://media.kitsu.app/anime/46300/cover_image/59ece1982637fc545e04555b313f9db4.jpg), 2249×842 | 23 | Kitsu: 23 | [Shikimori](https://shikimori.io/animes/52588-kaijuu-8-gou) | 8.19 | 81 |
| Made in Abyss (`made-in-abyss`) | [страница](https://anilist.co/anime/97986) | [Kitsu](https://media.kitsu.app/anime/poster_images/13273/original.jpg), 1200×1600 | [Kitsu](https://media.kitsu.app/anime/cover_images/13273/original.jpg), 1497×588 | 25 | AniList → Crunchyroll: 13 | [Shikimori](https://shikimori.io/animes/z34599-made-in-abyss) | 8.62 | 84 |
| Re:Zero kara Hajimeru Isekai Seikatsu (`re-zero`) | [страница](https://anilist.co/anime/21355) | [Kitsu](https://media.kitsu.app/anime/poster_images/11209/original.jpg), 5829×8275 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/21355-f9SjOfEJMk5P.jpg), 1900×400 | 50 | Kitsu: 1 | [Shikimori](https://shikimori.io/animes/z31240-re-zero-kara-hajimeru-isekai-seikatsu) | 8.25 | 81 |
| Tokyo Ghoul (`tokyo-ghoul`) | [страница](https://anilist.co/anime/20605) | [Kitsu](https://media.kitsu.app/anime/poster_images/8271/original.jpg), 490×710 | [Kitsu](https://media.kitsu.app/anime/cover_images/8271/original.jpg), 2560×1440 | 24 | AniList → Crunchyroll: 12 | [Shikimori](https://shikimori.io/animes/22319-tokyo-ghoul) | 7.79 | 76 |
| Code Geass: Hangyaku no Lelouch (`code-geass`) | [страница](https://anilist.co/anime/1575) | [Kitsu](https://media.kitsu.app/anime/poster_images/1415/original.png), 500×735 | [Kitsu](https://media.kitsu.app/anime/cover_images/1415/original.jpg), 2560×1690 | 50 | Kitsu: 50 | [Shikimori](https://shikimori.io/animes/1575-code-geass-hangyaku-no-lelouch) | 8.71 | 85 |
| Violet Evergarden (`violet-evergarden`) | [страница](https://anilist.co/anime/21827) | [Kitsu](https://media.kitsu.app/anime/poster_images/12230/original.jpg), 768×1074 | [Kitsu](https://media.kitsu.app/anime/cover_images/12230/original.jpg), 1680×931 | 13 | Kitsu: 13 | [Shikimori](https://shikimori.io/animes/33352-violet-evergarden) | 8.69 | 85 |
| Cowboy Bebop (`cowboy-bebop`) | [страница](https://anilist.co/anime/1) | [Kitsu](https://media.kitsu.app/anime/poster_images/1/original.jpg), 484×706 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/1-OquNCNB6srGe.jpg), 1900×400 | 26 | AniList → Crunchyroll: 25, Kitsu: 1 | [Shikimori](https://shikimori.io/animes/1-cowboy-bebop) | 8.75 | 86 |
| Shin Seiki Evangelion (`evangelion`) | [страница](https://anilist.co/anime/30) | [Kitsu](https://media.kitsu.app/anime/21/poster_image/077bf97dfb04853975a6e85694b861f4.jpg), 1446×2048 | [Kitsu](https://media.kitsu.app/anime/cover_images/21/original.jpg), 1920×1080 | 26 | Kitsu: 26 | [Shikimori](https://shikimori.io/animes/30-shinseiki-evangelion) | 8.37 | 83 |
| Kimi no Na wa. (`your-name`) | [страница](https://anilist.co/anime/21519) | [Kitsu](https://media.kitsu.app/anime/poster_images/11614/original.jpg), 1061×1500 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/21519-1ayMXgNlmByb.jpg), 1900×400 | 1 | — | [Shikimori](https://shikimori.io/animes/32281-kimi-no-na-wa) | 8.82 | 85 |
| Koe no Katachi (`a-silent-voice`) | [страница](https://anilist.co/anime/20954) | [Kitsu](https://media.kitsu.app/anime/poster_images/10028/original.jpeg), 640×905 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/20954-f30bHMXa5Qoe.jpg), 1900×400 | 1 | — | [Shikimori](https://shikimori.io/animes/y28851-koe-no-katachi) | 8.93 | 88 |
| Suzume no Tojimari (`suzume`) | [страница](https://anilist.co/anime/142770) | [Kitsu](https://media.kitsu.app/anime/45597/poster_image/ed7971ce8880f94e54753b99f4ef6a7f.jpg), 2385×3310 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/142770-YgESt2HJXlNg.jpg), 1900×399 | 1 | — | [Shikimori](https://shikimori.io/animes/50594-suzume-no-tojimari) | 8.24 | 81 |
| Sen to Chihiro no Kamikakushi (`spirited-away`) | [страница](https://anilist.co/anime/199) | [Kitsu](https://media.kitsu.app/anime/poster_images/176/original.jpg), 490×710 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/199-Sm2RU5PSqw7T.jpg), 1920×576 | 1 | — | [Shikimori](https://shikimori.io/animes/z199-sen-to-chihiro-no-kamikakushi) | 8.77 | 86 |
| Mononoke-hime (`princess-mononoke`) | [страница](https://anilist.co/anime/164) | [Kitsu](https://media.kitsu.app/anime/142/poster_image/f01d21998603a36c019211154074263a.jpg), 460×652 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/164-Aj6MINy7VTfs.jpg), 1900×1025 | 1 | — | [Shikimori](https://shikimori.io/animes/164-mononoke-hime) | 8.67 | 85 |
| Howl no Ugoku Shiro (`howls-moving-castle`) | [страница](https://anilist.co/anime/431) | [Kitsu](https://media.kitsu.app/anime/395/poster_image/39b44a8408c76fd0c6ae0969646b3906.jpg), 460×667 | [AniList](https://s4.anilist.co/file/anilistcdn/media/anime/banner/431-fLBlvTgdqLCz.jpg), 1920×576 | 1 | — | [Shikimori](https://shikimori.io/animes/431-howl-no-ugoku-shiro) | 8.67 | 85 |

Кадры меньше 320 px по ширине не используются: они выглядят хуже, чем фрагмент фона. Серии без собственного кадра показывают фон тайтла; таких серий 226 из 1091.

## Шрифт и иконки

- Шрифт **Onest** (вариативный, с кириллицей) подключён пакетом `@fontsource-variable/onest` и отдаётся с того же домена. Лицензия SIL Open Font License 1.1.
- Иконки — библиотека **Lucide** (`lucide-react`), лицензия ISC. Логотип и favicon Anikai нарисованы для проекта.

## Как обновить

```bash
npm run assets
```

Скрипт заново запрашивает данные, пересобирает изображения из кеша `scripts/.cache/` и перезаписывает этот файл. Список тайтлов и их идентификаторы AniList — в `scripts/titles.mjs`.
