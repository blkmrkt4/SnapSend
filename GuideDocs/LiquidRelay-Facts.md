# Liquid Relay — What It Is, How It Works, and Why It Exists

## What Is Liquid Relay?

Liquid Relay is a desktop app that moves files, clipboard content, and screenshots between computers on the same network. It's a direct tunnel between your machines — no cloud, no internet, no accounts, no sign-ups. You install it, your machines find each other automatically, and you start moving things across.

It runs on macOS (Apple Silicon and Intel) and Windows.

---

## The Problem It Solves

If you work on more than one computer at the same time, you already know the pain:

- You copy something on one machine and need it on the other.
- You take a screenshot on your Mac and need it on your PC.
- You have a file on your personal laptop and need it on your work desktop.
- You pull research from one tool and need to paste it into another tool that only runs on your other machine.
- Your work computer blocks the services you need, but your personal machine right next to it doesn't.

The usual workarounds are terrible:

| Workaround | Why it's bad |
|---|---|
| Email it to yourself | Slow, clunky, pollutes your inbox |
| Upload to Google Drive / Dropbox | Requires internet, goes through the cloud, blocked on many corporate machines |
| USB thumb drive | Requires physically getting up, finding the drive, plugging it in |
| Slack / Teams DM to yourself | Slow, compresses images, requires internet |
| Set up a network share | Requires IT permissions, SMB configuration, firewall rules, and admin access you probably don't have |
| Type it again on the other machine | Wastes time, introduces errors |

Liquid Relay eliminates all of that. Drag a file, paste your clipboard, or take a screenshot — it's on the other machine in under a second.

---

## Why It Exists — Real-World Use Cases

### Corporate firewalls and restricted machines

Many people work on company-issued PCs that block access to tools they rely on. Your work PC might not let you reach Claude, ChatGPT, Evernote, Notion, or dozens of other services. But your personal machine sitting right next to it can.

**Example:** You have notes and research in Evernote on your personal Mac, but you need that information on your work PC to do your job. Normally you'd have to retype it, email it through a personal account, or find some other workaround. With Liquid Relay, you copy the text on your Mac and hit paste — it appears on your work PC instantly. Nothing goes through the internet. Nothing touches the corporate firewall. It's just two machines talking directly to each other over your office Wi-Fi or ethernet.

Liquid Relay doesn't need firewall exceptions because it doesn't use the internet at all. Your IT department can't block what never leaves the local network.

### Working with multiple AI systems

If you use different AI tools on different machines — maybe Claude on your personal laptop and Copilot on your work PC — you constantly need to move prompts, responses, code snippets, or screenshots between them. Liquid Relay lets you grab output from one AI, paste or drag it, and have it on the other machine immediately. No retyping long prompts. No screenshotting and then squinting at the other screen trying to read it.

You can also screenshot the results from one AI tool and send that screenshot directly to the other machine, where you can paste it into a different AI for comparison or further analysis.

### Software development across machines

When you're building software, you constantly need to move things between machines:

- Source files, config files, build artifacts
- Screenshots of bugs or UI states
- Log files and error outputs
- Instructions, prompts, and documentation
- Files you need to feed into AI coding tools

**Example:** To build Liquid Relay itself, development happens across multiple machines. Instead of setting up complex shared drives or pushing every small change through Git, you hand a batch of files and a set of instructions directly to the other machine. What would have required typing everything out on the other side now takes a single drag-and-drop.

### Multi-platform workflows

Designers, video editors, musicians, and other creatives often work across Mac and Windows simultaneously — different tools run better on different platforms. Liquid Relay bridges them without needing to set up network shares, fight with SMB permissions, or go through a cloud service. Drag your assets across at full LAN speed.

### Air-gapped and offline environments

Some workplaces have no internet at all — government facilities, labs, secure offices. Liquid Relay doesn't need internet. It doesn't even try to connect to the internet. If your machines are on the same network — even a simple ethernet cable between two laptops — it works.

