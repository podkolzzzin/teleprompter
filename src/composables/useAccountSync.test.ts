import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useAccountSync } from './useAccountSync'

type Handler = (...args: any[]) => void

const peerState = vi.hoisted(() => {
  const instances: any[] = []

  class MockConnection {
    peer: string
    open = false
    sent: any[] = []
    private handlers = new Map<string, Handler[]>()

    constructor(peer: string) {
      this.peer = peer
    }

    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    }

    send(payload: any) {
      this.sent.push(payload)
    }

    close() {
      this.open = false
      this.emit('close')
    }

    emit(event: string, ...args: any[]) {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(...args)
      }
    }

    openConnection() {
      this.open = true
      this.emit('open')
    }
  }

  class MockPeer {
    id?: string
    connections: MockConnection[] = []
    destroyed = false
    private handlers = new Map<string, Handler[]>()

    constructor(id?: string) {
      this.id = id
      instances.push(this)
    }

    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    }

    connect(deviceId: string) {
      const conn = new MockConnection(deviceId)
      this.connections.push(conn)
      return conn
    }

    destroy() {
      this.destroyed = true
    }

    emit(event: string, ...args: any[]) {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(...args)
      }
    }
  }

  return {
    instances: instances as InstanceType<typeof MockPeer>[],
    MockPeer,
  }
})

vi.mock('peerjs', () => ({
  default: peerState.MockPeer,
}))

vi.mock('../storage/db', () => ({
  deleteScriptsByUuid: vi.fn().mockResolvedValue(0),
  getAllScripts: vi.fn().mockResolvedValue([]),
  getDeletedScripts: vi.fn(() => []),
  upsertSyncedScripts: vi.fn().mockResolvedValue(0),
}))

describe('useAccountSync', () => {
  beforeEach(() => {
    localStorage.clear()
    peerState.instances.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('queues scanned account links until the local peer is open and marks connected only after channel open', async () => {
    vi.useFakeTimers()
    let sync!: ReturnType<typeof useAccountSync>

    const Harness = defineComponent({
      setup() {
        sync = useAccountSync()
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    await nextTick()

    expect(peerState.instances).toHaveLength(1)
    const peer = peerState.instances[0]

    sync.connectToDevice('target-device')

    expect(sync.status.value).toBe('connecting')
    expect(sync.connectedDeviceIds.value).toEqual([])
    expect(peer.connections).toHaveLength(0)

    peer.emit('open')

    expect(peer.connections).toHaveLength(1)
    expect(sync.connectedDeviceIds.value).toEqual([])
    expect(sync.status.value).toBe('connecting')

    peer.connections[0].openConnection()
    await flushPromises()

    expect(sync.connectedDeviceIds.value).toEqual(['target-device'])
    expect(sync.status.value).toBe('online')
    expect(peer.connections[0].sent[0]).toMatchObject({ type: 'account:hello' })

    sync.stop()
    wrapper.unmount()
  })
})
