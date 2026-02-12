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

  // Port setting
  getPortSetting: () => ipcRenderer.invoke('get-port-setting'),
  setPortSetting: (port: number) => ipcRenderer.invoke('set-port-setting', port),

  // Connection mode
  getConnectionMode: () => ipcRenderer.invoke('get-connection-mode'),
  setConnectionMode: (mode: string) => ipcRenderer.invoke('set-connection-mode', mode),
  getRemoteServerUrl: () => ipcRenderer.invoke('get-remote-server-url'),
  setRemoteServerUrl: (url: string) => ipcRenderer.invoke('set-remote-server-url', url),
  getLanAddresses: () => ipcRenderer.invoke('get-lan-addresses'),

  // Screenshot
  captureScreenshot: (mode: 'fullscreen' | 'window') => ipcRenderer.invoke('capture-screenshot', mode),

  // Clipboard
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),

  // License
  activateLicense: (key: string) => ipcRenderer.invoke('activate-license', key),
  validateLicense: () => ipcRenderer.invoke('validate-license'),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),

  // File operations
  openFile: (filename: string) => ipcRenderer.invoke('open-file', filename),
});
