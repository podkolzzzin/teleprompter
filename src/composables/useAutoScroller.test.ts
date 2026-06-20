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
})
