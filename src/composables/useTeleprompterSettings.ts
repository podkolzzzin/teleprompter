import { shallowRef, watch } from 'vue'
import { clampScrollSpeed } from '../constants/teleprompter'

const SETTINGS_KEY = 'teleprompter-device-settings'

interface TeleprompterSettings {
  speed: number
  fontSize: number
  mirror: boolean
  focusOpacity: number
  areaWidth: number
  areaOffsetX: number
}

const defaults: TeleprompterSettings = {
  speed: 5,
  fontSize: 48,
  mirror: false,
  focusOpacity: 50,
  areaWidth: 900,
  areaOffsetX: 0,
}

const speed = shallowRef(defaults.speed)
const fontSize = shallowRef(defaults.fontSize)
const mirror = shallowRef(defaults.mirror)
const focusOpacity = shallowRef(defaults.focusOpacity)
const areaWidth = shallowRef(defaults.areaWidth)
const areaOffsetX = shallowRef(defaults.areaOffsetX)

let loaded = false
let persistenceStarted = false
let storageListenerStarted = false
let applyingStoredSettings = false

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, numeric))
}

function normalizeSettings(value: Partial<TeleprompterSettings>): TeleprompterSettings {
  return {
    speed: clampScrollSpeed(value.speed ?? defaults.speed),
    fontSize: clampNumber(value.fontSize, 24, 96, defaults.fontSize),
    mirror: typeof value.mirror === 'boolean' ? value.mirror : defaults.mirror,
    focusOpacity: clampNumber(value.focusOpacity, 0, 100, defaults.focusOpacity),
    areaWidth: clampNumber(value.areaWidth, 240, 2400, defaults.areaWidth),
    areaOffsetX: clampNumber(value.areaOffsetX, -2400, 2400, defaults.areaOffsetX),
  }
}

function readSettings(): TeleprompterSettings {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return defaults
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<TeleprompterSettings>
    return normalizeSettings(parsed)
  } catch {
    return defaults
  }
}

function getCurrentSettings(): TeleprompterSettings {
  return {
    speed: speed.value,
    fontSize: fontSize.value,
    mirror: mirror.value,
    focusOpacity: focusOpacity.value,
    areaWidth: areaWidth.value,
    areaOffsetX: areaOffsetX.value,
  }
}

function persistSettings() {
  if (applyingStoredSettings) return
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(getCurrentSettings()))
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

function applySettings(settings: Partial<TeleprompterSettings>) {
  const normalized = normalizeSettings({ ...getCurrentSettings(), ...settings })
  speed.value = normalized.speed
  fontSize.value = normalized.fontSize
  mirror.value = normalized.mirror
  focusOpacity.value = normalized.focusOpacity
  areaWidth.value = normalized.areaWidth
  areaOffsetX.value = normalized.areaOffsetX
}

function startPersistence() {
  if (persistenceStarted) return
  persistenceStarted = true
  watch([speed, fontSize, mirror, focusOpacity, areaWidth, areaOffsetX], persistSettings)
}

function startStorageListener() {
  if (storageListenerStarted) return
  storageListenerStarted = true
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  window.addEventListener('storage', (event) => {
    if (event.key !== SETTINGS_KEY || event.newValue === null) return
    try {
      applyingStoredSettings = true
      applySettings(JSON.parse(event.newValue) as Partial<TeleprompterSettings>)
    } catch {
      // Ignore malformed cross-tab storage payloads.
    } finally {
      applyingStoredSettings = false
    }
  })
}

function ensureLoaded() {
  if (!loaded) {
    applyingStoredSettings = true
    applySettings(readSettings())
    applyingStoredSettings = false
    loaded = true
  }
  startPersistence()
  startStorageListener()
}

export function useTeleprompterSettings() {
  ensureLoaded()

  return {
    speed,
    fontSize,
    mirror,
    focusOpacity,
    areaWidth,
    areaOffsetX,
    applySettings,
  }
}

export function resetTeleprompterSettingsForTest() {
  applyingStoredSettings = true
  applySettings(defaults)
  applyingStoredSettings = false
  loaded = true
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(SETTINGS_KEY)
    }
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

export const TELEPROMPTER_SETTINGS_KEY = SETTINGS_KEY
export type { TeleprompterSettings }
