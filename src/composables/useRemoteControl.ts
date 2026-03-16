import { ref, onUnmounted } from 'vue'
import Peer, { type DataConnection } from 'peerjs'

// ─── Remote-control types (smartphone → teleprompter) ────────────────────────

export interface TeleprompterState {
  playing: boolean
  speed: number
  fontSize: number
  mirror: boolean
  scrollProgress: number
  timeLeft: number
}

export type RemoteCommand =
  | { type: 'togglePlay' }
  | { type: 'speedUp' }
  | { type: 'speedDown' }
  | { type: 'fontUp' }
  | { type: 'fontDown' }
  | { type: 'toggleMirror' }
  | { type: 'reset' }
  | { type: 'scrollUp' }
  | { type: 'scrollDown' }
  | { type: 'seek'; progress: number }

// ─── Share / Transfer payload types ──────────────────────────────────────────

export interface SessionPayload {
  type: 'session'
  content: string
  settings: {
    speed: number
    fontSize: number
    mirror: boolean
    areaWidth: number
    areaOffsetX: number
  }
  scrollOffset: number
}

export interface TransferPayload {
  type: 'transfer'
  scripts: Array<{
    title: string
    content: string
    createdAt: number
    updatedAt: number
  }>
}

export type SharePayload = SessionPayload | TransferPayload

export type HostStatus = 'idle' | 'waiting' | 'connected' | 'error'
export type ClientStatus = 'idle' | 'connecting' | 'connected' | 'error'

// ─── Remote-control composables (host: teleprompter, client: smartphone) ─────

/**
 * Host-side composable: creates a PeerJS peer and accepts incoming data connections.
 * Returns the peerId (used to build the share link) and a callback for state broadcasts.
 */
export function useRemoteHost(onCommand: (cmd: RemoteCommand) => void) {
  const peerId = ref('')
  const connected = ref(false)
  const connections: DataConnection[] = []
  let peer: Peer | null = null

  function init() {
    peer = new Peer()

    peer.on('open', (id) => {
      peerId.value = id
    })

    peer.on('connection', (conn) => {
      connections.push(conn)
      connected.value = true

      conn.on('data', (data) => {
        onCommand(data as RemoteCommand)
      })

      conn.on('close', () => {
        const idx = connections.indexOf(conn)
        if (idx >= 0) connections.splice(idx, 1)
        connected.value = connections.length > 0
      })
    })
  }

  function broadcastState(state: TeleprompterState) {
    const msg = {
      type: 'state' as const,
      playing: state.playing,
      speed: state.speed,
      fontSize: state.fontSize,
      mirror: state.mirror,
      scrollProgress: state.scrollProgress,
      timeLeft: state.timeLeft,
    }
    for (const conn of connections) {
      if (conn.open) conn.send(msg)
    }
  }

  function destroy() {
    for (const conn of connections) conn.close()
    connections.length = 0
    peer?.destroy()
    peer = null
    peerId.value = ''
    connected.value = false
  }

  onUnmounted(destroy)

  return { peerId, connected, init, broadcastState, destroy }
}

/**
 * Client-side composable: connects to a host peer and sends commands.
 */
export function useRemoteClient() {
  const state = ref<TeleprompterState>({
    playing: false,
    speed: 5,
    fontSize: 48,
    mirror: false,
    scrollProgress: 0,
    timeLeft: -1,
  })
  const connected = ref(false)
  const connecting = ref(false)
  const error = ref('')
  let peer: Peer | null = null
  let conn: DataConnection | null = null

  function connect(hostId: string) {
    connecting.value = true
    error.value = ''
    peer = new Peer()

    peer.on('open', () => {
      conn = peer!.connect(hostId, { reliable: true })

      conn.on('open', () => {
        connected.value = true
        connecting.value = false
      })

      conn.on('data', (data) => {
        const msg = data as { type: string } & TeleprompterState
        if (msg.type === 'state') {
          state.value = {
            playing: msg.playing,
            speed: msg.speed,
            fontSize: msg.fontSize,
            mirror: msg.mirror,
            scrollProgress: msg.scrollProgress ?? 0,
            timeLeft: msg.timeLeft ?? -1,
          }
        }
      })

      conn.on('close', () => {
        connected.value = false
        connecting.value = false
      })

      conn.on('error', (err) => {
        error.value = err.message || 'Connection failed'
        connecting.value = false
      })
    })

    peer.on('error', (err) => {
      error.value = err.message || 'Failed to connect'
      connecting.value = false
    })
  }

  function send(cmd: RemoteCommand) {
    if (conn?.open) conn.send(cmd)
  }

  function disconnect() {
    conn?.close()
    peer?.destroy()
    conn = null
    peer = null
    connected.value = false
    connecting.value = false
  }

  onUnmounted(disconnect)

  return { state, connected, connecting, error, connect, send, disconnect }
}

// ─── Share-session / Transfer composables ────────────────────────────────────

/**
 * Host-side composable for sharing a teleprompter session or transferring scripts.
 * Creates a one-time PeerJS connection and fires when a client connects.
 */
export function useShareHost() {
  const peerId = ref('')
  const status = ref<HostStatus>('idle')
  const error = ref('')
  let peer: Peer | null = null
  let conn: DataConnection | null = null

  function start(): Promise<string> {
    return new Promise((resolve, reject) => {
      status.value = 'waiting'
      peer = new Peer()

      peer.on('open', (id) => {
        peerId.value = id
        resolve(id)
      })

      peer.on('connection', (incoming) => {
        conn = incoming
        conn.on('open', () => {
          status.value = 'connected'
        })
        conn.on('error', (err) => {
          error.value = (err as Error).message
          status.value = 'error'
        })
      })

      peer.on('error', (err) => {
        error.value = (err as Error).message
        status.value = 'error'
        reject(err)
      })
    })
  }

  function send(payload: SharePayload) {
    conn?.send(payload)
  }

  function stop() {
    conn?.close()
    peer?.destroy()
    conn = null
    peer = null
    status.value = 'idle'
    peerId.value = ''
    error.value = ''
  }

  onUnmounted(stop)

  return { peerId, status, error, start, send, stop }
}

/**
 * Client-side composable for receiving a shared session or transferred scripts.
 */
export function useShareClient() {
  const status = ref<ClientStatus>('idle')
  const error = ref('')
  let peer: Peer | null = null
  let conn: DataConnection | null = null
  let dataCallback: ((data: SharePayload) => void) | null = null

  function onData(cb: (data: SharePayload) => void) {
    dataCallback = cb
  }

  function connect(targetId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      status.value = 'connecting'
      peer = new Peer()

      peer.on('open', () => {
        conn = peer!.connect(targetId)

        conn.on('open', () => {
          status.value = 'connected'
          resolve()
        })

        conn.on('data', (raw) => {
          dataCallback?.(raw as SharePayload)
        })

        conn.on('error', (err) => {
          error.value = (err as Error).message
          status.value = 'error'
          reject(err)
        })
      })

      peer.on('error', (err) => {
        error.value = (err as Error).message
        status.value = 'error'
        reject(err)
      })
    })
  }

  function disconnect() {
    conn?.close()
    peer?.destroy()
    conn = null
    peer = null
    dataCallback = null
    status.value = 'idle'
    error.value = ''
  }

  onUnmounted(disconnect)

  return { status, error, connect, onData, disconnect }
}