---

## Everything It Does

### File Transfer

- **Any file type** — Documents, images, code, archives, spreadsheets, presentations, PDFs, videos, audio — no restrictions on file type or extension.
- **Drag and drop** — Drag one or more files from your desktop or file manager onto the app window. They transfer instantly.
- **File picker** — Click to browse and select files if you prefer.
- **Large file support** — Files up to 100MB transfer normally. Files over 70MB automatically switch to chunked transfer (sent in 1MB pieces) with a progress bar so you can see it happening.
- **Send to one device or all** — Choose a specific device as your target, or broadcast to every connected machine at once.
- **Save locally** — Set the target to "This Device" to save files into your local library without sending them anywhere. Useful for organizing screenshots and clipboard captures.
- **Queue files for offline devices** — If you send to a device that's not connected yet, the files queue up and send automatically the moment that device comes online.
- **Re-share files** — Drag a file you've already received back onto the drop zone to forward it to another device.
- **Open with system app** — Double-click any file to open it with whatever your computer normally uses for that file type (Preview for images, Word for .docx, etc.).

### Clipboard

- **Text clipboard** — Copy text on one machine, hit Cmd+V (or Ctrl+V) in the app, and it appears on the other machine. Works globally — you don't need to click into a specific field first.
- **Image clipboard** — Copy an image (from a browser, a screenshot tool, anything), and Liquid Relay can read it directly from your clipboard and send it as a PNG. No need to save it as a file first.
- **Automatic clipboard write** — When you receive clipboard content, it's automatically written to your system clipboard on the receiving machine. Just Cmd+V/Ctrl+V to paste it wherever you need it.
- **Descriptive filenames** — Clipboard transfers are saved with meaningful names like `meeting-notes-2024-01-15.txt` or `clipboard-image-1920x1080-143022.png` so you can find them later.

### Screenshots

Three capture modes, all built into the app:

1. **Full screen** — Captures your entire display at up to 4K resolution (3840x2160).
2. **Window** — Captures a specific application window.
3. **Select area** — Captures your full screen, then opens a cropping tool where you draw a rectangle around exactly what you want. Only the selected region is sent.

Screenshots transfer immediately after capture. No saving to desktop, no finding the file, no dragging it over. Capture and send in one action.

### File Organization

Everything you send and receive is logged and searchable:

- **Tag system** — Create your own tags (e.g., "project-x", "receipts", "screenshots") and assign them to files. Tags live in a shared vocabulary so you build them once and reuse them. You can add or remove tags on any file, and deleting a tag from the vocabulary removes it from every file that had it.
- **Filter by direction** — Show All, Received only, Sent only, Saved (local), or Pending (queued for offline devices).
- **Filter by type** — Clipboard, Screenshot, Image, PDF, Excel, Word, PowerPoint, Document, or generic File.
- **Search by name** — Type to filter files by filename.
- **Filter by date** — Presets for Today, Yesterday, Last 7 Days, Last 30 Days, This Month, All Time — or pick a custom date range from a calendar.
- **Sort** — By date (newest first), name (alphabetical), or file type.
- **Preview** — Click the eye icon to preview images and text files without downloading them.
- **Rename** — Click any filename to edit it inline. The file extension stays locked so you can't accidentally break it.
- **Download** — Save any file to your computer's download folder.
- **Delete** — Remove files you no longer need. Deletes from both the database and disk.
- **Metadata** — Expanded file details show image dimensions, video/audio duration, PDF page count, and MIME type.

### Networking & Discovery

- **Automatic discovery** — Devices find each other on the network using mDNS (the same technology that lets your printer show up automatically). No IP addresses to type, no configuration needed.
- **macOS Sequoia compatible** — On macOS 15+, Apple restricted the network APIs that most apps use for local discovery. Liquid Relay uses a native workaround (`dns-sd`) that bypasses this restriction, so discovery works reliably even on the latest macOS.
- **Client Mode** — If automatic discovery doesn't work (some corporate networks block mDNS, or you're on different subnets), switch to Client Mode in Settings and type in the other machine's IP address and port. This punches through situations where mDNS can't.
- **LAN address display** — Settings shows all your machine's local IP addresses and the port Liquid Relay is running on, so you can tell someone else exactly where to connect.
- **Configurable port** — Default is 53000, but you can change it in Settings if that port is taken.

