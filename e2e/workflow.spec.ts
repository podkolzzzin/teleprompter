import { test, expect } from '@playwright/test'

test.describe('Full teleprompter workflow', () => {
  test('creates a script, starts teleprompter, and verifies no console errors', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message)
    })

    // 1. Navigate to home — empty state
    await page.goto('/')
    await expect(page.getByText('No scripts yet')).toBeVisible()

    // 2. Create a new script
    await page.getByRole('button', { name: '+ New Script' }).click()
    await expect(page).toHaveURL(/\/edit$/)

    await page.getByLabel('Title').fill('E2E Demo Script')
    await page.getByLabel('Content (Markdown)').fill(
      '# Welcome\n\nThis is a **teleprompter** demo.\n\n' +
        'Line three of the script.\n\n' +
        'Line four with *italic* text.\n\n' +
        '> A blockquote for emphasis.\n\n' +
        'The final paragraph.'
    )

    // 3. Preview the markdown
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.locator('.preview-body')).toBeVisible()
    await expect(page.locator('.preview-body')).toContainText('Welcome')

    // 4. Save and return to list
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('E2E Demo Script')).toBeVisible()

    // 5. Start the teleprompter
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.getByText('Welcome')).toBeVisible()

    // 6. Play the teleprompter and let it scroll for a moment
    const playBtn = page.getByTitle('Play')
    await expect(playBtn).toBeVisible()
    await playBtn.click()
    await expect(page.getByTitle('Pause')).toBeVisible()

    // Let the teleprompter scroll for 2 seconds (video will capture this)
    await page.waitForTimeout(2000)

    // 7. Pause
    await page.getByTitle('Pause').click()
    await expect(page.getByTitle('Play')).toBeVisible()

    // 8. Navigate back to home
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')

    // 9. Verify no console errors occurred during the entire workflow
    expect(consoleErrors, 'Expected no browser console errors').toEqual([])
  })
})
