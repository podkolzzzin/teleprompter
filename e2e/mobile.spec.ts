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

    // Wait for scroll to progress (observable state change)
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 0
    })

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
    await page.locator('.ctrl-group').first().hover()
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
    await page.locator('.ctrl-group').nth(1).hover()
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

  test('frame editor boundaries are visible on mobile when opened', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)

    // Open frame editor - on mobile the default 900px width exceeds viewport
    await page.getByTitle('Edit prompter frame (F)').click()
    await expect(page.locator('.frame-edit-overlay')).toBeVisible()

    // The frame box width must be clamped to viewport width so boundaries are visible
    const viewportWidth = page.viewportSize()!.width
    const frameBoxLeft = await page.locator('.frame-box').evaluate((el) => el.getBoundingClientRect().left)
    const frameBoxRight = await page.locator('.frame-box').evaluate((el) => el.getBoundingClientRect().right)

    // Both edges of the frame should be within the viewport
    expect(frameBoxLeft).toBeGreaterThanOrEqual(0)
    expect(frameBoxRight).toBeLessThanOrEqual(viewportWidth)

    // Close frame editor
    await page.getByTitle('Edit prompter frame (F)').click()
    await expect(page.locator('.frame-edit-overlay')).not.toBeVisible()
  })

  test('controls panel stays on a single line on mobile', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)

    // All control buttons should fit on a single line (same top offset)
    const controlsInner = page.locator('.controls-inner')
    const firstButton = controlsInner.locator('.ctrl-btn').first()
    const lastButton = controlsInner.locator('.ctrl-btn').last()

    const firstTop = await firstButton.evaluate((el) => el.getBoundingClientRect().top)
    const lastTop = await lastButton.evaluate((el) => el.getBoundingClientRect().top)

    // All buttons should be on the same row — allow up to 4px tolerance for
    // sub-pixel rendering differences between the first and last button tops
    expect(Math.abs(firstTop - lastTop)).toBeLessThan(4)
  })

  test('full mobile workflow: create, edit, preview, teleprompter with all controls, and navigation', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    // ── 1. Edit the existing script to add richer content ──
    await page.getByRole('button', { name: '✏ Edit' }).click()
    await expect(page).toHaveURL(/\/edit\/\d+/)
    await expect(page.getByLabel('Title')).toHaveValue('Mobile Demo Script')

    const richContent =
      '# Mobile Broadcast\n\n' +
      'Welcome to our **live mobile broadcast**.\n\n' +
      '## Opening Segment\n\n' +
      'The host opens with a warm greeting to the audience.\n\n' +
      '> "Every great story begins with a single word."\n\n' +
      '## Main Topic\n\n' +
      'Today we discuss the following key points:\n\n' +
      '- First point: technology trends\n' +
      '- Second point: mobile innovation\n' +
      '- Third point: future predictions\n' +
      '- Fourth point: audience interaction\n\n' +
      '## Interview Segment\n\n' +
      'Our guest shares insights on *creative storytelling*.\n\n' +
      'The conversation covers multiple aspects of modern communication.\n\n' +
      '## Closing Remarks\n\n' +
      'Thank you for joining us on this mobile broadcast.\n\n' +
      '*— End of Broadcast —*'

    await page.getByLabel('Title').fill('Mobile Broadcast Demo')
    await page.getByLabel('Content (Markdown)').fill(richContent)

    // Preview the markdown
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.locator('.preview-body')).toContainText('Mobile Broadcast')
    await expect(page.locator('.preview-body')).toContainText('great story begins')
    await page.getByRole('button', { name: 'Hide Preview' }).click()

    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Mobile Broadcast Demo')).toBeVisible()

    // ── 2. Launch teleprompter ──
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.locator('.tp-content')).toContainText('Mobile Broadcast')

    // ── 3. Increase speed and font size ──
    await page.locator('.ctrl-group').first().hover()
    await page.getByTitle('Scroll speed').fill('8')
    await expect(page.locator('.ctrl-group').first().locator('.ctrl-value')).toContainText('8')

    await page.locator('.ctrl-group').nth(1).hover()
    await page.getByTitle('Font size').fill('56')
    await expect(page.locator('.ctrl-group').nth(1).locator('.ctrl-value')).toContainText('56px')

    // ── 4. Play and let it scroll ──
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()
    await expect(page.locator('.tap-hint')).toContainText('Tap text to pause')

    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 80
    })

    // Pause by tapping content
    await page.locator('.tp-scroll').click()
    await expect(page.getByTitle('Play')).toBeVisible()

    // ── 5. Enable mirror mode and scroll more ──
    await page.getByTitle('Mirror mode (M)').click()
    await expect(page.locator('.tp-root')).toHaveClass(/mirrored/)

    await page.getByTitle('Play').click()
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 150
    })
    await page.getByTitle('Pause').click()

    // Disable mirror
    await page.getByTitle('Mirror mode (M)').click()
    await expect(page.locator('.tp-root')).not.toHaveClass(/mirrored/)

    // ── 6. Open and close frame editor ──
    await page.getByTitle('Edit prompter frame (F)').click()
    await expect(page.locator('.frame-edit-overlay')).toBeVisible()
    await page.getByTitle('Edit prompter frame (F)').click()
    await expect(page.locator('.frame-edit-overlay')).not.toBeVisible()

    // ── 7. Hide controls, show again ──
    await page.getByTitle('Toggle controls').click()
    await expect(page.locator('.show-controls-btn')).toBeVisible()
    await page.locator('.show-controls-btn').click()
    await expect(page.locator('.tp-root')).not.toHaveClass(/controls-hidden/)

    // ── 8. Change settings again and do final scroll ──
    await page.locator('.ctrl-group').first().hover()
    await page.getByTitle('Scroll speed').fill('15')
    await page.locator('.ctrl-group').nth(1).hover()
    await page.getByTitle('Font size').fill('40')
    await page.getByTitle('Play').click()
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 200
    })
    await page.getByTitle('Pause').click()

    // ── 9. Navigate back ──
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Mobile Broadcast Demo')).toBeVisible()

    expect(consoleErrors, 'Expected no browser console errors').toEqual([])
  })

  test('mobile multi-script workflow: create two scripts and switch between them', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    // ── 1. Create a second script ──
    await page.getByRole('button', { name: '+ New Script' }).click()
    await page.getByLabel('Title').fill('Second Mobile Script')
    await page.getByLabel('Content (Markdown)').fill(
      '# Second Script\n\n' +
        'This is the **second** script for mobile testing.\n\n' +
        '## Part One\n\n' +
        'Content for the second teleprompter session.\n\n' +
        '## Part Two\n\n' +
        'More paragraphs to ensure proper scrolling behavior.\n\n' +
        'Additional lines of text for the second script.\n\n' +
        '*— End —*'
    )
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('.script-card')).toHaveCount(2)

    // ── 2. Launch first script (most recent = Second Mobile Script) ──
    const startBtns = page.getByRole('button', { name: '▶ Start' })
    await startBtns.first().click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.locator('.tp-content')).toContainText('Second Script')

    // Play with fast speed
    await page.locator('.ctrl-group').first().hover()
    await page.getByTitle('Scroll speed').fill('14')
    await page.getByTitle('Play').click()
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 60
    })
    await page.getByTitle('Pause').click()
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')

    // ── 3. Launch second script (Mobile Demo Script) ──
    await startBtns.nth(1).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.locator('.tp-content')).toContainText('Welcome to Mobile')

    // Play with mirror and large font
    await page.locator('.ctrl-group').nth(1).hover()
    await page.getByTitle('Font size').fill('72')
    await page.getByTitle('Mirror mode (M)').click()
    await expect(page.locator('.tp-root')).toHaveClass(/mirrored/)
    await page.getByTitle('Play').click()
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 50
    })
    await page.getByTitle('Pause').click()
    await page.getByTitle('Mirror mode (M)').click()

    // ── 4. Navigate back and delete one script ──
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')

    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '🗑 Delete' }).first().click()
    await expect(page.locator('.script-card')).toHaveCount(1)

    expect(consoleErrors, 'Expected no browser console errors').toEqual([])
  })
})
