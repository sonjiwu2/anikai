import type { Anime, AnimeFormat, CatalogVideoSource, Episode, Season } from '../types'
import generatedJson from './generated/anilist.json'
import videoJson from './generated/video-sources.json'
import { publicAsset, episodeFile, videoApiBase, staticHosting } from '../lib/hosting'

/**
 * Catalog = editorial Russian text (below) + data fetched by `npm run assets`:
 * episode lists, titles, stills and air dates, years, formats, statuses, scores, studios, artwork,
 * Russian descriptions. To add a title: add its ids to scripts/titles.mjs, run `npm run assets`,
 * then add an entry to EDITORIAL.
 */

// ---------- Verified public video sources ----------

export const DEMO_VIDEO_CREDIT = 'трейлер фильма Sintel, © Blender Foundation, лицензия CC BY 3.0'

const videoSources = videoJson.sources as Record<string, CatalogVideoSource>
export const VIDEO_SOURCES_DATE = videoJson.fetchedAt

// ---------- Generated data shape ----------

interface GeneratedEpisode {
  n: number
  title: string | null
  airdate: string | null
  thumb: boolean
}
interface GeneratedSeason {
  anilistId: number
  format: string
  duration: number | null
  status: string
  year: number | null
  episodes: GeneratedEpisode[]
}
interface GeneratedTitle {
  anilistUrl: string
  titleRomaji: string
  titleEnglish: string | null
  titleNative: string | null
  titleRuShikimori: string | null
  descriptionRu: string | null
  shikimoriUrl: string | null
  score: number | null
  scoreShikimori: number | null
  popularity: number
  studios: string[]
  trailerYoutubeId: string | null
  poster: { w: number }
  backdrop: { w: number; h: number; from: string }
  seasons: GeneratedSeason[]
}
interface GeneratedCatalog {
  fetchedAt: string
  titles: Record<string, GeneratedTitle>
}

const generated = generatedJson as unknown as GeneratedCatalog

// ---------- Editorial data ----------

interface Editorial {
  slug: string
  titleRu: string
  aliases: string[]
  tagline: string
  synopsis: string
  genres: string[]
  focalX: number
  focalY?: number
  seasonTitles?: string[]
  catalogNote?: string
}

const MOVIE = ['Фильм']

