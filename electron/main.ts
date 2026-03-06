import './logger'; // Must be first — patches console to capture all output
import { app, BrowserWindow, ipcMain, shell, clipboard, powerMonitor, dialog } from 'electron';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryManager } from './discovery';
import { registerDiscoveryIPC, registerP2PIPC, getPeerManager, resetPeerRetries } from './ipc-handlers';
import { activateLicense, validateLicense, deactivateLicense, getLicenseStatus } from './license';
import { readRecentLogLines, getLogPath, closeLogStream } from './logger';
import {
  captureSelectArea,
  captureWindowNative,
  listWindowSources,
  captureWindowBySourceId,
  captureFullscreen,
  getDisplayInfo,
  cleanupScreenshotTemp,
} from './screenshot';
import {
  getSmartNamingSetting,
  saveSmartNamingSetting,
  checkOllamaStatus,
  pullModel,
  generateSmartName,
  ensureOllamaRunning,
  stopOllama,
  getPromptConfigPath,
  getPromptLogPath,
  clearPromptLog,
  resetPromptConfig,
  getConfigImageModel,
  setConfigImageModel,
  type SmartNameContext,
} from './smart-naming';

let mainWindow: BrowserWindow | null = null;
let serverPort: number = 5000;
let discovery: DiscoveryManager | null = null;
let serverInstance: any = null;
let reconnectDisconnectedPeers: (() => void) | null = null;

const isDev = !app.isPackaged;

// Expose dev mode to preload via env
process.env.SNAPSEND_ELECTRON_DEV = isDev ? 'true' : 'false';

// Persistent device ID: stored in userData
function getOrCreateDeviceId(): string {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const idFile = path.join(configDir, 'device-id');

  try {
    if (fs.existsSync(idFile)) {
      return fs.readFileSync(idFile, 'utf-8').trim();
    }
  } catch {}

  const id = uuidv4();
  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(idFile, id, 'utf-8');
  } catch (err) {
    console.error('Failed to persist device ID:', err);
  }
  return id;
}

function getDeviceName(): string {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const nameFile = path.join(configDir, 'device-name');

  try {
    if (fs.existsSync(nameFile)) {
      return fs.readFileSync(nameFile, 'utf-8').trim();
    }
  } catch {}

  const os = require('os') as typeof import('os');
  return os.hostname();
}

function saveDeviceName(name: string) {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const nameFile = path.join(configDir, 'device-name');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(nameFile, name, 'utf-8');
  } catch (err) {
    console.error('Failed to save device name:', err);
  }
}

// Enabled devices persistence (for auto-connect control)
// Maps device UUID to enabled state
let enabledDevicesCache: Map<string, boolean> = new Map();

function loadEnabledDevices(): Map<string, boolean> {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const enabledFile = path.join(configDir, 'enabled-devices.json');

  try {
    if (fs.existsSync(enabledFile)) {
      const data = JSON.parse(fs.readFileSync(enabledFile, 'utf-8'));
      enabledDevicesCache = new Map(Object.entries(data));
      return enabledDevicesCache;
    }
  } catch (err) {
    console.error('Failed to load enabled devices:', err);
  }
  return new Map();
}

function saveEnabledDevices() {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const enabledFile = path.join(configDir, 'enabled-devices.json');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    const data = Object.fromEntries(enabledDevicesCache);
    fs.writeFileSync(enabledFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save enabled devices:', err);
  }
}

function isDeviceEnabled(deviceUUID: string): boolean {
  // If not in cache, default to enabled (new devices are enabled by default)
  if (!enabledDevicesCache.has(deviceUUID)) {
    return true;
  }
  return enabledDevicesCache.get(deviceUUID) ?? true;
}

function setDeviceEnabled(deviceUUID: string, enabled: boolean) {
  enabledDevicesCache.set(deviceUUID, enabled);
  saveEnabledDevices();
}

