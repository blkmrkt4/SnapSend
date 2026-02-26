import { contextBridge, ipcRenderer } from 'electron';

const isDev = process.env.SNAPSEND_ELECTRON_DEV === 'true';
const isClientMode = process.env.SNAPSEND_CLIENT_MODE === 'true';

contextBridge.exposeInMainWorld('electronAPI', {
  // Core
  isElectron: true,
  isDev,
  isClientMode,
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Device identity
  getDeviceName: () => ipcRenderer.invoke('get-device-name'),
  setDeviceName: (name: string) => ipcRenderer.invoke('set-device-name', name),

  // mDNS Discovery
  getPeers: () => ipcRenderer.invoke('get-peers'),
  getLocalDevice: () => ipcRenderer.invoke('get-local-device'),
  onPeerDiscovered: (callback: (peer: any) => void) => {
    ipcRenderer.on('peer-discovered', (_event, peer) => callback(peer));
  },
  onPeerLost: (callback: (peerId: string) => void) => {
    ipcRenderer.on('peer-lost', (_event, peerId) => callback(peerId));
  },

  // P2P Connections
  connectToPeer: (peerId: string) => ipcRenderer.invoke('connect-to-peer', peerId),
  disconnectFromPeer: (peerId: string) => ipcRenderer.invoke('disconnect-from-peer', peerId),
  sendFile: (peerId: string, fileData: any) => ipcRenderer.invoke('send-file-to-peer', peerId, fileData),
  onPeerConnected: (callback: (peer: any) => void) => {
    ipcRenderer.on('peer-connected', (_event, peer) => callback(peer));
  },
  onPeerDisconnected: (callback: (peerId: string) => void) => {
    ipcRenderer.on('peer-disconnected', (_event, peerId) => callback(peerId));
  },
  onFileReceived: (callback: (data: any) => void) => {
    ipcRenderer.on('file-received', (_event, data) => callback(data));
  },
  onRelayDevicesUpdated: (callback: (devices: { id: string; name: string }[]) => void) => {
    ipcRenderer.on('relay-devices-updated', (_event, devices) => callback(devices));
  },
  sendRelayFile: (targetClientId: string, fileData: any) => ipcRenderer.invoke('send-relay-file', targetClientId, fileData),
  restartDiscovery: () => ipcRenderer.invoke('restart-discovery'),

  // Chunked file transfer
  sendChunkedFile: (peerId: string, fileData: any) => ipcRenderer.invoke('send-chunked-file-to-peer', peerId, fileData),
  onChunkProgress: (callback: (data: { transferId: string; progress: number; direction: 'send' | 'receive' }) => void) => {
    ipcRenderer.on('chunk-progress', (_event, data) => callback(data));
  },
  shouldUseChunkedTransfer: (size: number) => ipcRenderer.invoke('should-use-chunked-transfer', size),

  // Get currently connected peers (for sync on mount)
  getConnectedPeers: () => ipcRenderer.invoke('get-connected-peers'),

  // Port setting
  getPortSetting: () => ipcRenderer.invoke('get-port-setting'),
  setPortSetting: (port: number) => ipcRenderer.invoke('set-port-setting', port),

  // Connection mode
  getConnectionMode: () => ipcRenderer.invoke('get-connection-mode'),
  setConnectionMode: (mode: string) => ipcRenderer.invoke('set-connection-mode', mode),
  getRemoteServerUrl: () => ipcRenderer.invoke('get-remote-server-url'),
  setRemoteServerUrl: (url: string) => ipcRenderer.invoke('set-remote-server-url', url),
  getLanAddresses: () => ipcRenderer.invoke('get-lan-addresses'),

  // Device enabled state (for auto-connect control)
  isDeviceEnabled: (deviceUUID: string) => ipcRenderer.invoke('is-device-enabled', deviceUUID),
  setDeviceEnabled: (deviceUUID: string, enabled: boolean) => ipcRenderer.invoke('set-device-enabled', deviceUUID, enabled),
  getAllEnabledDevices: () => ipcRenderer.invoke('get-all-enabled-devices'),

  // Screenshot
  screenshotSelectArea: () => ipcRenderer.invoke('screenshot-select-area'),
  screenshotWindowNative: () => ipcRenderer.invoke('screenshot-window-native'),
  screenshotListWindows: () => ipcRenderer.invoke('screenshot-list-windows'),
  screenshotWindowById: (sourceId: string, fullResDataURL: string, width: number, height: number) =>
    ipcRenderer.invoke('screenshot-window-by-id', sourceId, fullResDataURL, width, height),
  screenshotFullscreen: (displayId?: number | string) => ipcRenderer.invoke('screenshot-fullscreen', displayId),
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),

  // Clipboard
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),

  // License
  activateLicense: (key: string) => ipcRenderer.invoke('activate-license', key),
  validateLicense: () => ipcRenderer.invoke('validate-license'),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),

  // Window settings
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  setAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke('set-always-on-top', enabled),

  // Window size
  setWindowSize: (width: number, height: number) => ipcRenderer.invoke('set-window-size', width, height),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),

  // Ghost mode
  getGhostMode: () => ipcRenderer.invoke('get-ghost-mode'),
  setGhostMode: (enabled: boolean) => ipcRenderer.invoke('set-ghost-mode', enabled),
  getWindowOpacity: () => ipcRenderer.invoke('get-window-opacity'),
  setWindowOpacity: (opacity: number) => ipcRenderer.invoke('set-window-opacity', opacity),

  // File operations
  openFile: (filename: string) => ipcRenderer.invoke('open-file', filename),

  // Smart Naming
  getSmartNaming: () => ipcRenderer.invoke('get-smart-naming'),
  setSmartNaming: (enabled: boolean) => ipcRenderer.invoke('set-smart-naming', enabled),
  checkOllamaStatus: () => ipcRenderer.invoke('check-ollama-status'),
  pullOllamaModel: (name: string) => ipcRenderer.invoke('pull-ollama-model', name),
  smartRenameFile: (fileId: number, filePath: string, mimeType: string, originalName: string) =>
    ipcRenderer.invoke('smart-rename-file', fileId, filePath, mimeType, originalName),
  onOllamaPullProgress: (callback: (data: { model: string; status: string; percent?: number }) => void) => {
    ipcRenderer.on('ollama-pull-progress', (_event, data) => callback(data));
  },
  onSmartRenamed: (callback: (data: { fileId: number; newName: string }) => void) => {
    ipcRenderer.on('smart-renamed', (_event, data) => callback(data));
  },

  // Prompt config/log
  getPromptConfigPath: () => ipcRenderer.invoke('get-prompt-config-path'),
  getPromptLogPath: () => ipcRenderer.invoke('get-prompt-log-path'),
  openPromptConfig: () => ipcRenderer.invoke('open-prompt-config'),
  openPromptLog: () => ipcRenderer.invoke('open-prompt-log'),
  clearPromptLog: () => ipcRenderer.invoke('clear-prompt-log'),
  resetPromptConfig: () => ipcRenderer.invoke('reset-prompt-config'),
  getImageModel: () => ipcRenderer.invoke('get-image-model'),
  setImageModel: (model: string) => ipcRenderer.invoke('set-image-model', model),

  // Diagnostics
  exportDiagnostics: () => ipcRenderer.invoke('export-diagnostics'),
  openLogFile: () => ipcRenderer.invoke('open-log-file'),
  fixWindowsFirewall: () => ipcRenderer.invoke('fix-windows-firewall'),
});
