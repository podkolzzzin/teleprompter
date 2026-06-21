import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TELEPROMPTER_SETTINGS_KEY, type TeleprompterSettings } from './useTeleprompterSettings'

async function loadSettingsStore() {
  const module = await import('./useTeleprompterSettings')
  return module.useTeleprompterSettings()
}

function readStoredSettings(): TeleprompterSettings {
  return JSON.parse(localStorage.getItem(TELEPROMPTER_SETTINGS_KEY) ?? '{}') as TeleprompterSettings
}

describe('useTeleprompterSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('shares one device-wide settings source between consumers', async () => {
    const first = await loadSettingsStore()
    const second = await loadSettingsStore()

    first.speed.value = 12.5
    first.fontSize.value = 72
    first.mirror.value = true
    first.focusOpacity.value = 80

    expect(second.speed.value).toBe(12.5)
    expect(second.fontSize.value).toBe(72)
    expect(second.mirror.value).toBe(true)
    expect(second.focusOpacity.value).toBe(80)
  })

  it('persists settings for the next page load', async () => {
    const settings = await loadSettingsStore()

    settings.speed.value = 18.25
    settings.fontSize.value = 64
    settings.mirror.value = true
    settings.focusOpacity.value = 75
    settings.areaWidth.value = 720
    settings.areaOffsetX.value = -40
    await nextTick()

    expect(readStoredSettings()).toMatchObject({
      speed: 18.25,
      fontSize: 64,
      mirror: true,
      focusOpacity: 75,
      areaWidth: 720,
      areaOffsetX: -40,
    })

    vi.resetModules()
    const reloaded = await loadSettingsStore()

    expect(reloaded.speed.value).toBe(18.25)
    expect(reloaded.fontSize.value).toBe(64)
    expect(reloaded.mirror.value).toBe(true)
    expect(reloaded.focusOpacity.value).toBe(75)
    expect(reloaded.areaWidth.value).toBe(720)
    expect(reloaded.areaOffsetX.value).toBe(-40)
  })
})
