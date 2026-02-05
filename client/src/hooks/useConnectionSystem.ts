import { useState, useEffect, useCallback, useRef } from 'react';
import { type Device, type Connection, type File } from '@shared/schema';
import '@/types/electron.d.ts';

interface ExtendedFile extends File {
  transferType?: 'sent' | 'received' | 'queued';
  fromDevice?: string;
}

interface PendingFile {
  id: number;
  fileData: any;
  queuedAt: Date;
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
    selectedTargetId: null,
    knownDevices: loadKnownDevices(),
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
        const exists = prev.onlineDevices.some(d => d.socketId === peer.id);
        if (exists) return prev;

        const peerAsDevice: Device = {
          id: 0, // Not used in P2P mode
          name: peer.name,
          uuid: null,
          socketId: peer.id,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        return {
          ...prev,
          onlineDevices: [...prev.onlineDevices, peerAsDevice],
          notifications: [...prev.notifications, {
            id: Date.now(),
            type: 'device-connected',
            title: 'Peer discovered',
            message: `${peer.name} appeared on the network`,
            timestamp: new Date(),
          }],
        };
      });

      // Auto-connect to discovered peer for immediate file transfer capability
      api.connectToPeer?.(peer.id);
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
      setState(prev => ({
        ...prev,
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
      }));
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
          updated[existingIdx] = { id: devId, uuid: devUUID, name: device.name, lastSeen: now };
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
  }, [state.onlineDevices, state.currentDevice]);

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

    // ─── RELAY PATH (Electron P2P): target is a browser client on a peer's server ───
    if (targetId && targetId.startsWith('relay:') && isElectron) {
      const clientId = targetId.replace('relay:', '');
      const targetName = state.onlineDevices.find(d => d.socketId === targetId)?.name || 'device';
      window.electronAPI!.sendRelayFile?.(clientId, fileData).then((sent) => {
        if (sent) {
          setState(prev => ({
            ...prev,
            files: [{
              id: Date.now() + Math.random(),
              filename: fileData.filename,
              originalName: fileData.originalName,
              mimeType: fileData.mimeType,
              size: fileData.size,
              isClipboard: fileData.isClipboard ? 1 : 0,
              transferredAt: new Date().toISOString(),
              transferType: 'sent' as const,
              fromDevice: undefined,
              fromDeviceId: null,
              toDeviceId: null,
              connectionId: null,
              fromDeviceName: null,
              toDeviceName: targetName,
              content: null,
            } as ExtendedFile, ...prev.files],
            notifications: [...prev.notifications, {
              id: Date.now(),
              type: 'file-sent',
              title: fileData.isClipboard ? 'Clipboard shared' : 'File sent',
              message: `${fileData.originalName} sent to ${targetName}`,
              timestamp: new Date(),
            }],
          }));
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
        if (isElectron) {
          window.electronAPI!.sendFile?.(targetConn.peerId, fileData).then((sent) => {
            if (sent) {
              setState(prev => ({
                ...prev,
                files: [{
                  id: Date.now() + Math.random(),
                  filename: fileData.filename,
                  originalName: fileData.originalName,
                  mimeType: fileData.mimeType,
                  size: fileData.size,
                  isClipboard: fileData.isClipboard ? 1 : 0,
                  transferredAt: new Date().toISOString(),
                  transferType: 'sent' as const,
                  fromDevice: undefined,
                  fromDeviceId: null,
                  toDeviceId: null,
                  connectionId: null,
                  fromDeviceName: null,
                  toDeviceName: targetConn.partnerName || null,
                  content: null,
                } as ExtendedFile, ...prev.files],
                notifications: [...prev.notifications, {
                  id: Date.now(),
                  type: 'file-sent',
                  title: fileData.isClipboard ? 'Clipboard shared' : 'File sent',
                  message: `${fileData.originalName} sent to ${targetConn.partnerName || 'device'}`,
                  timestamp: new Date(),
                }],
              }));
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

      // No active connection to selected target — queue the file
      const pendingId = Date.now() + Math.random();
      const targetName = state.onlineDevices.find(d => d.socketId === targetId)?.name || 'selected device';
      setState(prev => ({
        ...prev,
        pendingFiles: [...prev.pendingFiles, { id: pendingId, fileData, queuedAt: new Date() }],
        files: [{
          id: pendingId,
          filename: fileData.filename,
          originalName: fileData.originalName,
          mimeType: fileData.mimeType,
          size: fileData.size,
          content: fileData.content,
          isClipboard: fileData.isClipboard ? 1 : 0,
          transferredAt: new Date().toISOString(),
          transferType: 'queued' as const,
          fromDevice: undefined,
          fromDeviceId: null,
          toDeviceId: null,
          connectionId: null,
          fromDeviceName: null,
          toDeviceName: targetName,
        } as ExtendedFile, ...prev.files],
        notifications: [...prev.notifications, {
          id: Date.now(),
          type: 'file-queued',
          title: 'File queued',
          message: `${fileData.originalName} queued for delivery`,
          timestamp: new Date(),
        }],
      }));
      return;
    }

    // No target selected — broadcast to all (original behavior)
    if (state.connections.length === 0) {
      // No connections at all — queue it
      const pendingId = Date.now() + Math.random();
      setState(prev => ({
        ...prev,
        pendingFiles: [...prev.pendingFiles, { id: pendingId, fileData, queuedAt: new Date() }],
        files: [{
          id: pendingId,
          filename: fileData.filename,
          originalName: fileData.originalName,
          mimeType: fileData.mimeType,
          size: fileData.size,
          content: fileData.content,
          isClipboard: fileData.isClipboard ? 1 : 0,
          transferredAt: new Date().toISOString(),
          transferType: 'queued' as const,
          fromDevice: undefined,
          fromDeviceId: null,
          toDeviceId: null,
          connectionId: null,
          fromDeviceName: null,
          toDeviceName: null,
        } as ExtendedFile, ...prev.files],
        notifications: [...prev.notifications, {
          id: Date.now(),
          type: 'file-queued',
          title: 'File queued',
          message: `${fileData.originalName} queued — connect to a device to send`,
          timestamp: new Date(),
        }],
      }));
      return;
    }

    if (isElectron) {
      let sentCount = 0;
      const sendPromises = state.connections.map(conn =>
        window.electronAPI!.sendFile?.(conn.peerId, fileData).then(sent => {
          if (sent) sentCount++;
        })
      );
      Promise.all(sendPromises).then(() => {
        if (sentCount > 0) {
          setState(prev => ({
            ...prev,
            files: [{
              id: Date.now() + Math.random(),
              filename: fileData.filename,
              originalName: fileData.originalName,
              mimeType: fileData.mimeType,
              size: fileData.size,
              isClipboard: fileData.isClipboard ? 1 : 0,
              transferredAt: new Date().toISOString(),
              transferType: 'sent' as const,
              fromDevice: undefined,
              fromDeviceId: null,
              toDeviceId: null,
              connectionId: null,
              fromDeviceName: null,
              toDeviceName: null,
              content: null,
            } as ExtendedFile, ...prev.files],
            notifications: [...prev.notifications, {
              id: Date.now(),
              type: 'file-sent',
              title: fileData.isClipboard ? 'Clipboard shared' : 'File sent',
              message: `${fileData.originalName} sent to ${sentCount} device${sentCount > 1 ? 's' : ''}`,
              timestamp: new Date(),
            }],
          }));
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

  // Load persisted files from the database once setup completes
  useEffect(() => {
    if (state.isSetup) {
      refreshFiles();
    }
  }, [state.isSetup, refreshFiles]);

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
  useEffect(() => {
    if (state.pendingFiles.length === 0 || state.connections.length === 0) return;

    const targetId = state.selectedTargetId;

    // If a target is selected, check if it's now connected
    if (targetId) {
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
        if (isElectron) {
          window.electronAPI!.sendFile?.(targetConn.peerId, pending.fileData);
        } else if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'file-transfer',
            data: { ...pending.fileData, targetConnectionId: targetConn.id }
          }));
        }
      }
      return;
    }

    // No target selected — flush to first available connection (broadcast)
    const filesToSend = [...state.pendingFiles];
    const pendingIds = filesToSend.map(p => p.id);

    setState(prev => ({
      ...prev,
      pendingFiles: [],
      files: prev.files.filter(f => !pendingIds.includes(f.id)),
    }));

    for (const pending of filesToSend) {
      if (isElectron) {
        for (const conn of state.connections) {
          window.electronAPI!.sendFile?.(conn.peerId, pending.fileData);
        }
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'file-transfer',
          data: pending.fileData
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
    refreshDiscovery,
  };
}
