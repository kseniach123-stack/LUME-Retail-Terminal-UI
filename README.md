# Lume Retail Terminal UI

Web-based internal terminal (POS-like UI) for retail workforce productivity and sales analytics.

The app is designed for **offline-first** usage on tablets: it stores operations locally, shows a **sync status** (`pending` / `synced`), and (in a production version) would synchronize queued events to a server when internet returns.

> Current version note: the project includes a **demo sync** (no real backend). It marks queued items as synced locally when the browser goes online.

## Features

- Responsive interface (desktop/tablet/mobile)
- Dashboard / Operations / Analytics tabs
- Product catalog with autocomplete search and suggestions
- Cart + transaction history (“Operations”)
- **Barcode scanning** using `html5-qrcode`
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

This is a static web app (no build step).

Option A (quick):
- Open `index.html` in Chrome.

Option B (recommended for camera + correct behavior):
- Serve the folder with a local static server (HTTP).
- You can use a VS Code extension like **Live Server**.

VS Code debug config:
- `.vscode/launch.json` expects the app at `http://localhost:8080`.

## Project structure

- `index.html` — layout and UI containers
- `main.css` / `mobile.css` — styling
- `app.js` — app bootstrap + deviceId + (demo) sync logic + state initialization
- `ui.js` — DOM rendering (cart, operations, analytics, user picker, filters)
- `actions.js` — business logic (cart actions, transactions, barcode scanning, etc.)
- `favicon.svg` — simple brand icon

## Developer notes / limitations

- Demo barcode scanning uses the included `html5-qrcode` script from `index.html`.
- Demo “sync” is local-only. For real offline-first:
  - store queued events in IndexedDB
  - sync to a backend API
  - confirm events server-side, then push updates to managers (WebSocket/SSE or polling)

## Reset local data (for testing)

In Chrome dev tools / settings:
- Clear site data for this app’s origin
- This removes:
  - transactions (`lume_vault`)
  - outbox (`lume_outbox_v1`)
  - device id (`lume_device_id_v1`)

