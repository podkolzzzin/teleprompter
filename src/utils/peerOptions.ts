import type { PeerOptions } from 'peerjs'

export function createPeerOptions(): PeerOptions | undefined {
  const host = import.meta.env.VITE_PEERJS_HOST
  if (!host) return undefined

  const port = Number(import.meta.env.VITE_PEERJS_PORT)
  const secureEnv = import.meta.env.VITE_PEERJS_SECURE

  return {
    host,
    key: import.meta.env.VITE_PEERJS_KEY || 'peerjs',
    path: import.meta.env.VITE_PEERJS_PATH || '/',
    ...(Number.isFinite(port) ? { port } : {}),
    ...(secureEnv ? { secure: secureEnv !== 'false' } : {}),
  }
}
