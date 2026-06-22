import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import Peer, { type DataConnection } from 'peerjs'
import {
  deleteScriptsByUuid,
  getAllScripts,
  getDeletedScripts,
  upsertSyncedScripts,
  type DeletedScript,
  type Script,
} from '../storage/db'

const ACCOUNT_KEY = 'teleprompter-account'
const DEVICE_KEY = 'teleprompter-device'
const KNOWN_DEVICES_KEY = 'teleprompter-known-devices'
const ACTIVE_SESSION_TTL = 30_000
const PEERJS_DISABLED = import.meta.env.VITE_DISABLE_PEERJS === 'true'

export interface AccountProfile {
  id: string
  createdAt: number
}

export interface DeviceProfile {
  id: string
  name: string
  createdAt: number
}

export interface ActiveSession {
  deviceId: string
  scriptId: number | null
  scriptTitle: string
  remotePeerId: string
  playing: boolean
  updatedAt: number
}

type SyncPayload =
  | {
      type: 'account:hello'
      account: AccountProfile
      device: DeviceProfile
      scripts: Script[]
      deletedScripts: DeletedScript[]
      activeSession: ActiveSession | null
    }
  | { type: 'account:merge'; account: AccountProfile; scripts: Script[]; deletedScripts: DeletedScript[] }
  | { type: 'account:scripts'; scripts: Script[]; deletedScripts: DeletedScript[] }
  | { type: 'account:activeSession'; session: ActiveSession | null }

const account = ref<AccountProfile | null>(null)
const device = ref<DeviceProfile | null>(null)
const knownDevices = ref<DeviceProfile[]>([])
const remoteSessions = ref<Record<string, ActiveSession>>({})
const connectedDeviceIds = ref<string[]>([])
const pairingOpen = ref(false)
const status = ref<'idle' | 'connecting' | 'online' | 'error'>('idle')
const error = ref('')
const clock = ref(Date.now())

let peer: Peer | null = null
let retryTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
let started = false
let peerReady = false

const connections = reactive(new Map<string, DataConnection>())
const pendingDeviceIds = new Set<string>()
const memoryStorage = new Map<string, string>()

function createUuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function loadJson<T>(key: string): T | null {
  const raw = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage.getItem(key)
    : memoryStorage.get(key) ?? null
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(key)
    } else {
      memoryStorage.delete(key)
    }
    return null
  }
}

function saveProfiles() {
  const values = [
    [ACCOUNT_KEY, account.value ? JSON.stringify(account.value) : null],
    [DEVICE_KEY, device.value ? JSON.stringify(device.value) : null],
    [KNOWN_DEVICES_KEY, JSON.stringify(knownDevices.value)],
  ] as const

  for (const [key, value] of values) {
    if (!value) continue
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value)
    } else {
      memoryStorage.set(key, value)
    }
  }
}

function createDeviceName(): string {
  const platform = navigator.userAgent.includes('Mobile') ? 'Phone' : 'Desktop'
  return `${platform} ${new Date().toLocaleDateString()}`
}

function ensureProfiles() {
  account.value = loadJson<AccountProfile>(ACCOUNT_KEY) ?? {
    id: createUuid(),
    createdAt: Date.now(),
  }
  device.value = loadJson<DeviceProfile>(DEVICE_KEY) ?? {
    id: `tp-${createUuid()}`,
    name: createDeviceName(),
    createdAt: Date.now(),
  }
  knownDevices.value = loadJson<DeviceProfile[]>(KNOWN_DEVICES_KEY) ?? []
  saveProfiles()
}

function rememberDevice(remoteDevice: DeviceProfile) {
  if (!device.value || remoteDevice.id === device.value.id) return
  const existing = knownDevices.value.find((known) => known.id === remoteDevice.id)
  if (existing) {
    existing.name = remoteDevice.name
    existing.createdAt = remoteDevice.createdAt
  } else {
    knownDevices.value = [...knownDevices.value, remoteDevice]
  }
  saveProfiles()
}

function chooseMergedAccount(remoteAccount: AccountProfile): AccountProfile {
  if (!account.value) return remoteAccount
  if (remoteAccount.createdAt < account.value.createdAt) return remoteAccount
  if (remoteAccount.createdAt > account.value.createdAt) return account.value
  return remoteAccount.id < account.value.id ? remoteAccount : account.value
}

async function buildHello(): Promise<SyncPayload> {
  ensureProfiles()
  return {
    type: 'account:hello',
    account: account.value!,
    device: device.value!,
    scripts: await getAllScripts(),
    deletedScripts: getDeletedScripts(),
    activeSession: localActiveSession.value,
  }
}

function sendTo(conn: DataConnection, payload: SyncPayload) {
  if (conn.open) conn.send(payload)
}

function broadcast(payload: SyncPayload) {
  for (const conn of connections.values()) {
    sendTo(conn, payload)
  }
}

