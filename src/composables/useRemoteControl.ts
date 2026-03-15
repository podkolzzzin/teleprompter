import { ref, onUnmounted, type Ref } from 'vue'
import Peer, { type DataConnection } from 'peerjs'

export interface TeleprompterState {
  playing: boolean
  speed: number
  fontSize: number
  mirror: boolean
}

export type RemoteCommand =
  | { type: 'togglePlay' }
  | { type: 'speedUp' }
  | { type: 'speedDown' }
  | { type: 'fontUp' }
  | { type: 'fontDown' }
  | { type: 'toggleMirror' }
  | { type: 'reset' }

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
    const msg = { type: 'state' as const, ...state }
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