// Connection mode persistence (server or client)
function getConnectionMode(): 'server' | 'client' {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const modeFile = path.join(configDir, 'connection-mode');

  try {
    if (fs.existsSync(modeFile)) {
      const mode = fs.readFileSync(modeFile, 'utf-8').trim();
      if (mode === 'client') return 'client';
    }
  } catch {}

  return 'server';
}

function saveConnectionMode(mode: 'server' | 'client') {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const modeFile = path.join(configDir, 'connection-mode');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(modeFile, mode, 'utf-8');
  } catch (err) {
    console.error('Failed to save connection mode:', err);
  }
}

function getRemoteServerUrl(): string {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const urlFile = path.join(configDir, 'remote-server-url');

  try {
    if (fs.existsSync(urlFile)) {
      return fs.readFileSync(urlFile, 'utf-8').trim();
    }
  } catch {}

  return '';
}

function saveRemoteServerUrl(url: string) {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const urlFile = path.join(configDir, 'remote-server-url');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(urlFile, url, 'utf-8');
  } catch (err) {
    console.error('Failed to save remote server URL:', err);
  }
}

const DEFAULT_SERVER_PORT = 53000;

function getServerPortSetting(): number {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const portFile = path.join(configDir, 'server-port');

  try {
    if (fs.existsSync(portFile)) {
      const port = parseInt(fs.readFileSync(portFile, 'utf-8').trim(), 10);
      if (port > 0 && port < 65536) return port;
    }
  } catch {}

  return DEFAULT_SERVER_PORT;
}

function saveServerPortSetting(port: number) {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const portFile = path.join(configDir, 'server-port');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(portFile, String(port), 'utf-8');
  } catch (err) {
    console.error('Failed to save server port:', err);
  }
}

function getAlwaysOnTopSetting(): boolean {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const settingFile = path.join(configDir, 'always-on-top');

  try {
    if (fs.existsSync(settingFile)) {
      return fs.readFileSync(settingFile, 'utf-8').trim() === 'true';
    }
  } catch {}

  return false;
}

function saveAlwaysOnTopSetting(enabled: boolean) {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const settingFile = path.join(configDir, 'always-on-top');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(settingFile, enabled ? 'true' : 'false', 'utf-8');
  } catch (err) {
    console.error('Failed to save always-on-top setting:', err);
  }
}

// Ghost mode persistence
function getGhostModeSetting(): boolean {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const settingFile = path.join(configDir, 'ghost-mode');

  try {
    if (fs.existsSync(settingFile)) {
      return fs.readFileSync(settingFile, 'utf-8').trim() === 'true';
    }
  } catch {}

  return false;
}

function saveGhostModeSetting(enabled: boolean) {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const settingFile = path.join(configDir, 'ghost-mode');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(settingFile, enabled ? 'true' : 'false', 'utf-8');
  } catch (err) {
    console.error('Failed to save ghost mode setting:', err);
  }
}

function getGhostOpacitySetting(): number {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const settingFile = path.join(configDir, 'ghost-opacity');

  try {
    if (fs.existsSync(settingFile)) {
      const val = parseFloat(fs.readFileSync(settingFile, 'utf-8').trim());
      if (val >= 0.1 && val <= 0.5) return val;
    }
  } catch {}

  return 0.25;
}

function saveGhostOpacitySetting(opacity: number) {
  const fs = require('fs') as typeof import('fs');
  const configDir = app.getPath('userData');
  const settingFile = path.join(configDir, 'ghost-opacity');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(settingFile, String(opacity), 'utf-8');
  } catch (err) {
    console.error('Failed to save ghost opacity setting:', err);
  }
}

// Pre-ghost state for restoring when leaving ghost mode
let preGhostState: {
  width: number;
  height: number;
  alwaysOnTop: boolean;
} | null = null;

const COLLAPSED_SIDEBAR_WIDTH = 380;

