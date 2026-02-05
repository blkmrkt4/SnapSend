# SnapSend — Implementation Tasks

Reference: `PRD.md` for full requirements. `CLAUDE.md` for project conventions.

## How to Use This File

- Work through tasks **in order** — later tasks depend on earlier ones.
- Mark tasks `[x]` when complete.
- Each task is scoped small enough to complete in a single session without exceeding context limits.
- After completing a task, verify the server starts and the app loads before moving on.

---

## Phase 1: Database Migration (PostgreSQL → SQLite)

- [x] **1.1** Install `better-sqlite3` and `@types/better-sqlite3`. Remove `@neondatabase/serverless`, `connect-pg-simple`.
- [x] **1.2** Rewrite `server/db.ts` — replace Neon pool with `better-sqlite3` opening `data/snapsend.db`. Auto-create the `data/` directory if it doesn't exist. Export a Drizzle instance using the SQLite dialect.
- [x] **1.3** Rewrite `shared/schema.ts` — convert all table definitions from `pgTable` (pg-core) to `sqliteTable` (sqlite-core). Drop the `users` table entirely. Simplify `connections` (remove `connectionKey`, `approvedAt`; rename requester/target to `deviceA`/`deviceB`; default status to `active`). Update all Zod schemas, relations, and TypeScript types.
- [x] **1.4** Rewrite `server/storage.ts` — update all query methods to work with the new SQLite schema. Remove all user-related methods (`createUser`, `getUser`, `getUserByEmail`, `updateUser`, `updateUserPassword`). Update device methods (no `userId` field). Update connection methods (no verification key logic).
- [x] **1.5** Update `drizzle.config.ts` to use the SQLite dialect and point to `data/snapsend.db`.
- [x] **1.6** Verify: server starts, SQLite DB file is created, tables exist.

## Phase 2: Remove Authentication

- [x] **2.1** Delete or gut `server/auth.ts` — remove Passport.js setup, session config, login/register/logout routes, password hashing utilities.
- [x] **2.2** Update `server/routes.ts` — remove all auth-related route registrations (`POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/user`, `PUT /api/user/update`, `PUT /api/user/change-password`). Remove `setupAuth(app)` call. Remove session middleware.
- [x] **2.3** Update `server/index.ts` — remove session middleware setup, remove `seedInitialData()` call if it creates default users, remove any auth-related imports.
- [x] **2.4** Remove `server/seed.ts` if it only seeds user data.
- [x] **2.5** Remove unused packages from `package.json`: `passport`, `passport-local`, `express-session`, `connect-pg-simple`, `memorystore`, `openid-client`. Remove their `@types/*` dev dependencies too.
- [x] **2.6** Verify: server starts with no `DATABASE_URL` env var, no auth errors, WebSocket connects.

## Phase 3: Simplified WebSocket Protocol

- [x] **3.1** Update `server/routes.ts` WebSocket handler — modify `device-setup` to accept `{name}` instead of `{nickname, userId}`. Create device with just a name and socketId.
- [x] **3.2** Add device list broadcast — when a device connects or disconnects, broadcast the full online device list to all connected clients. Include this list in the `setup-complete` response.
- [x] **3.3** Implement `pair-request` message — client sends `{targetDeviceId}`, server creates an active connection immediately (no verification key), sends `pair-accepted` to both devices.
- [x] **3.4** Implement auto-pair — after a device completes setup, if exactly 2 devices are online and not already paired, auto-create a connection and send `auto-paired` to both.
- [x] **3.5** Remove old connection handshake logic — delete `connection-request`/`connection-response`/`submit-verification-key` handlers and the 2-digit key generation code.
- [x] **3.6** Update `shared/schema.ts` WebSocket message type interfaces to reflect the new protocol.
- [x] **3.7** Verify: two browser tabs can connect, see each other, and get paired.

## Phase 4: Frontend — Remove Auth UI

- [x] **4.1** Remove `client/src/pages/auth-page.tsx` and `client/src/pages/landing-page.tsx`.
- [x] **4.2** Remove `client/src/hooks/use-auth.tsx` (the auth context provider).
- [x] **4.3** Remove `client/src/lib/protected-route.tsx`.
- [x] **4.4** Update `client/src/App.tsx` — remove AuthProvider wrapper, remove `/auth` route, make `/` render the main app directly (no protected route).
- [x] **4.5** Remove auth-related API calls from `client/src/lib/queryClient.ts` or wherever login/register mutations exist.
- [x] **4.6** Verify: app loads at `/` with no login prompt, no console errors about missing auth endpoints.

## Phase 5: Frontend — Simplified Device Setup & Pairing

- [x] **5.1** Rewrite `client/src/components/DeviceSetup.tsx` — simple name input (no email/password). Save chosen name to `localStorage` so returning users skip setup. Auto-submit if name exists in `localStorage`.
- [x] **5.2** Rewrite `client/src/hooks/useConnectionSystem.ts` — update to new WebSocket message types (`pair-request`, `pair-accepted`, `auto-paired`). Maintain device list from broadcasts. Remove verification key state and scan/search logic.
- [x] **5.3** Rewrite `client/src/components/ConnectionManager.tsx` — show online devices with a "Pair" button. Show active connections. Remove search input, pending requests, outgoing requests, verification key UI.
- [x] **5.4** Update `client/src/components/Sidebar.tsx` — update nav items (Devices, Files, Settings). Remove user menu / auth references.
- [x] **5.5** Update `client/src/components/SettingsPage.tsx` — remove profile/password sections. Show device name (editable), server IP/port info, and connection status only.
- [x] **5.6** Update `client/src/pages/Home.tsx` — wire up new components, remove auth checks.
- [x] **5.7** Verify: full flow works — open app, enter name, see devices, pair, transfer a file.

## Phase 6: Cleanup & Polish

- [x] **6.1** Remove Replit-specific dev dependencies from `package.json` (`@replit/vite-plugin-cartographer`, `@replit/vite-plugin-runtime-error-modal`). Update `vite.config.ts` to remove these plugins.
- [x] **6.2** Ensure server binds to `0.0.0.0:5000` explicitly in `server/index.ts`.
- [x] **6.3** Auto-create `uploads/` directory on server startup if it doesn't exist.
- [x] **6.4** Auto-create `data/` directory on server startup if it doesn't exist.
- [x] **6.5** Add a startup log that prints the server's local IP addresses so the user knows what URL to open on the other machine (e.g., "SnapSend running at http://192.168.1.50:5000").
- [ ] **6.6** Test end-to-end: start server on machine A, open browser on machine B to the IP, enter device name, pair, send a file, send clipboard, verify received.
- [x] **6.7** Remove any dead imports, unused components, or orphaned files left over from the migration.
