import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createVideoMiddleware } from './server/video-api.mjs'
import videos from './src/data/generated/video-sources.json' with { type: 'json' }
import type { CatalogVideoSource } from './src/types/index.ts'

const verifiedVideos = Object.values(videos.sources) as CatalogVideoSource[]
const videoOptions = {
  allowedIds: new Set(verifiedVideos.filter(s => s.provider === 'rutube').map(s => s.videoId)),
  allowedAniEpisodes: new Set(verifiedVideos.filter(s => s.provider === 'aniliberty').map(s => `${s.releaseId}/${s.episodeNumber}`)),
  allowedOkIds: new Set(verifiedVideos.filter(s => s.provider === 'ok').map(s => s.videoId)),
}

const videoApi = (): Plugin => ({
  name: 'anikai-video-api',
  configureServer(server) {
    server.middlewares.use(createVideoMiddleware(videoOptions))
  },
  configurePreviewServer(server) {
    server.middlewares.use(createVideoMiddleware(videoOptions))
  },
})

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), videoApi()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: {
    rolldownOptions: {
      output: {
        // Libraries and catalog data change far less often than app code: separate files cache better.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'catalog', test: /src[\\/]data[\\/]generated[\\/]/ },
          ],
        },
      },
    },
  },
})
