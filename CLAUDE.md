# CLAUDE.md — SnapSend Project Guide

## Product Requirements

The full product requirements document is at **`PRD.md`** in the project root. Read it before making architectural decisions or adding features. It defines the data model, WebSocket protocol, what was removed from the original cloud version, and what is explicitly out of scope.

## Task Tracker

The implementation checklist is at **`TASKS.md`** in the project root. Before starting work, read it to find the next uncompleted task. Work through tasks in order — later phases depend on earlier ones. Mark tasks `[x]` when complete.

## What This Project Is

SnapSend is a peer-to-peer desktop app for file and clipboard transfer on a local network. Each machine runs its own Electron instance, discovers peers via mDNS, and communicates directly — no central server required. All data stays local.

## Architecture

**Two modes of operation:**

1. **Electron P2P mode (primary):** Each machine runs Electron with an embedded Express server. Peers discover each other via mDNS (`_snapsend._tcp`). Files transfer directly between instances over WebSocket.
2. **Browser mode (legacy/dev):** One machine runs `npm run dev`, others open the URL in a browser. Uses centralized WebSocket pairing. Preserved for development convenience.

- **Desktop runtime:** Electron (BrowserWindow + preload IPC)
- **Frontend:** React 18 + Vite + shadcn/ui + Tailwind CSS + wouter (routing) + TanStack Query
- **Backend:** Express 4 + WebSocket (`ws`) + Drizzle ORM (embedded per-instance)
- **Database:** SQLite via `better-sqlite3`
- **Discovery:** `bonjour-service` (mDNS, `_snapsend._tcp`)
- **P2P transport:** Direct WebSocket connections between Electron instances
- **File storage:** Local `uploads/` directory

## Key Directories

```
electron/              — Electron main process
  main.ts              — Entry point: BrowserWindow, IPC, server startup, discovery
  preload.ts           — Context bridge exposing electronAPI to renderer
  discovery.ts         — mDNS service publish/browse via bonjour-service
  peer-connection.ts   — Outgoing P2P WebSocket connections to peers
  ipc-handlers.ts      — IPC handlers for discovery + P2P + file transfer
  tsconfig.json        — Separate TypeScript config for Electron (CommonJS)
electron-dist/         — Compiled Electron JS (gitignored)
client/src/            — React frontend (renderer process)
  pages/               — Route pages
  components/          — UI components
  hooks/               — Custom React hooks (useConnectionSystem, useFileTransfer)
  types/electron.d.ts  — TypeScript declarations for window.electronAPI
  lib/                 — Utilities
server/                — Express backend (embedded in each Electron instance)
  index.ts             — Server bootstrap: startServer({ port }) exported function
  routes.ts            — REST API + WebSocket handler (local renderer + P2P peers)
  storage.ts           — Database operations (Drizzle + SQLite)
  db.ts                — Database connection setup
shared/
  schema.ts            — Drizzle schema + TypeScript types (shared between client and server)
data/                  — SQLite database file (auto-created; in userData for Electron prod)
uploads/               — Transferred files on disk (auto-created; in userData for Electron prod)
assets/                — App icons for electron-builder (.icns, .ico)
GuideDocs/             — Mermaid architecture documentation (reference only, do not modify)
```

## Database

- **Engine:** SQLite via `better-sqlite3`
- **Location:** `data/snapsend.db` in dev; `{userData}/data/snapsend.db` in Electron production
- **ORM:** Drizzle with SQLite dialect
- **Schema:** `shared/schema.ts`
- **Tables:** `devices`, `connections`, `files`
- `files` table has optional `from_device_name`/`to_device_name` text columns for P2P transfers (where devices don't have integer DB IDs)
- There is NO `users` table. Devices identify themselves by name.

## Dual-Mode Operation

### Electron Mode (P2P)
- `useConnectionSystem` detects `window.electronAPI.isElectron`
- Device list populated from mDNS discovery events via IPC
- Pairing = connecting a direct WebSocket to the peer's Express server
- File transfer = send JSON message over P2P WebSocket
- Device name persisted in Electron `userData` (not localStorage)
- Setup screen skipped — device name auto-loaded from disk

### Browser Mode (Legacy)
- No `window.electronAPI` → standard WebSocket to server at `window.location.host`
- Device list from server broadcasts
- Pairing via `pair-request` / `pair-accepted` WebSocket messages
- File transfer via centralized server relay

## P2P Protocol (Electron ↔ Electron)

```
A → B: { type: "peer-handshake", data: { id, name } }
B → A: { type: "peer-handshake-ack", data: { id, name } }
A → B: { type: "file-transfer", data: { filename, originalName, mimeType, size, content, isClipboard, fromId, fromName } }
B → A: { type: "file-received-ack", data: { filename } }
```

Server-side `routes.ts` distinguishes peer connections (start with `peer-handshake`) from local renderer clients (start with `device-setup`).

## Important Constraints

- **No cloud anything.** No external database, no external API calls, no analytics, no telemetry. All data on local disk.
- **No authentication.** No passwords, no sessions. Device names only.
- **No internet required.** The app must work on an air-gapped LAN.
- **Browser mode binds to `0.0.0.0:5000`** so LAN browsers can connect by IP.
- **Electron mode binds to port 0** (OS-assigned random port). mDNS advertises the port.
- **Zero config startup.** `npm run dev` for browser mode, `npm run electron:dev` for Electron mode — no env vars needed.

## Commands

```bash
npm run dev              # Start dev server (Vite HMR + Express) on port 5000
npm run electron:dev     # Start Vite + Express, then launch Electron window
npm run electron:build   # Build frontend + server + Electron → installer (.dmg/.exe)
npm run electron:compile # Compile electron/ TypeScript only
npm run build            # Build for production (web mode)
npm start                # Run production build (web mode)
npm run check            # TypeScript type check
```

## Code Style

- TypeScript everywhere (strict mode)
- React functional components with hooks
- shadcn/ui components in `client/src/components/ui/`
- Tailwind CSS for styling
- Drizzle ORM for all database operations (no raw SQL unless necessary)
- Zod for validation (shared schemas in `shared/schema.ts`)
- WebSocket messages use `{type: string, data: object}` format
- Electron IPC uses `ipcMain.handle` / `ipcRenderer.invoke` pattern

## When Making Changes

- Always modify `shared/schema.ts` if the data model changes — both client and server import from it
- WebSocket message handling is in `server/routes.ts` (server) and `client/src/hooks/useConnectionSystem.ts` (client)
- For Electron-specific changes: `electron/main.ts` (process lifecycle), `electron/preload.ts` (IPC bridge), `electron/ipc-handlers.ts` (IPC handlers)
- P2P connection logic is in `electron/peer-connection.ts`
- mDNS discovery is in `electron/discovery.ts`
- Client type declarations for `window.electronAPI` are in `client/src/types/electron.d.ts`
- The `GuideDocs/` folder documents the ORIGINAL architecture. It is reference material for understanding the codebase history but does not reflect the current state.
- When you create a new build in a .dmg file iterate the version number. If the last version was 1 then the next version should be 2. The format should be in kebab style SS-Mac-Arm-1.dmg   then the next one would be SS-Mac-Arm-2.dmg assuming the build was for the ARM version.
