import { readFile, writeFile } from 'node:fs/promises'
import { publicPlaybackOptions } from '../server/video-api.mjs'
// The 82-minute premiere was reviewed at 10, 30, 60 and 80 minutes.
// Its subtitle names the episode rather than including an episode number.
const id = 'aeb8564f0f0fa7d3c0068e7c71f59b82'
const options = await publicPlaybackOptions(id)
if (!/зв[её]здное дитя/i.test(options.title) || options.duration < 4_800_000 || options.duration > 5_400_000) throw new Error('Reviewed premiere changed')
const file = new URL('../src/data/generated/video-sources.json', import.meta.url)
const data = JSON.parse(await readFile(file))
data.sources['oshi-no-ko/s1e01'] = { provider: 'rutube', videoId: id, url: `https://rutube.ru/video/${id}/`, title: options.title,
  duration: options.duration / 1000, channel: 'Rutube', verifiedAt: new Date().toISOString() }
data.missing = data.missing.filter(key => !data.sources[key])
await writeFile(file, JSON.stringify(data, null, 2) + '\n')
console.log('Connected reviewed long premiere of Oshi no Ko')
