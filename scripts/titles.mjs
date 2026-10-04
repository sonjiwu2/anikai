// AniList ids for every title/season in the Anikai catalog.
// `episodes` overrides are used only where AniList has no fixed count (ongoing series).
// `backdrop: 'kitsu'` picks Kitsu's cover image for the wide artwork instead of AniList's banner:
// chosen by eye, where the Kitsu image is both higher resolution and a better composition.
export const TITLES = [
  { slug: 'dandadan', seasons: [171018, 185660], backdrop: 'kitsu' },
  { slug: 'frieren', seasons: [154587, 182255], backdrop: 'kitsu' },
  { slug: 'jujutsu-kaisen', seasons: [113415, 145064, 172463], backdrop: 'kitsu' },
  { slug: 'chainsaw-man', seasons: [127230], backdrop: 'kitsu' },
  { slug: 'demon-slayer', seasons: [101922, 142329, 145139, 166240] },
  { slug: 'spy-family', seasons: [140960, 142838, 158927, 177937], backdrop: 'kitsu' },
  { slug: 'attack-on-titan', seasons: [16498, 20958, 99147, 104578], backdrop: 'kitsu' },
  { slug: 'death-note', seasons: [1535] },
  // One Piece is ongoing; the catalog carries the East Blue saga (episodes 1–61).
  { slug: 'one-piece', seasons: [21], episodes: { 21: 61 } },
  { slug: 'haikyu', seasons: [20464, 20992, 21698, 106625, 113538], backdrop: 'kitsu' },
  { slug: 'apothecary-diaries', seasons: [161645, 176301] },
  { slug: 'solo-leveling', seasons: [151807, 176496], backdrop: 'kitsu' },
  { slug: 'fullmetal-alchemist-brotherhood', seasons: [5114] },
  { slug: 'steins-gate', seasons: [9253] },
  { slug: 'vinland-saga', seasons: [101348, 136430], backdrop: 'kitsu' },
  { slug: 'mob-psycho-100', seasons: [21507, 101338, 140439] },
  { slug: 'bocchi-the-rock', seasons: [130003] },
  { slug: 'kaguya-sama', seasons: [101921, 112641, 125367] },
  { slug: 'cyberpunk-edgerunners', seasons: [120377], backdrop: 'kitsu' },
  { slug: 'oshi-no-ko', seasons: [150672, 166531], backdrop: 'kitsu' },
  { slug: 'blue-lock', seasons: [137822, 163146], backdrop: 'kitsu' },
  { slug: 'kaiju-no-8', seasons: [153288, 178754], backdrop: 'kitsu' },
  { slug: 'made-in-abyss', seasons: [97986, 114745], backdrop: 'kitsu' },
  { slug: 're-zero', seasons: [21355, 108632, 119661] },
  { slug: 'tokyo-ghoul', seasons: [20605, 20850], backdrop: 'kitsu' },
  { slug: 'code-geass', seasons: [1575, 2904], backdrop: 'kitsu' },
  { slug: 'violet-evergarden', seasons: [21827], backdrop: 'kitsu' },
  { slug: 'cowboy-bebop', seasons: [1] },
  { slug: 'evangelion', seasons: [30], backdrop: 'kitsu' },
  { slug: 'your-name', seasons: [21519] },
  { slug: 'a-silent-voice', seasons: [20954] },
  { slug: 'suzume', seasons: [142770] },
  { slug: 'spirited-away', seasons: [199] },
  { slug: 'princess-mononoke', seasons: [164] },
  { slug: 'howls-moving-castle', seasons: [431] },
]

// Avatar presets: square crops (source pixels) from a title's AniList banner.
export const AVATARS = [
  { id: 'frieren', from: 'frieren', left: 705, top: 190, size: 210 },
  { id: 'anya', from: 'spy-family', left: 770, top: 10, size: 380 },
  { id: 'okarun', from: 'dandadan', left: 1100, top: 0, size: 400 },
  { id: 'momo', from: 'dandadan', left: 470, top: 0, size: 400 },
  { id: 'hinata', from: 'haikyu', left: 590, top: 130, size: 270 },
  { id: 'luffy', from: 'one-piece', left: 480, top: 0, size: 400 },
  { id: 'bocchi', from: 'bocchi-the-rock', left: 925, top: 90, size: 290 },
]

// Open demo video (Blender Foundation, CC BY 3.0).
export const DEMO_VIDEOS = [
  { file: 'sintel-trailer-480p.mp4', url: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4' },
  { file: 'sintel-trailer-720p.mp4', url: 'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4' },
]
