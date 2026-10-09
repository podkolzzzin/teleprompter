import { expect, test } from '@playwright/test'

test('holds the screen wake lock while a script is open, even when paused', async ({ page }) => {
  await page.addInitScript(() => {
    const stats = { requests: 0, releases: 0 }
    ;(window as typeof window & { wakeLockStats: typeof stats }).wakeLockStats = stats
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        async request() {
          stats.requests++
          const sentinel = new EventTarget() as EventTarget & { released: boolean; release: () => Promise<void> }
          sentinel.released = false
          sentinel.release = async () => {
            sentinel.released = true
            stats.releases++
            sentinel.dispatchEvent(new Event('release'))
          }
          return sentinel
        },
      },
    })
  })

  await page.goto('/edit')
  await page.getByLabel('Title').fill('Wake lock test')
  await page.getByLabel('Content (Markdown)').fill('Keep this text visible')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: '▶ Start' }).click()
  await expect(page.locator('.tp-content')).toContainText('Keep this text visible')
  await expect.poll(() => page.evaluate(() => (window as typeof window & { wakeLockStats: { requests: number } }).wakeLockStats.requests)).toBe(1)

  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Pause' }).click()
  expect(await page.evaluate(() => (window as typeof window & { wakeLockStats: { requests: number; releases: number } }).wakeLockStats)).toEqual({ requests: 1, releases: 0 })

  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect.poll(() => page.evaluate(() => (window as typeof window & { wakeLockStats: { releases: number } }).wakeLockStats.releases)).toBe(1)
})
