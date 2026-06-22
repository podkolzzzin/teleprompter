import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount as baseMount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import TeleprompterView from './TeleprompterView.vue'
import { resetTeleprompterSettingsForTest } from '../composables/useTeleprompterSettings'

// Mock the storage module
vi.mock('../storage/db', () => ({
  getScript: vi.fn(),
  updateScrollProgress: vi.fn(),
}))

// Mock peerjs to avoid network calls in tests
vi.mock('peerjs', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    destroy: vi.fn(),
  })),
}))

// Mock qrcode
vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn(),
  },
}))

import { getScript } from '../storage/db'

const PAGE_STATE_KEY = 'teleprompter-page-state'

const mountedWrappers: VueWrapper[] = []

function mount(...args: Parameters<typeof baseMount>) {
  const wrapper = baseMount(...args)
  mountedWrappers.push(wrapper)
  return wrapper
}

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
  const originalWakeLockDescriptor = Object.getOwnPropertyDescriptor(navigator, 'wakeLock')

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.removeItem(PAGE_STATE_KEY)
    resetTeleprompterSettingsForTest()
    // Mock requestAnimationFrame for scrolling tests
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return window.setTimeout(() => cb(performance.now()), 0)
    })
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount()
    }
    if (originalWakeLockDescriptor) {
      Object.defineProperty(navigator, 'wakeLock', originalWakeLockDescriptor)
    } else {
      Reflect.deleteProperty(navigator, 'wakeLock')
    }
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

  it('keeps the screen awake only while playing', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const release = vi.fn().mockResolvedValue(undefined)
    const sentinel = new EventTarget() as WakeLockSentinel
    Object.defineProperties(sentinel, {
      released: { get: () => false },
      release: { value: release },
      type: { value: 'screen' },
    })
    const request = vi.fn().mockResolvedValue(sentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    })

    vi.mocked(window.requestAnimationFrame).mockImplementation(() => 1)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(TeleprompterView, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.loading').exists()).toBe(false)
    })

    await wrapper.find('.play-btn').trigger('click')
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledWith('screen')
    })

    await wrapper.find('.play-btn').trigger('click')
    await vi.waitFor(() => {
      expect(release).toHaveBeenCalledOnce()
    })

    wrapper.unmount()
  })

  it('adds space before the first line of text', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'First line',
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

    const scrollChildren = wrapper.find('.tp-scroll-track').element.children
    expect(scrollChildren[0]?.classList.contains('tp-start-spacer')).toBe(true)
    expect(scrollChildren[1]?.classList.contains('tp-content')).toBe(true)
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

    await wrapper.find('[title="Mirror mode (M)"]').trigger('click')
    expect(wrapper.find('.tp-root').classes()).toContain('mirrored')

    await wrapper.find('[title="Mirror mode (M)"]').trigger('click')
    expect(wrapper.find('.tp-root').classes()).not.toContain('mirrored')
  })

  it('toggles vertical flip mode', async () => {
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

    const root = wrapper.find('.tp-root')
    const flipButton = wrapper.find('.flip-vertical-btn')

    expect(root.classes()).not.toContain('flipped-vertically')
    expect(flipButton.classes()).not.toContain('active')

    await flipButton.trigger('click')
    expect(root.classes()).toContain('flipped-vertically')
    expect(flipButton.classes()).toContain('active')

    await flipButton.trigger('click')
    expect(root.classes()).not.toContain('flipped-vertically')
  })

  it('combines mirror and vertical flip modes', async () => {
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

    await wrapper.find('[title="Mirror mode (M)"]').trigger('click')
    await wrapper.find('.flip-vertical-btn').trigger('click')

    expect(wrapper.find('.tp-root').classes()).toEqual(
      expect.arrayContaining(['mirrored', 'flipped-vertically'])
    )
  })

  it('forces portrait, landscape, or automatic orientation', async () => {
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

    const root = wrapper.find('.tp-root')
    const trigger = wrapper.find('[title="Screen orientation: Auto"]')

    await trigger.trigger('click')
    await wrapper.findAll('.orientation-option')[1].trigger('click')
    expect(root.classes()).toContain('orientation-portrait')

    await wrapper.find('[title="Screen orientation: Vertical"]').trigger('click')
    await wrapper.findAll('.orientation-option')[2].trigger('click')
    expect(root.classes()).toContain('orientation-landscape')
    expect(root.classes()).not.toContain('orientation-portrait')

    await wrapper.find('[title="Screen orientation: Horizontal"]').trigger('click')
    await wrapper.findAll('.orientation-option')[0].trigger('click')
    expect(root.classes()).not.toContain('orientation-landscape')
    expect(root.classes()).not.toContain('orientation-portrait')
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

  it('renders focus overlay', async () => {
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

    expect(wrapper.find('.focus-overlay').exists()).toBe(true)
  })

  it('renders horizontal lines under headers', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'Test',
      content: '# Heading 1\n## Heading 2\n### Heading 3',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(TeleprompterView, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.tp-content').html()).toContain('<h1')
      expect(wrapper.find('.tp-content').html()).toContain('<h2')
      expect(wrapper.find('.tp-content').html()).toContain('<h3')
    })
  })

  it('toggles frame edit mode via button', async () => {
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

    expect(wrapper.find('.frame-edit-overlay').exists()).toBe(false)

    await wrapper.find('[title="Edit prompter frame (F)"]').trigger('click')
    expect(wrapper.find('.frame-edit-overlay').exists()).toBe(true)
    expect(wrapper.find('[title="Edit prompter frame (F)"]').classes()).toContain('active')

    await wrapper.find('[title="Edit prompter frame (F)"]').trigger('click')
    expect(wrapper.find('.frame-edit-overlay').exists()).toBe(false)
  })

  it('toggles mirror mode via M key', async () => {
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

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.tp-root').classes()).toContain('mirrored')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.tp-root').classes()).not.toContain('mirrored')
  })

  it('toggles controls visibility via H key', async () => {
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

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.tp-root').classes()).toContain('controls-hidden')
  })

  it('toggles frame edit mode via F key', async () => {
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

    expect(wrapper.find('.frame-edit-overlay').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.frame-edit-overlay').exists()).toBe(true)
  })

  it('adjusts font size via ArrowLeft/ArrowRight keys', async () => {
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

    // Default font size is 48px
    const scrollEl = wrapper.find('.tp-scroll')
    expect(scrollEl.attributes('style')).toContain('font-size: 48px')

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }))
    await wrapper.vm.$nextTick()
    expect(scrollEl.attributes('style')).toContain('font-size: 52px')

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }))
    await wrapper.vm.$nextTick()
    expect(scrollEl.attributes('style')).toContain('font-size: 48px')
  })

  it('renders share button in controls', async () => {
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

    const shareBtn = wrapper.find('.share-btn')
    expect(shareBtn.exists()).toBe(true)
    expect(shareBtn.attributes('title')).toBe('Remote control')
  })

  it('renders timeline bar in controls', async () => {
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

    expect(wrapper.find('.tl-bar').exists()).toBe(true)
    expect(wrapper.find('.tl-fill').exists()).toBe(true)
  })

  it('timeline starts at 0%', async () => {
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

    expect(wrapper.find('.tl-elapsed').text()).toBe('0%')
  })

  it('keeps restored text frame inside the viewport', async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

    try {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() {
          return this.classList?.contains('tp-root') ? 360 : 0
        },
      })

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
      await nextTick()

      const contentStyle = wrapper.find('.tp-content').attributes('style')
      expect(contentStyle).toContain('max-width: 360px')
      expect(contentStyle).toContain('margin-left: calc(50% - 180px)')
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
      }
    }
  })

  it('keeps mobile action buttons available while playing', async () => {
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

    expect(wrapper.find('.tp-root').classes()).not.toContain('is-playing')
    await wrapper.find('.play-btn').trigger('click')

    expect(wrapper.find('.tp-root').classes()).toContain('is-playing')
    expect(wrapper.find('.back-btn').exists()).toBe(true)
    expect(wrapper.find('.flip-vertical-btn').exists()).toBe(true)
    expect(wrapper.find('.fullscreen-btn').exists()).toBe(true)
    expect(wrapper.find('.share-btn').exists()).toBe(true)
    expect(wrapper.find('.hide-btn').exists()).toBe(true)
  })

  it('restores latest teleprompter page state after reload', async () => {
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    const originalScrollTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop')
    let scrollTop = 0

    try {
      Object.defineProperties(HTMLElement.prototype, {
        scrollHeight: {
          configurable: true,
          get() {
            return this.classList?.contains('tp-scroll-track') ? 2000 : 0
          },
        },
        clientHeight: {
          configurable: true,
          get() {
            return this.classList?.contains('tp-scroll') ? 500 : 0
          },
        },
        scrollTop: {
          configurable: true,
          get() {
            return scrollTop
          },
          set(value: number) {
            scrollTop = value
          },
        },
      })

      localStorage.setItem(PAGE_STATE_KEY, JSON.stringify({
        scriptId: 1,
        scrollProgress: 0.25,
        playing: true,
        controlsHidden: true,
        flipVertically: true,
        updatedAt: Date.now(),
      }))

      vi.mocked(getScript).mockResolvedValue({
        id: 1,
        title: 'Test',
        content: 'Content',
        createdAt: 1000,
        updatedAt: 1000,
        scrollProgress: 0.1,
      })

      const router = createTestRouter()
      await router.isReady()

      const wrapper = mount(TeleprompterView, {
        global: { plugins: [router] },
      })

      await vi.waitFor(() => {
        expect(wrapper.find('.loading').exists()).toBe(false)
      })
      await vi.waitFor(() => {
        expect(wrapper.find('.play-btn').attributes('title')).toBe('Pause')
      })

      expect(scrollTop).toBe(375)
      expect(wrapper.find('.tl-elapsed').text()).toBe('25%')
      expect(wrapper.find('.tp-root').classes()).toContain('controls-hidden')
      expect(wrapper.find('.tp-root').classes()).toContain('flipped-vertically')
    } finally {
      if (originalScrollHeight) {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight')
      }
      if (originalClientHeight) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
      }
      if (originalScrollTop) {
        Object.defineProperty(HTMLElement.prototype, 'scrollTop', originalScrollTop)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollTop')
      }
    }
  })
})