### Device Management

- **Enable/disable devices** — Toggle individual devices on or off. Disabled devices won't auto-connect, so you control which machines participate. Disabling a device disconnects it immediately; re-enabling reconnects it.
- **Device persistence** — The app remembers devices it's seen before across sessions. Even if a device is offline, it shows up in your list (grayed out) so you can queue files for it.
- **Rename your device** — Change your device name anytime from Settings or the device panel. It updates everywhere.

### Window & Interface

- **Always on top** — Pin the window above other applications so it's always accessible while you work. Toggle in Settings, persisted across restarts.
- **Compact size** — The window can shrink down to 320x400 pixels, small enough to tuck into a corner of your screen.
- **macOS native title bar** — On Mac, the title bar uses the native inset style with the traffic light buttons, so it feels like a proper Mac app.
- **Connection status** — A persistent indicator shows how many devices are connected and whether you're online.
- **Chunked transfer progress** — When sending or receiving large files, a progress bar shows the percentage and filename.
- **Recently sent** — Quick reference showing the last 3 files you sent.
- **Notification toasts** — Descriptive pop-ups when files arrive ("Screenshot received from Robin's MacBook", "Word document received").

### Licensing

- **LemonSqueezy integration** — Activate with a license key purchased from the Liquid Relay store.
- **Encrypted storage** — Your license key is encrypted on disk using Electron's secure storage API.
- **Periodic validation** — The license re-validates every 7 days. If your machine is offline when validation is due, a grace period prevents the app from locking you out.
- **Deactivation** — You can deactivate a license to free up the seat and move it to a different machine.

---

## How It Works (Non-Technical)

### 1. Install and launch

Install Liquid Relay on each machine you want to connect. When you launch it, it automatically announces itself on your local network — like raising a flag that says "I'm here."

### 2. Automatic discovery

Every running copy of Liquid Relay listens for those announcements. Within seconds, your devices see each other and appear in a list. No IP addresses to type, no configuration, no server to set up.

If discovery doesn't work on your network (some corporate networks block the broadcast protocol), switch to Client Mode in Settings and type in the other machine's address directly.

### 3. Connect

Click on a device in the list to connect. A direct link is established between the two machines. No passwords, no verification codes, no approval workflows. If only two devices are online, they auto-pair — you don't even have to click.

### 4. Transfer anything

Once connected, you can:

- **Drag and drop files** from your desktop or file manager onto the app
- **Paste your clipboard** with Cmd+V / Ctrl+V — text or images
- **Capture screenshots** — full screen, a specific window, or a selected region
- **Click "Browse"** to pick files from a file dialog

Everything moves at full LAN speed. A 50MB file takes about a second on a typical network.

### 5. Organize what you've transferred

Tag files, search by name, filter by type or date, preview images inline, rename things, download to your local drive, or delete what you don't need. Everything is searchable and filterable.

---

## How It Works (Under the Hood)

For the technically curious:

