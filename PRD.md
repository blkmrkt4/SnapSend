# SnapSend — Product Requirements Document

## 1. Product Vision

SnapSend is a **local-network file and clipboard transfer tool** for developers who work across multiple machines. It eliminates the friction of emailing documents, using cloud file shares, or finding workarounds when you need to move a file or clipboard content from one computer to another on the same network.

**Core principle:** All data stays local. No cloud storage, no external servers, no traffic leaving your network.

---

## 2. Target User

A developer working on two machines simultaneously (e.g., a personal Mac and a firm-issued PC) who needs to instantly share files, code snippets, or clipboard content between them without disrupting their workflow.

---

## 3. Core Requirements

### 3.1 Local-Only Architecture

| Requirement | Detail |
|---|---|
| **R-LOCAL-01** | All application data (users, devices, files, transfer history) must be stored locally on the machine running the server. No cloud databases. |
| **R-LOCAL-02** | The database engine must be SQLite, stored as a single file on disk. Replace the current Neon Serverless PostgreSQL dependency entirely. |
| **R-LOCAL-03** | Transferred files are stored in a local `uploads/` directory on the server machine. This behavior already exists and must be preserved. |
| **R-LOCAL-04** | No telemetry, analytics, or external API calls. The application must function with no internet connection. |
| **R-LOCAL-05** | Session storage must use SQLite (not a cloud-backed PostgreSQL session store). |

### 3.2 Network Isolation

| Requirement | Detail |
|---|---|
| **R-NET-01** | The server binds to `0.0.0.0` (all interfaces) so any machine on the local network can connect. |
| **R-NET-02** | All transfers happen over WebSocket between the client browser and the local Express server. No data is routed through any external service. |
| **R-NET-03** | When both machines are on the same LAN (or same VPN), traffic must not egress to the public internet. The server is a local process, not a hosted service. |
| **R-NET-04** | The application must work without DNS. Users connect via the server machine's local IP address (e.g., `http://192.168.1.50:5000`). |

### 3.3 Minimal Friction Transfers

| Requirement | Detail |
|---|---|
| **R-FRIC-01** | Remove mandatory email/password registration. Replace with a simple device name prompt on first use. No accounts needed. |
| **R-FRIC-02** | Remove the 2-digit verbal verification key handshake for connections. On a trusted local network, device pairing should be instant — click to connect, no ceremony. |
| **R-FRIC-03** | Devices on the same server auto-discover each other. When a new device connects via WebSocket, all online devices see it immediately in a device list. No manual search needed. |
| **R-FRIC-04** | If only two devices are online, auto-pair them. No connection request needed. |
| **R-FRIC-05** | Drag-and-drop a file onto the UI to send it instantly to the paired device. This exists today and must be preserved. |
| **R-FRIC-06** | One-click or keyboard shortcut to send clipboard content to the paired device. |
| **R-FRIC-07** | Received files and clipboard content appear immediately on the receiving device with a notification. |

### 3.4 File Transfer

| Requirement | Detail |
|---|---|
| **R-FILE-01** | Support any file type. No file extension restrictions. |
| **R-FILE-02** | Maximum file size: 100MB via WebSocket chunked transfer. For files over 100MB, use HTTP multipart upload as a fallback. |
| **R-FILE-03** | Files are stored on the server's local disk in `uploads/`. Metadata (filename, size, mime type, sender, receiver, timestamp) is stored in SQLite. |
| **R-FILE-04** | Users can preview (images, text), download, and delete transferred files from the File Explorer UI. |
| **R-FILE-05** | Clipboard content (text) is transferred via WebSocket and stored in the SQLite `content` column. No disk file is created for clipboard-only transfers. |

### 3.5 Clipboard Sync

| Requirement | Detail |
|---|---|
| **R-CLIP-01** | A dedicated "Send Clipboard" button sends the current clipboard text to all connected devices. |
| **R-CLIP-02** | On the receiving device, clipboard content is automatically written to the system clipboard (via `navigator.clipboard.writeText`). |
| **R-CLIP-03** | Clipboard transfers show in the notification feed and in the file explorer as clipboard entries. |

---

## 4. Simplified Data Model

### 4.1 Schema Changes (PostgreSQL → SQLite)

**Removed tables:**
- `users` — replaced by a simpler `devices` table with a device name (no email/password)
- `session` — sessions are either SQLite-backed or eliminated entirely (no login = no session needed)

**Retained/modified tables:**

