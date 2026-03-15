import { test, expect } from '@playwright/test'

test.describe('Script List', () => {
  test('shows empty state when no scripts exist', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('No scripts yet')).toBeVisible()
    await expect(page.getByText('Create your first script to get started.')).toBeVisible()
  })

  test('navigates to new script editor from header button', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '+ New Script' }).click()
    await expect(page).toHaveURL(/\/edit$/)
    await expect(page.getByText('New Script')).toBeVisible()
  })

  test('navigates to new script editor from empty state button', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Script' }).click()
    await expect(page).toHaveURL(/\/edit$/)
  })
})

test.describe('Script Editor', () => {
  test('shows validation error when saving without a title', async ({ page }) => {
    await page.goto('/edit')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Please enter a title.')).toBeVisible()
  })

  test('creates a new script and returns to list', async ({ page }) => {
    await page.goto('/edit')
    await page.getByLabel('Title').fill('My Test Script')
    await page.getByLabel('Content (Markdown)').fill('Hello **world**')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('My Test Script')).toBeVisible()
  })

  test('toggles markdown preview', async ({ page }) => {
    await page.goto('/edit')
    await page.getByLabel('Content (Markdown)').fill('# Heading')
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.getByRole('button', { name: 'Hide Preview' })).toBeVisible()
    await expect(page.locator('.preview-body')).toBeVisible()
  })

  test('navigates back to list without saving', async ({ page }) => {
    await page.goto('/edit')
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Teleprompter View', () => {
  test.beforeEach(async ({ page }) => {
    // Create a script first
    await page.goto('/edit')
    await page.getByLabel('Title').fill('Teleprompter Test')
    await page.getByLabel('Content (Markdown)').fill('Line one\n\nLine two\n\nLine three')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
  })

  test('opens teleprompter from list', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.getByText('Line one')).toBeVisible()
  })

  test('play/pause button toggles scrolling', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    // The play/pause button should be visible in controls
    const playBtn = page.getByTitle('Play')
    await expect(playBtn).toBeVisible()
    await playBtn.click()
    // After clicking play, button title changes to Pause
    await expect(page.getByTitle('Pause')).toBeVisible()
  })
})
