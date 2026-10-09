import { expect, test } from '@playwright/test'

test('offline script replay stays deleted across isolated browsers and reloads', async ({ browser }) => {
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  try {
    const first = await firstContext.newPage()
    const second = await secondContext.newPage()
    await Promise.all([first.goto('/'), second.goto('/')])

    const staleScript = {
      uuid: 'offline-sync-test',
      title: 'Offline script',
      content: 'Old copy',
      createdAt: 1,
      updatedAt: 10,
    }

    // Both browsers had the script before one device went offline.
    for (const page of [first, second]) {
      await page.evaluate(async (script) => {
        const db = await import('/src/storage/db.ts')
        await db.upsertSyncedScripts([script])
      }, staleScript)
    }

    const deletion = await first.evaluate(async () => {
      const db = await import('/src/storage/db.ts')
      const [script] = await db.getAllScripts()
      await db.deleteScript(script.id!)
      return db.getDeletedScripts()[0]
    })

    // Replay arrives before the other browser learns about the deletion.
    await first.evaluate(async (script) => {
      const db = await import('/src/storage/db.ts')
      await db.upsertSyncedScripts([script])
    }, staleScript)
    await second.evaluate(async (tombstone) => {
      const db = await import('/src/storage/db.ts')
      await db.deleteScriptsByUuid([tombstone])
    }, deletion)

    await Promise.all([first.reload(), second.reload()])
    for (const page of [first, second]) {
      await expect(page.getByText('Offline script')).not.toBeVisible()
      const state = await page.evaluate(async (script) => {
        const db = await import('/src/storage/db.ts')
        await db.upsertSyncedScripts([script])
        return { scripts: await db.getAllScripts(), deleted: db.getDeletedScripts() }
      }, staleScript)
      expect(state.scripts).toEqual([])
      expect(state.deleted).toEqual([deletion])
    }

    const newerScript = { ...staleScript, title: 'Newer edit', updatedAt: deletion.deletedAt + 1 }
    const state = await first.evaluate(async (script) => {
      const db = await import('/src/storage/db.ts')
      await db.upsertSyncedScripts([script])
      return db.getAllScripts()
    }, newerScript)
    expect(state).toHaveLength(1)
    expect(state[0].title).toBe('Newer edit')
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})
