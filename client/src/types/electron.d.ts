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

  // Get currently connected peers (for sync on mount)
  getConnectedPeers?: () => Promise<PeerInfo[]>;

  // Screenshot
  captureScreenshot: (mode: 'fullscreen' | 'window') => Promise<{ dataURL: string; width: number; height: number } | null>;

  // Clipboard
  readClipboardImage: () => Promise<{ dataURL: string; width: number; height: number } | null>;
  readClipboard?: () => Promise<ClipboardReadResult | null>;

  // Port setting
  getPortSetting: () => Promise<number>;
  setPortSetting: (port: number) => Promise<void>;

  // Connection mode
  getConnectionMode: () => Promise<string>;
  setConnectionMode: (mode: string) => Promise<void>;
  getRemoteServerUrl: () => Promise<string>;
  setRemoteServerUrl: (url: string) => Promise<void>;
  getLanAddresses: () => Promise<string[]>;

  // Device enabled state (for auto-connect control)
  isDeviceEnabled?: (deviceUUID: string) => Promise<boolean>;
  setDeviceEnabled?: (deviceUUID: string, enabled: boolean) => Promise<void>;
  getAllEnabledDevices?: () => Promise<Record<string, boolean>>;

  // License
  activateLicense: (key: string) => Promise<{ success: boolean; error?: string; customerName?: string }>;
  validateLicense: () => Promise<{ isActivated: boolean; customerName?: string }>;
  deactivateLicense: () => Promise<void>;
  getLicenseStatus: () => Promise<LicenseStatus>;

  // Window settings
  getAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (enabled: boolean) => Promise<void>;

  // Window size
  setWindowSize: (width: number, height: number) => Promise<void>;
  getWindowSize: () => Promise<{ width: number; height: number }>;

  // Ghost mode
  getGhostMode: () => Promise<boolean>;
  setGhostMode: (enabled: boolean) => Promise<void>;
  getWindowOpacity: () => Promise<number>;
  setWindowOpacity: (opacity: number) => Promise<void>;

  // File operations
  openFile: (filename: string) => Promise<{ success: boolean; error?: string }>;

  // Smart Naming
  getSmartNaming: () => Promise<boolean>;
  setSmartNaming: (enabled: boolean) => Promise<void>;
  checkOllamaStatus: () => Promise<OllamaStatus>;
  pullOllamaModel: (name: string) => Promise<boolean>;
  smartRenameFile: (fileId: number, filePath: string, mimeType: string, originalName: string) => Promise<SmartNameResult | null>;
  onOllamaPullProgress: (callback: (data: OllamaPullProgress) => void) => void;
  onSmartRenamed: (callback: (data: { fileId: number; newName: string }) => void) => void;

  // Prompt config/log
  getPromptConfigPath: () => Promise<string>;
  getPromptLogPath: () => Promise<string>;
  openPromptConfig: () => Promise<string>;
  openPromptLog: () => Promise<string>;
  clearPromptLog: () => Promise<void>;
  resetPromptConfig: () => Promise<void>;
}

export interface LicenseStatus {
  isActivated: boolean;
  key?: string;
  instanceId?: string;
  customerName?: string;
  expiresAt?: string;
  lastValidated?: string;
}

export interface OllamaStatus {
  running: boolean;
  models: string[];
}

export interface SmartNameResult {
  suggestedName: string;
}

export interface OllamaPullProgress {
  model: string;
  status: string;
  percent?: number;
}

export type ClipboardReadResult =
  | { type: 'image'; dataURL: string; mimeType: string; width: number; height: number }
  | { type: 'text'; content: string; mimeType: string };

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
