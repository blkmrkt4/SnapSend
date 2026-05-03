import { app, BrowserWindow, clipboard, desktopCapturer, ipcMain, nativeImage, screen, shell, systemPreferences } from 'electron';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// --- Types ---

export type ScreenshotResult =
  | { dataURL: string; width: number; height: number; error?: undefined }
  | { error: 'permission' | 'cancelled'; dataURL?: undefined; width?: undefined; height?: undefined }
  | null;

export interface DisplayInfo {
  id: string;
  index: number;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
  label: string;
}

export interface WindowSource {
  id: string;
  name: string;
  thumbnailDataURL: string;
  fullResDataURL: string;
  fullResWidth: number;
  fullResHeight: number;
  appIconDataURL: string | null;
}

// --- Helpers ---

function getTempDir(): string {
  const tempDir = path.join(app.getPath('temp'), 'liquidrelay-screenshots');
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function getTempScreenshotPath(): string {
  return path.join(getTempDir(), `screenshot-${uuidv4()}.png`);
}

function cleanup(filePath: string) {
  try { fs.unlinkSync(filePath); } catch {}
}

function readFileAsScreenshotResult(filePath: string): ScreenshotResult {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: 'permission' };
    }
    const img = nativeImage.createFromPath(filePath);
    if (img.isEmpty()) {
      return { error: 'permission' };
    }
    const size = img.getSize();
    return {
      dataURL: img.toDataURL(),
      width: size.width,
      height: size.height,
    };
  } catch {
    return null;
  }
}

/** Hide window and wait for it to fully disappear from screen */
async function hideWindow(win: BrowserWindow): Promise<void> {
  win.hide();
  await new Promise(r => setTimeout(r, 200));
}

/** Restore window visibility */
function showWindow(win: BrowserWindow): void {
  if (!win.isDestroyed()) {
    win.show();
    win.focus();
  }
}

// --- macOS: screen recording permission ---

export type ScreenRecordingStatus = 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';

export function getScreenRecordingStatus(): ScreenRecordingStatus {
  if (process.platform !== 'darwin') return 'granted';
  return systemPreferences.getMediaAccessStatus('screen') as ScreenRecordingStatus;
}

// Trigger the macOS TCC prompt through Electron's desktopCapturer — the
// Apple-blessed path that registers the grant cleanly against the app bundle.
// The returned thumbnails are discarded; we only call this for the side effect.
let promptInFlight: Promise<void> | null = null;
async function triggerScreenRecordingPrompt(): Promise<void> {
  if (process.platform !== 'darwin') return;
  if (promptInFlight) return promptInFlight;
  promptInFlight = (async () => {
    try {
      await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 },
      });
    } catch {
      // Ignore — we just need the TCC side effect
    }
  })();
  try {
    await promptInFlight;
  } finally {
    promptInFlight = null;
  }
}

export function openScreenRecordingSettings(): void {
  if (process.platform === 'darwin') {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  }
}

