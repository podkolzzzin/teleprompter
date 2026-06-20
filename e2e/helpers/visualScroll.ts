import type { Page } from '@playwright/test'

function visualScrollOffsetScript() {
  const scrollEl = document.querySelector('.tp-scroll') as HTMLElement | null
  const trackEl = document.querySelector('.tp-scroll-track') as HTMLElement | null
  if (!trackEl) return scrollEl?.scrollTop ?? 0

  const transform = getComputedStyle(trackEl).transform
  if (!transform || transform === 'none') {
    const offset = getComputedStyle(trackEl).getPropertyValue('--scroll-offset')
    return Number.parseFloat(offset) || 0
  }

  const matrix = new DOMMatrixReadOnly(transform)
  return Math.max(0, -matrix.m42)
}

export async function getVisualScrollOffset(page: Page): Promise<number> {
  return page.evaluate(visualScrollOffsetScript)
}

export async function waitForVisualScrollOffset(page: Page, minOffset: number): Promise<void> {
  await page.waitForFunction(
    ({ minOffset }) => {
      const scrollEl = document.querySelector('.tp-scroll') as HTMLElement | null
      const trackEl = document.querySelector('.tp-scroll-track') as HTMLElement | null
      if (!trackEl) return (scrollEl?.scrollTop ?? 0) > minOffset

      const transform = getComputedStyle(trackEl).transform
      if (!transform || transform === 'none') {
        const offset = getComputedStyle(trackEl).getPropertyValue('--scroll-offset')
        return (Number.parseFloat(offset) || 0) > minOffset
      }

      const matrix = new DOMMatrixReadOnly(transform)
      return Math.max(0, -matrix.m42) > minOffset
    },
    { minOffset }
  )
}
