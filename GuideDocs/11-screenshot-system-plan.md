# Native Screenshot System — Implementation Plan

## Context

The current screenshot system uses Electron's `desktopCapturer.getSources()` for all three modes (Window, Full, Select Area). This produces poor results:

- **Window** captures the Electron window itself (always `sources[0]`), not a user-chosen window
- **Full Screen** captures only one display — no multi-monitor support
- **Select Area** takes a full screenshot, stuffs it inside the Electron window as a canvas cropper, and the user must select within that constrained space

The goal is to replace this with a system that uses **native OS tools on macOS** (`screencapture` CLI) and **improved Electron desktopCapturer workflows on Windows** (transparent overlay for area, window thumbnail picker). The UI should feel similar on both platforms.

---

## Architecture: Three Layers

```
┌──────────────────────────────────────────┐
│  React UI (LeftSidebar / MinimalDrop)    │  Uses useScreenshot hook
│  └── useScreenshot.ts (shared hook)      │  Platform-aware routing
├──────────────────────────────────────────┤
│  Preload Bridge (preload.ts)             │  6 new IPC methods
├──────────────────────────────────────────┤
│  Main Process                            │
│  ├── main.ts (IPC handlers)             │  Delegates to screenshot module
│  └── screenshot.ts (new module)          │  Platform-specific capture logic
│      ├── macOS: spawns /usr/sbin/screencapture
│      └── Windows: desktopCapturer + overlay BrowserWindow
└──────────────────────────────────────────┘
```

---

## Step 1: Create `electron/screenshot.ts` — Platform Capture Module

**New file (~300 lines).** Exports platform-dispatching functions.

### Shared Types & Helpers

```typescript
export type ScreenshotResult =
  | { dataURL: string; width: number; height: number }
  | { error: 'permission' | 'cancelled' }
  | null;

export interface DisplayInfo {
  id: string; index: number; width: number; height: number;
  scaleFactor: number; isPrimary: boolean; label: string;
}

export interface WindowSource {
  id: string; name: string;
  thumbnailDataURL: string;
  fullResDataURL: string;       // Full-res capture stored from single fetch
  fullResWidth: number;
  fullResHeight: number;
  appIconDataURL: string | null;
}
```

- `getTempScreenshotPath()` — returns path in `app.getPath('temp')/liquidrelay-screenshots/`
- `readFileAsDataURL(filePath)` — uses `nativeImage.createFromPath()`, checks for empty (permission denied)
- `cleanup(filePath)` — `fs.unlinkSync` in try/catch
- Temp dir cleaned on `app.on('will-quit')`

### macOS Functions — spawn `screencapture`

