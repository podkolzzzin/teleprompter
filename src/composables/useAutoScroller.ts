import type { Ref } from 'vue'
import { scrollSpeedToPixelsPerSecond } from '../constants/teleprompter'

interface UseAutoScrollerOptions {
  scrollEl: Ref<HTMLElement | null>
  speed: Ref<number>
  playing: Ref<boolean>
  disabled?: Ref<boolean>
  onFrame?: () => void
  onEnd?: () => void
}

export function useAutoScroller({
  scrollEl,
  speed,
  playing,
  disabled,
  onFrame,
  onEnd,
}: UseAutoScrollerOptions) {
  let rafId: number | null = null
  let lastTime: number | null = null
  let virtualScrollTop = 0

  function syncScrollPosition() {
    virtualScrollTop = scrollEl.value?.scrollTop ?? 0
  }

  function stopScroll() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    lastTime = null
  }

  function pauseScroll() {
    playing.value = false
    stopScroll()
  }

  function startScroll() {
    if (playing.value && rafId !== null) return
    playing.value = true
    lastTime = null
    syncScrollPosition()
    rafId = requestAnimationFrame(tick)
  }

  function tick(ts: number) {
    const el = scrollEl.value
    if (!playing.value || !el) {
      stopScroll()
      return
    }

    if (lastTime === null) lastTime = ts
    const delta = Math.min(Math.max(ts - lastTime, 0), 100)
    lastTime = ts

    if (!disabled?.value) {
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight)
      const actualScrollTop = el.scrollTop
      if (Math.abs(actualScrollTop - virtualScrollTop) > 2) {
        virtualScrollTop = actualScrollTop
      }

      virtualScrollTop = Math.min(
        maxScroll,
        virtualScrollTop + (scrollSpeedToPixelsPerSecond(speed.value) * delta) / 1000
      )
      el.scrollTop = virtualScrollTop

      if (virtualScrollTop >= maxScroll - 0.5) {
        playing.value = false
        stopScroll()
        onFrame?.()
        onEnd?.()
        return
      }
    }

    onFrame?.()
    rafId = requestAnimationFrame(tick)
  }

  return {
    startScroll,
    pauseScroll,
    stopScroll,
    syncScrollPosition,
  }
}