async function handlePayload(payload: SyncPayload, conn: DataConnection) {
  if (payload.type === 'account:hello') {
    rememberDevice(payload.device)
    const mergedAccount = chooseMergedAccount(payload.account)
    if (!account.value || mergedAccount.id !== account.value.id) {
      account.value = mergedAccount
      saveProfiles()
    }
    await deleteScriptsByUuid(payload.deletedScripts)
    await upsertSyncedScripts(payload.scripts)
    window.dispatchEvent(new CustomEvent('teleprompter:scripts-updated'))
    if (payload.activeSession?.playing) {
      remoteSessions.value = {
        ...remoteSessions.value,
        [payload.device.id]: payload.activeSession,
      }
    }
    sendTo(conn, {
      type: 'account:merge',
      account: account.value!,
      scripts: await getAllScripts(),
      deletedScripts: getDeletedScripts(),
    })
  } else if (payload.type === 'account:merge') {
    const mergedAccount = chooseMergedAccount(payload.account)
    account.value = mergedAccount
    saveProfiles()
    await deleteScriptsByUuid(payload.deletedScripts)
    await upsertSyncedScripts(payload.scripts)
    window.dispatchEvent(new CustomEvent('teleprompter:scripts-updated'))
  } else if (payload.type === 'account:scripts') {
    const deleted = await deleteScriptsByUuid(payload.deletedScripts)
    const changed = await upsertSyncedScripts(payload.scripts)
    if (deleted > 0) window.dispatchEvent(new CustomEvent('teleprompter:scripts-updated'))
    if (changed > 0) window.dispatchEvent(new CustomEvent('teleprompter:scripts-updated'))
  } else if (payload.type === 'account:activeSession') {
    if (!payload.session || !payload.session.playing) {
      const next = { ...remoteSessions.value }
      if (payload.session) delete next[payload.session.deviceId]
      remoteSessions.value = next
      return
    }
    remoteSessions.value = {
      ...remoteSessions.value,
      [payload.session.deviceId]: payload.session,
    }
  }
}

function refreshConnectedDevices() {
  connectedDeviceIds.value = [...connections.entries()]
    .filter(([, conn]) => conn.open)
    .map(([deviceId]) => deviceId)

  if (connectedDeviceIds.value.length > 0) {
    status.value = 'online'
    return
  }

  if (!started && !peer) {
    status.value = 'idle'
    return
  }

  status.value = pendingDeviceIds.size > 0 || connections.size > 0 || !peerReady ? 'connecting' : 'idle'
}

function setupConnection(conn: DataConnection) {
  const remoteId = conn.peer
  const existing = connections.get(remoteId)
  if (existing && existing !== conn) existing.close()
  connections.set(remoteId, conn)
  refreshConnectedDevices()

  conn.on('open', async () => {
    pendingDeviceIds.delete(remoteId)
    error.value = ''
    refreshConnectedDevices()
    sendTo(conn, await buildHello())
  })

  conn.on('data', (raw) => {
    handlePayload(raw as SyncPayload, conn)
  })

  conn.on('close', () => {
    connections.delete(remoteId)
    refreshConnectedDevices()
  })

  conn.on('error', (err) => {
    error.value = err.message || 'Device sync failed'
    status.value = 'error'
  })
}

function startPeer() {
  if (!device.value || peer) return
  status.value = 'connecting'
  peerReady = false
  peer = new Peer(device.value.id)

  peer.on('open', () => {
    peerReady = true
    refreshConnectedDevices()
    connectPendingDevices()
    connectKnownDevices()
  })

  peer.on('connection', setupConnection)

  peer.on('error', (err) => {
    error.value = err.message || 'Account sync failed'
    status.value = 'error'
  })
}

function connectToDevice(deviceId: string) {
  if (!device.value || deviceId === device.value.id || connections.has(deviceId)) return
  pendingDeviceIds.add(deviceId)
  refreshConnectedDevices()
  connectPendingDevices()
}

function connectPendingDevices() {
  if (!peer || !peerReady || !device.value) return
  for (const deviceId of pendingDeviceIds) {
    if (deviceId === device.value.id || connections.has(deviceId)) continue
    const conn = peer.connect(deviceId, { reliable: true })
    setupConnection(conn)
  }
}

function connectKnownDevices() {
  for (const known of knownDevices.value) {
    connectToDevice(known.id)
  }
}

function retryDeviceConnections() {
  connectPendingDevices()
  connectKnownDevices()
}

const localActiveSession = ref<ActiveSession | null>(null)

async function syncNow() {
  if (connections.size === 0) return
  broadcast({
    type: 'account:scripts',
    scripts: await getAllScripts(),
    deletedScripts: getDeletedScripts(),
  })
}

function publishActiveSession(session: Omit<ActiveSession, 'deviceId' | 'updatedAt'> | null) {
  const nextSession = session && device.value
    ? { ...session, deviceId: device.value.id, updatedAt: Date.now() }
    : null
  localActiveSession.value = nextSession
  broadcast({ type: 'account:activeSession', session: nextSession })
}

const activeRemoteSession = computed(() => {
  const sessions = Object.values(remoteSessions.value)
    .filter((session) => session.playing && clock.value - session.updatedAt < ACTIVE_SESSION_TTL)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return sessions[0] ?? null
})

const pairUrl = computed(() => {
  if (!device.value) return ''
  return `${window.location.origin}/account/${device.value.id}`
})

function openPairing() {
  pairingOpen.value = true
}

function closePairing() {
  pairingOpen.value = false
}

function start() {
  if (started) return
  started = true
  ensureProfiles()
  if (PEERJS_DISABLED) {
    status.value = 'idle'
    return
  }
  startPeer()
  retryTimer = setInterval(retryDeviceConnections, 10_000)
  clockTimer = setInterval(() => {
    clock.value = Date.now()
  }, 1_000)
}

function stop() {
  if (retryTimer) clearInterval(retryTimer)
  if (clockTimer) clearInterval(clockTimer)
  for (const conn of connections.values()) conn.close()
  connections.clear()
  pendingDeviceIds.clear()
  peer?.destroy()
  peer = null
  peerReady = false
  retryTimer = null
  clockTimer = null
  started = false
  refreshConnectedDevices()
}

export function useAccountSync() {
  onMounted(start)
  onUnmounted(() => {
    // The singleton is intentionally kept alive across route components.
  })

  return {
    account,
    device,
    knownDevices,
    connectedDeviceIds,
    pairingOpen,
    pairUrl,
    status,
    error,
    activeRemoteSession,
    start,
    stop,
    openPairing,
    closePairing,
    connectToDevice,
    syncNow,
    publishActiveSession,
  }
}
