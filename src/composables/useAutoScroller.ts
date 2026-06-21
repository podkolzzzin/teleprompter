import { computed, shallowRef, type Ref } from 'vue'
import { scrollSpeedToPixelsPerSecond } from '../constants/teleprompter'

interface UseAutoScrollerOptions {
  scrollEl: Ref<HTMLElement | null>
  trackEl: Ref<HTMLElement | null>
  speed: Ref<number>
  playing: Ref<boolean>
  onProgress?: () => void
  onEnd?: () => void
}

export function useAutoScroller({
  scrollEl,
  trackEl,
  speed,
  playing,
  onProgress,
  onEnd,
}: UseAutoScrollerOptions) {
  const scrollOffset = shallowRef(0)
  const animationBaseOffset = shallowRef(0)
  const animationStartOffset = shallowRef(0)
  const animationEndOffset = shallowRef(0)
  const animationDurationMs = shallowRef(0)
  const isAnimating = shallowRef(false)
  let progressTimer: ReturnType<typeof setInterval> | null = null

  const scrollTrackStyle = computed(() => ({
    '--scroll-offset': `${scrollOffset.value}px`,
    '--scroll-start': `${animationStartOffset.value}px`,
    '--scroll-end': `${animationEndOffset.value}px`,
    '--scroll-duration': `${animationDurationMs.value}ms`,
  }))

  function getMaxScrollDistance(): number {
    const container = scrollEl.value
    const track = trackEl.value
    if (!container || !track) return 0
    return Math.max(0, track.scrollHeight - container.clientHeight)
  }

  function clampOffset(offset: number): number {
    return Math.max(0, Math.min(getMaxScrollDistance(), offset))
  }

  function getAnimatedOffset(): number {
    if (!isAnimating.value) {
      const nativeScrollTop = scrollEl.value?.scrollTop
      return typeof nativeScrollTop === 'number' ? clampOffset(nativeScrollTop) : scrollOffset.value
    }

    const track = trackEl.value
    if (!track) return scrollOffset.value

    const transform = getComputedStyle(track).transform
    if (!transform || transform === 'none') return scrollOffset.value
    if (typeof DOMMatrixReadOnly === 'undefined') return scrollOffset.value

    const matrix = new DOMMatrixReadOnly(transform)
    return clampOffset(animationBaseOffset.value - matrix.m42)
  }

  function setScrollOffset(offset: number) {
    scrollOffset.value = clampOffset(offset)
    animationBaseOffset.value = scrollOffset.value
    animationStartOffset.value = scrollOffset.value
    animationEndOffset.value = scrollOffset.value
    animationDurationMs.value = 0
    isAnimating.value = false
    if (scrollEl.value) scrollEl.value.scrollTop = scrollOffset.value
    onProgress?.()
  }

  function syncScrollPosition() {
    const nativeScrollTop = scrollEl.value?.scrollTop
    if (typeof nativeScrollTop === 'number') {
      scrollOffset.value = clampOffset(nativeScrollTop)
      animationBaseOffset.value = scrollOffset.value
      animationStartOffset.value = scrollOffset.value
      animationEndOffset.value = scrollOffset.value
      animationDurationMs.value = 0
      onProgress?.()
      return
    }
    setScrollOffset(getAnimatedOffset())
  }

  function startProgressTimer() {
    stopProgressTimer()
    progressTimer = setInterval(() => {
      scrollOffset.value = getAnimatedOffset()
      onProgress?.()
    }, 250)
  }

  function stopProgressTimer() {
    if (progressTimer !== null) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  }

  function startScroll() {
    const maxScroll = getMaxScrollDistance()
    const currentOffset = clampOffset(getAnimatedOffset())
    const remainingDistance = maxScroll - currentOffset

    if (maxScroll <= 0) {
      playing.value = true
      setScrollOffset(0)
      return
    }

    if (remainingDistance <= 0) {
      playing.value = false
      setScrollOffset(maxScroll)
      return
    }

    const pixelsPerSecond = scrollSpeedToPixelsPerSecond(speed.value)
    if (pixelsPerSecond <= 0) return

    playing.value = true
    scrollOffset.value = currentOffset
    animationBaseOffset.value = currentOffset
    animationStartOffset.value = 0
    animationEndOffset.value = remainingDistance
    animationDurationMs.value = (remainingDistance / pixelsPerSecond) * 1000
    isAnimating.value = false

    requestAnimationFrame(() => {
      if (!playing.value) return
      isAnimating.value = true
      startProgressTimer()
    })
  }

  function pauseScroll() {
    scrollOffset.value = getAnimatedOffset()
    playing.value = false
    isAnimating.value = false
    stopProgressTimer()
    if (scrollEl.value) scrollEl.value.scrollTop = scrollOffset.value
    onProgress?.()
  }

  function stopScroll() {
    playing.value = false
    isAnimating.value = false
    stopProgressTimer()
  }

  function finishScroll() {
    if (!isAnimating.value) return
    scrollOffset.value = animationEndOffset.value
    playing.value = false
    isAnimating.value = false
    stopProgressTimer()
    if (scrollEl.value) scrollEl.value.scrollTop = scrollOffset.value
    onProgress?.()
    onEnd?.()
  }

  return {
    scrollOffset,
    scrollTrackStyle,
    isAnimating,
    getMaxScrollDistance,
    getScrollOffset: getAnimatedOffset,
    setScrollOffset,
    syncScrollPosition,
    startScroll,
    pauseScroll,
    stopScroll,
    finishScroll,
  }
}
