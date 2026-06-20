import { onMounted, onUnmounted, shallowRef, type Ref } from 'vue'

export function useFullscreen(target: Ref<HTMLElement | null>) {
  const isFullscreen = shallowRef(false)

  function syncFullscreenState() {
    isFullscreen.value = document.fullscreenElement === target.value
  }

  async function toggleFullscreen() {
    const el = target.value
    if (!el) return

    if (document.fullscreenElement === el) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen()
    }
  }

  onMounted(() => {
    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', syncFullscreenState)
  })

  return {
    isFullscreen,
    toggleFullscreen,
  }
}
