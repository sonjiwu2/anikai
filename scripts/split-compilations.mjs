import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ffmpeg from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'

const configs = JSON.parse(await readFile(new URL('./compilation-cuts.json', import.meta.url)))
const localFile = new URL('../src/data/generated/local-video-sources.json', import.meta.url)
const sourcesFile = new URL('../src/data/generated/video-sources.json', import.meta.url)
const local = JSON.parse(await readFile(localFile))
function run(executable, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', capture ? 'pipe' : 'ignore', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout?.on('data', b => { stdout += b })
    child.stderr.on('data', b => { stderr = (stderr + b).slice(-1000) })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve(stdout) : reject(new Error(`FFmpeg failed (${code}): ${stderr}`)))
  })
}
for (const config of configs) {
  if (!config.review || !/^[a-z0-9-]+$/.test(config.slug)) throw new Error('Only reviewed cuts can be imported')
  const input = fileURLToPath(new URL(`./.cache/compilation-media/${config.videoId}.mp4`, import.meta.url))
  await stat(input)
  const dir = new URL(`../public/media/video/${config.slug}/`, import.meta.url)
  await mkdir(dir, { recursive: true })
  for (let i = 0; i < config.boundaries.length - 1; i++) {
    const episode = `s${config.season}e${String(i + 1).padStart(2, '0')}`
    const key = `${config.slug}/${episode}`
    const output = fileURLToPath(new URL(`${episode}.mp4`, dir))
    const partial = fileURLToPath(new URL(`${episode}.partial.mp4`, dir))
    const duration = config.boundaries[i + 1] - config.boundaries[i]
    if (!Number.isFinite(duration) || duration < 60) throw new Error(`Invalid cut: ${key}`)
    if (!await stat(output).catch(() => null)) {
      console.log(`Encoding ${key}: ${(duration / 60).toFixed(2)} min, standalone 720p MP4`)
      await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', String(config.boundaries[i]), '-i', input,
        '-t', String(duration), '-map', '0:v:0', '-map', '0:a:0', '-vf', 'fps=30,setpts=PTS-STARTPTS',
        '-af', 'asetpts=PTS-STARTPTS', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', '-metadata', `title=${config.title}, серия ${i + 1}`, partial])
      await rename(partial, output)
    }
    const metadata = JSON.parse(await run(ffprobe.path, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,start_time', '-of', 'json', output], true))
    const actual = Number(metadata.format.duration)
    if (Math.abs(actual - duration) > 0.25 || metadata.streams.some(s => Math.abs(Number(s.start_time)) > 0.1)) throw new Error(`Invalid duration or timestamp: ${key}`)
    const video = metadata.streams.find(s => s.codec_type === 'video')
    local.sources[key] = { provider: 'local', videoId: config.videoId, url: `https://rutube.ru/video/${config.videoId}/`,
      title: `${config.title}, серия ${i + 1}`, duration: actual, channel: config.channel,
      fileUrl: `/media/video/${key}.mp4`, height: video.height, cutStart: config.boundaries[i], cutEnd: config.boundaries[i + 1],
      verifiedAt: new Date().toISOString() }
    if (config.videoId.startsWith('ok-')) local.sources[key].url = `https://ok.ru/video/${config.videoId.slice(3)}`
    await writeFile(localFile, JSON.stringify(local, null, 2) + '\n')
    const catalog = JSON.parse(await readFile(sourcesFile))
    catalog.sources[key] = local.sources[key]
    catalog.missing = catalog.missing.filter(k => k !== key)
    catalog.fetchedAt = new Date().toISOString()
    await writeFile(sourcesFile, JSON.stringify(catalog, null, 2) + '\n')
    console.log(`Ready ${key}: ${actual.toFixed(3)} seconds, audio and video start at zero`)
  }
}
