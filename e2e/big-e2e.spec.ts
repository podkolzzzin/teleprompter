import { test, expect, type Page } from '@playwright/test'
import path from 'path'

/**
 * PeerJS mock module that uses BroadcastChannel for cross-page communication.
 * Replaces the real PeerJS library so that share/transfer flows work
 * between Playwright pages without an external signaling server.
 */
const PEERJS_MOCK = `
const _bc = new BroadcastChannel('peerjs-e2e-mock');

class MockDataConnection {
  constructor(localId, remoteId) {
    this._localId = localId;
    this._remoteId = remoteId;
    this._handlers = {};
    this.open = false;
    this.reliable = true;
    this._onMsg = (e) => {
      const d = e.data;
      if (d.to === this._localId && d.from === this._remoteId && d.kind === 'data') {
        const h = this._handlers['data'];
        if (h) h(d.payload);
      }
    };
    _bc.addEventListener('message', this._onMsg);
  }
  on(event, handler) { this._handlers[event] = handler; return this; }
  send(data) {
    _bc.postMessage({ kind: 'data', from: this._localId, to: this._remoteId, payload: data });
  }
  close() {
    _bc.removeEventListener('message', this._onMsg);
    this.open = false;
    const h = this._handlers['close']; if (h) h();
  }
}

class Peer {
  constructor(id, opts) {
    this._id = (typeof id === 'string' && id) ? id : ('mock-' + Math.random().toString(36).slice(2, 10));
    this._handlers = {};
    this._destroyed = false;
    this._onSignal = (e) => {
      const d = e.data;
      if (d.kind === 'connect-req' && d.targetId === this._id) {
        const conn = new MockDataConnection(this._id, d.sourceId);
        conn.open = true;
        _bc.postMessage({ kind: 'connect-ack', sourceId: this._id, targetId: d.sourceId, connId: d.connId });
        const h = this._handlers['connection'];
        if (h) {
          h(conn);
          setTimeout(() => { const oh = conn._handlers['open']; if (oh) oh(); }, 20);
        }
      }
    };
    _bc.addEventListener('message', this._onSignal);
    setTimeout(() => {
      if (!this._destroyed) { const h = this._handlers['open']; if (h) h(this._id); }
    }, 50);
  }
  on(event, handler) { this._handlers[event] = handler; return this; }
  connect(targetId, opts) {
    const connId = Math.random().toString(36).slice(2);
    const conn = new MockDataConnection(this._id, targetId);
    _bc.postMessage({ kind: 'connect-req', sourceId: this._id, targetId, connId });
    const ackHandler = (e) => {
      const d = e.data;
      if (d.kind === 'connect-ack' && d.sourceId === targetId && d.targetId === this._id && d.connId === connId) {
        conn.open = true;
        _bc.removeEventListener('message', ackHandler);
        setTimeout(() => { const oh = conn._handlers['open']; if (oh) oh(); }, 20);
      }
    };
    _bc.addEventListener('message', ackHandler);
    return conn;
  }
  destroy() {
    this._destroyed = true;
    _bc.removeEventListener('message', this._onSignal);
  }
}

export default Peer;
export { Peer };
`

/** Set up the PeerJS mock route on a page before it navigates */
async function setupPeerMock(page: Page) {
  await page.route(/\/peerjs[\.\?]/, async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: PEERJS_MOCK,
    })
  })
}

// Long script content that ensures visible scrolling
const longScriptContent =
  '# Act One: The Opening Scene\n\n' +
  'Welcome to our comprehensive **teleprompter** demonstration.\n\n' +
  '## Scene 1: Introduction\n\n' +
  'The narrator begins speaking with clear, measured pace.\n\n' +
  '> "The story of technology is the story of human ambition."\n\n' +
  '## Scene 2: Rising Action\n\n' +
  'Key discussion points for the audience:\n\n' +
  '- First important point about innovation\n' +
  '- Second critical detail about progress\n' +
  '- Third essential observation about change\n' +
  '- Fourth note with **bold emphasis**\n\n' +
  '## Scene 3: The Middle\n\n' +
  'Continuing the narration with additional paragraphs.\n\n' +
  'This section provides substantial scrollable content for testing.\n\n' +
  'More text follows to ensure the teleprompter scrolls visibly.\n\n' +
  '## Scene 4: Building Tension\n\n' +
  'The pace quickens as we approach the climax.\n\n' +
  'Every word matters when reading from a teleprompter.\n\n' +
  'Professional broadcasters rely on this technology daily.\n\n' +
  '## Scene 5: The Climax\n\n' +
  'Here we reach the most important part of the script.\n\n' +
  'The audience is fully engaged and listening intently.\n\n' +
  '## Scene 6: Resolution\n\n' +
  'The narrator winds down with closing thoughts.\n\n' +
  'Reflecting on everything that has been discussed today.\n\n' +
  '## Finale\n\n' +
  'And so we reach the conclusion of our demonstration.\n\n' +
  'Thank you for watching this **teleprompter** test script.\n\n' +
  '*— End of Script —*'

