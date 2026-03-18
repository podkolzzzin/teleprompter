import { test, expect } from '@playwright/test'

test.describe('Full teleprompter workflow', () => {
  test('end-to-end: create, preview, edit, teleprompter with all controls', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message)
    })

    // ── 1. Empty state ──
    await page.goto('/')
    await expect(page.getByText('No scripts yet')).toBeVisible()
    await expect(page.getByText('Create your first script to get started.')).toBeVisible()

    // ── 2. Create a new script with rich markdown ──
    await page.getByRole('button', { name: '+ New Script' }).click()
    await expect(page).toHaveURL(/\/edit$/)
    await expect(page.getByText('New Script')).toBeVisible()

    const scriptContent =
      '# Act One: Opening\n\n' +
      'Welcome to the **teleprompter** demo. This script exercises every feature.\n\n' +
      '## Scene 1\n\n' +
      'The narrator begins with *italicized* emphasis on the first line.\n\n' +
      '> "To be or not to be, that is the question." — Shakespeare\n\n' +
      '## Scene 2\n\n' +
      'A list of key points:\n\n' +
      '- First important point about the story\n' +
      '- Second critical detail to remember\n' +
      '- Third essential fact for the audience\n' +
      '- Fourth note with **bold emphasis**\n\n' +
      '## Scene 3\n\n' +
      'The middle section continues with additional dialogue and narration.\n\n' +
      'This paragraph provides more scrollable content for the teleprompter.\n\n' +
      '## Scene 4\n\n' +
      'Another paragraph to ensure there is plenty of content to scroll through.\n\n' +
      'The penultimate line approaches as we near the end of the script.\n\n' +
      '## Finale\n\n' +
      'And finally, the closing paragraph brings the demo to a satisfying conclusion.\n\n' +
      '*— End of Script —*'

    await page.getByLabel('Title').fill('Full Demo Script')
    await page.getByLabel('Content (Markdown)').fill(scriptContent)

    // ── 3. Preview markdown rendering ──
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.locator('.preview-body')).toBeVisible()
    await expect(page.locator('.preview-body')).toContainText('Act One: Opening')
    await expect(page.locator('.preview-body')).toContainText('Shakespeare')
    await expect(page.locator('.preview-body')).toContainText('End of Script')

    // Hide preview
    await page.getByRole('button', { name: 'Hide Preview' }).click()
    await expect(page.locator('.preview-body')).not.toBeVisible()

    // ── 4. Save and verify in list ──
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Full Demo Script')).toBeVisible()

    // ── 5. Edit the script to add more content ──
    await page.getByRole('button', { name: '✏ Edit' }).click()
    await expect(page).toHaveURL(/\/edit\/\d+/)
    await expect(page.getByText('Edit Script')).toBeVisible()
    await expect(page.getByLabel('Title')).toHaveValue('Full Demo Script')

    // Update the title
    await page.getByLabel('Title').fill('Full Demo Script (Extended)')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Full Demo Script (Extended)')).toBeVisible()

    // ── 6. Launch teleprompter ──
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.locator('.tp-content')).toContainText('Act One: Opening')

    // ── 7. Adjust speed to faster ──
    await page.locator('.ctrl-group').first().hover()
    const speedSlider = page.getByTitle('Scroll speed')
    await expect(speedSlider).toBeVisible()
    await speedSlider.fill('10')
    await expect(page.locator('.ctrl-group').first().locator('.ctrl-value')).toContainText('10')

    // ── 8. Adjust font size larger ──
    await page.locator('.ctrl-group').nth(1).hover()
    const fontSlider = page.getByTitle('Font size')
    await fontSlider.fill('64')
    await expect(page.locator('.ctrl-group').nth(1).locator('.ctrl-value')).toContainText('64px')

    // ── 9. Start scrolling and watch it progress ──
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()
    await expect(page.locator('.tap-hint')).toContainText('Tap text to pause')

    // Wait for meaningful scroll progress
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 100
    })

    // ── 10. Pause by clicking scroll area ──
    await page.locator('.tp-scroll').click()
    await expect(page.getByTitle('Play')).toBeVisible()

    // ── 11. Toggle mirror mode ──
    await page.getByTitle('Mirror mode (M)').click()
    await expect(page.locator('.tp-root')).toHaveClass(/mirrored/)

    // Resume scrolling in mirrored mode
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()

    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 200
    })

    await page.getByTitle('Pause').click()

    // Disable mirror
    await page.getByTitle('Mirror mode (M)').click()
    await expect(page.locator('.tp-root')).not.toHaveClass(/mirrored/)

    // ── 12. Open frame editor ──
    await page.getByTitle('Edit prompter frame (F)').click()
    await expect(page.locator('.frame-edit-overlay')).toBeVisible()
    await expect(page.locator('.frame-instructions')).toContainText('Drag to move')

    // Close frame editor
    await page.getByTitle('Edit prompter frame (F)').click()
    await expect(page.locator('.frame-edit-overlay')).not.toBeVisible()

    // ── 13. Hide and show controls ──
    await page.getByTitle('Toggle controls').click()
    await expect(page.locator('.tp-root')).toHaveClass(/controls-hidden/)
    await expect(page.locator('.show-controls-btn')).toBeVisible()

    // Show controls again
    await page.locator('.show-controls-btn').click()
    await expect(page.locator('.tp-root')).not.toHaveClass(/controls-hidden/)

    // ── 14. Change speed to slow and font to small, then scroll again ──
    await page.locator('.ctrl-group').first().hover()
    await speedSlider.fill('3')
    await expect(page.locator('.ctrl-group').first().locator('.ctrl-value')).toContainText('3')
    await page.locator('.ctrl-group').nth(1).hover()
    await fontSlider.fill('32')
    await expect(page.locator('.ctrl-group').nth(1).locator('.ctrl-value')).toContainText('32px')

    await page.getByTitle('Play').click()
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 250
    })
    await page.getByTitle('Pause').click()

    // ── 15. Navigate back to home ──
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Full Demo Script (Extended)')).toBeVisible()

    // ── 16. Verify no console errors during the entire workflow ──
    expect(consoleErrors, 'Expected no browser console errors').toEqual([])
  })

  test('multi-script workflow: create two scripts, launch each, delete one', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    // ── 1. Create first script ──
    await page.goto('/')
    await page.getByRole('button', { name: '+ New Script' }).click()
    await page.getByLabel('Title').fill('Morning News Script')
    await page.getByLabel('Content (Markdown)').fill(
      '# Good Morning\n\n' +
        'Welcome to the morning news broadcast.\n\n' +
        '## Top Stories\n\n' +
        'Here are today\'s top stories for our viewers.\n\n' +
        '1. First headline of the day\n' +
        '2. Second breaking story\n' +
        '3. Third developing event\n\n' +
        '## Weather\n\n' +
        'Today\'s forecast: sunny with clouds in the afternoon.\n\n' +
        '*Stay tuned for more updates.*'
    )
    // Preview before saving
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.locator('.preview-body')).toContainText('Good Morning')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    // ── 2. Create second script ──
    await page.getByRole('button', { name: '+ New Script' }).click()
    await page.getByLabel('Title').fill('Evening Show Script')
    await page.getByLabel('Content (Markdown)').fill(
      '# Evening Show\n\n' +
        'Good evening and welcome to tonight\'s program.\n\n' +
        '## Segment One\n\n' +
        'Our first guest discusses the latest trends.\n\n' +
        '> "Innovation is the key to the future."\n\n' +
        '## Segment Two\n\n' +
        'A panel discussion on technology and society.\n\n' +
        '- Point A: The impact of AI\n' +
        '- Point B: Privacy in the digital age\n' +
        '- Point C: The future of work\n\n' +
        '## Closing\n\n' +
        'Thank you for watching. Goodnight!'
    )
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('.script-card')).toHaveCount(2)

    // ── 3. Launch first script teleprompter (most recent is first) ──
    const startButtons = page.getByRole('button', { name: '▶ Start' })
    await startButtons.first().click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.locator('.tp-content')).toContainText('Evening Show')

    // Play with adjusted speed
    await page.locator('.ctrl-group').first().hover()
    await page.getByTitle('Scroll speed').fill('12')
    await page.getByTitle('Play').click()
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 80
    })
    await page.getByTitle('Pause').click()

    // Go back
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')

    // ── 4. Launch second script ──
    await startButtons.nth(1).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.locator('.tp-content')).toContainText('Good Morning')

    // Play with mirror mode
    await page.getByTitle('Mirror mode (M)').click()
    await expect(page.locator('.tp-root')).toHaveClass(/mirrored/)
    await page.getByTitle('Play').click()
    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 60
    })
    await page.getByTitle('Pause').click()
    await page.getByTitle('Mirror mode (M)').click()

    // Go back
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')

    // ── 5. Delete first script ──
    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '🗑 Delete' }).first().click()
    await expect(page.locator('.script-card')).toHaveCount(1)

    // ── 6. Verify remaining script ──
    await expect(page.locator('.card-title', { hasText: 'Morning News Script' })).toBeVisible()

    expect(consoleErrors, 'Expected no browser console errors').toEqual([])
  })
})