async function createWindow() {
  const isClientMode = !isDev && getConnectionMode() === 'client';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: COLLAPSED_SIDEBAR_WIDTH,
    minHeight: 400,
    title: 'Liquid Relay',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (getAlwaysOnTopSetting()) {
    mainWindow.setAlwaysOnTop(true, 'floating');
  }

  // Always reset ghost mode on startup — app should open in normal mode
  if (getGhostModeSetting()) {
    saveGhostModeSetting(false);
  }

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${serverPort}`);
    mainWindow.webContents.openDevTools();
  } else if (isClientMode) {
    const remoteUrl = getRemoteServerUrl();
    if (remoteUrl) {
      const url = remoteUrl.startsWith('http') ? remoteUrl : `http://${remoteUrl}`;
      mainWindow.loadURL(url);
    } else {
      // No remote URL configured — fall back to local server
      console.warn('Client mode enabled but no remote server URL configured, falling back to server mode');
      mainWindow.loadURL(`http://localhost:${serverPort}`);
    }
  } else {
    mainWindow.loadURL(`http://localhost:${serverPort}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startApp() {
  try {
    // Load enabled devices from disk
    loadEnabledDevices();

    // Sync smart naming setting to env for server process
    process.env.SNAPSEND_SMART_NAMING = getSmartNamingSetting() ? 'true' : 'false';

    const connectionMode = isDev ? 'server' : getConnectionMode();
    const isClientMode = connectionMode === 'client' && !isDev;
    const remoteUrl = isClientMode ? getRemoteServerUrl() : '';

    // Expose client mode to preload via env
    process.env.SNAPSEND_CLIENT_MODE = (isClientMode && remoteUrl) ? 'true' : 'false';

    if (isDev) {
      // In dev mode, the server is started separately via `npm run dev`
      serverPort = 5000;
    } else if (isClientMode && remoteUrl) {
      // Client mode: skip server startup entirely
      console.log(`Liquid Relay starting in client mode, connecting to: ${remoteUrl}`);
    } else {
      // Server mode (default): start local Express server
      if (isClientMode && !remoteUrl) {
        console.warn('Client mode enabled but no remote URL — falling back to server mode');
        process.env.SNAPSEND_CLIENT_MODE = 'false';
      }

      const userData = app.getPath('userData');
      process.env.ELECTRON = 'true';
      process.env.NODE_ENV = 'production';
      process.env.SNAPSEND_DATA_DIR = path.join(userData, 'data');
      process.env.SNAPSEND_UPLOADS_DIR = path.join(userData, 'uploads');

      const configuredPort = getServerPortSetting();
      const serverModule = require('../dist/index.js');
      const result = await serverModule.startServer({
        port: configuredPort,
        onP2PFileReceived: (data: any) => {
          console.log(`[Main] onP2PFileReceived: file="${data.file?.originalName}" from="${data.fromDevice}"`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('file-received', {
              file: data.file,
              fromDevice: data.fromDevice,
            });
          } else {
            console.warn(`[Main] onP2PFileReceived: mainWindow missing or destroyed!`);
          }
        },
        onPeerHandshake: (ws: any, peerId: string, peerName: string) => {
          // When a remote peer connects to our Express server, register the
          // incoming WebSocket in PeerConnectionManager so we can send files
          // back through the same connection.
          const pm = getPeerManager();
          if (pm) {
            pm.handleIncomingHandshake(ws, peerId, peerName);
          }
          // Also add to discovery so the UI shows this peer
          if (discovery) {
            discovery.addIncomingPeer(peerId, peerName);
          }
        },
        onFileSaved: (data: { fileId: number; filename: string; mimeType: string; originalName: string; size: number; isClipboard: boolean; fromDeviceName: string }) => {
          console.log(`onFileSaved: id=${data.fileId} file="${data.filename}" mime=${data.mimeType} clipboard=${data.isClipboard} smartNaming=${process.env.SNAPSEND_SMART_NAMING}`);
          // Async smart rename — non-blocking, silent failure
          if (process.env.SNAPSEND_SMART_NAMING === 'true') {
            // Only auto-rename clipboard items and screenshots
            const isScreenshot = data.originalName.startsWith('screenshot-');
            const shouldAutoRename = data.isClipboard || isScreenshot;
            if (!shouldAutoRename) {
              console.log(`Smart Naming: skipping auto-rename for "${data.originalName}" (not clipboard/screenshot)`);
              return;
            }
            const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
            const filePath = path.join(uploadsDir, data.filename);
            const context: SmartNameContext = {
              fileId: data.fileId,
              filename: data.filename,
              mimeType: data.mimeType,
              originalName: data.originalName,
              size: data.size,
              isClipboard: data.isClipboard,
              fromDeviceName: data.fromDeviceName,
            };
            generateSmartName(filePath, context)
              .then((result) => {
                if (result && mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('smart-renamed', {
                    fileId: data.fileId,
                    newName: result.suggestedName,
                  });
                }
              })
              .catch(() => {}); // Silent failure
          }
        },
      });
      serverPort = result.port;
      serverInstance = result.server;
      console.log(`Liquid Relay server started on port ${serverPort}`);
    }

    await createWindow();

    // In client mode, skip mDNS discovery and P2P IPC registration
    if (!isClientMode || !remoteUrl) {
      const deviceId = getOrCreateDeviceId();
      const deviceName = getDeviceName();
      discovery = new DiscoveryManager(deviceId, deviceName, serverPort);

      if (mainWindow) {
        const discoveryIPC = registerDiscoveryIPC(mainWindow, discovery);
        reconnectDisconnectedPeers = discoveryIPC.reconnectDisconnectedPeers;
        const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
        registerP2PIPC(mainWindow, discovery, deviceId, deviceName, serverPort, uploadsDir);
      }

      // Wake/unlock recovery: clean up dead connections, restart discovery, reconnect.
      // Debounced: resume + unlock-screen often fire within seconds of each other.
      let lastWakeRecovery = 0;
      let wakeReconnectTimer: ReturnType<typeof setTimeout> | null = null;

      const handleWakeRecovery = (source: string) => {
        const now = Date.now();
        if (now - lastWakeRecovery < 10000) {
          console.log(`[Power] ${source} — skipping (debounced, last recovery ${Math.round((now - lastWakeRecovery) / 1000)}s ago)`);
          return;
        }
        lastWakeRecovery = now;
        console.log(`[Power] ${source} — cleaning up dead connections and restarting discovery`);

        // 1. Close all dead WebSocket connections + notify renderer
        const pm = getPeerManager();
        if (pm) {
          pm.disconnectAll();
        }

        // 2. Reset retry backoff for fresh start
        resetPeerRetries();

        // 3. Restart mDNS discovery (peers preserved for immediate reconnect)
        if (discovery) {
          discovery.restart();
        }

        // 4. Delay reconnect to let network come back and discovery re-confirm peers.
        //    Cancel any pending timer from a previous event.
        if (wakeReconnectTimer) clearTimeout(wakeReconnectTimer);
        wakeReconnectTimer = setTimeout(() => {
          wakeReconnectTimer = null;
          if (reconnectDisconnectedPeers) {
            console.log(`[Power] Attempting peer reconnection after ${source}`);
            reconnectDisconnectedPeers();
          }
          // Second wave at 20s — network may still be settling
          setTimeout(() => {
            if (reconnectDisconnectedPeers) {
              console.log('[Power] Second reconnection wave');
              reconnectDisconnectedPeers();
            }
          }, 10000);
        }, 10000);
      };

      powerMonitor.on('resume', () => handleWakeRecovery('System resumed from sleep'));
      powerMonitor.on('unlock-screen', () => handleWakeRecovery('Screen unlocked'));

      console.log(`Liquid Relay ready: device="${deviceName}" id=${deviceId} port=${serverPort}`);
    } else {
      console.log('Liquid Relay ready in client mode');
    }
    // Auto-launch Ollama if smart naming is enabled (non-blocking)
    if (getSmartNamingSetting()) {
      ensureOllamaRunning().catch(() => {});
    }
  } catch (error) {
    console.error('Failed to start Liquid Relay:', error);
    app.quit();
  }
}

// Graceful shutdown
function gracefulShutdown() {
  console.log('Liquid Relay shutting down...');

  // Stop Ollama if we started it
  stopOllama();

  // Stop P2P connections
  const peerMgr = getPeerManager();
  if (peerMgr) {
    peerMgr.disconnectAll();
  }

  // Stop mDNS
  if (discovery) {
    discovery.stop();
    discovery = null;
  }

  // Stop Express server
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }

  // Clean up screenshot temp files and overlays
  cleanupScreenshotTemp();

  // Close log stream
  closeLogStream();
}

// IPC handlers
ipcMain.handle('get-server-port', () => serverPort);
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-device-name', () => getDeviceName());
ipcMain.handle('set-device-name', (_event, name: string) => {
  saveDeviceName(name);
  if (discovery) {
    discovery.updateName(name);
  }
});

// Port setting IPC handlers
ipcMain.handle('get-port-setting', () => getServerPortSetting());
ipcMain.handle('set-port-setting', (_event, port: number) => {
  if (port > 0 && port < 65536) {
    saveServerPortSetting(port);
  }
});

// Always on top IPC handlers
ipcMain.handle('get-always-on-top', () => getAlwaysOnTopSetting());
ipcMain.handle('set-always-on-top', (_event, enabled: boolean) => {
  saveAlwaysOnTopSetting(enabled);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(enabled, 'floating');
  }
});

// Hidden app screenshot — resize to 1440x900, capture, restore
ipcMain.handle('capture-app-screenshot', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, reason: 'No window' };
  }
  const [origWidth, origHeight] = mainWindow.getSize();
  try {
    mainWindow.setSize(1440, 900);
    // Wait for resize + render to settle
    await new Promise((resolve) => setTimeout(resolve, 500));
    const image = await mainWindow.webContents.capturePage();
    const screenshotDir = path.join(os.homedir(), 'Desktop');
    const screenshotPath = path.join(screenshotDir, `LiquidRelay-${Date.now()}.png`);
    const fs = require('fs') as typeof import('fs');
    fs.writeFileSync(screenshotPath, image.toPNG());
    return { success: true, filePath: screenshotPath };
  } catch (err: any) {
    return { success: false, reason: err.message };
  } finally {
    mainWindow.setSize(origWidth, origHeight);
  }
});

// Window size IPC handler
ipcMain.handle('set-window-size', (_event, width: number, height: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(width, height);
  }
});
ipcMain.handle('get-window-size', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [width, height] = mainWindow.getSize();
    return { width, height };
  }
  return { width: 1200, height: 800 };
});

// Ghost mode IPC handlers
ipcMain.handle('get-ghost-mode', () => getGhostModeSetting());
ipcMain.handle('set-ghost-mode', (_event, enabled: boolean) => {
  saveGhostModeSetting(enabled);
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (enabled) {
    // Save pre-ghost state
    const [w, h] = mainWindow.getSize();
    preGhostState = {
      width: w,
      height: h,
      alwaysOnTop: getAlwaysOnTopSetting(),
    };
    const ghostOpacity = getGhostOpacitySetting();
    mainWindow.setOpacity(ghostOpacity);
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setSize(COLLAPSED_SIDEBAR_WIDTH, 580);
  } else {
    // Restore opacity and always-on-top only — renderer handles window sizing
    mainWindow.setOpacity(1.0);
    if (preGhostState) {
      mainWindow.setAlwaysOnTop(preGhostState.alwaysOnTop, 'floating');
      preGhostState = null;
    } else {
      mainWindow.setAlwaysOnTop(getAlwaysOnTopSetting(), 'floating');
    }
  }
});

ipcMain.handle('get-window-opacity', () => getGhostOpacitySetting());
ipcMain.handle('set-window-opacity', (_event, opacity: number) => {
  if (opacity < 0.1 || opacity > 1.0) return;
  // Only persist if within the ghost range (0.1-0.5); higher values are transient hover reveals
  if (opacity <= 0.5) {
    saveGhostOpacitySetting(opacity);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(opacity);
  }
});

// Connection mode IPC handlers
ipcMain.handle('get-connection-mode', () => getConnectionMode());
ipcMain.handle('set-connection-mode', (_event, mode: 'server' | 'client') => {
  saveConnectionMode(mode);
});
ipcMain.handle('get-remote-server-url', () => getRemoteServerUrl());
ipcMain.handle('set-remote-server-url', (_event, url: string) => {
  saveRemoteServerUrl(url);
});

// Device enabled state IPC handlers
ipcMain.handle('is-device-enabled', (_event, deviceUUID: string) => {
  return isDeviceEnabled(deviceUUID);
});
ipcMain.handle('set-device-enabled', (_event, deviceUUID: string, enabled: boolean) => {
  setDeviceEnabled(deviceUUID, enabled);
  // If disabling, disconnect from peer
  if (!enabled) {
    const pm = getPeerManager();
    if (pm && pm.isConnected(deviceUUID)) {
      pm.disconnectFromPeer(deviceUUID);
    }
  }
  // If enabling and peer is discovered, connect
  if (enabled && discovery) {
    const peers = discovery.getPeers();
    const peer = peers.find(p => p.id === deviceUUID);
    if (peer && peer.host && peer.port > 0) {
      const pm = getPeerManager();
      if (pm && !pm.isConnected(deviceUUID)) {
        pm.connectToPeer(peer);
      }
    }
  }
});
ipcMain.handle('get-all-enabled-devices', () => {
  return Object.fromEntries(enabledDevicesCache);
});

// LAN address discovery
ipcMain.handle('get-lan-addresses', () => {
  const os = require('os') as typeof import('os');
  const nets = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
});

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

// License IPC handlers
ipcMain.handle('activate-license', (_event, key: string) => activateLicense(key));
ipcMain.handle('validate-license', () => validateLicense());
ipcMain.handle('deactivate-license', () => deactivateLicense());
ipcMain.handle('get-license-status', () => getLicenseStatus());

// Read clipboard with format detection
ipcMain.handle('read-clipboard-image', () => {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;

  const size = image.getSize();
  return {
    dataURL: image.toDataURL(),
    width: size.width,
    height: size.height,
  };
});

ipcMain.handle('read-clipboard', () => {
  const formats = clipboard.availableFormats();
  console.log('Clipboard formats:', formats);

  // Check for image formats: MIME types + macOS UTIs + Windows formats
  const hasImage = formats.some(f => {
    const lower = f.toLowerCase();
    return lower.startsWith('image/') ||
      lower === 'public.png' || lower === 'public.jpeg' || lower === 'public.tiff' ||
      lower === 'public.heic' || lower === 'com.apple.pict' ||
      lower === 'com.compuserve.gif' || lower === 'public.webp' ||
      lower === 'cf_bitmap' || lower === 'cf_dib' || lower === 'cf_dibv5';
  });
  const hasText = formats.some(f => {
    const lower = f.toLowerCase();
    return lower === 'text/plain' || lower === 'text/html' || lower === 'text/rtf';
  });

  // Prefer image when both are present.
  // Also try readImage() as a fallback even if no known image format was detected,
  // since some apps use non-standard format names.
  if (hasImage || !hasText) {
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const size = image.getSize();
      console.log(`Clipboard: detected image ${size.width}x${size.height}`);
      return {
        type: 'image' as const,
        dataURL: image.toDataURL(),
        mimeType: 'image/png',
        width: size.width,
        height: size.height,
      };
    }
  }

  if (hasText) {
    const text = clipboard.readText();
    if (text) {
      console.log(`Clipboard: detected text (${text.length} chars)`);
      return {
        type: 'text' as const,
        content: text,
        mimeType: 'text/plain',
      };
    }
  }

  // Last resort: try readImage anyway — some apps don't advertise image formats
  const fallbackImage = clipboard.readImage();
  if (!fallbackImage.isEmpty()) {
    const size = fallbackImage.getSize();
    console.log(`Clipboard: fallback detected image ${size.width}x${size.height}`);
    return {
      type: 'image' as const,
      dataURL: fallbackImage.toDataURL(),
      mimeType: 'image/png',
      width: size.width,
      height: size.height,
    };
  }

  return null;
});

// Open file with system default application
ipcMain.handle('open-file', async (_event, filename: string) => {
  const fs = require('fs') as typeof import('fs');
  const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  const filePath = path.join(uploadsDir, filename);

  // Verify file exists before opening
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'File not found' };
  }

  // shell.openPath returns empty string on success, error message on failure
  const result = await shell.openPath(filePath);
  return { success: result === '', error: result || undefined };
});

// Smart Naming IPC handlers
ipcMain.handle('get-smart-naming', () => getSmartNamingSetting());
ipcMain.handle('set-smart-naming', (_event, enabled: boolean) => {
  saveSmartNamingSetting(enabled);
  // Expose to server process via env var
  process.env.SNAPSEND_SMART_NAMING = enabled ? 'true' : 'false';
  // Auto-launch Ollama when enabling
  if (enabled) {
    ensureOllamaRunning().catch(() => {});
  }
});
ipcMain.handle('check-ollama-status', async () => {
  const status = await checkOllamaStatus();
  if (!status.running) {
    // Try to auto-launch if binary exists
    const launched = await ensureOllamaRunning();
    if (launched) return checkOllamaStatus();
  }
  return status;
});
ipcMain.handle('pull-ollama-model', async (_event, modelName: string) => {
  return pullModel(modelName, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ollama-pull-progress', { model: modelName, ...progress });
    }
  });
});
ipcMain.handle('smart-rename-file', async (_event, fileId: number, filename: string, mimeType: string, originalName: string) => {
  const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  const filePath = path.join(uploadsDir, filename);
  const context: SmartNameContext = {
    fileId,
    filename,
    mimeType,
    originalName,
    size: 0,
    isClipboard: false,
    fromDeviceName: '',
  };
  // Try to get file size
  try {
    const fs = require('fs') as typeof import('fs');
    const stat = fs.statSync(filePath);
    context.size = stat.size;
  } catch {}
  const result = await generateSmartName(filePath, context);
  if (result) {
    // Notify renderer so UI can update
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('smart-renamed', { fileId, newName: result.suggestedName });
    }
  }
  return result;
});

// Prompt config/log IPC handlers
ipcMain.handle('get-prompt-config-path', () => getPromptConfigPath());
ipcMain.handle('get-prompt-log-path', () => getPromptLogPath());
ipcMain.handle('open-prompt-config', async () => {
  const configPath = getPromptConfigPath();
  // Ensure file exists before opening
  const fs = require('fs') as typeof import('fs');
  if (!fs.existsSync(configPath)) {
    resetPromptConfig();
  }
  return shell.openPath(configPath);
});
ipcMain.handle('open-prompt-log', async () => {
  const logPath = getPromptLogPath();
  // Ensure file exists before opening
  const fs = require('fs') as typeof import('fs');
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '', 'utf-8');
  }
  return shell.openPath(logPath);
});
ipcMain.handle('clear-prompt-log', () => clearPromptLog());
ipcMain.handle('reset-prompt-config', () => resetPromptConfig());
ipcMain.handle('get-image-model', () => getConfigImageModel());
ipcMain.handle('set-image-model', (_event, model: string) => setConfigImageModel(model));

// Diagnostics IPC handlers
ipcMain.handle('export-diagnostics', async () => {
  try {
    const pm = getPeerManager();
    const diagData = {
      exportedAt: new Date().toISOString(),
      platform: {
        os: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        release: os.release(),
        networkInterfaces: os.networkInterfaces(),
      },
      app: {
        version: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
      },
      device: {
        id: getOrCreateDeviceId(),
        name: getDeviceName(),
        port: serverPort,
        mode: getConnectionMode(),
      },
      discovery: discovery?.getDebugState() || null,
      connections: pm?.getDebugState() || null,
      enabledDevices: Object.fromEntries(enabledDevicesCache),
      logs: readRecentLogLines(500),
    };

    const result = await dialog.showSaveDialog({
      title: 'Export Diagnostics',
      defaultPath: path.join(app.getPath('desktop'), `liquid-relay-diagnostics-${Date.now()}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, reason: 'cancelled' };
    }

    const fs = require('fs') as typeof import('fs');
    fs.writeFileSync(result.filePath, JSON.stringify(diagData, null, 2), 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (err: any) {
    console.error('[Diagnostics] Export failed:', err);
    return { success: false, reason: err.message };
  }
});