const EDITORIAL: Editorial[] = [
  {
    slug: 'dandadan',
    titleRu: 'Дандадан',
    aliases: ['Dan Da Dan', 'дан да дан'],
    tagline: 'Она верит в призраков. Он — в пришельцев.',
    synopsis:
      'Школьница Момо уверена, что призраки существуют, а её одноклассник Окарун — что существуют инопланетяне. Спор заканчивается тем, что оба оказываются правы.',
    genres: ['Сверхъестественное', 'Комедия', 'Экшен', 'Романтика'],
    focalX: 47,
  },
  {
    slug: 'frieren',
    titleRu: 'Провожающая в последний путь Фрирен',
    aliases: ['Фрирен', 'Frieren', 'Sousou no Frieren'],
    tagline: 'Путешествие начинается после того, как герои победили.',
    synopsis:
      'После победы над королём демонов эльфийская волшебница Фрирен переживает своих спутников и отправляется в новое путешествие, чтобы лучше понять людей.',
    genres: ['Фэнтези', 'Драма', 'Приключения'],
    focalX: 55,
  },
  {
    slug: 'jujutsu-kaisen',
    titleRu: 'Магическая битва',
    aliases: ['Jujutsu Kaisen', 'JJK', 'Дзюдзюцу Кайсэн'],
    tagline: 'Чтобы спасти друзей, он проглотил палец проклятия.',
    synopsis:
      'Старшеклассник Юдзи Итадори становится сосудом для сильнейшего проклятия и поступает в школу магов, где учат сражаться с тем, что рождается из человеческих страхов.',
    genres: ['Экшен', 'Сверхъестественное', 'Драма'],
    focalX: 47,
    seasonTitles: ['Сезон 1', 'Сезон 2', 'Сезон 3. Часть 1'],
  },
  {
    slug: 'chainsaw-man',
    titleRu: 'Человек-бензопила',
    aliases: ['Chainsaw Man', 'Чейнсо мэн'],
    tagline: 'Простая мечта и демон с бензопилой вместо сердца.',
    synopsis:
      'Дэндзи расплачивается с долгами отца, охотясь на демонов вместе с псом-бензопилой Почитой. После предательства они сливаются воедино, и Дэндзи попадает в отряд охотников.',
    genres: ['Экшен', 'Ужасы', 'Сверхъестественное'],
    focalX: 45,
  },
  {
    slug: 'demon-slayer',
    titleRu: 'Клинок, рассекающий демонов',
    aliases: ['Demon Slayer', 'Kimetsu no Yaiba', 'Истребитель демонов'],
    tagline: 'Брат ищет способ вернуть сестре человеческий облик.',
    synopsis:
      'Демон убивает семью Тандзиро, а его сестра Нэдзуко сама превращается в демона. Тандзиро вступает в ряды истребителей, чтобы найти виновного и вылечить сестру.',
    genres: ['Экшен', 'Фэнтези', 'Приключения'],
    focalX: 62,
    seasonTitles: ['Сезон 1', 'Квартал красных фонарей', 'Деревня кузнецов', 'Тренировка столпов'],
  },
  {
    slug: 'spy-family',
    titleRu: 'Семья шпиона',
    aliases: ['Spy x Family', 'Spy Family', 'SPY×FAMILY'],
    tagline: 'Шпион, наёмная убийца и девочка-телепат изображают семью.',
    synopsis:
      'Агенту по прозвищу Сумрак для задания нужна семья. Он не знает, что жена — наёмная убийца, а приёмная дочь Аня читает мысли и единственная понимает, кто есть кто.',
    genres: ['Комедия', 'Экшен', 'Повседневность'],
    focalX: 50,
    seasonTitles: ['Сезон 1. Часть 1', 'Сезон 1. Часть 2', 'Сезон 2', 'Сезон 3'],
  },
  {
    slug: 'attack-on-titan',
    titleRu: 'Атака титанов',
    aliases: ['Attack on Titan', 'Shingeki no Kyojin', 'Вторжение гигантов'],
    tagline: 'Человечество прячется за стенами. Стены не вечны.',
    synopsis:
      'Остатки человечества живут за тремя стенами, спасаясь от титанов. Когда внешняя стена падает, Эрен Йегер клянётся уничтожить их всех и вступает в разведкорпус.',
    genres: ['Экшен', 'Драма', 'Фэнтези', 'Детектив'],
    focalX: 50,
    seasonTitles: ['Сезон 1', 'Сезон 2', 'Сезон 3. Часть 1', 'Сезон 3. Часть 2'],
    catalogNote: 'В каталоге первые три сезона.',
  },
  {
    slug: 'death-note',
    titleRu: 'Тетрадь смерти',
    aliases: ['Death Note', 'Дэс Ноут'],
    tagline: 'Человек, чьё имя записано в тетради, умрёт.',
    synopsis:
      'Отличник Лайт Ягами находит тетрадь, способную убивать, и решает очистить мир от преступников. По его следу идёт детектив, известный только под буквой L.',
    genres: ['Детектив', 'Триллер', 'Сверхъестественное', 'Психология'],
    focalX: 52,
  },
  {
    slug: 'one-piece',
    titleRu: 'Ван-Пис',
    aliases: ['One Piece', 'Большой куш', 'Ван Пис'],
    tagline: 'Резиновый мальчишка собирается стать королём пиратов.',
    synopsis:
      'Монки Д. Луффи, съевший дьявольский плод, выходит в море, чтобы собрать команду и найти легендарное сокровище Ван-Пис.',
    genres: ['Приключения', 'Экшен', 'Комедия', 'Фэнтези'],
    focalX: 35,
    seasonTitles: ['Сага Ист-Блю'],
    catalogNote: 'Сериал продолжает выходить. В каталоге сага Ист-Блю: серии 1–61.',
  },
  {
    slug: 'haikyu',
    titleRu: 'Волейбол!!',
    aliases: ['Haikyu', 'Haikyuu', 'Хайкю'],
    tagline: 'Невысокий нападающий и гениальный связующий в одной команде.',
    synopsis:
      'Сёё Хината мечтает играть в волейбол, несмотря на рост. В старшей школе Карасуно его напарником становится бывший соперник Кагэяма, и вместе они поднимают команду с нуля.',
    genres: ['Спорт', 'Комедия', 'Драма'],
    focalX: 45,
    seasonTitles: ['Сезон 1', 'Сезон 2', 'Сезон 3', 'To the Top. Часть 1', 'To the Top. Часть 2'],
  },
  {
    slug: 'apothecary-diaries',
    titleRu: 'Монолог фармацевта',
    aliases: ['The Apothecary Diaries', 'Kusuriya no Hitorigoto', 'Записки аптекаря'],
    tagline: 'Служанка, которая разбирается в ядах лучше придворных лекарей.',
    synopsis:
      'Маомао, дочь аптекаря, попадает служанкой в императорский дворец. Её знания о лекарствах и ядах быстро замечают, и дворцовые тайны одна за другой оказываются у неё на столе.',
    genres: ['Детектив', 'Драма', 'Исторический'],
    focalX: 42,
  },
  {
    slug: 'solo-leveling',
    titleRu: 'Поднятие уровня в одиночку',
    aliases: ['Solo Leveling', 'Ore dake Level Up na Ken', 'Соло левелинг'],
    tagline: 'Слабейший охотник получает систему, которая видна только ему.',
    synopsis:
      'Сон Джин-у — самый слабый охотник в мире, где открылись врата с монстрами. Выжив в двойном подземелье, он получает способность повышать уровень без ограничений.',
    genres: ['Экшен', 'Фэнтези', 'Приключения'],
    focalX: 45,
  },
  {
    slug: 'fullmetal-alchemist-brotherhood',
    titleRu: 'Стальной алхимик: Братство',
    aliases: ['Fullmetal Alchemist Brotherhood', 'FMAB', 'Цельнометаллический алхимик'],
    tagline: 'Чтобы что-то получить, нужно отдать равноценное.',
    synopsis:
      'Братья Элрики пытались вернуть мать с помощью алхимии и заплатили за это телами. Теперь они ищут философский камень, чтобы всё исправить.',
    genres: ['Экшен', 'Приключения', 'Фэнтези', 'Драма'],
    focalX: 50,
    focalY: 28,
  },
  {
    slug: 'steins-gate',
    titleRu: 'Врата Штейна',
    aliases: ['Steins;Gate', 'Steins Gate', 'Врата Штейнера'],
    tagline: 'Сообщение в прошлое можно отправить с микроволновки.',
    synopsis:
      'Самопровозглашённый безумный учёный Ринтаро Окабэ случайно создаёт устройство, отправляющее сообщения в прошлое. Каждое изменение обходится дороже предыдущего.',
    genres: ['Фантастика', 'Триллер', 'Драма', 'Психология'],
    focalX: 60,
  },
  {
    slug: 'vinland-saga',
    titleRu: 'Сага о Винланде',
    aliases: ['Vinland Saga', 'Винланд'],
    tagline: 'Сын воина растёт среди тех, кто убил его отца.',
    synopsis:
      'Юный Торфинн годами служит в отряде викинга Аскеладда, чтобы однажды убить его в честном поединке. Месть оказывается не тем, что он себе представлял.',
    genres: ['Экшен', 'Приключения', 'Драма', 'Исторический'],
    focalX: 65,
  },
  {
    slug: 'mob-psycho-100',
    titleRu: 'Моб Психо 100',
    aliases: ['Mob Psycho 100', 'Моб психо'],
    tagline: 'Самый сильный экстрасенс хочет быть обычным школьником.',
    synopsis:
      'Сигэо Кагэяма по прозвищу Моб обладает огромной психической силой и держит эмоции под замком. Он подрабатывает у мошенника-экзорциста Рэйгэна и учится жить без сверхспособностей.',
    genres: ['Экшен', 'Комедия', 'Сверхъестественное'],
    focalX: 50,
  },
  {
    slug: 'bocchi-the-rock',
    titleRu: 'Одинокий рокер!',
    aliases: ['Bocchi the Rock', 'Боччи', 'Бочи'],
    tagline: 'Гитаристка, которая боится людей, попадает в группу.',
    synopsis:
      'Хитори Гото научилась отлично играть на гитаре, но так и не научилась разговаривать с людьми. Случайная встреча приводит её в группу, которой срочно нужен гитарист.',
    genres: ['Комедия', 'Музыка', 'Повседневность'],
    focalX: 50,
  },
  {
    slug: 'kaguya-sama',
    titleRu: 'Госпожа Кагуя: в любви как на войне',
    aliases: ['Kaguya-sama', 'Love is War', 'Кагуя'],
    tagline: 'Кто признается первым, тот проиграл.',
    synopsis:
      'Президент и вице-президент школьного совета влюблены друг в друга, но оба слишком горды, чтобы признаться. Каждый пытается хитростью вынудить другого сделать это первым.',
    genres: ['Комедия', 'Романтика', 'Психология'],
    focalX: 50,
  },
  {
    slug: 'cyberpunk-edgerunners',
    titleRu: 'Киберпанк: Бегущие по краю',
    aliases: ['Cyberpunk Edgerunners', 'Киберпанк'],
    tagline: 'В Найт-Сити легендой становятся только посмертно.',
    synopsis:
      'Подросток Дэвид Мартинес теряет всё и вживляет себе военный имплант. Он примыкает к банде наёмников и быстро поднимается — выше, чем выдержит тело.',
    genres: ['Экшен', 'Фантастика', 'Драма'],
    focalX: 45,
  },
  {
    slug: 'oshi-no-ko',
    titleRu: 'Звёздное дитя',
    aliases: ['Oshi no Ko', 'Ребёнок идола', 'Оши но ко'],
    tagline: 'В шоу-бизнесе ложь — это оружие.',
    synopsis:
      'Врач из провинции перерождается сыном своей любимой айдола Ай Хосино. Когда её жизнь обрывается, он решает найти виновного внутри индустрии развлечений.',
    genres: ['Драма', 'Детектив', 'Психология', 'Сверхъестественное'],
    focalX: 55,
  },
  {
    slug: 'blue-lock',
    titleRu: 'Синяя тюрьма: Блю Лок',
    aliases: ['Blue Lock', 'Блю Лок', 'Блю лок'],
    tagline: 'Триста нападающих. Останется один.',
    synopsis:
      'После провала сборной Японии запускают проект «Блю Лок»: триста юных форвардов запирают в тренировочном комплексе, чтобы вырастить лучшего в мире нападающего.',
    genres: ['Спорт', 'Драма', 'Психология'],
    focalX: 45,
  },
  {
    slug: 'kaiju-no-8',
    titleRu: 'Кайдзю № 8',
    aliases: ['Kaiju No. 8', 'Kaijuu 8-gou', 'Кайдзю номер 8'],
    tagline: 'Он убирал останки чудовищ. Теперь сам чудовище.',
    synopsis:
      'Кафка Хибино работает уборщиком останков кайдзю и давно отказался от мечты попасть в силы обороны. Всё меняется, когда он сам получает способность превращаться в кайдзю.',
    genres: ['Экшен', 'Фантастика'],
    focalX: 55,
  },
  {
    slug: 'made-in-abyss',
    titleRu: 'Созданный в Бездне',
    aliases: ['Made in Abyss', 'Сделано в Бездне'],
    tagline: 'Чем глубже спуск, тем дороже путь назад.',
    synopsis:
      'Сирота Рико живёт на краю гигантской Бездны и мечтает стать исследователем, как мать. Вместе с мальчиком-роботом Рэгом она отправляется вниз, откуда не возвращаются.',
    genres: ['Приключения', 'Фэнтези', 'Драма'],
    focalX: 55,
  },
  {
    slug: 're-zero',
    titleRu: 'Re:Zero. Жизнь с нуля в альтернативном мире',
    aliases: ['Re:Zero', 'Re Zero', 'Ре Зеро', 'Жизнь с нуля'],
    tagline: 'Каждая смерть возвращает его к началу.',
    synopsis:
      'Субару Нацуки попадает из магазина прямиком в фэнтезийный мир и обнаруживает единственную способность: после смерти он возвращается в прошлое и помнит всё, что случилось.',
    genres: ['Фэнтези', 'Драма', 'Психология', 'Триллер'],
    focalX: 32,
    seasonTitles: ['Сезон 1', 'Сезон 2. Часть 1', 'Сезон 2. Часть 2'],
  },
  {
    slug: 'tokyo-ghoul',
    titleRu: 'Токийский гуль',
    aliases: ['Tokyo Ghoul', 'Токийский гул'],
    tagline: 'Наполовину человек, наполовину тот, кто людьми питается.',
    synopsis:
      'Студент Кэн Канэки выживает после нападения гуля, но получает его органы. Теперь ему нужна человеческая плоть, а принадлежит он сразу двум мирам.',
    genres: ['Экшен', 'Ужасы', 'Драма', 'Сверхъестественное'],
    focalX: 62,
    seasonTitles: ['Сезон 1', 'Сезон 2 (√A)'],
  },
  {
    slug: 'code-geass',
    titleRu: 'Код Гиас: Восставший Лелуш',
    aliases: ['Code Geass', 'Код Гиасс', 'Лелуш'],
    tagline: 'Сила приказать любому. Но только один раз.',
    synopsis:
      'Изгнанный принц Лелуш получает Гиас — силу абсолютного приказа — и под маской Зеро поднимает восстание против Британской империи.',
    genres: ['Экшен', 'Драма', 'Фантастика', 'Меха'],
    focalX: 32,
    seasonTitles: ['Сезон 1', 'Сезон 2 (R2)'],
  },
  {
    slug: 'violet-evergarden',
    titleRu: 'Вайолет Эвергарден',
    aliases: ['Violet Evergarden', 'Виолет Эвергарден'],
    tagline: 'Бывшая солдат учится писать письма о чувствах.',
    synopsis:
      'После войны Вайолет, которую растили как оружие, начинает писать письма за других людей и пытается понять смысл последних слов своего командира.',
    genres: ['Драма', 'Фэнтези', 'Повседневность'],
    focalX: 52,
  },
  {
    slug: 'cowboy-bebop',
    titleRu: 'Ковбой Бибоп',
    aliases: ['Cowboy Bebop', 'Ковбой Бибоп'],
    tagline: 'Охотники за головами, джаз и прошлое, от которого не улететь.',
    synopsis:
      '2071 год. Команда корабля «Бибоп» ловит преступников по всей Солнечной системе, и у каждого на борту есть прошлое, которое однажды его догонит.',
    genres: ['Экшен', 'Приключения', 'Фантастика', 'Драма'],
    focalX: 45,
  },
  {
    slug: 'evangelion',
    titleRu: 'Евангелион',
    aliases: ['Neon Genesis Evangelion', 'Евангелион нового поколения', 'NGE', 'Ева'],
    tagline: 'Подростков сажают в гигантских роботов, чтобы остановить Ангелов.',
    synopsis:
      'Четырнадцатилетнего Синдзи Икари вызывает отец, которого он не видел годами, чтобы тот пилотировал Евангелион — единственное оружие против существ, называемых Ангелами.',
    genres: ['Фантастика', 'Меха', 'Драма', 'Психология'],
    focalX: 50,
  },
  {
    slug: 'your-name',
    titleRu: 'Твоё имя',
    aliases: ['Your Name', 'Kimi no Na wa', 'Кими но на ва'],
    tagline: 'Двое просыпаются в телах друг друга.',
    synopsis:
      'Школьница из горной деревни и школьник из Токио время от времени меняются телами. Они оставляют друг другу записки и пытаются встретиться.',
    genres: ['Романтика', 'Драма', 'Сверхъестественное'],
    focalX: 55,
    seasonTitles: MOVIE,
  },
  {
    slug: 'a-silent-voice',
    titleRu: 'Форма голоса',
    aliases: ['A Silent Voice', 'Koe no Katachi'],
    tagline: 'Он травил глухую одноклассницу. Теперь хочет извиниться.',
    synopsis:
      'В младшей школе Сёя издевался над глухой девочкой Сёко и сам стал изгоем. Спустя годы он находит её, чтобы попросить прощения.',
    genres: ['Драма', 'Романтика', 'Повседневность'],
    focalX: 45,
    seasonTitles: MOVIE,
  },
  {
    slug: 'suzume',
    titleRu: 'Судзумэ, закрывающая двери',
    aliases: ['Suzume', 'Suzume no Tojimari', 'Судзуме'],
    tagline: 'За каждой дверью — бедствие, которое нужно запереть.',
    synopsis:
      'Школьница Судзумэ встречает юношу, который ищет двери в заброшенных местах. Открыв одну из них, она отправляется через всю Японию закрывать остальные.',
    genres: ['Приключения', 'Фэнтези', 'Драма'],
    focalX: 50,
    seasonTitles: MOVIE,
  },
  {
    slug: 'spirited-away',
    titleRu: 'Унесённые призраками',
    aliases: ['Spirited Away', 'Sen to Chihiro no Kamikakushi', 'Сэн и Тихиро'],
    tagline: 'Чтобы вернуть родителей, нужно устроиться в купальни для духов.',
    synopsis:
      'По дороге в новый дом Тихиро с родителями попадает в мир духов. Родители превращаются в свиней, а ей приходится работать в купальнях ведьмы Юбабы.',
    genres: ['Приключения', 'Фэнтези', 'Сверхъестественное'],
    focalX: 55,
    seasonTitles: MOVIE,
  },
  {
    slug: 'princess-mononoke',
    titleRu: 'Принцесса Мононоке',
    aliases: ['Princess Mononoke', 'Mononoke Hime', 'Мононоке'],
    tagline: 'Война людей и леса, в которой нет правых.',
    synopsis:
      'Принц Аситака, проклятый демоном, идёт на запад искать исцеление и оказывается между железным городом госпожи Эбоси и духами леса, которых ведёт девушка-волчица Сан.',
    genres: ['Приключения', 'Фэнтези', 'Драма'],
    focalX: 50,
    seasonTitles: MOVIE,
  },
  {
    slug: 'howls-moving-castle',
    titleRu: 'Ходячий замок',
    aliases: ["Howl's Moving Castle", 'Howl no Ugoku Shiro', 'Ходячий замок Хаула'],
    tagline: 'Проклятие превратило её в старуху. Замок на ножках стал домом.',
    synopsis:
      'Шляпницу Софи заколдовывает ведьма, и та в облике старухи уходит из дома. Она нанимается уборщицей в ходячий замок волшебника Хаула.',
    genres: ['Приключения', 'Фэнтези', 'Романтика'],
    focalX: 50,
    seasonTitles: MOVIE,
  },
]

