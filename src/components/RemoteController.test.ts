import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import RemoteController from './RemoteController.vue'

// Mock the composable
vi.mock('../composables/useRemoteControl', () => ({
  useRemoteClient: vi.fn(() => ({
    state: ref({ playing: false, speed: 5, fontSize: 48, mirror: false }),
    connected: ref(false),
    connecting: ref(true),
    error: ref(''),
    connect: vi.fn(),
    send: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

import { useRemoteClient } from '../composables/useRemoteControl'

function createTestRouter(peerId = 'test-peer-123') {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/remote/:peerId', component: RemoteController },
    ],
  })
  router.push(`/remote/${peerId}`)
  return router
}

describe('RemoteController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows connecting state initially', async () => {
    vi.mocked(useRemoteClient).mockReturnValue({
      state: ref({ playing: false, speed: 5, fontSize: 48, mirror: false }),
      connected: ref(false),
      connecting: ref(true),
      error: ref(''),
      connect: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
    } as any)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(RemoteController, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('Connecting to teleprompter')
  })

  it('shows controls when connected', async () => {
    vi.mocked(useRemoteClient).mockReturnValue({
      state: ref({ playing: false, speed: 5, fontSize: 48, mirror: false }),
      connected: ref(true),
      connecting: ref(false),
      error: ref(''),
      connect: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
    } as any)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(RemoteController, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('Connected')
    expect(wrapper.find('.play-btn').exists()).toBe(true)
    expect(wrapper.find('.play-btn').text()).toContain('Play')
  })

  it('shows error state', async () => {
    vi.mocked(useRemoteClient).mockReturnValue({
      state: ref({ playing: false, speed: 5, fontSize: 48, mirror: false }),
      connected: ref(false),
      connecting: ref(false),
      error: ref('Connection failed'),
      connect: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
    } as any)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(RemoteController, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('Connection failed')
    expect(wrapper.find('.retry-btn').exists()).toBe(true)
  })

  it('sends togglePlay command when play button clicked', async () => {
    const mockSend = vi.fn()
    vi.mocked(useRemoteClient).mockReturnValue({
      state: ref({ playing: false, speed: 5, fontSize: 48, mirror: false }),
      connected: ref(true),
      connecting: ref(false),
      error: ref(''),
      connect: vi.fn(),
      send: mockSend,
      disconnect: vi.fn(),
    } as any)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(RemoteController, {
      global: { plugins: [router] },
    })

    await wrapper.find('.play-btn').trigger('click')
    expect(mockSend).toHaveBeenCalledWith({ type: 'togglePlay' })
  })

  it('shows pause label when playing', async () => {
    vi.mocked(useRemoteClient).mockReturnValue({
      state: ref({ playing: true, speed: 5, fontSize: 48, mirror: false }),
      connected: ref(true),
      connecting: ref(false),
      error: ref(''),
      connect: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
    } as any)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(RemoteController, {
      global: { plugins: [router] },
    })

    expect(wrapper.find('.play-btn').text()).toContain('Pause')
  })

  it('sends speed and font commands', async () => {
    const mockSend = vi.fn()
    vi.mocked(useRemoteClient).mockReturnValue({
      state: ref({ playing: false, speed: 5, fontSize: 48, mirror: false }),
      connected: ref(true),
      connecting: ref(false),
      error: ref(''),
      connect: vi.fn(),
      send: mockSend,
      disconnect: vi.fn(),
    } as any)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(RemoteController, {
      global: { plugins: [router] },
    })

    const buttons = wrapper.findAll('.small-btn')
    // Speed down, Speed up, Font down, Font up
    await buttons[0].trigger('click')
    expect(mockSend).toHaveBeenCalledWith({ type: 'speedDown' })

    await buttons[1].trigger('click')
    expect(mockSend).toHaveBeenCalledWith({ type: 'speedUp' })

    await buttons[2].trigger('click')
    expect(mockSend).toHaveBeenCalledWith({ type: 'fontDown' })

    await buttons[3].trigger('click')
    expect(mockSend).toHaveBeenCalledWith({ type: 'fontUp' })
  })

  it('sends mirror command', async () => {
    const mockSend = vi.fn()
    vi.mocked(useRemoteClient).mockReturnValue({
      state: ref({ playing: false, speed: 5, fontSize: 48, mirror: false }),
      connected: ref(true),
      connecting: ref(false),
      error: ref(''),
      connect: vi.fn(),
      send: mockSend,
      disconnect: vi.fn(),
    } as any)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(RemoteController, {
      global: { plugins: [router] },
    })

    await wrapper.find('.mirror-btn').trigger('click')
    expect(mockSend).toHaveBeenCalledWith({ type: 'toggleMirror' })
  })

  it('sends reset command', async () => {
    const mockSend = vi.fn()
    vi.mocked(useRemoteClient).mockReturnValue({
      state: ref({ playing: false, speed: 5, fontSize: 48, mirror: false }),
      connected: ref(true),
      connecting: ref(false),
      error: ref(''),
      connect: vi.fn(),
      send: mockSend,
      disconnect: vi.fn(),
    } as any)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(RemoteController, {
      global: { plugins: [router] },
    })

    await wrapper.find('.reset-btn').trigger('click')
    expect(mockSend).toHaveBeenCalledWith({ type: 'reset' })
  })
})
