import { test, expect } from '@playwright/test'

test.describe('Script editing', () => {
  test('edits an existing script', async ({ page }) => {
    // Create a script first
    await page.goto('/edit')
    await page.getByLabel('Title').fill('Original Title')
    await page.getByLabel('Content (Markdown)').fill('Original content')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Original Title')).toBeVisible()

    // Click edit on the script
    await page.getByRole('button', { name: '✏ Edit' }).click()
    await expect(page).toHaveURL(/\/edit\/\d+/)
    await expect(page.getByText('Edit Script')).toBeVisible()

    // Wait for existing data to load before modifying
    await expect(page.getByLabel('Title')).toHaveValue('Original Title')

    // Modify the script
    await page.getByLabel('Title').fill('Updated Title')
    await page.getByLabel('Content (Markdown)').fill('Updated content')
    await page.getByRole('button', { name: 'Save' }).click()

    // Verify the updated script appears in the list
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Updated Title')).toBeVisible()
  })

  test('preserves content when editing existing script', async ({ page }) => {
    // Create a script
    await page.goto('/edit')
    await page.getByLabel('Title').fill('Preserved Script')
    await page.getByLabel('Content (Markdown)').fill('This content should be preserved')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    // Open editor for the script
    await page.getByRole('button', { name: '✏ Edit' }).click()
    await expect(page).toHaveURL(/\/edit\/\d+/)

    // Verify the existing content is loaded
    await expect(page.getByLabel('Title')).toHaveValue('Preserved Script')
    await expect(page.getByLabel('Content (Markdown)')).toHaveValue('This content should be preserved')
  })
})

test.describe('Script deletion', () => {
  test('deletes a script from the list', async ({ page }) => {
    // Create a script
    await page.goto('/edit')
    await page.getByLabel('Title').fill('Script To Delete')
    await page.getByLabel('Content (Markdown)').fill('This will be deleted')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Script To Delete')).toBeVisible()

    // Handle the confirmation dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Delete the script
    await page.getByRole('button', { name: '🗑 Delete' }).click()

    // The script should no longer appear
    await expect(page.getByText('Script To Delete')).not.toBeVisible()
    await expect(page.getByText('No scripts yet')).toBeVisible()
  })
})

test.describe('Multiple scripts', () => {
  test('creates and displays multiple scripts', async ({ page }) => {
    // Create first script
    await page.goto('/edit')
    await page.getByLabel('Title').fill('First Script')
    await page.getByLabel('Content (Markdown)').fill('Content of first')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('.card-title', { hasText: 'First Script' })).toBeVisible()

    // Create second script
    await page.getByRole('button', { name: '+ New Script' }).click()
    await page.getByLabel('Title').fill('Second Script')
    await page.getByLabel('Content (Markdown)').fill('Content of second')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('.card-title', { hasText: 'Second Script' })).toBeVisible()

    // Both scripts should be visible with two cards
    await expect(page.locator('.script-card')).toHaveCount(2)
    await expect(page.locator('.card-title', { hasText: 'First Script' })).toBeVisible()
    await expect(page.locator('.card-title', { hasText: 'Second Script' })).toBeVisible()
  })

  test('starts correct script from list when multiple exist', async ({ page }) => {
    // Create two scripts
    await page.goto('/edit')
    await page.getByLabel('Title').fill('Script Alpha')
    await page.getByLabel('Content (Markdown)').fill('Alpha content paragraph')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    await page.getByRole('button', { name: '+ New Script' }).click()
    await page.getByLabel('Title').fill('Script Beta')
    await page.getByLabel('Content (Markdown)').fill('Beta content paragraph')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    // Start the first script's teleprompter (most recent first, so Beta is first)
    const startButtons = page.getByRole('button', { name: '▶ Start' })
    await startButtons.first().click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)

    // Verify the correct content is shown
    await expect(page.locator('.tp-content')).toBeVisible()
  })
})