/**
 * Focal points (x%, y%) for the titles whose wide artwork comes from Kitsu (`backdrop: 'kitsu'` in
 * scripts/titles.mjs). The `focalX` values in EDITORIAL describe the AniList banners and apply
 * to every other title.
 */
const KITSU_BACKDROP_FOCUS: Record<string, [number, number]> = {
  dandadan: [47, 40],
  frieren: [22, 50],
  'jujutsu-kaisen': [82, 55],
  'chainsaw-man': [50, 45],
  'spy-family': [50, 35],
  'attack-on-titan': [50, 60],
  haikyu: [50, 35],
  'solo-leveling': [22, 40],
  'vinland-saga': [28, 35],
  'cyberpunk-edgerunners': [45, 50],
  'oshi-no-ko': [50, 40],
  'blue-lock': [55, 35],
  'kaiju-no-8': [70, 50],
  'made-in-abyss': [50, 50],
  'tokyo-ghoul': [35, 30],
  'code-geass': [35, 35],
  'violet-evergarden': [20, 55],
  evangelion: [50, 45],
}

// ---------- Assembly ----------

const FORMAT_MAP: Record<string, AnimeFormat> = { TV: 'tv', MOVIE: 'movie', ONA: 'ona' }

function buildSeasons(slug: string, gen: GeneratedTitle, seasonTitles?: string[]): Season[] {
  return gen.seasons.map((s, i) => {
    const number = i + 1
    const seasonId = `s${number}`
    const episodes: Episode[] = s.episodes.map((e) => {
      const id = `${seasonId}e${String(e.n).padStart(2, '0')}`
      const source = videoSources[`${slug}/${id}`]
      return {
        id,
        number: e.n,
        seasonId,
        title: e.title ?? undefined,
        durationMin: source ? Math.round(source.duration / 60) : s.duration ?? undefined,
        airDate: e.airdate ?? undefined,
        thumbnail: e.thumb ? publicAsset(`/media/episodes/${slug}/${id}.webp`) : undefined,
        mediaSources: source ? [{ src: source.provider === 'local' ? episodeFile(source.fileUrl!) : staticHosting && !videoApiBase && source.provider === 'aniliberty' ? `aniliberty:${source.releaseId}/${source.episodeNumber}` : videoApiBase + (source.provider === 'ok' ? `/api/video/ok/${source.videoId}/video.mp4` : source.provider === 'aniliberty'
          ? `/api/video/aniliberty/${source.releaseId}/${source.episodeNumber}/master.m3u8`
          : `/api/video/rutube/${source.videoId}/master.m3u8`), type: source.provider === 'local' || source.provider === 'ok' ? 'video/mp4' : 'application/vnd.apple.mpegurl', label: source.height ? `${source.height}p` : 'Авто', height: source.height ?? 0, isDemo: false }] : [],
        subtitleTracks: [],
        catalogSource: source,
      }
    })
    return { id: seasonId, number, title: seasonTitles?.[i] ?? `Сезон ${number}`, year: s.year ?? 0, episodes }
  })
}

