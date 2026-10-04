// QA helper: tiles screenshots side by side for review.
// Usage: node scripts/tile.mjs <out.png> <img1> <img2> ...
import sharp from 'sharp'

const [out, ...files] = process.argv.slice(2)
const gap = 12
const metas = await Promise.all(files.map((f) => sharp(f).metadata()))
const height = Math.max(...metas.map((m) => m.height))
let left = gap
const tiles = files.map((input, i) => {
  const tile = { input, left, top: gap }
  left += metas[i].width + gap
  return tile
})
await sharp({ create: { width: left, height: height + gap * 2, channels: 3, background: '#3a3e4b' } })
  .composite(tiles)
  .png()
  .toFile(out)
console.log(out)