ipcMain.handle('open-log-file', async () => {
  const logFile = getLogPath();
  const fs = require('fs') as typeof import('fs');
  // Ensure file exists before opening
  if (!fs.existsSync(logFile)) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, '', 'utf-8');
  }
  return shell.openPath(logFile);
});

// Windows Firewall fix IPC handler
ipcMain.handle('fix-windows-firewall', async () => {
  if (process.platform !== 'win32') {
    return { success: false, reason: 'Not Windows' };
  }
  try {
    const exePath = app.getPath('exe');
    const port = serverPort;
    const ruleName = 'Liquid Relay';

    // Build a script that:
    // 1. Removes any stale rules with our name (idempotent, ignores errors)
    // 2. Removes old "electron" rules that may be blocking
    // 3. Adds fresh inbound TCP allow rule for our exe
    const script = [
      `netsh advfirewall firewall delete rule name="${ruleName}" >nul 2>&1`,
      `netsh advfirewall firewall delete rule name="electron" program="${exePath}" >nul 2>&1`,
      `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow program="${exePath}" protocol=TCP localport=${port} enable=yes profile=private,domain`,
    ].join(' & ');

    // Use PowerShell Start-Process -Verb RunAs to trigger UAC elevation
    const psCommand = `Start-Process cmd.exe -ArgumentList '/c ${script.replace(/"/g, '\\"')}' -Verb RunAs -Wait`;

    const { exec } = require('child_process') as typeof import('child_process');
    return new Promise((resolve) => {
      exec(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { timeout: 30000 }, (err) => {
        if (err) {
          console.error('[Firewall] Fix failed:', err.message);
          if (err.message.includes('canceled') || err.message.includes('cancelled') || (err as any).code === 1) {
            resolve({ success: false, reason: 'UAC prompt was cancelled' });
          } else {
            resolve({ success: false, reason: err.message });
          }
        } else {
          console.log('[Firewall] Rules updated successfully');
          resolve({ success: true });
        }
      });
    });
  } catch (err: any) {
    console.error('[Firewall] Fix error:', err);
    return { success: false, reason: err.message };
  }
});

