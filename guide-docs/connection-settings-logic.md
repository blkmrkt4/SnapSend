# Connection Settings — Decision Logic & Data Flow

This document maps every path through the Connection Mode settings UI, what each runtime environment actually does, and where the current logic is confusing or broken.

---

## 1. Runtime Environments

There are four distinct runtime contexts. The settings UI behaves differently in each.

```mermaid
flowchart TD
    START["SnapSend Launched"] --> ENV{"How was it started?"}

    ENV -->|"npm run dev"| BROWSER_DEV["Browser Dev Mode<br/>Express on 0.0.0.0:5000<br/>No electronAPI<br/>isElectronProd = false"]
    ENV -->|"npm run electron:dev"| ELECTRON_DEV["Electron Dev Mode<br/>Express started separately on :5000<br/>electronAPI.isDev = true<br/>isElectronProd = false"]
    ENV -->|"Built .app/.exe"| ELECTRON_PROD["Electron Production<br/>electronAPI.isDev = false<br/>isElectronProd = true"]

    ELECTRON_PROD --> MODE{"getConnectionMode()"}
    MODE -->|"'server' (default)"| SERVER_PROD["Server Mode<br/>Express starts on configuredPort<br/>default 53000, binds 0.0.0.0"]
    MODE -->|"'client' + has URL"| CLIENT_PROD["Client Mode<br/>NO Express server started<br/>BrowserWindow loads remote URL"]
    MODE -->|"'client' + no URL"| FALLBACK["Falls back to Server Mode<br/>Console warning logged"]
```

---

## 2. What the Settings UI Shows in Each Environment

```mermaid
flowchart TD
    SETTINGS["User opens Settings tab"] --> CHECK{"isElectronProd?<br/>(electronAPI && !isDev)"}

    CHECK -->|"false<br/>(Browser dev OR Electron dev)"| MOCK["Uses MOCK data:<br/>portSetting = '53000'<br/>lanAddresses = ['192.168.1.5']<br/>licenseStatus = mock"]
    CHECK -->|"true<br/>(Electron production)"| REAL["Fetches REAL data via IPC:<br/>getPortSetting() → portSetting<br/>getConnectionMode() → mode<br/>getRemoteServerUrl() → url<br/>getLanAddresses() → IPs"]

    MOCK --> RENDER_MOCK["Renders connection card<br/>Save buttons do nothing<br/>(guard: if !isElectronProd return)"]
    REAL --> RENDER_REAL["Renders connection card<br/>Save buttons persist to disk"]
```

---

## 3. Server Mode — Address Display Logic

This is the main source of confusion. What address is shown depends on the runtime.

```mermaid
flowchart TD
    SMODE["Server Mode selected"] --> ECHECK{"window.electronAPI?.isElectron?"}

    ECHECK -->|"Yes (Electron)"| LAN_CHECK{"lanAddresses.length > 0?"}
    ECHECK -->|"No (Browser)"| SHOW_ORIGIN["Shows window.location.origin<br/>e.g. http://localhost:5000"]

    LAN_CHECK -->|"Yes"| SHOW_LAN["Shows each LAN IP:<br/>http://{ip}:{portSetting}<br/>e.g. http://192.168.1.5:53000"]
    LAN_CHECK -->|"No"| SHOW_NONE["Shows: 'No network<br/>addresses detected'"]

    SHOW_ORIGIN --> PROBLEM_1["⚠️ PROBLEM: localhost is<br/>useless for other devices.<br/>Other devices need the<br/>LAN IP, e.g. 192.168.1.5:5000"]

    SHOW_LAN --> NOTE_1["✅ Correct for Electron prod.<br/>But portSetting is the SAVED<br/>value, not necessarily what's<br/>running right now."]

    NOTE_1 --> PROBLEM_2["⚠️ EDGE CASE: If user just<br/>changed port from 53000→54000<br/>and hasn't restarted, UI shows<br/>http://192.168.1.5:54000 but<br/>server is still on :53000"]
```

---

## 4. Port Setting — What Changes and When

```mermaid
sequenceDiagram
    participant User
    participant UI as Settings UI
    participant IPC as Electron IPC
    participant Disk as userData/server-port
    participant Server as Express Server

    Note over Server: Server already running<br/>on port 53000 (from last startup)

    User->>UI: Types "54000" in port field
    Note over UI: portSetting state = "54000"<br/>Address display immediately<br/>updates to show :54000

    User->>UI: Clicks "Save"
    UI->>IPC: setPortSetting(54000)
    IPC->>Disk: Write "54000" to server-port file
    UI->>User: Toast: "will use port 54000 after restart"

    Note over Server: ⚠️ Server is STILL on :53000<br/>Address display says :54000<br/>These don't match until restart

    User->>User: Quits and restarts SnapSend

    Note over Server: main.ts reads server-port file<br/>→ gets 54000<br/>→ starts Express on :54000<br/>Now everything matches
```

---

## 5. The Two-Device Pairing Scenario

This is the primary use case for connection settings: Device A runs as Server, Device B connects as Client.

```mermaid
flowchart TD
    subgraph DeviceA ["Device A — Server Mode (default)"]
        A_START["Electron prod starts"] --> A_SERVER["Express binds to<br/>0.0.0.0:53000"]
        A_SERVER --> A_MDNS["mDNS publishes<br/>_snapsend._tcp on :53000"]
        A_SERVER --> A_SETTINGS["Settings shows:<br/>Your address:<br/>http://192.168.1.5:53000"]
    end

    subgraph DeviceB ["Device B — Client Mode"]
        B_START["User selects Client Mode<br/>in Settings"] --> B_INPUT["Enters: 192.168.1.5:53000<br/>Clicks Save"]
        B_INPUT --> B_RESTART["Restarts SnapSend"]
        B_RESTART --> B_LOAD["Electron loads<br/>http://192.168.1.5:53000<br/>in BrowserWindow"]
        B_LOAD --> B_RENDER["Renders the Server's UI<br/>as if it were local"]
    end

    A_SETTINGS -.->|"User reads IP<br/>from Device A"| B_INPUT

    B_LOAD -->|"HTTP + WebSocket"| A_SERVER
```

