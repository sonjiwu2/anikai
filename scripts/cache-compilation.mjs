import { mkdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import ffmpeg from 'ffmpeg-static'
import { publicPlaybackOptions } from '../server/video-api.mjs'
import { publicOkVideo } from '../server/ok-video.mjs'

const id = process.argv[2]
const dir = new URL('./.cache/compilation-media/',import.meta.url)
await mkdir(dir,{recursive:true})
const output = fileURLToPath(new URL(`${id}.mp4`,dir))
if (await stat(output).catch(()=>null)) { console.log('Cached',output); process.exit(0) }
const ok = id.startsWith('ok-') ? await publicOkVideo(id.slice(3)) : null
const o = ok ? { title: ok.metadata.movie.title, duration: Number(ok.metadata.movie.duration) * 1000 } : await publicPlaybackOptions(id)
const master = ok ? '' : await (await fetch(o.video_balancer.m3u8)).text()
const variants = [...master.matchAll(/RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g)]
const selected = ok ? [null,ok.metadata.movie.height,ok.url] : variants.find(v=>Number(v[1])===720) ?? variants[0]
if(!selected)throw new Error('No variant')
console.log(`Downloading ${o.title}: ${Math.round(o.duration/60000)} minutes, ${selected[1]}p`)
await new Promise((resolve,reject)=>{
  const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-i',selected[2],'-map','0:v:0','-map','0:a:0','-c','copy','-movflags','+faststart',output],{windowsHide:true,stdio:['ignore','ignore','pipe']})
  let error=''
  child.stderr.on('data',b=>{error=(error+b).slice(-500)})
  child.on('error',reject)
  child.on('exit',code=>code===0?resolve():reject(new Error(`FFmpeg failed (${code}) ${error.replace(/https:\/\/\S+/g,'[media]')}`)))
})
console.log('Saved',output)
