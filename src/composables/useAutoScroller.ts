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
    const track = trackEl.value
    if (!track || !isAnimating.value) return scrollOffset.value

    const transform = getComputedStyle(track).transform
    if (!transform || transform === 'none') return scrollOffset.value
    if (typeof DOMMatrixReadOnly === 'undefined') return scrollOffset.value

    const matrix = new DOMMatrixReadOnly(transform)
    return clampOffset(-matrix.m42)
  }

  function setScrollOffset(offset: number) {
    scrollOffset.value = clampOffset(offset)
    animationStartOffset.value = scrollOffset.value
    animationEndOffset.value = scrollOffset.value
    animationDurationMs.value = 0
    isAnimating.value = false
    if (scrollEl.value) scrollEl.value.scrollTop = 0
    onProgress?.()
  }

  function syncScrollPosition() {
    const nativeScrollTop = scrollEl.value?.scrollTop ?? 0
    setScrollOffset(nativeScrollTop > 0 ? nativeScrollTop : getAnimatedOffset())
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
    animationStartOffset.value = currentOffset
    animationEndOffset.value = maxScroll
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
