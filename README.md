# teleprompter

A Progressive Web App (PWA) teleprompter for reading scripts in the browser. Supports auto-scrolling, adjustable speed and font size, mirror mode, and offline use.

## Features

- 📝 Create and edit scripts in Markdown with live preview
- 📺 Full-screen auto-scroll display with speed and font-size controls
- 🪞 Mirror mode for use with physical teleprompter glass
- ⌨️ Keyboard shortcuts (Space to play/pause, ↑ / ↓ to adjust speed)
- 💾 Scripts stored locally in IndexedDB — no server required
- 📱 Installable as a PWA (works offline)

## Tech Stack

- [Vue 3](https://vuejs.org/) with Composition API + TypeScript
- [Vite 5](https://vitejs.dev/) for fast development and builds
- [vue-router 4](https://router.vuejs.org/) for client-side routing
- [idb](https://github.com/jakearchibald/idb) for IndexedDB access
- [marked](https://marked.js.org/) for Markdown rendering
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) for PWA support
- [Playwright](https://playwright.dev/) for end-to-end testing

## Project Structure

```
src/
├── main.ts                   # App bootstrap
├── App.vue                   # Root component (RouterView)
├── assets/main.css           # Design tokens and global styles
├── components/
│   ├── ScriptList.vue        # Home page — browse, start, edit, delete scripts
│   ├── ScriptEditor.vue      # Markdown editor with live preview
│   └── TeleprompterView.vue  # Full-screen scrolling display with controls
├── router/index.ts           # Route definitions (/, /edit/:id?, /teleprompter/:id)
└── storage/db.ts             # IndexedDB CRUD helpers
e2e/                          # Playwright end-to-end tests
playwright.config.ts          # Playwright configuration
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

End-to-end tests use [Playwright](https://playwright.dev/). The dev server is started automatically before the tests run.

### Install browsers (first time)

```bash
npx playwright install --with-deps chromium
```

### Run tests

```bash
npm run test:e2e
```

### Run tests with interactive UI

```bash
npm run test:e2e:ui
```

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
