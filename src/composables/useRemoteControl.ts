import { ref, onUnmounted } from 'vue'
import Peer, { type DataConnection } from 'peerjs'

export type HostStatus = 'idle' | 'waiting' | 'connected' | 'error'
export type ClientStatus = 'idle' | 'connecting' | 'connected' | 'error'

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

export type RemotePayload = SessionPayload | TransferPayload

export function useRemoteHost() {
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

  function send(payload: RemotePayload) {
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

export function useRemoteClient() {
  const status = ref<ClientStatus>('idle')
  const error = ref('')
  let peer: Peer | null = null
  let conn: DataConnection | null = null
  let dataCallback: ((data: RemotePayload) => void) | null = null

  function onData(cb: (data: RemotePayload) => void) {
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
          dataCallback?.(raw as RemotePayload)
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