All three functions follow the same pattern:
1. `mainWindow.hide()` + 200ms delay (so Electron window isn't in the capture)
2. `spawn('/usr/sbin/screencapture', [...flags, tempPath])`
3. On exit code 0 → read file via `nativeImage.createFromPath()`
4. On exit code 1 → user cancelled (Escape) → return `null`
5. If `nativeImage.isEmpty()` → return `{ error: 'permission' }` (Screen Recording not granted)
6. Always `mainWindow.show()` + `mainWindow.focus()` in exit/error handlers

| Function | Flags | Behavior |
|---|---|---|
| `captureSelectAreaMac(mainWindow)` | `-i -x <file>` | Native crosshair area selection |
| `captureWindowMac(mainWindow)` | `-i -w -x <file>` | Native window picker (click any window) |
| `captureFullscreenMac(mainWindow, displayIndex?)` | `-D <n> -x <file>` or just `-x <file>` | Specific display or all displays |

The `-x` flag suppresses the camera shutter sound.

**Permission detection (macOS):** When Screen Recording permission is not granted, `screencapture` exits with code 0 but writes a blank or corrupt PNG. The reliable check is `nativeImage.createFromPath(tempPath).isEmpty()` — this returns `true` for 0-byte files, corrupt PNGs, and blank captures. Do NOT use a file-size threshold (e.g. <1KB), as a user can legitimately capture a tiny region that produces a small but valid PNG.

### Windows Functions — desktopCapturer + overlay

**Select Area (`captureSelectAreaWin`):**
1. Capture all screens via `desktopCapturer.getSources({ types: ['screen'] })`
2. Hide main window
3. Compute union bounding rect of all displays (see Multi-Monitor Geometry below)
4. Create a transparent, frameless, alwaysOnTop `BrowserWindow` positioned and sized to span all displays
5. Load `screenshot-overlay.html`, send it the per-display screenshot data + display bounds
6. Overlay canvas composites the display images at correct offsets and lets user draw selection rectangle
7. Escape closes overlay → returns `null`
8. Always restore main window

**Multi-Monitor Geometry:** Displays can have negative x/y coordinates (e.g. a monitor to the left of the primary). The overlay window must be positioned at the union bounds origin:
```typescript
const allDisplays = screen.getAllDisplays();
const minX = Math.min(...allDisplays.map(d => d.bounds.x));
const minY = Math.min(...allDisplays.map(d => d.bounds.y));
const maxX = Math.max(...allDisplays.map(d => d.bounds.x + d.bounds.width));
const maxY = Math.max(...allDisplays.map(d => d.bounds.y + d.bounds.height));

const overlayWindow = new BrowserWindow({
  x: minX,
  y: minY,
  width: maxX - minX,
  height: maxY - minY,
  // ... other options
});
```

**Window List (`listWindowSources`):**
- Single fetch at full resolution: `desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 3840, height: 2160 }, fetchWindowIcons: true })`
- For each source, generate a small thumbnail client-side by resizing the full-res `nativeImage` via `source.thumbnail.resize({ width: 320 })`
- Store both the small thumbnail (for picker UI) and the full-res data URL (for immediate capture on selection)
- Returns `WindowSource[]` with both `thumbnailDataURL` and `fullResDataURL` populated
- This avoids a second `desktopCapturer.getSources()` call, eliminating source-ID instability

**Capture Window by Source ID (`captureWindowBySourceId(sourceId)`):**
- Looks up the already-fetched full-res data from the `WindowSource` that was returned by `listWindowSources()`
- The renderer sends back the `sourceId` + the `fullResDataURL` it already has, so the main process just wraps it as a `ScreenshotResult`
- No refetch needed — the data was captured in the single original pass

**Full Screen (`captureFullscreenWin(mainWindow, displayId?)`):**
- Hide window, capture via `desktopCapturer`, match `source.display_id` if specific display requested
- Single display or specific display: return that source's thumbnail directly
- **"All Displays" on Windows:** Do NOT attempt main-process compositing with `nativeImage` (it lacks canvas drawing APIs). Instead, open the overlay window spanning all monitors (same as Select Area), draw each display's capture at its correct offset on the overlay canvas, and immediately send the full composite back without requiring user selection. The overlay briefly flashes then auto-closes.
  - Alternatively (simpler for v1): omit "All Displays" on Windows and require the user to pick a specific display. macOS handles "All Displays" natively via `screencapture -x`.

### Platform Entry Points

All IPC-facing functions return consistent types — no union of `ScreenshotResult | WindowSource[]`:

```typescript
// Area selection — returns captured area or null/error
export async function captureSelectArea(mainWindow: BrowserWindow): Promise<ScreenshotResult>

// Window capture — macOS: native picker returns ScreenshotResult directly
//                  Windows: NOT called directly, use listWindowSources + captureWindowBySourceId
export async function captureWindowNative(mainWindow: BrowserWindow): Promise<ScreenshotResult>

// Window list — Windows only (macOS returns empty array)
export async function listWindowSources(): Promise<WindowSource[]>

// Capture a pre-fetched window — just wraps the already-captured full-res data
export async function captureWindowBySourceId(sourceId: string, fullResDataURL: string, width: number, height: number): Promise<ScreenshotResult>

// Full screen — single display or specific display
export async function captureFullscreen(mainWindow: BrowserWindow, displayId?: number | string): Promise<ScreenshotResult>

// Display info — for multi-monitor picker UI
export function getDisplayInfo(): DisplayInfo[]
```

Each dispatches to Mac/Win implementation based on `process.platform`.

---

## Step 2: Create Windows Overlay Files

### `electron/screenshot-overlay.html`

Self-contained HTML + CSS + JS (no build step needed — copied to `electron-dist/` during compile). Contains:
- Full-window canvas with `cursor: crosshair`
- Receives per-display screenshot data + display bounds via IPC `set-screenshot` event
- **Composites** each display's image onto the canvas at its correct offset (origin-adjusted so that display at `minX, minY` maps to canvas `0, 0`)
- Draws dark overlay (50% opacity) outside selection
- Mouse drag draws selection rectangle with dashed white border
- Shows pixel dimensions label during drag
- Mouse up → crops via offscreen canvas → sends result via IPC
- Escape → sends `null` via IPC

This overlay also serves the "All Displays" fullscreen capture on Windows — in that mode, it receives a flag to skip user selection and immediately send the full composite back.

### `electron/screenshot-overlay-preload.ts`

Minimal preload:
```typescript
contextBridge.exposeInMainWorld('overlayAPI', {
  onSetScreenshot: (cb: (data: OverlayData) => void) => {
    ipcRenderer.on('set-screenshot', (_event, data) => cb(data));
  },
  sendResult: (result: { dataURL: string; width: number; height: number } | null) => {
    ipcRenderer.invoke('screenshot-overlay-result', result);
  },
});
```

### Build integration

**Create `scripts/copy-electron-assets.mjs`** — a small Node script that copies non-TypeScript assets to `electron-dist/`:

```javascript
import { copyFileSync, mkdirSync } from 'fs';
mkdirSync('electron-dist', { recursive: true });
copyFileSync('electron/screenshot-overlay.html', 'electron-dist/screenshot-overlay.html');
// Future non-TS assets can be added here
```

**Update `package.json`** `electron:compile` script:
```json
"electron:compile": "tsc -p electron/tsconfig.json && node -e \"require('fs').writeFileSync('electron-dist/package.json', JSON.stringify({type:'commonjs'}))\" && node scripts/copy-electron-assets.mjs"
```

This replaces inline shell copy commands with a maintainable script. Cross-platform safe (no `cp` vs `copy` issues). Since `electron-builder.json5` already includes `electron-dist/**/*`, no builder config changes needed.

---

## Step 3: Update `electron/main.ts` — IPC Handlers

**Remove:** Lines 640–665 (existing `capture-screenshot` handler)

**Add import:**
```typescript
import {
  captureSelectArea,
  captureWindowNative,
  listWindowSources,
  captureWindowBySourceId,
  captureFullscreen,
  getDisplayInfo,
} from './screenshot';
```

Can also remove `desktopCapturer` from the Electron import on line 1 (it moves into `screenshot.ts`).

**Add new handlers:**
```typescript
// Screenshot IPC handlers
ipcMain.handle('screenshot-select-area', async () => {
  if (!mainWindow) return null;
  return captureSelectArea(mainWindow);
});

ipcMain.handle('screenshot-window-native', async () => {
  if (!mainWindow) return null;
  return captureWindowNative(mainWindow);
});

ipcMain.handle('screenshot-list-windows', async () => {
  return listWindowSources();
});

ipcMain.handle('screenshot-window-by-id', async (_e, sourceId: string, fullResDataURL: string, width: number, height: number) => {
  return captureWindowBySourceId(sourceId, fullResDataURL, width, height);
});

ipcMain.handle('screenshot-fullscreen', async (_e, displayId?: number | string) => {
  if (!mainWindow) return null;
  return captureFullscreen(mainWindow, displayId);
});

ipcMain.handle('get-display-info', () => getDisplayInfo());
```

---

## Step 4: Update `electron/preload.ts`

**Replace line 74:**
```typescript
// Old:
captureScreenshot: (mode: 'fullscreen' | 'window') => ipcRenderer.invoke('capture-screenshot', mode),

// New:
screenshotSelectArea: () => ipcRenderer.invoke('screenshot-select-area'),
screenshotWindowNative: () => ipcRenderer.invoke('screenshot-window-native'),
screenshotListWindows: () => ipcRenderer.invoke('screenshot-list-windows'),
screenshotWindowById: (sourceId: string, fullResDataURL: string, width: number, height: number) =>
  ipcRenderer.invoke('screenshot-window-by-id', sourceId, fullResDataURL, width, height),
screenshotFullscreen: (displayId?: number | string) => ipcRenderer.invoke('screenshot-fullscreen', displayId),
getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
```

---

## Step 5: Update `client/src/types/electron.d.ts`

**Replace line 47** (`captureScreenshot`) with:
```typescript
// Screenshot — all methods return consistent ScreenshotResult
screenshotSelectArea: () => Promise<ScreenshotResult | null>;
screenshotWindowNative: () => Promise<ScreenshotResult | null>;
screenshotListWindows: () => Promise<WindowSource[]>;
screenshotWindowById: (sourceId: string, fullResDataURL: string, width: number, height: number) => Promise<ScreenshotResult | null>;
screenshotFullscreen: (displayId?: number | string) => Promise<ScreenshotResult | null>;
getDisplayInfo: () => Promise<DisplayInfo[]>;
```

**Add types** (before `declare global`):
```typescript
export type ScreenshotResult =
  | { dataURL: string; width: number; height: number; error?: undefined }
  | { error: 'permission' | 'cancelled'; dataURL?: undefined };

export interface WindowSource {
  id: string;
  name: string;
  thumbnailDataURL: string;       // Small thumbnail for picker UI
  fullResDataURL: string;         // Full-res capture from same fetch pass
  fullResWidth: number;
  fullResHeight: number;
  appIconDataURL: string | null;
}

export interface DisplayInfo {
  id: string;
  index: number;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
  label: string;
}
```

---

## Step 6: Create `client/src/hooks/useScreenshot.ts` — Shared Hook

Extracts ~80 lines of duplicated logic from both `LeftSidebar.tsx` and `MinimalDropWindow.tsx`.

**Input:** `{ onSendFile, onShowMist? }`

**Manages state:**
- `showScreenshotPicker` — toggle the 3-button menu
- `screenshotData` — for browser-mode ScreenshotCropper fallback
- `windowSources` — for Windows window thumbnail picker (populated by `listWindowSources`)
- `displayInfo` — loaded on mount via `getDisplayInfo()`
- `isMultiMonitor` — derived from `displayInfo`

**Exposes handlers:**

| Handler | macOS | Windows | Browser fallback |
|---|---|---|---|
| `handleScreenshotSelectArea()` | `screenshotSelectArea()` → native crosshair | `screenshotSelectArea()` → overlay window | `getDisplayMedia` → ScreenshotCropper |
| `handleScreenshotWindow()` | `screenshotWindowNative()` → native picker, returns `ScreenshotResult` | `screenshotListWindows()` → sets `windowSources` state, shows picker | `getDisplayMedia({displaySurface:'window'})` |
| `handleWindowSourceSelect(source)` | N/A | Uses `source.fullResDataURL` directly → `sendScreenshot()` | N/A |
| `handleScreenshotFullScreen(displayId?)` | `screenshotFullscreen(displayId)` | `screenshotFullscreen(displayId)` | `getDisplayMedia({displaySurface:'monitor'})` |
| `handleScreenshotCrop(croppedDataURL)` | N/A | N/A | Sends cropped image |
| `handleScreenshotCancel()` | N/A | Clears windowSources | Clears screenshotData |

**Key design:** `handleScreenshotWindow()` on macOS calls `screenshotWindowNative()` which always returns `ScreenshotResult`. On Windows it calls `screenshotListWindows()` which always returns `WindowSource[]`. The hook handles routing — the IPC boundary never returns ambiguous union types.

**`handleWindowSourceSelect` on Windows** receives the full `WindowSource` object (which already contains `fullResDataURL` from the single fetch). It calls `sendScreenshot(source.fullResDataURL)` directly — no second round-trip to main process needed. No source-ID instability risk.

**Common send logic:**
```typescript
const sendScreenshot = (dataURL: string) => {
  const filename = `screenshot-${Date.now()}.png`;
  const size = Math.round(dataURL.split(',')[1].length * 0.75);
  onSendFile({ filename, originalName: filename, mimeType: 'image/png', size, content: dataURL, isClipboard: false });
};
```

**Permission error handling:**
```typescript
if (result?.error === 'permission') {
  toast({ title: 'Screen Recording Permission Required',
    description: 'System Settings → Privacy & Security → Screen Recording → enable Liquid Relay',
    variant: 'destructive' });
}
```

---

## Step 7: Update UI Components

### `client/src/components/LeftSidebar.tsx`

**Remove:**
- `screenshotData` / `showScreenshotPicker` state declarations
- `captureScreen()`, `sendScreenshot()`, `handleScreenshotWindow`, `handleScreenshotFullScreen`, `handleScreenshotCropMode`, `handleScreenshotCrop`, `handleScreenshotCancel` functions (~lines 525–606)
- Inline `<ScreenshotCropper>` render

**Add:**
```typescript
const { showScreenshotPicker, setShowScreenshotPicker, screenshotData, windowSources,
  displayInfo, handleScreenshotWindow, handleScreenshotFullScreen,
  handleScreenshotSelectArea, handleScreenshotCrop, handleScreenshotCancel,
  handleWindowSourceSelect, isMultiMonitor } = useScreenshot({ onSendFile, onShowMist: () => setShowMist(true) });
```

**Update UI:**
- Same 3 buttons: Window | Full | Select Area
- **Full** button: if `isMultiMonitor`, render a small dropdown ("All Displays" + each display with resolution). On Windows, "All Displays" is omitted for v1 — user picks a specific display. On macOS, "All Displays" calls `screenshotFullscreen()` with no displayId, which maps to `screencapture -x` natively. If single monitor, capture immediately on click.
- **Window** button: works the same on both platforms from the UI side — macOS does native picker, Windows populates `windowSources` which triggers a thumbnail grid popover
- Add `{windowSources && <WindowPicker .../>}` — small grid of clickable thumbnails with app name. Clicking a thumbnail calls `handleWindowSourceSelect(source)` which uses the pre-fetched full-res data.
- Keep `{screenshotData && <ScreenshotCropper .../>}` for browser fallback

### `client/src/components/MinimalDropWindow.tsx`

Exact same refactor — replace inline screenshot code with `useScreenshot` hook.

### `client/src/components/ScreenshotCropper.tsx`

**No changes.** Kept as browser-mode fallback only.

---

## Step 8: Create `scripts/copy-electron-assets.mjs`

Small build utility script:

```javascript
// scripts/copy-electron-assets.mjs
// Copies non-TypeScript electron assets to electron-dist/ after tsc compilation.
// Called by the electron:compile npm script.

import { copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const assets = [
  ['electron/screenshot-overlay.html', 'electron-dist/screenshot-overlay.html'],
];

for (const [src, dest] of assets) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`Copied ${src} → ${dest}`);
}
```

---

## Files Summary

| File | Action | Purpose |
|---|---|---|
| `electron/screenshot.ts` | **Create** | Core platform-specific capture logic |
| `electron/screenshot-overlay.html` | **Create** | Windows area selection + all-displays overlay |
| `electron/screenshot-overlay-preload.ts` | **Create** | Minimal preload for overlay window IPC |
| `scripts/copy-electron-assets.mjs` | **Create** | Cross-platform asset copy for electron build |
| `electron/main.ts` | **Edit** | Replace old IPC handler (L640–665) with new ones |
| `electron/preload.ts` | **Edit** | Replace `captureScreenshot` (L74) with 6 new methods |
| `client/src/types/electron.d.ts` | **Edit** | New types + replace L47 |
| `client/src/hooks/useScreenshot.ts` | **Create** | Shared hook eliminating ~80 lines duplication |
| `client/src/components/LeftSidebar.tsx` | **Edit** | Use hook, add display/window pickers |
| `client/src/components/MinimalDropWindow.tsx` | **Edit** | Use hook, add display/window pickers |
| `package.json` | **Edit** | Update `electron:compile` to call copy script |
| `client/src/components/ScreenshotCropper.tsx` | No change | Kept for browser dev mode |

---

## Edge Cases

- **Window hide/show timing:** 200ms delay after `mainWindow.hide()` before spawning screencapture. Always restore in both `exit` and `error` handlers.
- **Retina/HiDPI:** macOS `screencapture` auto-captures at Retina res. Windows uses `scaleFactor` from `screen.getAllDisplays()` for thumbnail sizing.
- **Multi-monitor overlay geometry (Windows):** Displays can have negative x/y. Compute union bounding rect: `x=minX, y=minY, width=maxX-minX, height=maxY-minY`. Set both position and size on the overlay `BrowserWindow`. Overlay canvas composites each display image at `(display.bounds.x - minX, display.bounds.y - minY)`.
- **No main-process compositing (Windows):** `nativeImage` lacks canvas drawing APIs. All multi-display compositing happens in the overlay renderer's canvas, where `drawImage()` at arbitrary coordinates is straightforward.
- **Window source-ID stability (Windows):** Single-pass fetch at full resolution. Thumbnails are derived from the same data via `nativeImage.resize()`. The renderer holds both thumbnail and full-res data. When the user picks a window, the already-captured full-res data is used directly — no refetch, no stale-ID risk.
- **Overlay cleanup (Windows):** Track `activeOverlay` reference, destroy on `will-quit`.
- **`ipcMain.handleOnce` doesn't exist:** Use `ipcMain.handle` + `ipcMain.removeHandler` with a unique channel per overlay invocation.
- **Permission detection (macOS):** Use `nativeImage.createFromPath(tempPath).isEmpty()` — this correctly identifies blank captures from permission denial. Do NOT use file-size thresholds, as tiny but valid captures can be small.
- **Temp file cleanup:** `fs.unlinkSync` after each capture + `fs.rmSync(tempDir, { recursive: true })` on quit.

---

## Verification

1. `npm run electron:compile` — clean compile, no errors
2. **macOS testing:**
   - Select Area → macOS crosshair appears, Electron hidden. Draw selection → file sent. Escape → window restores, nothing sent.
   - Select Area with tiny region (e.g. 5x5 pixels) → valid capture sent, NOT flagged as permission error.
   - Window → macOS window picker. Click any window → captured and sent.
   - Full (single monitor) → captures immediately.
   - Full (multi-monitor) → display picker sub-menu, each option works, "All Displays" works.
   - No Screen Recording permission → toast with instructions.
3. **Windows testing:**
   - Select Area → fullscreen overlay appears covering ALL monitors (including those with negative coordinates). Draw selection → file sent. Escape → overlay closes.
   - Window → thumbnail grid popover shown with full-res thumbnails. Click a window → captured immediately from pre-fetched data (no refetch delay).
   - Full (single display) → captures immediately.
   - Full (multi-display) → display picker shown, each specific display works.
4. Both platforms: verify MinimalDropWindow has identical behavior.
5. Browser dev mode (`npm run dev`): verify `getDisplayMedia` + ScreenshotCropper fallback still works.
6. Verify screenshot files appear in "Recently Sent" with smart naming if enabled.
