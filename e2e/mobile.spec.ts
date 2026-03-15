import { test, expect } from '@playwright/test'

test.describe('Mobile teleprompter workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Create a script for teleprompter testing
    await page.goto('/edit')
    await page.getByLabel('Title').fill('Mobile Demo Script')
    await page.getByLabel('Content (Markdown)').fill(
      '# Welcome to Mobile\n\n' +
        'This is a **teleprompter** demo for mobile devices.\n\n' +
        'Second paragraph with *italic* text.\n\n' +
        'Third paragraph for scrolling content.\n\n' +
        '> A blockquote for emphasis.\n\n' +
        'Fourth paragraph to ensure enough content.\n\n' +
        'Fifth paragraph for extended scrolling.\n\n' +
        'The final paragraph of the script.'
    )
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Mobile Demo Script')).toBeVisible()
  })

  test('creates script, launches teleprompter, and plays in mobile viewport', async ({ page }) => {
    // Launch teleprompter
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.getByText('Welcome to Mobile')).toBeVisible()

    // Verify controls are visible
    await expect(page.getByTitle('Play')).toBeVisible()
    await expect(page.getByTitle('Back')).toBeVisible()

    // Start playback - video will record the scroll
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()

    // Let it scroll for video capture
    await page.waitForTimeout(2000)

    // Pause
    await page.getByTitle('Pause').click()
    await expect(page.getByTitle('Play')).toBeVisible()

    // Navigate back
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')
  })

  test('adjusts speed control on mobile', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)

    // The speed slider should be accessible
    const speedSlider = page.getByTitle('Scroll speed')
    await expect(speedSlider).toBeVisible()

    // Change speed via keyboard
    await speedSlider.focus()
    await speedSlider.fill('15')

    // Verify the speed value updated
    await expect(page.getByText('15').first()).toBeVisible()
  })

  test('adjusts font size control on mobile', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)

    // The font size slider should be accessible
    const fontSlider = page.getByTitle('Font size')
    await expect(fontSlider).toBeVisible()

    // Change font size
    await fontSlider.focus()
    await fontSlider.fill('72')

    // Verify the size value updated
    await expect(page.getByText('72px')).toBeVisible()
  })

  test('toggles mirror mode on mobile', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)

    // Toggle mirror mode
    const mirrorBtn = page.getByTitle('Mirror mode (M)')
    await expect(mirrorBtn).toBeVisible()
    await mirrorBtn.click()

    // The root element should have the mirrored class
    await expect(page.locator('.tp-root.mirrored')).toBeVisible()

    // Let video capture the mirrored state
    await page.waitForTimeout(1000)

    // Toggle back
    await mirrorBtn.click()
    await expect(page.locator('.tp-root.mirrored')).not.toBeVisible()
  })

  test('hides and shows controls on mobile', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)

    // Controls should be visible initially
    await expect(page.getByTitle('Toggle controls')).toBeVisible()

    // Hide controls
    await page.getByTitle('Toggle controls').click()

    // The gear button to re-show should appear
    await expect(page.locator('.show-controls-btn')).toBeVisible()

    // Show controls again
    await page.locator('.show-controls-btn').click()
    await expect(page.getByTitle('Toggle controls')).toBeVisible()
  })

  test('full workflow: create, preview, save, teleprompter, and back', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    // Start teleprompter from existing script
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)

    // Play and let it scroll for a visible demo
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()
    await page.waitForTimeout(3000)

    // Pause and go back
    await page.getByTitle('Pause').click()
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')

    expect(consoleErrors, 'Expected no browser console errors').toEqual([])
  })
})
