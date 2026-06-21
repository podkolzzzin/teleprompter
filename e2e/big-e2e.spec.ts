import { test, expect, type Page } from '@playwright/test'
import { getVisualScrollOffset, waitForVisualScrollOffset } from './helpers/visualScroll'

/**
 * PeerJS mock module that uses BroadcastChannel for cross-page communication.
 * Replaces the real PeerJS library so remote-control hosting can initialise
 * without an external signaling server.
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
  test('comprehensive: create scripts, play, persist, and hide legacy import/share/transfer actions', async ({ page, context }, testInfo) => {
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

    // ── 3. Create additional scripts manually ───────────────────────────────
    await page.getByRole('button', { name: '+ New Script' }).click()
    await expect(page).toHaveURL(/\/edit$/)
    await page.getByLabel('Title').fill('Second Manual Script')
    await page.getByLabel('Content (Markdown)').fill('# Second Script\n\nAccount sync handles this content automatically.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    await page.getByRole('button', { name: '+ New Script' }).click()
    await expect(page).toHaveURL(/\/edit$/)
    await page.getByLabel('Title').fill('Third Manual Script')
    await page.getByLabel('Content (Markdown)').fill('# Third Script\n\nAnother script for persistence coverage.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/')

    // ── Verify 3 scripts and removed legacy actions ─────────────────────────
    await expect(page.locator('.script-card')).toHaveCount(3)
    await expect(page.getByRole('heading', { name: 'Manual Script', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Second Manual Script', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Third Manual Script', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Import/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Transfer/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Share/ })).toHaveCount(0)
    await expect(page.locator('input[type="file"]')).toHaveCount(0)

    // ── 4. Launch the long manual script & modify settings ──────────────────
    const manualCard = page.locator('.script-card', {
      has: page.getByRole('heading', { name: 'Manual Script', exact: true }),
    })
    await manualCard.getByRole('button', { name: '▶ Start' }).click()
    await expect(page).toHaveURL(/\/teleprompter\/\d+/)
    await expect(page.locator('.tp-content')).toContainText('Act One: The Opening Scene')
    await expect(page.getByTitle('Share this session (S)')).toHaveCount(0)

    // Change speed and font
    await page.locator('.ctrl-group').first().hover()
    await page.locator('#speed-slider').fill('10')
    await expect(page.locator('.ctrl-group').first().locator('.ctrl-value')).toContainText('10')
    await page.locator('.ctrl-group').nth(1).hover()
    await page.locator('#size-slider').fill('64')
    await expect(page.locator('.ctrl-group').nth(1).locator('.ctrl-value')).toContainText('64px')

    // ── 5. Play and let it scroll ───────────────────────────────────────────
    await page.getByTitle('Play').click()
    await expect(page.getByTitle('Pause')).toBeVisible()
    await expect(page.locator('.tap-hint')).toContainText('Tap text to pause')

    await waitForVisualScrollOffset(page, 100)
    // Pause
    await page.locator('.tp-scroll').click()
    await expect(page.getByTitle('Play')).toBeVisible()

    // Record scroll position for later verification
    const hostScrollOffset = await getVisualScrollOffset(page)
    expect(hostScrollOffset).toBeGreaterThan(100)

    // ── 6. Verify script remains in list after playing ──────────────────────
    await page.getByTitle('Back').click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('.script-card')).toHaveCount(3)
    await expect(page.getByRole('heading', { name: 'Manual Script', exact: true })).toBeVisible()

    // ── 7. Close page, reopen, verify persistence ───────────────────────────
    await page.close()
    const freshPage = await context.newPage()
    await setupPeerMock(freshPage)
    await freshPage.goto('/')
    await expect(freshPage.locator('.script-card')).toHaveCount(3)
    await expect(freshPage.getByRole('heading', { name: 'Manual Script', exact: true })).toBeVisible()
    await expect(freshPage.getByRole('heading', { name: 'Second Manual Script', exact: true })).toBeVisible()
    await expect(freshPage.getByRole('heading', { name: 'Third Manual Script', exact: true })).toBeVisible()
    await expect(freshPage.getByRole('button', { name: /Import/ })).toHaveCount(0)
    await expect(freshPage.getByRole('button', { name: /Transfer/ })).toHaveCount(0)
    await expect(freshPage.getByRole('button', { name: /Share/ })).toHaveCount(0)

    // ── 8. Final console-error check ────────────────────────────────────────
    expect(consoleErrors, 'Expected no browser console errors').toEqual([])
  })
})
