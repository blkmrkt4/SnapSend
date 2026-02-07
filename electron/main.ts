import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryManager } from './discovery';
import { registerDiscoveryIPC, registerP2PIPC, getPeerManager } from './ipc-handlers';
import { activateLicense, validateLicense, deactivateLicense, getLicenseStatus } from './license';

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

async function createWindow() {
  const isClientMode = !isDev && getConnectionMode() === 'client';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Liquid Relay',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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
        registerP2PIPC(mainWindow, discovery, deviceId, deviceName, serverPort);
      }

      console.log(`Liquid Relay ready: device="${deviceName}" id=${deviceId} port=${serverPort}`);
    } else {
      console.log('Liquid Relay ready in client mode');
    }
  } catch (error) {
    console.error('Failed to start Liquid Relay:', error);
    app.quit();
  }
}

// Graceful shutdown
function gracefulShutdown() {
  console.log('Liquid Relay shutting down...');

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

// Connection mode IPC handlers
ipcMain.handle('get-connection-mode', () => getConnectionMode());
ipcMain.handle('set-connection-mode', (_event, mode: 'server' | 'client') => {
  saveConnectionMode(mode);
});
ipcMain.handle('get-remote-server-url', () => getRemoteServerUrl());
ipcMain.handle('set-remote-server-url', (_event, url: string) => {
  saveRemoteServerUrl(url);
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
