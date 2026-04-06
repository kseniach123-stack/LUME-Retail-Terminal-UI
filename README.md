# Lume Retail Terminal UI

Web-based internal terminal (POS-like UI) for retail workforce productivity and sales analytics.

The app is designed for **offline-first** usage on tablets: it stores operations locally, shows a **sync status** (`pending` / `synced`), and (in a production version) would synchronize queued events to a server when internet returns.

> Current version note: the project includes a **demo sync** (no real backend). It marks queued items as synced locally when the browser goes online.

## Live demo

**Production URL:** _[after first deploy, paste your link here, e.g. `https://your-app.netlify.app`]_

Replace the line above with the real URL and commit — recruiters get a one-click demo.

**Netlify:** New site from Git → **Build command:** `npm run build` → **Publish directory:** `dist`.  
**Cloudflare Pages:** Connect repo → **Build command:** `npm run build` → **Output directory:** `dist`.

On every push / PR to `main` or `master`, **GitHub Actions** runs `npm run lint` and `npm run test:e2e` (`.github/workflows/ci.yml`).

## Features

- Responsive interface (desktop/tablet/mobile)
- **PWA** (installable app + offline caching of built assets via Workbox)
- In-app **toasts** instead of blocking `alert`
- **Clear cart** confirmation modal (no focus trap; confirm button receives focus when opened)
- Scanner guide frame: **hover-only** on fine pointer; **always visible** on touch / coarse pointer (no hover)
- Dashboard search **filters the product grid** with an empty state + “Clear search”
- **Keyboard**: Arrow Up/Down + Enter in search suggestions
- Dashboard / Operations / Analytics tabs
- Product catalog with autocomplete search and suggestions
- Cart + transaction history (“Operations”)
- **Barcode scanning** using the [`html5-qrcode`](https://github.com/mebjas/html5-qrcode) npm package (camera + decode for barcodes/QR in the browser), bundled by Vite
- Analytics with date-range filters
- Analytics user picker (built from locally stored transactions)
- Offline visibility:
  - transactions are saved immediately
  - items created while offline get `syncStatus: "pending"`

## Offline + “sync status”

Local storage keys used by the current implementation:

- `lume_vault` — stored transactions (sales)
- `lume_outbox_v1` — a demo outbox queue for offline events
- `lume_last_sync_v1` — last “sync” timestamp
- `lume_device_id_v1` — persistent identifier for this tablet device

In the demo version:
- When offline: new transactions are stored with `syncStatus: "pending"` and an entry is added to the outbox.
- When online: the app “flushes” the outbox locally and updates `syncStatus` to `synced`.

## Device scoping (tablet -> its own analytics)

To support scenarios where the app can be deployed across the UK but each tablet must only display data for its own location/counter:

- Each tablet generates and persists a `deviceId` in `localStorage` (`lume_device_id_v1`).
- Every transaction includes `deviceId`.
- Analytics, operations history, and the analytics user picker are filtered by the current tablet `deviceId`.

> In production, a server can resolve `deviceId` to `storeId/counterId` during sync.

## Authentication

Right now authentication is a **UI gate for demo purposes**:
- the username/password inputs are used to set a local “current user” (stored in `localStorage`)
- there is no server-side validation in this version

For a real production rollout with GDPR-compliant handling and email domain validation (e.g. `@charlottetilbury.com`):
- login and password verification must happen on a backend
- issued tokens should allow offline operation until token expiry / reconnect

## How to run

The app uses **[Vite](https://vitejs.dev/)** as the dev server and bundler (ES modules + npm dependencies).

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (default **http://127.0.0.1:5173**). The VS Code **Launch Chrome** config in `.vscode/launch.json` matches that address.

Production build (outputs to `dist/`):

```bash
npm run build
npm run preview
```

> Opening `index.html` directly from disk (`file://`) will not work anymore, because the entry script is a JS module that imports CSS and `html5-qrcode`.

## Environment variables

Copy `.env.example` to `.env` if you need a placeholder for a future API:

- `VITE_API_BASE_URL` — exposed as `import.meta.env.VITE_API_BASE_URL` and `LumeTerminal.config.apiBaseUrl` (no HTTP calls use it in the demo).

## Quality tooling

```bash
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
```

## Testing (E2E)

End-to-end tests use [Playwright](https://playwright.dev/) and start the dev server automatically.

```bash
npx playwright install   # once per machine: browser binaries
npm run test:e2e         # headless
npm run test:e2e:ui      # interactive UI mode
```

What this checks: login flow, add product → cart → checkout → toast, Operations list; search with no matches → empty state → clear search.

**How to test manually:** run `npm run dev`, use the app in the browser (login, search, cart, tabs, scanner if you allow camera). Use DevTools → Application → Storage to inspect `localStorage`. After `npm run build` + `npm run preview`, verify the production bundle and PWA (install prompt / manifest in Application tab).

## Deployment

**What “deploy” means:** you run `npm run build`, then upload the generated **`dist/`** folder to a **hosting service** so the app is available on a real **HTTPS URL** (not `file://` and not only your laptop). Others open that link like any website; PWAs can also be “installed” from supported browsers.

Typical flow:

1. `npm run build`
2. Upload **`dist/`** contents (or connect the Git repo) to a static host, for example:
   - [Netlify](https://www.netlify.com/) — drag-and-drop `dist` or link GitHub; set **publish directory** to `dist`, **build command** `npm run build`.
   - [Cloudflare Pages](https://pages.cloudflare.com/) — same idea: build `npm run build`, output `dist`.
   - [GitHub Pages](https://pages.github.com/) — build in Actions, deploy `dist` to `gh-pages` (may need `base` in `vite.config.js` if the site is not at domain root).

3. Ensure the site is served over **HTTPS** (hosts above do this by default) so camera / PWA features behave consistently.

## Project structure

- `index.html` — layout and UI containers; loads `/src/main.js`
- `vite.config.js` — Vite + PWA plugin
- `src/main.js` — entry: CSS, PWA `registerSW`, `window.LumeTerminal`, `initApp`
- `src/config.js` — `VITE_API_BASE_URL` helper
- `src/toast.js` — non-blocking toast messages
- `src/app.js` — bootstrap + deviceId + (demo) sync logic + state initialization
- `src/ui.js` — DOM rendering (cart, operations, analytics, user picker, filters)
- `src/actions.js` — business logic (cart, transactions, barcode scanning)
- `main.css` / `mobile.css` — styling (imported from `main.js`)
- `public/favicon.svg` — favicon served at `/favicon.svg`
- `e2e/` — Playwright specs
- `.github/workflows/ci.yml` — CI: lint + E2E on push/PR
- `eslint.config.js`, `.prettierrc` — lint/format

## Developer notes / limitations

- Barcode scanning uses **`html5-qrcode`** from npm (same library as before, no CDN).
- **IndexedDB** is **not required** for this demo: `localStorage` is enough for the sample catalog and transactions. Add IndexedDB when you introduce a **real API / sync**, larger payloads, or a structured offline queue—not before.
- Demo “sync” is local-only. For real offline-first with a backend:
  - store queued events in IndexedDB (optional step-up from `localStorage`)
  - sync to a backend API
  - confirm events server-side, then push updates to managers (WebSocket/SSE or polling)

## Reset local data (for testing)

In Chrome dev tools / settings:
- Clear site data for this app’s origin
- This removes:
  - transactions (`lume_vault`)
  - outbox (`lume_outbox_v1`)
  - device id (`lume_device_id_v1`)

