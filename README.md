# 📺 Teleprompter

A Progressive Web App (PWA) teleprompter for reading scripts in the browser. Supports auto-scrolling, adjustable speed and font size, horizontal mirroring, vertical flipping, screen wake lock during playback, remote control, account sync, and offline use.

## Screenshots

| Script List | Script Editor | Teleprompter View |
|:-----------:|:-------------:|:-----------------:|
| ![Script List](https://github.com/user-attachments/assets/03d563dd-1fe0-40d7-b450-b920104ba718) | ![Script Editor](https://github.com/user-attachments/assets/aac36f24-20d1-40fc-b0be-f9a9872699ee) | ![Teleprompter View](https://github.com/user-attachments/assets/88d75c4d-b669-430e-8dd0-6eb49815e368) |

## Features

- 📝 **Markdown Editor** — Create and edit scripts with live preview
- 📺 **Auto-Scroll Display** — Full-screen teleprompter with decimal speed control (1–30, 0.2-step buttons) and font size (24–96 px)
- 🪞 **Mirror Mode** — Horizontal flip for use with physical teleprompter glass
- ↕️ **Vertical Flip** — Flip the script vertically for flexible display setups
- 🔄 **Orientation Control** — Follow device rotation or force portrait/landscape for the full display and controls
- 🔆 **Screen Wake Lock** — Keep supported mobile screens awake during playback
- 🖼️ **Frame Editor** — Drag and resize the content area to fit any physical prompter setup
- 📲 **Remote Control** — Share a link or QR code so a second device can control playback via WebRTC (PeerJS)
- 🔗 **Account Sync** — Pair devices once and keep scripts/settings synchronized automatically
- 🎯 **Focus Gradient** — Top/bottom dimming with a centre highlight line for easier reading
- ⌨️ **Keyboard Shortcuts** — Full keyboard control (see table below)
- 💾 **Local Storage** — All scripts stored in IndexedDB; no server required
- 📱 **Installable PWA** — Works offline and can be added to your home screen

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space** | Play / Pause |
| **↑** / **↓** | Increase / Decrease scroll speed |
| **→** / **←** | Increase / Decrease font size |
| **M** | Toggle mirror mode |
| **H** | Hide / Show controls |
| **F** | Toggle frame editor |
| **R** | Reset scroll to top |
| **Esc** | Exit frame editor or go back |

## Tech Stack

- [Vue 3](https://vuejs.org/) with Composition API + TypeScript
- [Vite 5](https://vitejs.dev/) for fast development and builds
- [vue-router 4](https://router.vuejs.org/) for client-side routing
- [idb](https://github.com/jakearchibald/idb) for IndexedDB access
- [marked](https://marked.js.org/) for Markdown rendering
- [PeerJS](https://peerjs.com/) for WebRTC remote control
- [qrcode](https://github.com/soldair/node-qrcode) for QR code generation
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) for PWA support
- [Playwright](https://playwright.dev/) + [Vitest](https://vitest.dev/) for testing

## Project Structure

```
src/
├── main.ts                        # App bootstrap
├── App.vue                        # Root component (RouterView)
├── assets/main.css                # Design tokens and global styles
├── components/
│   ├── ScriptList.vue             # Home page — browse, start, edit, delete, and pair accounts
│   ├── ScriptEditor.vue           # Markdown editor with live preview
│   ├── TeleprompterView.vue       # Full-screen scrolling display with controls
│   ├── RemoteController.vue       # Remote control UI for a second device
│   ├── ShareModal.vue             # QR code + link sharing modal (remote control)
│   ├── SessionModal.vue           # QR code + link modal for account pairing
│   └── AccountConnector.vue       # Account pairing receiver
├── composables/
│   ├── useRemoteControl.ts        # PeerJS host/client composables for remote control
│   └── useAccountSync.ts          # Automatic script/settings sync between paired devices
├── router/index.ts                # Route definitions (/, /edit/:id?, /teleprompter/:id, /remote/:peerId, /account/:deviceId)
└── storage/db.ts                  # IndexedDB CRUD helpers
e2e/
├── app.spec.ts                    # Basic app, editor, and teleprompter tests
├── script-management.spec.ts      # CRUD: edit, preserve, delete, multi-script
├── workflow.spec.ts               # Full create → edit → teleprompter workflows
├── teleprompter-controls.spec.ts  # Sliders, mirror, frame editor, keyboard shortcuts
├── mobile.spec.ts                 # Mobile-specific viewport tests
└── big-e2e.spec.ts                # Comprehensive E2E: create scripts, play, persist, verify legacy actions are hidden
playwright.config.ts               # Playwright configuration (3 projects, video recording)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

Open <http://localhost:5173> in your browser.

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Testing

Unit tests use [Vitest](https://vitest.dev/) and end-to-end tests use [Playwright](https://playwright.dev/). The dev server is started automatically before E2E tests run. All E2E tests record video (configured in `playwright.config.ts`).

### Install browsers (first time)

```bash
npx playwright install --with-deps chromium
```

### Run unit tests

```bash
npm run test:unit
```

### Run E2E tests

```bash
npm run test:e2e
```

### Run tests with interactive UI

```bash
npm run test:e2e:ui
```

### E2E test suite overview

| Test file | Coverage |
|-----------|----------|
| `app.spec.ts` | Empty state, navigation, editor validation, create script, preview toggle, teleprompter launch, play/pause |
| `script-management.spec.ts` | Edit existing script, preserve content, delete, multi-script display, start correct script |
| `workflow.spec.ts` | Full create → preview → edit → teleprompter workflow with all controls; multi-script launch & delete |
| `teleprompter-controls.spec.ts` | Speed/font sliders, mirror mode, frame editor, controls hide/show, keyboard shortcuts (Space, M, H, F), tap-to-pause, frame drag in mirror mode |
| `mobile.spec.ts` | Mobile viewport: launch, play, speed/font controls, mirror, hide/show, full mobile workflow, multi-script |
| **`big-e2e.spec.ts`** | **Comprehensive E2E with video proof**: create scripts manually, play with settings, verify persistence after close/reopen, and verify legacy import/share/transfer actions stay hidden |

Tests run across 3 Playwright projects: Desktop Chrome, Pixel 7 portrait, and Pixel 7 landscape. The big E2E test runs only on Desktop Chrome.

## AI / MCP Browser Automation

This project ships with the [Playwright MCP](https://github.com/microsoft/playwright-mcp) server so that AI assistants (GitHub Copilot, Claude, etc.) can navigate the app, click buttons, read the DOM, and inspect console logs during development tasks.

### VS Code (GitHub Copilot)

The MCP server is pre-configured in `.vscode/mcp.json`. Open the project in VS Code and the Playwright MCP server will be available to Copilot automatically.

### Manual start (SSE transport)

```bash
npm run mcp        # starts the server on http://localhost:8931
```

Configure your AI client to connect to `http://localhost:8931/sse`.

### What the MCP server can do

- Navigate to any URL
- Click, type, hover, and drag elements
- Read the accessibility tree / DOM snapshot
- Take screenshots
- Read browser console logs
- Handle dialogs