export const CATALOG_DATE: string = generated.fetchedAt

export const CATALOG: Anime[] = EDITORIAL.flatMap((e) => {
  const gen = generated.titles[e.slug]
  const first = gen?.seasons[0]
  // An editorial entry without fetched data is skipped rather than shown half-empty.
  if (!gen || !first) return []
  const kitsuFocus = gen.backdrop.from === 'Kitsu' ? KITSU_BACKDROP_FOCUS[e.slug] : undefined
  const ratingAniList = (gen.score ?? 0) / 10
  const anime: Anime = {
    id: e.slug,
    slug: e.slug,
    titleRu: e.titleRu,
    titleEn: gen.titleEnglish ?? gen.titleRomaji,
    titleOriginal: gen.titleNative ?? gen.titleRomaji,
    aliases: [...new Set([...e.aliases, gen.titleRomaji, gen.titleRuShikimori ?? ''].filter(Boolean))],
    tagline: e.tagline,
    synopsis: e.synopsis,
    description: gen.descriptionRu ?? e.synopsis,
    descriptionSource: gen.descriptionRu && gen.shikimoriUrl ? { label: 'Shikimori', url: gen.shikimoriUrl } : undefined,
    genres: e.genres,
    studios: gen.studios,
    year: first.year ?? 0,
    format: FORMAT_MAP[first.format] ?? 'tv',
    releaseStatus: gen.seasons.some((s) => s.status === 'RELEASING') ? 'ongoing' : 'finished',
    // The headline rating is Shikimori's (the scale Russian-speaking viewers know); AniList's is the fallback.
    rating: gen.scoreShikimori ?? ratingAniList,
    ratingSource: gen.scoreShikimori ? 'Shikimori' : 'AniList',
    ratingShikimori: gen.scoreShikimori ?? undefined,
    ratingAniList,
    ratingUrl: gen.scoreShikimori && gen.shikimoriUrl ? gen.shikimoriUrl : gen.anilistUrl,
    popularity: gen.popularity ?? 0,
    poster: publicAsset(`/media/posters/${e.slug}.webp`),
    posterSm: publicAsset(`/media/posters/${e.slug}-sm.webp`),
    posterWidth: gen.poster.w,
    backdrop: publicAsset(`/media/backdrops/${e.slug}.webp`),
    backdropSm: publicAsset(`/media/backdrops/${e.slug}-sm.webp`),
    backdropRatio: gen.backdrop.w / gen.backdrop.h,
    focalX: kitsuFocus?.[0] ?? e.focalX,
    focalY: kitsuFocus?.[1] ?? e.focalY ?? 35,
    seasons: buildSeasons(e.slug, gen, e.seasonTitles),
    trailerUrl: gen.trailerYoutubeId ? `https://www.youtube.com/watch?v=${gen.trailerYoutubeId}` : undefined,
    sourceUrl: gen.anilistUrl,
    catalogNote: e.catalogNote,
  }
  return [anime]
})

const BY_ID = new Map(CATALOG.map((a) => [a.id, a]))

export function getAnime(idOrSlug: string | undefined): Anime | undefined {
  return idOrSlug ? BY_ID.get(idOrSlug) : undefined
}

/** All genres that actually occur in the catalog, most frequent first. */
export const GENRES: string[] = (() => {
  const count = new Map<string, number>()
  for (const a of CATALOG) for (const g of a.genres) count.set(g, (count.get(g) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')).map(([g]) => g)
})()

export const FORMAT_LABEL: Record<AnimeFormat, string> = { tv: 'ТВ-сериал', movie: 'Фильм', ona: 'ONA' }
export const STATUS_LABEL = { finished: 'Завершён', ongoing: 'Выходит' } as const

/** Editorial order for the home hero. */
export const HERO_SLUGS = ['dandadan', 'frieren', 'demon-slayer', 'spy-family']
