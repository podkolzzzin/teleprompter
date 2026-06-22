interface Env {
  PEER_SERVER: DurableObjectNamespace
  PEERJS_KEY?: string
}

interface PeerMessage {
  type?: string
  dst?: string
  payload?: unknown
}

const DEFAULT_KEY = 'peerjs'
const PEER_PATH = '/peerjs'

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      ...init.headers,
    },
  })
}

function text(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    ...init,
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
      ...init.headers,
    },
  })
}

function createPeerId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function configuredKey(env: Env) {
  return env.PEERJS_KEY || DEFAULT_KEY
}

function routeToPeerServer(request: Request, env: Env) {
  const key = configuredKey(env)
  const id = env.PEER_SERVER.idFromName(key)
  return env.PEER_SERVER.get(id).fetch(request)
}

export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return text('', { status: 204 })
    }

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      if (url.pathname !== PEER_PATH) return text('Not found', { status: 404 })
      if (url.searchParams.get('key') !== configuredKey(env)) {
        return text('Invalid PeerJS key', { status: 403 })
      }
      return routeToPeerServer(request, env)
    }

    const keyPath = `/${configuredKey(env)}`
    if (request.method === 'GET' && [PEER_PATH, keyPath].includes(url.pathname.replace(/\/id$/, ''))) {
      if (!url.pathname.endsWith('/id')) return text('Not found', { status: 404 })
      return text(createPeerId())
    }

    if (request.method === 'GET' && [PEER_PATH, keyPath].includes(url.pathname.replace(/\/peers$/, ''))) {
      if (!url.pathname.endsWith('/peers')) return text('Not found', { status: 404 })
      return json({ error: 'Peer listing is disabled' }, { status: 401 })
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true })
    }

    return text('Not found', { status: 404 })
  },
}

export class PeerServer {
  private peers = new Map<string, WebSocket>()

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request) {
    const url = new URL(request.url)
    const peerId = url.searchParams.get('id')

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return text('Expected WebSocket', { status: 426 })
    }

    if (!peerId) {
      return text('Missing peer id', { status: 400 })
    }

    if (this.peers.has(peerId)) {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      server.accept()
      this.send(server, { type: 'ID-TAKEN', payload: { msg: `ID "${peerId}" is taken` } })
      server.close(1008, 'Peer ID is already connected')
      return new Response(null, { status: 101, webSocket: client })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    server.accept()
    this.peers.set(peerId, server)
    this.send(server, { type: 'OPEN' })

    server.addEventListener('message', (event) => {
      this.handleMessage(peerId, event.data)
    })

    server.addEventListener('close', () => {
      this.removePeer(peerId)
    })

    server.addEventListener('error', () => {
      this.removePeer(peerId)
    })

    this.state.waitUntil(Promise.resolve())
    return new Response(null, { status: 101, webSocket: client })
  }

  private handleMessage(peerId: string, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') return

    let message: PeerMessage
    try {
      message = JSON.parse(raw) as PeerMessage
    } catch {
      return
    }

    if (message.type === 'HEARTBEAT') return
    if (!message.type || !message.dst) return

    const target = this.peers.get(message.dst)
    if (!target) {
      this.sendTo(peerId, { type: 'EXPIRE', src: message.dst })
      return
    }

    this.send(target, {
      type: message.type,
      payload: message.payload,
      src: peerId,
    })
  }

  private removePeer(peerId: string) {
    if (!this.peers.delete(peerId)) return
    for (const [id, socket] of this.peers) {
      if (id !== peerId) this.send(socket, { type: 'LEAVE', src: peerId })
    }
  }

  private sendTo(peerId: string, message: Record<string, unknown>) {
    const socket = this.peers.get(peerId)
    if (socket) this.send(socket, message)
  }

  private send(socket: WebSocket, message: Record<string, unknown>) {
    try {
      socket.send(JSON.stringify(message))
    } catch {
      // The close/error handler will clean up sockets that can no longer send.
    }
  }
}