---

## 6. All Connection Mode Choices — Decision Tree

```mermaid
flowchart TD
    USER["User on Settings page<br/>(Electron Production)"] --> MODE{"Which mode<br/>do they select?"}

    MODE -->|"Server Mode"| S_EXPANDED["Expanded panel shows:<br/>1. LAN address(es)<br/>2. Port input<br/>3. Save port button"]

    S_EXPANDED --> S_PORT{"Change port?"}
    S_PORT -->|"No"| S_DONE["Keep defaults<br/>Server runs on :53000<br/>mDNS advertises :53000"]
    S_PORT -->|"Yes, e.g. 54000"| S_SAVE_PORT["Save → writes to disk<br/>Toast: restart to apply"]
    S_SAVE_PORT --> S_RESTART["After restart:<br/>Server on :54000<br/>mDNS advertises :54000<br/>Address shows :54000"]

    S_RESTART --> S_TELL["User tells Device B<br/>the new address:<br/>http://192.168.1.x:54000"]

    MODE -->|"Client Mode"| C_EXPANDED["Expanded panel shows:<br/>1. 'Connect to' input<br/>2. Helper text"]

    C_EXPANDED --> C_URL{"Enter remote URL?"}
    C_URL -->|"Yes: 192.168.1.5:53000"| C_SAVE["Save → writes mode + URL<br/>to disk"]
    C_URL -->|"No / empty"| C_BLOCKED["Save button disabled"]

    C_SAVE --> C_RESTART["After restart:<br/>No local server started<br/>BrowserWindow loads<br/>http://192.168.1.5:53000"]
    C_RESTART --> C_WORKS{"Can reach server?"}
    C_WORKS -->|"Yes"| C_OK["Device B sees Device A's<br/>UI and can transfer files"]
    C_WORKS -->|"No"| C_FAIL["White screen / error<br/>No fallback in UI"]

    MODE -->|"Switch mode but<br/>don't click Save"| UNSAVED["⚠️ Mode not persisted<br/>On restart, old mode used<br/>Radio button resets"]

    %% Bottom save button
    S_EXPANDED --> BOTTOM_SAVE["Bottom 'Save' button<br/>saves connection MODE only<br/>(not port — that has its own Save)"]
    C_EXPANDED --> BOTTOM_SAVE
```

---

## 7. Browser Dev Mode — Separate Problem

```mermaid
flowchart TD
    BDEV["npm run dev<br/>(Browser dev mode)"] --> BIND["Express binds to<br/>0.0.0.0:5000"]

    BIND --> LOCAL["Developer opens<br/>http://localhost:5000"]
    BIND --> REMOTE["Other device opens<br/>http://192.168.1.5:5000"]

    LOCAL --> SETTINGS_L["Settings shows:<br/>Your address: http://localhost:5000"]
    REMOTE --> SETTINGS_R["Settings shows:<br/>Your address: http://192.168.1.5:5000"]

    SETTINGS_L --> WRONG["⚠️ Misleading for sharing.<br/>localhost only works on<br/>the same machine.<br/>Should show LAN IP."]
    SETTINGS_R --> RIGHT["✅ Correct — this IS<br/>the address they used."]

    WRONG --> FIX["Possible fix: use the same<br/>os.networkInterfaces() logic<br/>server-side and expose via<br/>an API endpoint for non-Electron"]
```

---

## 8. Port Value Discrepancy — `portSetting` vs Actual Port

The settings UI has a subtle bug: the displayed address uses `portSetting` (the saved-to-disk value), which can differ from the port the server is actually listening on.

```mermaid
flowchart LR
    subgraph "What exists"
        SAVED["portSetting<br/>(from disk file)<br/>Read via getPortSetting IPC"]
        ACTUAL["serverPort<br/>(actual listening port)<br/>Set at startup in main.ts"]
    end

    subgraph "Timeline"
        T1["App starts → reads port file<br/>Both = 53000 ✅"]
        T2["User changes port to 54000,<br/>saves. portSetting = 54000,<br/>serverPort still 53000 ⚠️"]
        T3["User restarts app.<br/>Both = 54000 ✅"]
    end

    SAVED --> DISPLAYED["Used in address display:<br/>http://192.168.1.5:{portSetting}"]
    ACTUAL --> LISTENING["What other devices<br/>actually connect to"]

    T1 --> T2 --> T3
```

---

## 9. Summary of Issues Found

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| 1 | Browser dev mode shows `localhost:5000` as shareable address — other devices can't use localhost | SettingsPage.tsx line 162 | Medium |
| 2 | After changing port but before restart, address display shows new port but server is still on old port | SettingsPage.tsx line 154 | Low |
| 3 | Two separate Save buttons (port vs mode) with unclear scope — user may think one saves everything | SettingsPage.tsx lines 180, 258 | Medium |
| 4 | Client mode with no URL entered: Save is disabled, but if user somehow saved empty URL previously, app falls back to server mode silently | electron/main.ts line 210 | Low |
| 5 | No visual feedback that current port differs from saved port (no "current: X, will change to: Y" display) | SettingsPage.tsx | Low |
