import { describe, expect, it } from 'vitest'
import {
  MAX_SCROLL_SPEED,
  MIN_SCROLL_SPEED,
  clampScrollSpeed,
  scrollSpeedToPixelsPerSecond,
  stepScrollSpeed,
} from './teleprompter'

describe('scroll speed helpers', () => {
  it('keeps fractional values within bounds', () => {
    expect(clampScrollSpeed(17.35)).toBe(17.35)
    expect(clampScrollSpeed(0.8)).toBe(MIN_SCROLL_SPEED)
    expect(clampScrollSpeed(30.2)).toBe(MAX_SCROLL_SPEED)
  })

  it('changes speed by 0.05 without floating-point drift', () => {
    expect(stepScrollSpeed(5, 1)).toBe(5.05)
    expect(stepScrollSpeed(5.05, -1)).toBe(5)
    expect(stepScrollSpeed(29.95, 1)).toBe(30)
  })

  it('converts speed to pixels per second through one shared mapping', () => {
    expect(scrollSpeedToPixelsPerSecond(1.25)).toBe(25)
    expect(scrollSpeedToPixelsPerSecond(30.2)).toBe(600)
  })
})
