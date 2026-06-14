import { onMounted, onUnmounted, watch } from 'vue'
import type { Ref } from 'vue'

export function useWakeLock(active: Readonly<Ref<boolean>>) {
  let wakeLock: WakeLockSentinel | null = null
  let requestPending = false
  let unmounted = false

  async function acquireWakeLock() {
    if (
      !active.value ||
      document.visibilityState !== 'visible' ||
      wakeLock ||
      requestPending ||
      !('wakeLock' in navigator)
    ) {
      return
    }

    requestPending = true

    try {
      const lock = await navigator.wakeLock.request('screen')

      if (!active.value || document.visibilityState !== 'visible' || unmounted) {
        await lock.release()
        return
      }

      wakeLock = lock
      lock.addEventListener('release', handleWakeLockRelease, { once: true })
    } catch {
      // Wake lock support and permission vary by browser and device.
    } finally {
      requestPending = false
    }
  }

  async function releaseWakeLock() {
    const lock = wakeLock
    wakeLock = null

    if (lock && !lock.released) {
      try {
        await lock.release()
      } catch {
        // Playback must continue even if the browser cannot release cleanly.
      }
    }
  }

  function handleWakeLockRelease() {
    wakeLock = null
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      void acquireWakeLock()
    } else {
      void releaseWakeLock()
    }
  }

  watch(active, (isActive) => {
    if (isActive) {
      void acquireWakeLock()
    } else {
      void releaseWakeLock()
    }
  })

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    unmounted = true
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    void releaseWakeLock()
  })
}
