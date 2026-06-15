export const MIN_SCROLL_SPEED = 1
export const MAX_SCROLL_SPEED = 30
export const SCROLL_SPEED_STEP = 0.2

export function clampScrollSpeed(speed: number): number {
  const clamped = Math.max(MIN_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, speed))
  return Math.round(clamped * 100) / 100
}

export function stepScrollSpeed(speed: number, direction: -1 | 1): number {
  return clampScrollSpeed(speed + SCROLL_SPEED_STEP * direction)
}
