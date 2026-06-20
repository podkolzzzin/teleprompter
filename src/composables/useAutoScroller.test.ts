import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useAutoScroller } from './useAutoScroller'

describe('useAutoScroller', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  let rafCallbacks: FrameRequestCallback[] = []

  beforeEach(() => {
    rafCallbacks = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
    vi.restoreAllMocks()
  })

  it('keeps low-speed scrolling smooth by accumulating fractional movement', () => {
    const el = document.createElement('div')
    let roundedScrollTop = 0

    Object.defineProperties(el, {
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: {
        configurable: true,
        get: () => roundedScrollTop,
        set: (value: number) => {
          roundedScrollTop = Math.floor(value)
        },
      },
    })

    const scrollEl = shallowRef<HTMLElement | null>(el)
    const speed = shallowRef(1.2)
    const playing = shallowRef(false)
    const { startScroll } = useAutoScroller({ scrollEl, speed, playing })

    startScroll()

    rafCallbacks.shift()?.(0)
    rafCallbacks.shift()?.(1000 / 60)
    rafCallbacks.shift()?.((1000 / 60) * 2)
    rafCallbacks.shift()?.((1000 / 60) * 3)

    expect(el.scrollTop).toBe(1)
  })
})
