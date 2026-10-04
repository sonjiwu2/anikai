// QA helper: tiles all posters / backdrops into contact sheets for a visual check.
// Usage: node scripts/contact-sheet.mjs <outDir>
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { TITLES } from './titles.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'scripts', '.cache'))
await mkdir(outDir, { recursive: true })

async function sheet(kind, cellW, cellH, cols, name) {
  const rows = Math.ceil(TITLES.length / cols)
  const gap = 8
  const tiles = await Promise.all(
    TITLES.map(async (t, i) => ({
      input: await sharp(path.join(ROOT, 'public', 'media', kind, `${t.slug}.webp`))
        .resize({ width: cellW, height: cellH, fit: 'cover' })
        .png()
        .toBuffer(),
      left: gap + (i % cols) * (cellW + gap),
      top: gap + Math.floor(i / cols) * (cellH + gap),
    })),
  )
  await sharp({
    create: { width: gap + cols * (cellW + gap), height: gap + rows * (cellH + gap), channels: 3, background: '#121318' },
  })
    .composite(tiles)
    .png()
    .toFile(path.join(outDir, name))
  console.log(path.join(outDir, name))
}

await sheet('posters', 200, 300, 8, 'sheet-posters.png')
await sheet('backdrops', 712, 150, 2, 'sheet-backdrops.png')