```
devices
  id            INTEGER PRIMARY KEY AUTOINCREMENT
  name          TEXT NOT NULL          -- user-chosen device name
  socket_id     TEXT UNIQUE            -- current WebSocket connection ID (null if offline)
  is_online     INTEGER DEFAULT 0     -- 0 or 1
  last_seen     TEXT                   -- ISO timestamp
  created_at    TEXT DEFAULT (datetime('now'))

connections
  id                    INTEGER PRIMARY KEY AUTOINCREMENT
  device_a_id           INTEGER REFERENCES devices(id) NOT NULL
  device_b_id           INTEGER REFERENCES devices(id) NOT NULL
  status                TEXT NOT NULL DEFAULT 'active'  -- active, terminated
  created_at            TEXT DEFAULT (datetime('now'))
  terminated_at         TEXT

files
  id            INTEGER PRIMARY KEY AUTOINCREMENT
  filename      TEXT NOT NULL           -- storage filename on disk
  original_name TEXT NOT NULL           -- original filename
  mime_type     TEXT NOT NULL
  size          INTEGER NOT NULL        -- bytes
  content       TEXT                    -- clipboard text content (null for files)
  from_device_id INTEGER REFERENCES devices(id)
  to_device_id   INTEGER REFERENCES devices(id)
  connection_id  INTEGER REFERENCES connections(id)
  is_clipboard  INTEGER DEFAULT 0
  transferred_at TEXT DEFAULT (datetime('now'))
```

### 4.2 Removed Concepts
- User accounts (email, password, registration, login)
- Connection verification keys
- Pending/rejected connection states — connections are either active or terminated
- Session table — no auth means no sessions

---

## 5. Simplified User Flow

```
1. Start server on Machine A          (npm run dev)
2. Open browser on Machine B          (http://<machine-a-ip>:5000)
3. Enter a device name                ("Robin's MacBook")
4. See other online devices           (auto-discovered)
5. Click to pair  OR  auto-paired     (if only 2 devices)
6. Drag file → instant transfer       (or click "Send Clipboard")
7. File appears on the other machine  (notification + file explorer)
```

---

## 6. WebSocket Protocol Changes

### 6.1 Removed Messages
- `scan-users` / `scan-results` — replaced by automatic device list broadcast
- `connection-request` / `connection-response` / `submit-verification-key` — replaced by direct pairing
- `connection-request-sent` / `connection-rejected` — no rejection flow needed

### 6.2 Modified Messages

| Message | Direction | Change |
|---|---|---|
| `device-setup` | Client → Server | Now sends only `{name}` (no userId) |
| `setup-complete` | Server → Client | Returns device + list of all online devices |
| `device-connected` | Server → All | Broadcast when any device comes online, includes full device list |
| `device-disconnected` | Server → All | Broadcast when any device goes offline |
| `pair-request` | Client → Server | New: simple `{targetDeviceId}` — no verification key |
| `pair-accepted` | Server → Both | New: immediate confirmation, connection is active |
| `auto-paired` | Server → Both | New: sent when only 2 devices are online and auto-connected |

### 6.3 Retained Messages (unchanged)
- `file-transfer`, `file-received`, `file-sent-confirmation`
- `clipboard-sync`
- `connection-terminated`
- `error`

---

## 7. UI Changes

### 7.1 Removed
- Landing page with pricing plans
- Registration / login forms
- Auth page (`/auth`)
- Verification key input modal
- User profile settings (email, password changes)

### 7.2 Modified
- **Home page** becomes the app — no `/app` route needed, just `/`
- **Device setup** is a simple name input modal on first visit (stored in localStorage for subsequent visits)
- **Connection Manager** becomes a **Device List** showing online devices with a "Pair" button
- **Sidebar** simplified — Devices, Files, and a minimal Settings (device name, server info)

### 7.3 Retained
- File Explorer (browse, preview, download, delete)
- Drag-and-drop file sending
- Clipboard send button
- Notification system
- All shadcn/ui component library usage

---

## 8. Technology Changes

| Component | Current | Target |
|---|---|---|
| Database | Neon Serverless PostgreSQL | SQLite via `better-sqlite3` |
| ORM | Drizzle (pg dialect) | Drizzle (sqlite dialect) |
| Session store | `connect-pg-simple` | Removed (no auth) |
| Auth | Passport.js + scrypt | Removed |
| Server hosting | Replit (cloud) | Local machine (`0.0.0.0:5000`) |
| DB connection | `@neondatabase/serverless` Pool | `better-sqlite3` file handle |

### 8.1 Packages to Remove
- `@neondatabase/serverless`
- `connect-pg-simple`
- `passport`, `passport-local`
- `express-session`
- `openid-client`
- `memorystore`

### 8.2 Packages to Add
- `better-sqlite3`
- `@types/better-sqlite3` (dev)
- `drizzle-orm` (keep, switch to SQLite dialect)

---

## 9. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| **NF-01** | Server must start and be usable within 3 seconds |
| **NF-02** | File transfers up to 10MB should feel instantaneous on a LAN |
| **NF-03** | The application must work on macOS and Windows (Node.js + browser) |
| **NF-04** | Zero configuration — `npm run dev` should work with no environment variables (no DATABASE_URL needed) |
| **NF-05** | SQLite database is created automatically on first run in the project directory |
| **NF-06** | The `uploads/` directory is created automatically if it doesn't exist |

---

## 10. Out of Scope (Future)

These are explicitly **not** part of the current implementation phase:

- End-to-end encryption (LAN traffic is trusted)
- Electron/Tauri desktop wrapper with system tray
- Global hotkeys for clipboard send
- mDNS/Bonjour auto-discovery of the server itself (user provides IP for now)
- Mobile client
- Multi-user authentication (only one "user" operates the network)
- Payment/subscription features
- File versioning/history
- Admin dashboard