// Check Firewall — self-probe from each LAN IP
ipcMain.handle('check-firewall', async () => {
  if (process.platform !== 'win32') {
    return { success: true, results: [], message: 'Not Windows — no firewall check needed' };
  }
  const http = require('http') as typeof import('http');
  const nets = os.networkInterfaces();
  const lanIPs: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIPs.push(net.address);
      }
    }
  }
  if (lanIPs.length === 0) {
    return { success: false, results: [], message: 'No LAN interfaces found' };
  }

  const probeResults = await Promise.all(
    lanIPs.map((ip) =>
      new Promise<{ ip: string; reachable: boolean; error?: string }>((resolve) => {
        let done = false;
        const finish = (reachable: boolean, error?: string) => {
          if (done) return;
          done = true;
          req.destroy();
          resolve({ ip, reachable, error });
        };
        const req = http.get(`http://${ip}:${serverPort}/health`, { timeout: 3000 }, (res) => {
          res.resume();
          finish(true);
        });
        req.on('timeout', () => finish(false, 'timeout'));
        req.on('error', (err: any) => finish(false, err.code || err.message));
      })
    )
  );

  const allReachable = probeResults.every((r) => r.reachable);
  const message = allReachable
    ? `All ${probeResults.length} interface(s) reachable — firewall is not blocking.`
    : `${probeResults.filter((r) => !r.reachable).length} of ${probeResults.length} interface(s) blocked.`;

  return { success: allReachable, results: probeResults, message };
});

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  gracefulShutdown();
});

// Export for use by ipc-handlers
export { isDeviceEnabled };