- **Discovery:** Each instance broadcasts a service on the local network using mDNS. The service type is `_liquidrelay._tcp`. On macOS, it uses the native `dns-sd` command-line tool (which bypasses Sequoia's Local Network Privacy restrictions). On other platforms, it uses the `bonjour-service` library with a 10-second refresh cycle.

- **Connection:** Devices connect directly to each other via WebSocket. There is no central server — each machine runs its own embedded Express server. When you pair two devices, one opens a direct WebSocket connection to the other's server. The protocol is: handshake, handshake-ack, then bidirectional file transfer messages.

- **Transfer:** Files are sent as JSON messages with base64-encoded content over the direct WebSocket. Files over 70MB use chunked transfer — a `chunk-start` message, then a series of 1MB `chunk-data` messages, then `chunk-end`. The receiver assembles the chunks into the final file. Stale transfers are automatically cleaned up after 5 minutes.

- **Storage:** Each machine keeps its own local SQLite database (via `better-sqlite3` and Drizzle ORM) and its own `uploads/` folder. Transferred files are stored on the receiving machine's disk. Metadata (filenames, timestamps, tags, dimensions, etc.) lives in the database.

- **Relay:** In mixed environments where some machines run the desktop app and others connect via browser, a relay system routes files between them. Browser clients connect to one machine's server; that machine can relay files to/from other Electron peers on the network.

- **No internet dependency:** The app doesn't phone home, doesn't send analytics, doesn't require DNS resolution. Two machines, one network, and it works.

---

## What It Doesn't Do

Liquid Relay is deliberately simple and focused. It is **not**:

- A cloud storage service — nothing is stored online
- A sync tool — it doesn't keep folders in sync automatically
- A remote access tool — you can't control the other machine
- A messaging app — it transfers files and clipboard, not chat
- A backup solution — it's for active transfers, not archival

---

## Who It's For

| Person | Why they'd use it |
|---|---|
| **Anyone with a restricted work PC** | Get notes, research, AI output, and files from your personal machine to your locked-down work computer without ever touching the internet or corporate firewall |
| **AI power user across platforms** | Move prompts, responses, screenshots, and outputs between machines running different AI tools — Claude on one, Copilot on another, ChatGPT on a third |
| **Developer with a Mac and a PC** | Move code, configs, build output, instructions, and screenshots between dev machines without Git commits or USB drives |
| **Creative professional** | Bridge Mac and Windows workflows for design, video, audio — transfer assets at LAN speed without network share headaches |
| **IT consultant on client sites** | Transfer files on air-gapped or restricted networks where cloud tools aren't available |
| **Anyone with two computers on a desk** | Stop emailing files to yourself |

---

## Pricing

Liquid Relay is a one-time purchase. No subscriptions, no recurring fees.

| Plan | Price | Machines |
|---|---|---|
| **Personal** | $24.99 | Up to 3 machines |
| **Team** | $59.99 | Up to 10 machines |

Both plans include unlimited transfers, all file types, clipboard and screenshot sharing, and free updates.

---

## Supported Platforms

- macOS 12+ (Apple Silicon — M1, M2, M3, M4)
- macOS 12+ (Intel)
- Windows 10+
- Linux support is on the roadmap

---

## Key Facts at a Glance

- **Peer-to-peer:** No central server. Each machine talks directly to the others.
- **No internet required:** Works on air-gapped networks. Nothing leaves your LAN.
- **No accounts:** No sign-up, no email, no password. Just a device name.
- **No cloud:** Files are never uploaded anywhere. Everything stays on your machines.
- **Bypasses firewalls:** Transfers happen on your local network, so corporate firewalls and content filters don't apply.
- **Automatic discovery:** Devices find each other on the network. No IP addresses to configure (but you can manually connect if needed).
- **Any file type:** Documents, images, code, archives, video, audio — no restrictions.
- **Clipboard transfer:** Copy on one machine, paste sends it to the other — text and images.
- **Screenshot capture:** Full screen, window, or cropped region — captures and transfers in one action.
- **Large file support:** Files over 70MB use chunked transfer with progress tracking.
- **Tagging and organization:** Tag, filter, search, sort, and manage everything you've transferred.
- **File queuing:** Send to offline devices — files deliver automatically when they connect.
- **Device control:** Enable or disable individual devices to control which machines participate.
- **Client Mode:** Manual connection option for networks where automatic discovery is blocked.
- **macOS Sequoia compatible:** Native discovery workaround for Apple's latest privacy restrictions.
- **One-time purchase:** Pay once, own it forever.
