export interface ElectronAPI {
  // Core
  isElectron: boolean;
  isDev: boolean;
  isClientMode: boolean;
  getServerPort: () => Promise<number>;
  getPlatform: () => Promise<string>;

  // Device identity
  getDeviceName: () => Promise<string>;
  setDeviceName: (name: string) => Promise<void>;

  // mDNS discovery
  getPeers: () => Promise<PeerInfo[]>;
  getLocalDevice: () => Promise<{ id: string; name: string }>;
  onPeerDiscovered: (callback: (peer: PeerInfo) => void) => void;
  onPeerLost: (callback: (peerId: string) => void) => void;

  // P2P connections
  connectToPeer: (peerId: string) => Promise<void>;
  disconnectFromPeer: (peerId: string) => Promise<void>;
  sendFile: (peerId: string, fileData: any) => Promise<boolean>;
  onPeerConnected: (callback: (peer: PeerInfo) => void) => void;
  onPeerDisconnected: (callback: (peerId: string) => void) => void;
  onFileReceived: (callback: (data: { file: any; fromDevice: string }) => void) => void;
  onRelayDevicesUpdated?: (callback: (devices: { id: string; name: string }[]) => void) => void;
  sendRelayFile?: (targetClientId: string, fileData: any) => Promise<boolean>;
  restartDiscovery?: () => Promise<void>;

  // Chunked file transfer
  sendChunkedFile?: (peerId: string, fileData: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    filePath?: string;
    content?: string;
    isClipboard?: boolean;
  }) => Promise<boolean>;
  onChunkProgress?: (callback: (data: { transferId: string; progress: number; direction: 'send' | 'receive' }) => void) => void;
  shouldUseChunkedTransfer?: (size: number) => boolean;

  // Screenshot
  captureScreenshot: (mode: 'fullscreen' | 'window') => Promise<{ dataURL: string; width: number; height: number } | null>;

  // Clipboard
  readClipboardImage: () => Promise<{ dataURL: string; width: number; height: number } | null>;

  // Port setting
  getPortSetting: () => Promise<number>;
  setPortSetting: (port: number) => Promise<void>;

  // Connection mode
  getConnectionMode: () => Promise<string>;
  setConnectionMode: (mode: string) => Promise<void>;
  getRemoteServerUrl: () => Promise<string>;
  setRemoteServerUrl: (url: string) => Promise<void>;
  getLanAddresses: () => Promise<string[]>;

  // License
  activateLicense: (key: string) => Promise<{ success: boolean; error?: string; customerName?: string }>;
  validateLicense: () => Promise<{ isActivated: boolean; customerName?: string }>;
  deactivateLicense: () => Promise<void>;
  getLicenseStatus: () => Promise<LicenseStatus>;

  // File operations
  openFile: (filename: string) => Promise<{ success: boolean; error?: string }>;
}

export interface LicenseStatus {
  isActivated: boolean;
  key?: string;
  instanceId?: string;
  customerName?: string;
  expiresAt?: string;
  lastValidated?: string;
}

export interface PeerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
}

declare global {
  const __APP_VERSION__: string;
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
