import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import TeleprompterView from './TeleprompterView.vue'

// Mock the storage module
vi.mock('../storage/db', () => ({
  getScript: vi.fn(),
}))

import { getScript } from '../storage/db'

function createTestRouter(id = 1) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/teleprompter/:id', component: TeleprompterView },
    ],
  })
  router.push(`/teleprompter/${id}`)
  return router
}

describe('TeleprompterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock requestAnimationFrame for scrolling tests
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return window.setTimeout(() => cb(performance.now()), 0)
    })
  })

  it('renders script content', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'My Script',
      content: '# Hello World',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(TeleprompterView, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.tp-content').html()).toContain('Hello World')
    })
  })

  it('shows loading state initially', async () => {
    // Delay the getScript resolution
    vi.mocked(getScript).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 100))
    )

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(TeleprompterView, {
      global: { plugins: [router] },
    })

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('starts with play button visible', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(TeleprompterView, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.loading').exists()).toBe(false)
    })

    const playBtn = wrapper.find('.play-btn')
    expect(playBtn.exists()).toBe(true)
    expect(playBtn.attributes('title')).toBe('Play')
  })

  it('toggles mirror mode', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(TeleprompterView, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.loading').exists()).toBe(false)
    })

    expect(wrapper.find('.tp-root').classes()).not.toContain('mirrored')

    await wrapper.find('.mirror-btn').trigger('click')
    expect(wrapper.find('.tp-root').classes()).toContain('mirrored')

    await wrapper.find('.mirror-btn').trigger('click')
    expect(wrapper.find('.tp-root').classes()).not.toContain('mirrored')
  })

  it('toggles controls visibility', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(TeleprompterView, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.loading').exists()).toBe(false)
    })

    expect(wrapper.find('.tp-root').classes()).not.toContain('controls-hidden')

    await wrapper.find('.hide-btn').trigger('click')
    expect(wrapper.find('.tp-root').classes()).toContain('controls-hidden')
  })
})
