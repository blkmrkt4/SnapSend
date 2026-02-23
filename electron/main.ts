import { app, BrowserWindow, ipcMain, desktopCapturer, shell, clipboard } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryManager } from './discovery';
import { registerDiscoveryIPC, registerP2PIPC, getPeerManager } from './ipc-handlers';
import { activateLicense, validateLicense, deactivateLicense, getLicenseStatus } from './license';
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
  type SmartNameContext,
} from './smart-naming';

let mainWindow: BrowserWindow | null = null;
let serverPort: number = 5000;
let discovery: DiscoveryManager | null = null;
let serverInstance: any = null;

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

async function createWindow() {
  const isClientMode = !isDev && getConnectionMode() === 'client';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 320,  // Match sidebar width for collapsed mode
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
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('file-received', {
              file: data.file,
              fromDevice: data.fromDevice,
            });
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
        registerDiscoveryIPC(mainWindow, discovery);
        const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
        registerP2PIPC(mainWindow, discovery, deviceId, deviceName, serverPort, uploadsDir);
      }

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
    mainWindow.setSize(320, 535);
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

// Screenshot IPC handler
ipcMain.handle('capture-screenshot', async (_event, mode: 'fullscreen' | 'window') => {
  try {
    const types: ('screen' | 'window')[] = mode === 'window' ? ['window'] : ['screen'];
    const sources = await desktopCapturer.getSources({
      types,
      thumbnailSize: { width: 3840, height: 2160 },
    });

    if (sources.length === 0) return null;

    // For fullscreen, take the first screen; for window, take the first window
    const source = sources[0];
    const thumbnail = source.thumbnail;
    if (thumbnail.isEmpty()) return null;

    return {
      dataURL: thumbnail.toDataURL(),
      width: thumbnail.getSize().width,
      height: thumbnail.getSize().height,
    };
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    return null;
  }
});

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
ipcMain.handle('smart-rename-file', async (_event, fileId: number, filePath: string, mimeType: string, originalName: string) => {
  const context: SmartNameContext = {
    fileId,
    filename: path.basename(filePath),
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
