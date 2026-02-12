import { useState, useEffect, useCallback, useRef } from 'react';
import { type Device, type Connection, type File, type ChunkedTransferState, CHUNK_SIZE, CHUNK_THRESHOLD } from '@shared/schema';
import '@/types/electron.d.ts';

// Special ID representing "this device" (local save only, no send)
export const LOCAL_DEVICE_ID = '__local__';

interface ExtendedFile extends File {
  transferType?: 'sent' | 'received' | 'queued' | 'saved';
  fromDevice?: string;
}

interface PendingFile {
  id: number;
  fileData: any;
  queuedAt: Date;
}

export interface ChunkedTransferProgress {
  transferId: string;
  originalName: string;
  progress: number;
  direction: 'send' | 'receive';
  totalSize: number;
}

export interface KnownDevice {
  id: string;       // socketId — transient connection identifier
  uuid: string;     // stable identity (persisted in localStorage)
  name: string;     // latest known display name
  lastSeen: string; // ISO timestamp
}

export interface ConnectionSystemState {
  isSetup: boolean;
  isConnecting: boolean;
  currentDevice: Device | null;
  onlineDevices: Device[];
  connections: any[];
  files: ExtendedFile[];
  notifications: any[];
  isElectronMode: boolean;
  pendingFiles: PendingFile[];
  selectedTargetId: string | null;
  knownDevices: KnownDevice[];
  allTags: string[];
  chunkedTransfers: ChunkedTransferProgress[];
}