test.describe('Big E2E test with video proof', () => {
  test('comprehensive: create 3 scripts (manual, pdf, docx), play, share session, persist, transfer', async ({ page, context, browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop Chrome only')
    test.setTimeout(120_000)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await setupPeerMock(page)

    // ── 1. Empty state ──────────────────────────────────────────────────────
    await page.goto('/')
    await expect(page.getByText('No scripts yet')).toBeVisible()

    // ── 2. Create manual script (long enough for scrolling) ─────────────────
    await page.getByRole('button', { name: '+ New Script' }).click()
    await expect(page).toHaveURL(/\/edit$/)
    await page.getByLabel('Title').fill('Manual Script')
    await page.getByLabel('Content (Markdown)').fill(longScriptContent)
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.locator('.preview-body')).toContainText('Act One')
    await page.getByRole('button', { name: 'Hide Preview' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Manual Script')).toBeVisible()

    // ── 3. Import PDF script ────────────────────────────────────────────────
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(
      path.resolve(__dirname, 'fixtures/news-broadcast.pdf')
    )
    await expect(page).toHaveURL(/\/edit\/\d+/)
    await expect(page.getByLabel('Title')).toHaveValue('news-broadcast')
    // Rename for clarity
    await page.getByLabel('Title').fill('PDF News Script')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    // ── 4. Import DOCX script ───────────────────────────────────────────────
    await fileInput.setInputFiles(
      path.resolve(__dirname, 'fixtures/presentation-notes.docx')
    )
    await expect(page).toHaveURL(/\/edit\/\d+/)
    await expect(page.getByLabel('Title')).toHaveValue('presentation-notes')
    await page.getByLabel('Title').fill('DOCX Presentation')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    // ── Verify 3 scripts ────────────────────────────────────────────────────
    await expect(page.locator('.script-card')).toHaveCount(3)
    await expect(page.locator('.card-title', { hasText: 'Manual Script' })).toBeVisible()
    await expect(page.locator('.card-title', { hasText: 'PDF News Script' })).toBeVisible()
    await expect(page.locator('.card-title', { hasText: 'DOCX Presentation' })).toBeVisible()

    // ── 5. Launch the long manual script & modify settings ──────────────────
    const manualCard = page.locator('.script-card', { hasText: 'Manual Script' })
    await manualCard.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.locator('.tp-content')).toContainText('Act One: The Opening Scene')

    // Change speed and font
    await page.locator('.ctrl-group').first().hover()
    await page.getByTitle('Scroll speed').fill('10')
    await expect(page.locator('.ctrl-group').first().locator('.ctrl-value')).toContainText('10')
    await page.locator('.ctrl-group').nth(1).hover()
    await page.getByTitle('Font size').fill('64')
    await expect(page.locator('.ctrl-group').nth(1).locator('.ctrl-value')).toContainText('64px')

    // ── 6. Play and let it scroll ───────────────────────────────────────────
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()
    await expect(page.locator('.tap-hint')).toContainText('Tap text to pause')

    await page.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 100
    })
    // Pause
    await page.locator('.tp-scroll').click()
    await expect(page.getByTitle('Play')).toBeVisible()

    // Record scroll position for later verification
    const hostScrollOffset = await page.evaluate(
      () => document.querySelector('.tp-scroll')?.scrollTop ?? 0
    )
    expect(hostScrollOffset).toBeGreaterThan(100)

    // ── 7. Share session to another page ────────────────────────────────────
    await page.getByTitle('Share this session (S)').click()
    await expect(page.locator('.modal-backdrop')).toBeVisible()

    // Wait for the share URL to be populated
    await page.waitForFunction(() => {
      const input = document.querySelector('.url-input') as HTMLInputElement
      return input && input.value && input.value.includes('/share/')
    })
    const shareUrl = await page.locator('.url-input').inputValue()
    expect(shareUrl).toContain('/share/')

    // Host should show waiting status
    await expect(page.locator('.status-banner')).toContainText('Waiting')

    // Open receiver page in the same context (shared BroadcastChannel)
    const receiverPage = await context.newPage()
    await setupPeerMock(receiverPage)
    await receiverPage.goto(shareUrl)

    // Host should transition to connected
    await expect(page.locator('.status-banner')).toContainText('Connected', { timeout: 10_000 })

    // Receiver should get the session content
    await expect(
      receiverPage.locator('.tp-content')
    ).toContainText('Act One: The Opening Scene', { timeout: 10_000 })

    // Verify settings were transferred to receiver
    await expect(
      receiverPage.locator('.ctrl-group').first().locator('.ctrl-value')
    ).toContainText('10')
    await expect(
      receiverPage.locator('.ctrl-group').nth(1).locator('.ctrl-value')
    ).toContainText('64px')

    // Verify scroll offset was transferred (should be close to host's offset)
    const receiverScroll = await receiverPage.evaluate(
      () => document.querySelector('.tp-scroll')?.scrollTop ?? 0
    )
    expect(receiverScroll).toBeGreaterThan(50)

    // Continue playing on receiver and verify it scrolls further
    await receiverPage.getByTitle('Play').click()
    await expect(receiverPage.getByTitle('Pause')).toBeVisible()
    await receiverPage.waitForFunction(() => {
      const el = document.querySelector('.tp-scroll')
      return el && el.scrollTop > 200
    })
    await receiverPage.getByTitle('Pause').click()

    // Close receiver
    await receiverPage.close()

    // Close share modal on host
    await page.locator('.modal-close').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible()

    // ── 8. Verify script remains in list after playing ──────────────────────
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('.script-card')).toHaveCount(3)
    await expect(page.locator('.card-title', { hasText: 'Manual Script' })).toBeVisible()

    // ── 9. Close page, reopen, verify persistence ───────────────────────────
    await page.close()
    const freshPage = await context.newPage()
    await setupPeerMock(freshPage)
    await freshPage.goto('/')
    await expect(freshPage.locator('.script-card')).toHaveCount(3)
    await expect(freshPage.locator('.card-title', { hasText: 'Manual Script' })).toBeVisible()
    await expect(freshPage.locator('.card-title', { hasText: 'PDF News Script' })).toBeVisible()
    await expect(freshPage.locator('.card-title', { hasText: 'DOCX Presentation' })).toBeVisible()

    // ── 10. Transfer all scripts to a new page ──────────────────────────────
    await freshPage.getByRole('button', { name: '📲 Transfer' }).click()
    await expect(freshPage.locator('.modal-backdrop')).toBeVisible()

    // Wait for transfer URL
    await freshPage.waitForFunction(() => {
      const input = document.querySelector('.url-input') as HTMLInputElement
      return input && input.value && input.value.includes('/transfer/')
    })
    const transferUrl = await freshPage.locator('.url-input').inputValue()
    expect(transferUrl).toContain('/transfer/')

    // Open transfer receiver page
    const transferPage = await context.newPage()
    await setupPeerMock(transferPage)
    await transferPage.goto(transferUrl)

    // Host should show connected
    await expect(freshPage.locator('.status-banner')).toContainText('Connected', { timeout: 10_000 })

    // Receiver should show transfer complete
    await expect(transferPage.getByText('Transfer complete!')).toBeVisible({ timeout: 10_000 })
    await expect(transferPage.getByText('3 scripts imported')).toBeVisible()

    // Navigate receiver to home and verify all scripts are present
    await transferPage.getByRole('button', { name: 'View Scripts' }).click()
    await expect(transferPage).toHaveURL('/')
    // Same context → shared IndexedDB, so 3 original + 3 transferred = 6
    await expect(transferPage.locator('.script-card')).toHaveCount(6)

    // Verify all original titles appear (transferred copies have same titles)
    await expect(transferPage.locator('.card-title', { hasText: 'Manual Script' }).first()).toBeVisible()
    await expect(transferPage.locator('.card-title', { hasText: 'PDF News Script' }).first()).toBeVisible()
    await expect(transferPage.locator('.card-title', { hasText: 'DOCX Presentation' }).first()).toBeVisible()

    // Cleanup
    await transferPage.close()
    await freshPage.locator('.modal-close').click()

    // ── 11. Final console-error check ───────────────────────────────────────
    expect(consoleErrors, 'Expected no browser console errors').toEqual([])
  })
})
