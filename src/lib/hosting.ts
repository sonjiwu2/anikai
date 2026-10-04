/** Resolve public assets both at / and beneath a GitHub Pages project path. */
export const publicAsset = (path: string): string => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
export const staticHosting = import.meta.env.VITE_STATIC_HOST === 'true'
export const videoApiBase = (import.meta.env.VITE_VIDEO_API_URL ?? '').replace(/\/$/, '')
export function episodeFile(path: string): string {
  const remote = import.meta.env.VITE_VIDEO_FILES_URL
  return remote ? `${remote.replace(/\/$/, '')}/${path.replace(/^\/media\/video\//, '').replaceAll('/', '-')}` : publicAsset(path)
}
