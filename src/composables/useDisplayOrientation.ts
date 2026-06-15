import { computed, shallowRef } from 'vue'

export type DisplayOrientation = 'auto' | 'portrait' | 'landscape'

const ORIENTATION_KEY = 'teleprompter-display-orientation'
const VALID_ORIENTATIONS: DisplayOrientation[] = ['auto', 'portrait', 'landscape']

function loadOrientation(): DisplayOrientation {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return 'auto'
    const saved = localStorage.getItem(ORIENTATION_KEY)
    return VALID_ORIENTATIONS.includes(saved as DisplayOrientation)
      ? saved as DisplayOrientation
      : 'auto'
  } catch {
    return 'auto'
  }
}

export function useDisplayOrientation() {
  const orientation = shallowRef<DisplayOrientation>(loadOrientation())

  const orientationClass = computed(() => (
    orientation.value === 'auto' ? '' : `orientation-${orientation.value}`
  ))

  function setOrientation(value: DisplayOrientation) {
    orientation.value = value
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem(ORIENTATION_KEY, value)
      }
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  }

  return {
    orientation,
    orientationClass,
    setOrientation,
  }
}
