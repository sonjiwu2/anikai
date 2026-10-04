import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { publicPlaybackOptions } from '../server/video-api.mjs'
import ffmpeg from 'ffmpeg-static'
import sharp from 'sharp'
import { publicOkVideo } from '../server/ok-video.mjs'

const [id, ...positions] = process.argv.slice(2)
const isOk = id.startsWith('ok-')
const ok = isOk ? await publicOkVideo(id.slice(3)) : undefined
const options = isOk ? {title:ok.metadata.movie.title,duration:Number(ok.metadata.movie.duration)*1000} : await publicPlaybackOptions(id)
const master = isOk ? '' : await (await fetch(options.video_balancer.m3u8)).text()
const entries = [...master.matchAll(/RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g)]
const chosen = isOk ? [null,null,ok.url] : entries.find(e => Number(e[1]) === 360) ?? entries[0]
if (!chosen) throw new Error('No variant')
const dir = new URL('./.cache/review/', import.meta.url)
await mkdir(dir, {recursive:true})
const images = []
for (const [i, position] of positions.entries()) {
  const output = new URL(`${id}-${position}.jpg`, dir)
  await new Promise((resolve,reject) => {
    const child = spawn(ffmpeg, ['-hide_banner','-loglevel','error','-nostdin','-y','-ss',position,'-i',chosen[2],'-frames:v','1','-vf','scale=480:-1',output.pathname.replace(/^\/(\w:)/,'$1')], {windowsHide:true,stdio:['ignore','ignore','pipe']})
    let error = ''
    child.stderr.on('data', b => {error += b})
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Frame ${position}: FFmpeg failed (${code}) ${error.slice(-180).replace(/https:\/\/\S+/g,'[media]')}`)))
  })
  const file = output.pathname.replace(/^\/(\w:)/,'$1')
  const label = Buffer.from(`<svg width="480" height="30"><rect width="480" height="30" fill="#111"/><text x="10" y="22" fill="white" font-size="18">${position}s</text></svg>`)
  const frame = await sharp(file).resize(480,270,{fit:'contain'}).extend({top:30,bottom:0,left:0,right:0,background:'#111'}).composite([{input:label,top:0,left:0}]).jpeg().toBuffer()
  images.push({input:frame,left:(i%3)*480,top:Math.floor(i/3)*300})
}
const sheet = new URL(`${id}-sheet.jpg`,dir).pathname.replace(/^\/(\w:)/,'$1')
await sharp({create:{width:1440,height:Math.ceil(images.length/3)*300,channels:3,background:'#111'}}).composite(images).jpeg({quality:90}).toFile(sheet)
console.log(JSON.stringify({id,title:options.title,duration:options.duration/1000,sheet}))
