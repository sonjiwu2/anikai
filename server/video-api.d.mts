import type { IncomingMessage, ServerResponse } from 'node:http'
export function createVideoMiddleware(options?: { allowedIds?: Set<string>; allowedAniEpisodes?: Set<string>; allowedOkIds?: Set<string> }): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<void>