export function resetScreenRecordingPermission(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({ success: false, error: 'Only supported on macOS' });
      return;
    }
    // Any user can reset TCC for their own apps; no sudo needed.
    exec('tccutil reset ScreenCapture com.liquidrelay.app', (err, _stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr?.trim() || err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}

// --- macOS: screencapture CLI ---

function runScreencapture(mainWindow: BrowserWindow, args: string[]): Promise<ScreenshotResult> {
  const tempPath = getTempScreenshotPath();
  const fullArgs = [...args, tempPath];

  return new Promise(async (resolve) => {
    await hideWindow(mainWindow);

    const proc = spawn('/usr/sbin/screencapture', fullArgs);

    proc.on('exit', (code) => {
      showWindow(mainWindow);

      if (code !== 0) {
        // Exit code 1 = user pressed Escape
        cleanup(tempPath);
        resolve(null);
        return;
      }

      const result = readFileAsScreenshotResult(tempPath);
      cleanup(tempPath);
      resolve(result);
    });

    proc.on('error', () => {
      showWindow(mainWindow);
      cleanup(tempPath);
      resolve(null);
    });
  });
}

// Guard a mac capture call: trigger TCC prompt if undetermined, bail out
// with a permission error if denied/restricted, otherwise proceed.
async function ensureMacPermission(): Promise<ScreenshotResult | null> {
  const status = getScreenRecordingStatus();
  if (status === 'granted') return null;
  if (status === 'not-determined' || status === 'unknown') {
    await triggerScreenRecordingPrompt();
    const after = getScreenRecordingStatus();
    if (after === 'granted') return null;
    return { error: 'permission' };
  }
  return { error: 'permission' };
}

async function captureSelectAreaMac(mainWindow: BrowserWindow): Promise<ScreenshotResult> {
  const denied = await ensureMacPermission();
  if (denied) return denied;
  // -i: interactive, -x: no sound
  return runScreencapture(mainWindow, ['-i', '-x']);
}

async function captureWindowMac(mainWindow: BrowserWindow): Promise<ScreenshotResult> {
  const denied = await ensureMacPermission();
  if (denied) return denied;
  // -i: interactive, -w: window mode, -x: no sound
  return runScreencapture(mainWindow, ['-i', '-w', '-x']);
}

async function captureFullscreenMac(mainWindow: BrowserWindow, displayIndex?: number): Promise<ScreenshotResult> {
  const denied = await ensureMacPermission();
  if (denied) return denied;
  const args: string[] = [];
  if (displayIndex !== undefined) {
    args.push('-D', String(displayIndex));
  }
  args.push('-x');
  return runScreencapture(mainWindow, args);
}

// --- Windows: Snipping Tool (out-of-process) + desktopCapturer + overlay ---

let activeOverlay: BrowserWindow | null = null;

/**
 * Use the Windows Snipping Tool's snip URI handler to capture an area.
 * Runs entirely out-of-process — a crash there cannot take down Liquid Relay.
 * The captured image lands in the clipboard; we poll for it to change vs the
 * pre-snip snapshot, then forward it through the same pipeline as macOS uses.
 *
 * Requires Windows 10 1809+ (October 2018) or Windows 11. Older Windows
 * versions will see ms-screenclip: do nothing and the call will time out.
 */
async function captureSelectAreaWin(mainWindow: BrowserWindow): Promise<ScreenshotResult> {
  // Snapshot clipboard image bytes so we can detect when the user completes the snip
  const beforeImage = clipboard.readImage();
  const beforeBytes = beforeImage.isEmpty() ? null : beforeImage.toPNG();

  await hideWindow(mainWindow);

  // Trigger the system snip UI. shell.openExternal is the standard Electron way
  // to invoke a URI protocol handler — equivalent to typing `start ms-screenclip:`.
  try {
    await shell.openExternal('ms-screenclip:');
  } catch (err) {
    console.error('[Screenshot] Failed to launch Snipping Tool:', err);
    showWindow(mainWindow);
    return null;
  }

  return new Promise((resolve) => {
    const POLL_INTERVAL_MS = 250;
    const TIMEOUT_MS = 60000; // user has 60s to complete the snip
    let resolved = false;
    let pollTimer: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const finish = (result: ScreenshotResult) => {
      if (resolved) return;
      resolved = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      showWindow(mainWindow);
      resolve(result);
    };

    pollTimer = setInterval(() => {
      const current = clipboard.readImage();
      if (current.isEmpty()) return;
      const currentBytes = current.toPNG();
      const changed = !beforeBytes || !currentBytes.equals(beforeBytes);
      if (!changed) return;
      const size = current.getSize();
      finish({
        dataURL: current.toDataURL(),
        width: size.width,
        height: size.height,
      });
    }, POLL_INTERVAL_MS);

    timeoutTimer = setTimeout(() => {
      // Treat timeout as a cancel — no error toast, just restore the main window.
      finish(null);
    }, TIMEOUT_MS);
  });
}

function captureFullscreenAllDisplaysWin(mainWindow: BrowserWindow): Promise<ScreenshotResult> {
  return captureWithOverlay(mainWindow, 'fullscreen');
}

async function captureWithOverlay(mainWindow: BrowserWindow, mode: 'area' | 'fullscreen'): Promise<ScreenshotResult> {
  try {
    // Get display bounds first so we can size thumbnails to actual screen size,
    // not a hardcoded 4K — overcapturing on multi-monitor 4K setups was a likely
    // contributor to the GPU memory pressure that crashed the app.
    const allDisplays = screen.getAllDisplays();
    const maxScaleFactor = Math.max(...allDisplays.map(d => d.scaleFactor));
    const totalNativeWidth = Math.max(...allDisplays.map(d => (d.bounds.x + d.bounds.width) * maxScaleFactor));
    const totalNativeHeight = Math.max(...allDisplays.map(d => (d.bounds.y + d.bounds.height) * maxScaleFactor));

    // Cap thumbnail at 1920x1080 — area-select doesn't need pixel-perfect preview;
    // the actual region is captured separately. Smaller thumbnails dramatically
    // reduce GPU memory pressure on multi-monitor 4K systems.
    const thumbWidth = Math.min(1920, totalNativeWidth);
    const thumbHeight = Math.min(1080, totalNativeHeight);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: thumbWidth, height: thumbHeight },
    });

    if (sources.length === 0) return null;

    const minX = Math.min(...allDisplays.map(d => d.bounds.x));
    const minY = Math.min(...allDisplays.map(d => d.bounds.y));
    const maxX = Math.max(...allDisplays.map(d => d.bounds.x + d.bounds.width));
    const maxY = Math.max(...allDisplays.map(d => d.bounds.y + d.bounds.height));

    // Defensive: if any dimension is non-positive, abort rather than create an
    // invalid window that may crash the renderer or transparent-window backend.
    const overlayWidth = maxX - minX;
    const overlayHeight = maxY - minY;
    if (overlayWidth <= 0 || overlayHeight <= 0) {
      console.error(`[Screenshot] Invalid overlay dimensions ${overlayWidth}x${overlayHeight} — aborting`);
      return null;
    }

    const displayData = allDisplays.map((display, i) => {
      const source = sources.find(s => s.display_id === String(display.id)) || sources[i];
      return {
        x: display.bounds.x - minX,
        y: display.bounds.y - minY,
        width: display.bounds.width,
        height: display.bounds.height,
        dataURL: source ? source.thumbnail.toDataURL() : '',
      };
    });

    await hideWindow(mainWindow);

    const resultChannel = `screenshot-overlay-result-${uuidv4()}`;

    return await new Promise((resolve) => {
      let overlayWindow: BrowserWindow;
      try {
        overlayWindow = new BrowserWindow({
          x: minX,
          y: minY,
          width: overlayWidth,
          height: overlayHeight,
          transparent: true,
          frame: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          resizable: false,
          hasShadow: false,
          webPreferences: {
            preload: path.join(__dirname, 'screenshot-overlay-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
          },
        });
      } catch (err) {
        console.error('[Screenshot] Failed to create overlay window:', err);
        showWindow(mainWindow);
        resolve(null);
        return;
      }

      activeOverlay = overlayWindow;
      overlayWindow.loadFile(path.join(__dirname, 'screenshot-overlay.html'));

      overlayWindow.webContents.on('did-finish-load', () => {
        try {
          overlayWindow.webContents.send('set-screenshot', { displays: displayData, mode, resultChannel });
        } catch (err) {
          console.error('[Screenshot] Failed to send set-screenshot:', err);
        }
      });

      let resolved = false;

      ipcMain.handle(resultChannel, (_event, result: ScreenshotResult) => {
        if (resolved) return;
        resolved = true;
        ipcMain.removeHandler(resultChannel);
        if (!overlayWindow.isDestroyed()) overlayWindow.close();
        activeOverlay = null;
        showWindow(mainWindow);
        resolve(result);
      });

      overlayWindow.webContents.on('render-process-gone', (_e, details) => {
        console.error(`[Screenshot] Overlay render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
        if (resolved) return;
        resolved = true;
        ipcMain.removeHandler(resultChannel);
        if (!overlayWindow.isDestroyed()) {
          try { overlayWindow.destroy(); } catch {}
        }
        activeOverlay = null;
        showWindow(mainWindow);
        resolve(null);
      });

      overlayWindow.on('closed', () => {
        activeOverlay = null;
        if (!resolved) {
          resolved = true;
          ipcMain.removeHandler(resultChannel);
          showWindow(mainWindow);
          resolve(null);
        }
      });
    });
  } catch (err) {
    console.error('[Screenshot] captureWithOverlay failed:', err);
    showWindow(mainWindow);
    return null;
  }
}

async function listWindowSourcesWin(): Promise<WindowSource[]> {
  // Single fetch at full resolution to avoid source-ID instability
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 3840, height: 2160 },
    fetchWindowIcons: true,
  });

  return sources
    .filter(s => !s.thumbnail.isEmpty())
    .map(s => {
      const fullSize = s.thumbnail.getSize();
      // Resize for thumbnail preview
      const thumb = s.thumbnail.resize({ width: 320 });
      return {
        id: s.id,
        name: s.name,
        thumbnailDataURL: thumb.toDataURL(),
        fullResDataURL: s.thumbnail.toDataURL(),
        fullResWidth: fullSize.width,
        fullResHeight: fullSize.height,
        appIconDataURL: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
      };
    });
}

async function captureFullscreenSingleWin(mainWindow: BrowserWindow, displayId?: string): Promise<ScreenshotResult> {
  await hideWindow(mainWindow);

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 3840, height: 2160 },
    });

    if (displayId) {
      const source = sources.find(s => s.display_id === displayId);
      if (!source || source.thumbnail.isEmpty()) {
        return null;
      }
      const size = source.thumbnail.getSize();
      return { dataURL: source.thumbnail.toDataURL(), width: size.width, height: size.height };
    }

    // Single display
    if (sources.length > 0 && !sources[0].thumbnail.isEmpty()) {
      const size = sources[0].thumbnail.getSize();
      return { dataURL: sources[0].thumbnail.toDataURL(), width: size.width, height: size.height };
    }

    return null;
  } finally {
    showWindow(mainWindow);
  }
}

// --- Platform-dispatching entry points ---

export async function captureSelectArea(mainWindow: BrowserWindow): Promise<ScreenshotResult> {
  if (process.platform === 'darwin') {
    return captureSelectAreaMac(mainWindow);
  }
  return captureSelectAreaWin(mainWindow);
}

export async function captureWindowNative(mainWindow: BrowserWindow): Promise<ScreenshotResult> {
  if (process.platform === 'darwin') {
    return captureWindowMac(mainWindow);
  }
  // Windows: native window capture not supported — use listWindowSources + captureWindowBySourceId
  return null;
}

export async function listWindowSources(): Promise<WindowSource[]> {
  if (process.platform === 'darwin') {
    // macOS uses native picker, no need for source list
    return [];
  }
  return listWindowSourcesWin();
}

export async function captureWindowBySourceId(
  _sourceId: string,
  fullResDataURL: string,
  width: number,
  height: number,
): Promise<ScreenshotResult> {
  // The full-res data was already captured in the single listWindowSources pass.
  // Just wrap it as a ScreenshotResult.
  return { dataURL: fullResDataURL, width, height };
}

export async function captureFullscreen(mainWindow: BrowserWindow, displayId?: number | string): Promise<ScreenshotResult> {
  if (process.platform === 'darwin') {
    return captureFullscreenMac(mainWindow, displayId as number | undefined);
  }

  // Windows: check if "All Displays" requested on multi-monitor
  const allDisplays = screen.getAllDisplays();
  if (displayId === undefined && allDisplays.length > 1) {
    // Multi-monitor "All Displays" — use overlay compositor
    return captureFullscreenAllDisplaysWin(mainWindow);
  }

  // Single display or specific display
  return captureFullscreenSingleWin(mainWindow, displayId as string | undefined);
}

export function getDisplayInfo(): DisplayInfo[] {
  const displays = screen.getAllDisplays();
  return displays.map((d, i) => ({
    id: String(d.id),
    index: i + 1,
    width: d.size.width,
    height: d.size.height,
    scaleFactor: d.scaleFactor,
    isPrimary: d.bounds.x === 0 && d.bounds.y === 0,
    label: `Display ${i + 1} (${d.size.width}x${d.size.height})`,
  }));
}

// --- Cleanup ---

export function cleanupScreenshotTemp() {
  const tempDir = path.join(app.getPath('temp'), 'liquidrelay-screenshots');
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

  if (activeOverlay && !activeOverlay.isDestroyed()) {
    activeOverlay.close();
    activeOverlay = null;
  }
}
