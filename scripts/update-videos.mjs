import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
// Each step is independently cached and resumable; verification always uses live playback metadata.
for (const script of ['collect-video-candidates.mjs', 'search-missing-videos.mjs', 'sync-videos.mjs', 'sync-aniliberty.mjs', 'sync-ok.mjs', 'sync-reviewed.mjs', 'write-video-report.mjs']) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), ...process.argv.slice(2)], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
