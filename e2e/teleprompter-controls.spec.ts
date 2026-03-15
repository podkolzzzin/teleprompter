import { test, expect } from '@playwright/test'

test.describe('Teleprompter controls', () => {
  test.beforeEach(async ({ page }) => {
    // Create a script with enough content
    await page.goto('/edit')
    await page.getByLabel('Title').fill('Controls Test Script')
    await page.getByLabel('Content (Markdown)').fill(
      '# Heading One\n\n' +
        'Paragraph one of the controls test.\n\n' +
        'Paragraph two with **bold** text.\n\n' +
        'Paragraph three with *italic* text.\n\n' +
        '- List item one\n- List item two\n- List item three\n\n' +
        'Paragraph four for scrolling.\n\n' +
        'Paragraph five for more scroll area.\n\n' +
        'Paragraph six continues.\n\n' +
        'Paragraph seven goes on.\n\n' +
        'Final paragraph of the script.'
    )
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    // Open the teleprompter
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
  })

  test('speed slider changes speed value', async ({ page }) => {
    const speedSlider = page.getByTitle('Scroll speed')
    await expect(speedSlider).toBeVisible()

    // Default speed is 5
    await expect(page.locator('.ctrl-group').first().locator('.ctrl-value')).toContainText('5')

    // Change speed
    await speedSlider.fill('12')
    await expect(page.locator('.ctrl-group').first().locator('.ctrl-value')).toContainText('12')
  })

  test('font size slider changes font size value', async ({ page }) => {
    const fontSlider = page.getByTitle('Font size')
    await expect(fontSlider).toBeVisible()

    // Default font size is 48px
    await expect(page.locator('.ctrl-group').nth(1).locator('.ctrl-value')).toContainText('48px')

    // Change font size
    await fontSlider.fill('72')
    await expect(page.locator('.ctrl-group').nth(1).locator('.ctrl-value')).toContainText('72px')
  })

  test('mirror mode toggles mirrored class', async ({ page }) => {
    const mirrorBtn = page.getByTitle('Mirror mode (M)')
    await expect(mirrorBtn).toBeVisible()

    // Not mirrored initially
    await expect(page.locator('.tp-root')).not.toHaveClass(/mirrored/)

    // Enable mirror
    await mirrorBtn.click()
    await expect(page.locator('.tp-root')).toHaveClass(/mirrored/)

    // Disable mirror
    await mirrorBtn.click()
    await expect(page.locator('.tp-root')).not.toHaveClass(/mirrored/)
  })

  test('frame editor toggles on and off', async ({ page }) => {
    const frameBtn = page.getByTitle('Edit prompter frame (F)')
    await expect(frameBtn).toBeVisible()

    // Frame overlay not visible initially
    await expect(page.locator('.frame-edit-overlay')).not.toBeVisible()

    // Open frame editor
    await frameBtn.click()
    await expect(page.locator('.frame-edit-overlay')).toBeVisible()
    await expect(frameBtn).toHaveClass(/active/)

    // Close frame editor
    await frameBtn.click()
    await expect(page.locator('.frame-edit-overlay')).not.toBeVisible()
  })

  test('controls can be hidden and shown', async ({ page }) => {
    const toggleBtn = page.getByTitle('Toggle controls')
    await expect(toggleBtn).toBeVisible()

    // Hide controls
    await toggleBtn.click()
    await expect(page.locator('.tp-root')).toHaveClass(/controls-hidden/)

    // The gear button should appear
    const showBtn = page.locator('.show-controls-btn')
    await expect(showBtn).toBeVisible()

    // Show controls again
    await showBtn.click()
    await expect(page.locator('.tp-root')).not.toHaveClass(/controls-hidden/)
  })

  test('keyboard shortcut Space toggles play/pause', async ({ page }) => {
    await expect(page.getByTitle('Play')).toBeVisible()

    // Press space to play
    await page.keyboard.press('Space')
    await expect(page.getByTitle('Pause')).toBeVisible()

    // Press space to pause
    await page.keyboard.press('Space')
    await expect(page.getByTitle('Play')).toBeVisible()
  })

  test('keyboard shortcut M toggles mirror', async ({ page }) => {
    await expect(page.locator('.tp-root')).not.toHaveClass(/mirrored/)

    // Press M to enable mirror
    await page.keyboard.press('m')
    await expect(page.locator('.tp-root')).toHaveClass(/mirrored/)

    // Press M to disable mirror
    await page.keyboard.press('m')
    await expect(page.locator('.tp-root')).not.toHaveClass(/mirrored/)
  })

  test('keyboard shortcut H toggles controls visibility', async ({ page }) => {
    await expect(page.locator('.tp-root')).not.toHaveClass(/controls-hidden/)

    // Press H to hide controls
    await page.keyboard.press('h')
    await expect(page.locator('.tp-root')).toHaveClass(/controls-hidden/)

    // Press H to show controls
    await page.keyboard.press('h')
    await expect(page.locator('.tp-root')).not.toHaveClass(/controls-hidden/)
  })

  test('keyboard shortcut F toggles frame editor', async ({ page }) => {
    await expect(page.locator('.frame-edit-overlay')).not.toBeVisible()

    // Press F to open frame editor
    await page.keyboard.press('f')
    await expect(page.locator('.frame-edit-overlay')).toBeVisible()

    // Press F to close frame editor
    await page.keyboard.press('f')
    await expect(page.locator('.frame-edit-overlay')).not.toBeVisible()
  })

  test('tap-to-pause hint shows when playing', async ({ page }) => {
    // Hint not visible when paused
    await expect(page.locator('.tap-hint')).not.toBeVisible()

    // Start playing
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()

    // Tap hint should appear
    await expect(page.locator('.tap-hint')).toBeVisible()
    await expect(page.locator('.tap-hint')).toContainText('Tap text to pause')

    // Pause
    await page.getByTitle('Pause').click()
    await expect(page.locator('.tap-hint')).not.toBeVisible()
  })

  test('clicking scroll area pauses playback', async ({ page }) => {
    // Start playing
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()

    // Click on the scroll area to pause
    await page.locator('.tp-scroll').click()
    await expect(page.getByTitle('Play')).toBeVisible()
  })
})
