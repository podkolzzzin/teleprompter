import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'
import { useAutoScroller } from './useAutoScroller'

describe('useAutoScroller', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame
  let rafCallbacks: FrameRequestCallback[] = []

  beforeEach(() => {
    rafCallbacks = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
  })

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame
    vi.restoreAllMocks()
  })

  it('drives scrolling through CSS animation state instead of per-frame scrollTop writes', async () => {
    const container = document.createElement('div')
    const track = document.createElement('div')
    let scrollTopWrites = 0

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 500 },
      scrollTop: {
        configurable: true,
        get: () => 0,
        set: () => {
          scrollTopWrites += 1
        },
      },
    })

    Object.defineProperty(track, 'scrollHeight', {
      configurable: true,
      value: 2000,
    })

    const scrollEl = shallowRef<HTMLElement | null>(container)
    const trackEl = shallowRef<HTMLElement | null>(track)
    const speed = shallowRef(1.2)
    const playing = shallowRef(false)
    const { isAnimating, scrollTrackStyle, startScroll, finishScroll } = useAutoScroller({
      scrollEl,
      trackEl,
      speed,
      playing,
    })

    startScroll()
    rafCallbacks.shift()?.(0)
    await nextTick()

    expect(playing.value).toBe(true)
    expect(isAnimating.value).toBe(true)
    expect(scrollTrackStyle.value['--scroll-start']).toBe('0px')
    expect(scrollTrackStyle.value['--scroll-end']).toBe('1500px')
    expect(scrollTrackStyle.value['--scroll-duration']).toBe('62500ms')
    expect(scrollTopWrites).toBe(0)

    finishScroll()

    expect(playing.value).toBe(false)
    expect(isAnimating.value).toBe(false)
  })

  it('keeps native scroll position usable when setting an idle offset', () => {
    const container = document.createElement('div')
    const track = document.createElement('div')
    let scrollTop = 0

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 500 },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value
        },
      },
    })

    Object.defineProperty(track, 'scrollHeight', {
      configurable: true,
      value: 2000,
    })

    const scrollEl = shallowRef<HTMLElement | null>(container)
    const trackEl = shallowRef<HTMLElement | null>(track)
    const speed = shallowRef(1.2)
    const playing = shallowRef(false)
    const { getScrollOffset, setScrollOffset, syncScrollPosition } = useAutoScroller({
      scrollEl,
      trackEl,
      speed,
      playing,
    })

    setScrollOffset(300)

    expect(container.scrollTop).toBe(300)
    expect(getScrollOffset()).toBe(300)

    container.scrollTop = 420
    syncScrollPosition()

    expect(getScrollOffset()).toBe(420)
  })

  it('pauses at the visual offset without double-counting the native scroll position', async () => {
    const container = document.createElement('div')
    const track = document.createElement('div')
    let scrollTop = 300

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 500 },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value
        },
      },
    })

    Object.defineProperty(track, 'scrollHeight', {
      configurable: true,
      value: 2000,
    })

    class TestDOMMatrixReadOnly {
      m42 = 0

      constructor(transform: string) {
        const values = transform.match(/matrix\((.*)\)/)?.[1]?.split(',').map(Number)
        this.m42 = values?.[5] ?? 0
      }
    }

    vi.stubGlobal('DOMMatrixReadOnly', TestDOMMatrixReadOnly)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transform: 'matrix(1, 0, 0, 1, 0, -120)',
    } as CSSStyleDeclaration)

    const scrollEl = shallowRef<HTMLElement | null>(container)
    const trackEl = shallowRef<HTMLElement | null>(track)
    const speed = shallowRef(1.2)
    const playing = shallowRef(false)
    const { pauseScroll, startScroll } = useAutoScroller({
      scrollEl,
      trackEl,
      speed,
      playing,
    })

    startScroll()
    rafCallbacks.shift()?.(0)
    await nextTick()

    pauseScroll()

    expect(playing.value).toBe(false)
    expect(container.scrollTop).toBe(420)
  })
})
