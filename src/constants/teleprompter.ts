export const MIN_SCROLL_SPEED = 1
export const MAX_SCROLL_SPEED = 30

export function clampScrollSpeed(speed: number): number {
  return Math.max(MIN_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, Math.round(speed)))
}