function loadKnownDevices(): KnownDevice[] {
  try {
    const raw = localStorage.getItem('snapsend-known-devices');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveKnownDevices(devices: KnownDevice[]) {
  localStorage.setItem('snapsend-known-devices', JSON.stringify(devices));
}

// Promise that resolves with the device name (fetches from Electron if available)
let deviceNamePromise: Promise<string> | null = null;

async function getDeviceNameAsync(): Promise<string> {
  // In Electron, get the name from main process (synced with mDNS broadcast)
  const api = (window as any).electronAPI;
  if (api?.getDeviceName) {
    try {
      const name = await api.getDeviceName();
      if (name) {
        localStorage.setItem('snapsend-device-name', name); // Keep in sync
        return name;
      }
    } catch {}
  }

  // Fallback: localStorage or auto-generate
  const saved = localStorage.getItem('snapsend-device-name');
  if (saved) return saved;

  // Auto-generate a name from platform info
  const ua = navigator.userAgent;
  let base = 'Device';
  if (/Macintosh|Mac OS/.test(ua)) base = 'Mac';
  else if (/Windows/.test(ua)) base = 'Windows-PC';
  else if (/Linux/.test(ua)) base = 'Linux-PC';
  else if (/iPhone/.test(ua)) base = 'iPhone';
  else if (/Android/.test(ua)) base = 'Android';

  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const name = `${base}-${suffix}`;
  localStorage.setItem('snapsend-device-name', name);
  return name;
}

function getOrCreateDeviceName(): string {
  // Sync version: return cached localStorage value (will be updated async)
  const saved = localStorage.getItem('snapsend-device-name');
  if (saved) return saved;

  // Auto-generate (same logic as async version)
  const ua = navigator.userAgent;
  let base = 'Device';
  if (/Macintosh|Mac OS/.test(ua)) base = 'Mac';
  else if (/Windows/.test(ua)) base = 'Windows-PC';
  else if (/Linux/.test(ua)) base = 'Linux-PC';
  else if (/iPhone/.test(ua)) base = 'iPhone';
  else if (/Android/.test(ua)) base = 'Android';

  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const name = `${base}-${suffix}`;
  localStorage.setItem('snapsend-device-name', name);
  return name;
}

// Pre-fetch device name on module load (populates localStorage before WS connects)
if (typeof window !== 'undefined') {
  deviceNamePromise = getDeviceNameAsync();
}

function getOrCreateDeviceUUID(): string {
  const saved = localStorage.getItem('snapsend-device-uuid');
  if (saved) return saved;
  const uuid = crypto.randomUUID();
  localStorage.setItem('snapsend-device-uuid', uuid);
  return uuid;
}

export function useConnectionSystem() {
  // Use P2P mode only in packaged Electron (not dev, not client mode). In dev or client mode, use WebSocket like browser mode.
  const isClientMode = !!window.electronAPI?.isClientMode;
  const isElectronP2P = !!window.electronAPI?.isElectron && !window.electronAPI?.isDev && !isClientMode;
  const isElectron = isElectronP2P;

  const [state, setState] = useState<ConnectionSystemState>({
    isSetup: false,
    isConnecting: false,
    currentDevice: null,
    onlineDevices: [],
    connections: [],
    files: [],
    notifications: [],
    isElectronMode: isElectron,
    pendingFiles: [],
    selectedTargetId: LOCAL_DEVICE_ID, // Default to "This Device" (local save only)
    knownDevices: loadKnownDevices(),
    allTags: [],
    chunkedTransfers: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ────────────────────────────────────────────
  // Electron mDNS peer discovery and IPC events
  // Set up listeners whenever electronAPI exists (even in dev mode)
  // ────────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // Listen for mDNS peer events
    api.onPeerDiscovered?.((peer) => {
      setState(prev => {
        // Check if already in onlineDevices
        const existsInDevices = prev.onlineDevices.some(d => d.socketId === peer.id);
        // Check if already connected (to avoid showing "Pair" button for already-paired peers)
        const alreadyConnected = prev.connections.some(c => c.peerId === peer.id);

        if (existsInDevices) return prev;

        const peerAsDevice: Device = {
          id: 0, // Not used in P2P mode
          name: peer.name,
          uuid: null,
          socketId: peer.id,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        // Only show notification if not already connected
        const newNotifications = alreadyConnected ? prev.notifications : [...prev.notifications, {
          id: Date.now(),
          type: 'device-connected',
          title: 'Peer discovered',
          message: `${peer.name} appeared on the network`,
          timestamp: new Date(),
        }];

        return {
          ...prev,
          onlineDevices: [...prev.onlineDevices, peerAsDevice],
          notifications: newNotifications,
        };
      });

      // Note: Auto-connect is handled by the main process in ipc-handlers.ts
      // Don't call connectToPeer here to avoid redundant connection attempts
      // for incoming peers (which have invalid host/port)
    });

    api.onPeerLost?.((peerId) => {
      setState(prev => {
        const lost = prev.onlineDevices.find(d => d.socketId === peerId);
        return {
          ...prev,
          onlineDevices: prev.onlineDevices.filter(d => d.socketId !== peerId),
          connections: prev.connections.filter(c => c.peerId !== peerId),
          notifications: lost ? [...prev.notifications, {
            id: Date.now(),
            type: 'device-disconnected',
            title: 'Peer lost',
            message: `${lost.name} left the network`,
            timestamp: new Date(),
          }] : prev.notifications,
        };
      });
    });

    // P2P connection events (Phase 4)
    api.onPeerConnected?.((peer) => {
      setState(prev => {
        // Check if already connected (avoid duplicates)
        const alreadyConnected = prev.connections.some(c => c.peerId === peer.id);
        if (alreadyConnected) return prev;

        // Also ensure the peer is in onlineDevices (for incoming connections)
        const existsInDevices = prev.onlineDevices.some(d => d.socketId === peer.id);
        const updatedOnlineDevices = existsInDevices ? prev.onlineDevices : [...prev.onlineDevices, {
          id: 0,
          name: peer.name,
          uuid: null,
          socketId: peer.id,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Device];

        return {
          ...prev,
          onlineDevices: updatedOnlineDevices,
          connections: [...prev.connections, {
            id: peer.id,
            peerId: peer.id,
            partnerName: peer.name,
            status: 'active',
          }],
          notifications: [...prev.notifications, {
            id: Date.now(),
            type: 'pair-accepted',
            title: 'Connected',
            message: `Connected to ${peer.name}`,
            timestamp: new Date(),
          }],
        };
      });
    });

    api.onPeerDisconnected?.((peerId) => {
      setState(prev => {
        const conn = prev.connections.find(c => c.peerId === peerId);
        return {
          ...prev,
          connections: prev.connections.filter(c => c.peerId !== peerId),
          notifications: conn ? [...prev.notifications, {
            id: Date.now(),
            type: 'connection-terminated',
            title: 'Disconnected',
            message: `Disconnected from ${conn.partnerName}`,
            timestamp: new Date(),
          }] : prev.notifications,
        };
      });
    });

    api.onFileReceived?.((data) => {
      setState(prev => ({
        ...prev,
        files: [{ ...data.file, transferType: 'received', fromDevice: data.fromDevice }, ...prev.files],
        notifications: [...prev.notifications, {
          id: Date.now(),
          type: 'file',
          title: 'File received',
          message: `${data.file.originalName} from ${data.fromDevice}`,
          file: data.file,
          timestamp: new Date(),
        }],
      }));
    });

    // Relay devices: browser clients connected to a peer's server
    api.onRelayDevicesUpdated?.((devices) => {
      setState(prev => {
        // Remove old relay devices
        const nonRelay = prev.onlineDevices.filter(d => !d.socketId?.startsWith('relay:'));
        // Add new relay devices
        const relayDevices: Device[] = devices.map(d => ({
          id: 0,
          name: d.name,
          uuid: null,
          socketId: `relay:${d.id}`,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }));
        return { ...prev, onlineDevices: [...nonRelay, ...relayDevices] };
      });
    });

    // Load initial peers
    api.getPeers?.().then(peers => {
      const peerDevices: Device[] = peers.map(p => ({
        id: 0,
        name: p.name,
        uuid: null,
        socketId: p.id,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }));
      setState(prev => ({ ...prev, onlineDevices: peerDevices }));
    });

    // Listen for chunked transfer progress
    api.onChunkProgress?.((data) => {
      setState(prev => {
        const existingIndex = prev.chunkedTransfers.findIndex(t => t.transferId === data.transferId);
        if (existingIndex >= 0) {
          // Update existing transfer
          const updated = [...prev.chunkedTransfers];
          updated[existingIndex] = { ...updated[existingIndex], progress: data.progress };
          // Remove if complete
          if (data.progress >= 100) {
            updated.splice(existingIndex, 1);
          }
          return { ...prev, chunkedTransfers: updated };
        }
        // New transfer (will be added with full info when we send)
        return prev;
      });
    });
  }, []);

  // ────────────────────────────────────────────
  // WebSocket connection (browser mode)
  // ────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (isElectron) return; // Skip WebSocket in Electron mode
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    let host = window.location.host;
    if (window.electronAPI?.getServerPort && !window.electronAPI?.isClientMode) {
      try {
        const port = await window.electronAPI.getServerPort();
        host = `localhost:${port}`;
      } catch {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message.type, message.data);

        switch (message.type) {
          case 'setup-required': {
            // Auto-setup with persisted (or Electron-provided) device name + UUID
            setState(prev => ({ ...prev, isConnecting: true }));
            getDeviceNameAsync().then(deviceName => {
              const deviceUUID = getOrCreateDeviceUUID();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'device-setup',
                  data: { name: deviceName, uuid: deviceUUID }
                }));
              }
            });
            break;
          }

          case 'setup-complete':
            setState(prev => ({
              ...prev,
              isSetup: true,
              isConnecting: false,
              currentDevice: message.data.device,
              onlineDevices: message.data.onlineDevices || [],
            }));
            break;

          case 'device-connected': {
            const connDevice = message.data.device;
            setState(prev => {
              // Update knownDevices: if a device with this UUID already exists, update its name
              let updatedKnown = prev.knownDevices;
              if (connDevice.uuid) {
                const existingIdx = updatedKnown.findIndex(k => k.uuid === connDevice.uuid);
                if (existingIdx >= 0 && updatedKnown[existingIdx].name !== connDevice.name) {
                  updatedKnown = [...updatedKnown];
                  updatedKnown[existingIdx] = { ...updatedKnown[existingIdx], name: connDevice.name };
                  saveKnownDevices(updatedKnown);
                }
              }
              return {
                ...prev,
                onlineDevices: message.data.onlineDevices || prev.onlineDevices,
                knownDevices: updatedKnown,
                notifications: [...prev.notifications, {
                  id: Date.now(),
                  type: 'device-connected',
                  title: 'Device connected',
                  message: `${connDevice.name} came online`,
                  timestamp: new Date()
                }]
              };
            });
            break;
          }

          case 'device-disconnected':
            setState(prev => ({
              ...prev,
              onlineDevices: message.data.onlineDevices || prev.onlineDevices,
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'device-disconnected',
                title: 'Device disconnected',
                message: `${message.data.device.name} went offline`,
                timestamp: new Date()
              }]
            }));
            break;

          case 'pair-accepted': {
            const conn = message.data.connection;
            setState(prev => {
              if (prev.connections.some(c => c.id === conn.id)) return prev;
              return {
                ...prev,
                connections: [...prev.connections, {
                  ...conn,
                  partnerName: message.data.partnerDevice?.name || 'Unknown'
                }],
                notifications: [...prev.notifications, {
                  id: Date.now(),
                  type: 'pair-accepted',
                  title: 'Paired',
                  message: `Connected to ${message.data.partnerDevice?.name || 'device'}`,
                  timestamp: new Date()
                }]
              };
            });
            break;
          }

          case 'auto-paired': {
            const conn = message.data.connection;
            setState(prev => {
              if (prev.connections.some(c => c.id === conn.id)) return prev;
              return {
                ...prev,
                connections: [...prev.connections, {
                  ...conn,
                  partnerName: message.data.partnerDevice?.name || 'Unknown'
                }],
                notifications: [...prev.notifications, {
                  id: Date.now(),
                  type: 'auto-paired',
                  title: 'Auto-paired',
                  message: `Automatically connected to ${message.data.partnerDevice?.name || 'device'}`,
                  timestamp: new Date()
                }]
              };
            });
            break;
          }

          case 'connection-terminated':
            setState(prev => ({
              ...prev,
              connections: prev.connections.filter(c => c.id !== message.data.connectionId),
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'connection-terminated',
                title: 'Disconnected',
                message: `Connection terminated by ${message.data.terminatedBy}`,
                timestamp: new Date()
              }]
            }));
            break;

          case 'file-received':
            setState(prev => ({
              ...prev,
              files: [{ ...message.data.file, transferType: 'received', fromDevice: message.data.fromDevice }, ...prev.files],
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'file',
                title: 'File received',
                message: `${message.data.file.originalName} from ${message.data.fromDevice}`,
                file: message.data.file,
                timestamp: new Date()
              }]
            }));
            break;

          case 'clipboard-sync':
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(message.data.content).catch(console.error);
            }
            break;

          case 'file-sent-confirmation': {
            const sentFile = message.data.file;
            if (sentFile) {
              setState(prev => ({
                ...prev,
                files: [{ ...sentFile, transferType: 'sent' }, ...prev.files],
                notifications: [...prev.notifications, {
                  id: Date.now(),
                  type: 'file-sent',
                  title: message.data.isClipboard ? 'Clipboard shared' : 'File sent',
                  message: `${message.data.filename} sent to ${message.data.recipientCount} device${message.data.recipientCount > 1 ? 's' : ''}`,
                  timestamp: new Date()
                }]
              }));
            }
            break;
          }

          case 'name-updated':
            setState(prev => {
              const updatedDevice = message.data.device;
              // Update knownDevices if a peer with the same UUID changed name
              const updatedKnown = prev.knownDevices.map(k =>
                k.uuid === updatedDevice.uuid ? { ...k, name: updatedDevice.name } : k
              );
              saveKnownDevices(updatedKnown);
              return {
                ...prev,
                currentDevice: updatedDevice,
                knownDevices: updatedKnown,
              };
            });
            break;

          case 'error':
            setState(prev => ({
              ...prev,
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'error',
                title: 'Error',
                message: message.data.message,
                timestamp: new Date()
              }]
            }));
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      wsRef.current = null;

      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setState(prev => ({
        ...prev,
        notifications: [...prev.notifications, {
          id: Date.now(),
          type: 'error',
          title: 'Connection Error',
          message: 'WebSocket connection failed',
          timestamp: new Date()
        }]
      }));
    };
  }, [isElectron]);

  useEffect(() => {
    if (isElectron) {
      // In Electron mode, auto-setup with persisted device name
      window.electronAPI!.getLocalDevice?.().then(device => {
        setState(prev => ({
          ...prev,
          isSetup: true,
          currentDevice: {
            id: 0,
            name: device.name,
            uuid: null,
            socketId: device.id,
            isOnline: true,
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        }));
      });
      return;
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, isElectron]);

  // ────────────────────────────────────────────
  // Track known devices (persist across sessions)
  // ────────────────────────────────────────────
  useEffect(() => {
    if (state.onlineDevices.length === 0) return;

    setState(prev => {
      const now = new Date().toISOString();
      const updated: KnownDevice[] = [];

      // Helper to check if a device is connected
      const isConnected = (socketId: string) =>
        prev.connections.some(c => c.peerId === socketId);

      // Build fresh list from current online devices (excluding self)
      for (const device of prev.onlineDevices) {
        const devId = device.socketId;
        if (!devId) continue;
        if (prev.currentDevice && devId === prev.currentDevice.socketId) continue;

        const devUUID = (device as any).uuid || '';

        // Deduplicate by UUID (stable identity), fall back to name
        const existingIdx = devUUID
          ? updated.findIndex(k => k.uuid === devUUID)
          : updated.findIndex(k => !k.uuid && k.name === device.name);

        if (existingIdx >= 0) {
          // Only replace if the new entry is connected and the old one isn't
          // (prefer entries that have active connections)
          const existingConnected = isConnected(updated[existingIdx].id);
          const newConnected = isConnected(devId);
          if (newConnected && !existingConnected) {
            updated[existingIdx] = { id: devId, uuid: devUUID, name: device.name, lastSeen: now };
          } else if (!existingConnected && !newConnected) {
            // Both unconnected - update with newer info
            updated[existingIdx] = { id: devId, uuid: devUUID, name: device.name, lastSeen: now };
          }
          // If existing is connected, keep it (don't replace with unconnected)
        } else {
          updated.push({ id: devId, uuid: devUUID, name: device.name, lastSeen: now });
        }
      }

      // Merge in previously known devices not currently online (deduplicated by UUID)
      // Skip legacy entries without a UUID — they can't be deduplicated reliably
      for (const known of prev.knownDevices) {
        if (!known.uuid) continue;
        if (updated.some(k => k.uuid === known.uuid)) continue;
        updated.push(known);
      }

      saveKnownDevices(updated);
      return { ...prev, knownDevices: updated };
    });
  }, [state.onlineDevices, state.currentDevice, state.connections]);

  // ────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────
  const setupDevice = useCallback((name: string) => {
    if (isElectron) {
      // In Electron, save name and update state
      window.electronAPI!.setDeviceName?.(name);
      setState(prev => ({
        ...prev,
        isSetup: true,
        currentDevice: prev.currentDevice ? { ...prev.currentDevice, name } : null,
      }));
      return;
    }

    localStorage.setItem('snapsend-device-name', name.trim());

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // If already set up, send a name-update instead of re-running device-setup
      const msgType = state.isSetup ? 'device-name-update' : 'device-setup';
      const uuid = getOrCreateDeviceUUID();
      wsRef.current.send(JSON.stringify({
        type: msgType,
        data: { name, uuid }
      }));
      if (!state.isSetup) {
        setState(prev => ({ ...prev, isConnecting: true }));
      }
    }
  }, [isElectron, state.isSetup]);

  const pairWithDevice = useCallback((targetDeviceId: number | string) => {
    if (isElectron) {
      // In Electron mode, connect to peer via IPC
      const peerId = typeof targetDeviceId === 'string' ? targetDeviceId : targetDeviceId.toString();
      window.electronAPI!.connectToPeer?.(peerId);
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'pair-request',
        data: { targetDeviceId }
      }));
    }
  }, [isElectron]);

  const terminateConnection = useCallback((connectionId: number | string) => {
    if (isElectron) {
      const peerId = typeof connectionId === 'string' ? connectionId : connectionId.toString();
      window.electronAPI!.disconnectFromPeer?.(peerId);
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'terminate-connection',
        data: { connectionId }
      }));
    }
  }, [isElectron]);

  const sendFile = useCallback((fileData: any) => {
    const targetId = state.selectedTargetId;

    // ─── LOCAL DEVICE (save locally only, no send, no queue) ───
    if (targetId === LOCAL_DEVICE_ID) {
      (async () => {
        try {
          const response = await fetch('/api/files/record-sent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: fileData.filename,
              originalName: fileData.originalName,
              mimeType: fileData.mimeType,
              size: fileData.size,
              content: fileData.content,
              isClipboard: fileData.isClipboard,
              toDeviceName: 'local',
            }),
          });
          const savedFile = response.ok ? await response.json() : null;

          setState(prev => ({
            ...prev,
            files: [{
              ...(savedFile || {
                id: Date.now() + Math.random(),
                filename: fileData.filename,
                originalName: fileData.originalName,
                mimeType: fileData.mimeType,
                size: fileData.size,
                content: fileData.content,
                isClipboard: fileData.isClipboard ? 1 : 0,
                transferredAt: new Date().toISOString(),
                fromDeviceId: null,
                toDeviceId: null,
                connectionId: null,
                fromDeviceName: null,
                toDeviceName: 'local',
              }),
              transferType: 'saved' as const,
              fromDevice: undefined,
            } as ExtendedFile, ...prev.files],
            notifications: [...prev.notifications, {
              id: Date.now(),
              type: 'file-saved',
              title: fileData.isClipboard ? 'Clipboard saved' : 'File saved',
              message: `${fileData.originalName} saved to this device`,
              timestamp: new Date(),
            }],
          }));
        } catch (error) {
          console.error('Error saving file locally:', error);
        }
      })();
      return;
    }

    // ─── RELAY PATH (Electron P2P): target is a browser client on a peer's server ───
    if (targetId && targetId.startsWith('relay:') && isElectron) {
      const clientId = targetId.replace('relay:', '');
      const targetName = state.onlineDevices.find(d => d.socketId === targetId)?.name || 'device';
      window.electronAPI!.sendRelayFile?.(clientId, fileData).then(async (sent) => {
        if (sent) {
          // Persist sent file to database
          try {
            const response = await fetch('/api/files/record-sent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: fileData.filename,
                originalName: fileData.originalName,
                mimeType: fileData.mimeType,
                size: fileData.size,
                content: fileData.content,
                isClipboard: fileData.isClipboard,
                toDeviceName: targetName,
              }),
            });
            const savedFile = response.ok ? await response.json() : null;

            setState(prev => ({
              ...prev,
              files: [{
                ...(savedFile || {
                  id: Date.now() + Math.random(),
                  filename: fileData.filename,
                  originalName: fileData.originalName,
                  mimeType: fileData.mimeType,
                  size: fileData.size,
                  isClipboard: fileData.isClipboard ? 1 : 0,
                  transferredAt: new Date().toISOString(),
                  fromDeviceId: null,
                  toDeviceId: null,
                  connectionId: null,
                  fromDeviceName: null,
                  toDeviceName: targetName,
                  content: null,
                }),
                transferType: 'sent' as const,
                fromDevice: undefined,
              } as ExtendedFile, ...prev.files],
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'file-sent',
                title: fileData.isClipboard ? 'Clipboard shared' : 'File sent',
                message: `${fileData.originalName} sent to ${targetName}`,
                timestamp: new Date(),
              }],
            }));
          } catch (error) {
            console.error('Error persisting sent file:', error);
          }
        }
      });
      return;
    }

    // ─── RELAY PATH (Browser): target is a P2P peer on the server ───
    if (targetId && targetId.startsWith('peer:') && !isElectron) {
      const peerId = targetId.replace('peer:', '');
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'file-transfer',
          data: { ...fileData, targetPeerId: peerId }
        }));
      }
      return;
    }

    // If a target is selected, check if we have an active connection to it
    if (targetId) {
      const targetConn = state.connections.find(
        (c: any) => c.peerId === targetId || c.id === targetId || String(c.id) === targetId
      );

      if (targetConn) {
        // Send directly to the targeted connection
        if (window.electronAPI?.sendFile) {
          // Check if we should use chunked transfer for large files
          const useChunked = fileData.size > CHUNK_THRESHOLD && window.electronAPI.sendChunkedFile;

          const sendPromise = useChunked
            ? (async () => {
                // Add to chunked transfers for progress tracking
                const transferId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                setState(prev => ({
                  ...prev,
                  chunkedTransfers: [...prev.chunkedTransfers, {
                    transferId,
                    originalName: fileData.originalName,
                    progress: 0,
                    direction: 'send' as const,
                    totalSize: fileData.size,
                  }],
                  notifications: [...prev.notifications, {
                    id: Date.now(),
                    type: 'info',
                    title: 'Large file transfer',
                    message: `Starting chunked transfer of ${fileData.originalName}...`,
                    timestamp: new Date(),
                  }],
                }));
                return window.electronAPI!.sendChunkedFile!(targetConn.peerId, fileData);
              })()
            : window.electronAPI.sendFile(targetConn.peerId, fileData);

          sendPromise.then(async (sent) => {
            if (sent) {
              // Persist sent file to database
              try {
                const response = await fetch('/api/files/record-sent', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filename: fileData.filename,
                    originalName: fileData.originalName,
                    mimeType: fileData.mimeType,
                    size: fileData.size,
                    content: useChunked ? null : fileData.content, // Don't store large file content in DB
                    isClipboard: fileData.isClipboard,
                    toDeviceName: targetConn.partnerName,
                  }),
                });
                const savedFile = response.ok ? await response.json() : null;

                setState(prev => ({
                  ...prev,
                  files: [{
                    ...(savedFile || {
                      id: Date.now() + Math.random(),
                      filename: fileData.filename,
                      originalName: fileData.originalName,
                      mimeType: fileData.mimeType,
                      size: fileData.size,
                      isClipboard: fileData.isClipboard ? 1 : 0,
                      transferredAt: new Date().toISOString(),
                      fromDeviceId: null,
                      toDeviceId: null,
                      connectionId: null,
                      fromDeviceName: null,
                      toDeviceName: targetConn.partnerName || null,
                      content: null,
                    }),
                    transferType: 'sent' as const,
                    fromDevice: undefined,
                  } as ExtendedFile, ...prev.files],
                  notifications: [...prev.notifications, {
                    id: Date.now(),
                    type: 'file-sent',
                    title: fileData.isClipboard ? 'Clipboard shared' : 'File sent',
                    message: `${fileData.originalName} sent to ${targetConn.partnerName || 'device'}`,
                    timestamp: new Date(),
                  }],
                }));
              } catch (error) {
                console.error('Error persisting sent file:', error);
              }
            }
          });
        } else if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'file-transfer',
            data: { ...fileData, targetConnectionId: targetConn.id }
          }));
        }
        return;
      }

      // No active connection to selected target — save locally and queue for later
      const targetName = state.onlineDevices.find(d => d.socketId === targetId)?.name || 'selected device';
      (async () => {
        try {
          const response = await fetch('/api/files/record-sent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: fileData.filename,
              originalName: fileData.originalName,
              mimeType: fileData.mimeType,
              size: fileData.size,
              content: fileData.content,
              isClipboard: fileData.isClipboard,
              toDeviceName: targetName,
            }),
          });
          const savedFile = response.ok ? await response.json() : null;
          const fileId = savedFile?.id || (Date.now() + Math.random());

          setState(prev => ({
            ...prev,
            pendingFiles: [...prev.pendingFiles, { id: fileId, fileData, queuedAt: new Date() }],
            files: [{
              ...(savedFile || {
                id: fileId,
                filename: fileData.filename,
                originalName: fileData.originalName,
                mimeType: fileData.mimeType,
                size: fileData.size,
                content: fileData.content,
                isClipboard: fileData.isClipboard ? 1 : 0,
                transferredAt: new Date().toISOString(),
                fromDeviceId: null,
                toDeviceId: null,
                connectionId: null,
                fromDeviceName: null,
                toDeviceName: targetName,
              }),
              transferType: 'queued' as const,
              fromDevice: undefined,
            } as ExtendedFile, ...prev.files],
            notifications: [...prev.notifications, {
              id: Date.now(),
              type: 'file-queued',
              title: 'File queued',
              message: `${fileData.originalName} queued for delivery`,
              timestamp: new Date(),
            }],
          }));
        } catch (error) {
          console.error('Error saving queued file:', error);
        }
      })();
      return;
    }

    // No target selected (All Connected Devices) — broadcast to all
    if (state.connections.length === 0) {
      // No connections — save locally (security: no queuing for "All Devices" mode)
      (async () => {
        try {
          const response = await fetch('/api/files/record-sent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: fileData.filename,
              originalName: fileData.originalName,
              mimeType: fileData.mimeType,
              size: fileData.size,
              content: fileData.content,
              isClipboard: fileData.isClipboard,
              toDeviceName: 'local',
            }),
          });
          const savedFile = response.ok ? await response.json() : null;

          setState(prev => ({
            ...prev,
            files: [{
              ...(savedFile || {
                id: Date.now() + Math.random(),
                filename: fileData.filename,
                originalName: fileData.originalName,
                mimeType: fileData.mimeType,
                size: fileData.size,
                content: fileData.content,
                isClipboard: fileData.isClipboard ? 1 : 0,
                transferredAt: new Date().toISOString(),
                fromDeviceId: null,
                toDeviceId: null,
                connectionId: null,
                fromDeviceName: null,
                toDeviceName: 'local',
              }),
              transferType: 'sent' as const,
              fromDevice: undefined,
            } as ExtendedFile, ...prev.files],
            notifications: [...prev.notifications, {
              id: Date.now(),
              type: 'file-sent',
              title: fileData.isClipboard ? 'Clipboard saved' : 'File saved',
              message: `No devices connected — ${fileData.originalName} saved locally`,
              timestamp: new Date(),
            }],
          }));
        } catch (error) {
          console.error('Error saving file locally:', error);
        }
      })();
      return;
    }

    if (window.electronAPI?.sendFile) {
      // Check if we should use chunked transfer for large files
      const useChunked = fileData.size > CHUNK_THRESHOLD && window.electronAPI.sendChunkedFile;

      if (useChunked) {
        // For chunked transfers to multiple devices, add progress tracking
        const transferId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        setState(prev => ({
          ...prev,
          chunkedTransfers: [...prev.chunkedTransfers, {
            transferId,
            originalName: fileData.originalName,
            progress: 0,
            direction: 'send' as const,
            totalSize: fileData.size,
          }],
          notifications: [...prev.notifications, {
            id: Date.now(),
            type: 'info',
            title: 'Large file transfer',
            message: `Starting chunked transfer of ${fileData.originalName} to ${state.connections.length} device(s)...`,
            timestamp: new Date(),
          }],
        }));
      }

      let sentCount = 0;
      const sendPromises = state.connections.map(conn => {
        const sendFn = useChunked
          ? window.electronAPI!.sendChunkedFile!(conn.peerId, fileData)
          : window.electronAPI!.sendFile!(conn.peerId, fileData);
        return sendFn.then(sent => {
          if (sent) sentCount++;
        });
      });

      Promise.all(sendPromises).then(async () => {
        if (sentCount > 0) {
          // Persist sent file to database
          try {
            const response = await fetch('/api/files/record-sent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: fileData.filename,
                originalName: fileData.originalName,
                mimeType: fileData.mimeType,
                size: fileData.size,
                content: useChunked ? null : fileData.content, // Don't store large file content
                isClipboard: fileData.isClipboard,
                toDeviceName: `${sentCount} device${sentCount > 1 ? 's' : ''}`,
              }),
            });
            const savedFile = response.ok ? await response.json() : null;

            setState(prev => ({
              ...prev,
              files: [{
                ...(savedFile || {
                  id: Date.now() + Math.random(),
                  filename: fileData.filename,
                  originalName: fileData.originalName,
                  mimeType: fileData.mimeType,
                  size: fileData.size,
                  isClipboard: fileData.isClipboard ? 1 : 0,
                  transferredAt: new Date().toISOString(),
                  fromDeviceId: null,
                  toDeviceId: null,
                  connectionId: null,
                  fromDeviceName: null,
                  toDeviceName: null,
                  content: null,
                }),
                transferType: 'sent' as const,
                fromDevice: undefined,
              } as ExtendedFile, ...prev.files],
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'file-sent',
                title: fileData.isClipboard ? 'Clipboard shared' : 'File sent',
                message: `${fileData.originalName} sent to ${sentCount} device${sentCount > 1 ? 's' : ''}`,
                timestamp: new Date(),
              }],
            }));
          } catch (error) {
            console.error('Error persisting sent file:', error);
          }
        }
      });
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'file-transfer',
        data: fileData
      }));
    }
  }, [isElectron, state.connections, state.selectedTargetId, state.onlineDevices]);

  const dismissNotification = useCallback((id: number) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id)
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
  }, []);

  const clearAllFiles = useCallback(() => {
    setState(prev => ({ ...prev, files: [] }));
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const [filesResponse, devicesResponse] = await Promise.all([
        fetch('/api/files'),
        fetch('/api/devices')
      ]);

      if (filesResponse.ok && devicesResponse.ok) {
        const fetchedFiles = await filesResponse.json();
        const devices = await devicesResponse.json();
        const deviceMap = new Map(devices.map((d: any) => [d.id, d.name]));

        setState(prev => {
          const currentName = prev.currentDevice?.name;
          const currentId = prev.currentDevice?.id;

          return {
            ...prev,
            files: fetchedFiles.map((file: any) => {
              // Determine transfer direction: check DB device IDs first, then P2P name fields
              const isSent = file.fromDeviceId != null
                ? file.fromDeviceId === currentId
                : file.fromDeviceName === currentName || file.toDeviceName === 'local';
              const fromName = file.fromDeviceId != null
                ? deviceMap.get(file.fromDeviceId) || file.fromDeviceName || 'Unknown'
                : file.fromDeviceName || 'Unknown';

              return {
                ...file,
                transferType: isSent ? 'sent' : 'received',
                fromDevice: isSent ? undefined : fromName,
              };
            })
          };
        });
      }
    } catch (error) {
      console.error('Error refreshing files:', error);
    }
  }, []);

  const refreshTags = useCallback(async () => {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        const tags = await response.json();
        setState(prev => ({ ...prev, allTags: tags }));
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }, []);

  // Load persisted files and tags from the database once setup completes
  useEffect(() => {
    if (state.isSetup) {
      refreshFiles();
      refreshTags();
    }
  }, [state.isSetup, refreshFiles, refreshTags]);

  const deleteFile = useCallback(async (fileId: number) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      if (response.ok) {
        setState(prev => ({
          ...prev,
          files: prev.files.filter(file => file.id !== fileId),
          notifications: [...prev.notifications, {
            id: Date.now(),
            type: 'success',
            title: 'File deleted',
            message: 'File has been permanently deleted',
            timestamp: new Date()
          }]
        }));
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }, []);

  const renameFile = useCallback(async (fileId: number, newName: string) => {
    // Optimistically update state immediately
    setState(prev => ({
      ...prev,
      files: prev.files.map(f => f.id === fileId ? { ...f, originalName: newName } : f),
    }));

    try {
      await fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalName: newName }),
      });
    } catch (error) {
      console.error('Error renaming file:', error);
      // Revert on failure by refreshing from DB
      refreshFiles();
    }
  }, [refreshFiles]);

  const updateFileTags = useCallback(async (fileId: number, tags: string[]) => {
    // Optimistically update state immediately
    setState(prev => ({
      ...prev,
      files: prev.files.map(f =>
        f.id === fileId ? { ...f, tags: JSON.stringify(tags) } : f
      ),
    }));

    try {
      await fetch(`/api/files/${fileId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      // Refresh all tags list to include any new tags
      refreshTags();
    } catch (error) {
      console.error('Error updating file tags:', error);
      // Revert on failure by refreshing from DB
      refreshFiles();
    }
  }, [refreshFiles, refreshTags]);

  const addTag = useCallback(async (name: string) => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) return;

    // Optimistically add to state
    setState(prev => ({
      ...prev,
      allTags: prev.allTags.includes(cleanName)
        ? prev.allTags
        : [...prev.allTags, cleanName].sort(),
    }));

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({ ...prev, allTags: data.tags }));
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      refreshTags();
    }
  }, [refreshTags]);

  const deleteTag = useCallback(async (tag: string) => {
    // Optimistically update state - remove tag from allTags and from all files
    setState(prev => ({
      ...prev,
      allTags: prev.allTags.filter(t => t !== tag),
      files: prev.files.map(f => {
        if (!f.tags) return f;
        try {
          const fileTags: string[] = JSON.parse(f.tags);
          const newTags = fileTags.filter(t => t !== tag);
          return { ...f, tags: newTags.length > 0 ? JSON.stringify(newTags) : null };
        } catch {
          return f;
        }
      }),
    }));

    try {
      const response = await fetch(`/api/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({ ...prev, allTags: data.tags }));
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      // Revert on failure
      refreshFiles();
      refreshTags();
    }
  }, [refreshFiles, refreshTags]);

  const setSelectedTarget = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedTargetId: id }));
  }, []);

  const refreshDiscovery = useCallback(() => {
    if (isElectron) {
      // Restart mDNS discovery
      window.electronAPI!.restartDiscovery?.();
    } else {
      // In browser mode, reconnect WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
      connect();
    }
  }, [isElectron, connect]);

  // Auto-flush pending files when a matching connection appears
  // NOTE: Only flushes for specific device targets, NOT for "All Devices" (security)
  useEffect(() => {
    if (state.pendingFiles.length === 0 || state.connections.length === 0) return;

    const targetId = state.selectedTargetId;

    // Never auto-flush for LOCAL_DEVICE_ID or null (All Devices)
    // - LOCAL_DEVICE_ID files are saved locally, never queued
    // - null (All Devices) files are saved locally when no connections; we don't want
    //   files to auto-send to whoever connects later (security protection)
    if (!targetId || targetId === LOCAL_DEVICE_ID) return;

    // A specific target is selected — check if it's now connected
    const targetConn = state.connections.find(
      (c: any) => c.peerId === targetId || c.id === targetId || String(c.id) === targetId
    );
    if (!targetConn) return; // Target not yet connected

    // Flush all pending files to this target
    const filesToSend = [...state.pendingFiles];
    const pendingIds = filesToSend.map(p => p.id);

    // Clear pending files from state first
    setState(prev => ({
      ...prev,
      pendingFiles: prev.pendingFiles.filter(p => !pendingIds.includes(p.id)),
      // Remove the "pending" file entries — they'll be re-added by the send confirmation
      files: prev.files.filter(f => !pendingIds.includes(f.id)),
    }));

    // Send each queued file
    for (const pending of filesToSend) {
      if (window.electronAPI?.sendFile) {
        window.electronAPI.sendFile(targetConn.peerId, pending.fileData);
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'file-transfer',
          data: { ...pending.fileData, targetConnectionId: targetConn.id }
        }));
      }
    }
  }, [state.connections, state.selectedTargetId, state.pendingFiles, isElectron]);

  return {
    ...state,
    setupDevice,
    pairWithDevice,
    terminateConnection,
    sendFile,
    setSelectedTarget,
    dismissNotification,
    clearAllNotifications,
    clearAllFiles,
    refreshFiles,
    deleteFile,
    renameFile,
    updateFileTags,
    addTag,
    deleteTag,
    refreshTags,
    refreshDiscovery,
  };
}
