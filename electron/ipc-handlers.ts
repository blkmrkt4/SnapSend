import { ipcMain, type BrowserWindow } from 'electron';
import { DiscoveryManager, type PeerInfo } from './discovery';
import { PeerConnectionManager } from './peer-connection';
import { isDeviceEnabled } from './main';

// Chunked transfer threshold (must match shared/schema.ts)
const CHUNK_THRESHOLD = 70 * 1024 * 1024; // 70MB

let peerManager: PeerConnectionManager | null = null;
let reconnectInterval: ReturnType<typeof setInterval> | null = null;

// Reconnect backoff state. Backoff grows exponentially up to MAX_DELAY_MS,
// then keeps trying forever at that interval. We never permanently abandon
// a peer — a LAN device that's offline now may come back any time, and
// silently giving up makes the app look broken to the user.
const peerRetryCount: Map<string, number> = new Map();
const peerLastAttempt: Map<string, number> = new Map();
const BASE_DELAY_MS = 5000; // 5s base
const MAX_DELAY_MS = 60 * 1000; // 1 min cap (was 5 min — too slow for LAN reality)

export function resetPeerRetries(): void {
  peerRetryCount.clear();
  peerLastAttempt.clear();
  console.log('[IPC] Peer retry counters reset');
}

export function registerDiscoveryIPC(
  mainWindow: BrowserWindow,
  discovery: DiscoveryManager
) {
  ipcMain.handle('get-peers', () => {
    return discovery.getPeers();
  });

  ipcMain.handle('get-local-device', () => {
    return discovery.getLocalDevice();
  });

  ipcMain.handle('restart-discovery', () => {
    discovery.restart();
  });

  // Reconnect to any discovered peers that are enabled but not connected (with backoff)
  function reconnectDisconnectedPeers() {
    if (!peerManager) return;
    const discoveredPeers = discovery.getPeers();
    const now = Date.now();

    for (const peer of discoveredPeers) {
      const hasValidAddress = peer.host && peer.port > 0;
      if (!hasValidAddress || peerManager.isConnected(peer.id) || !isDeviceEnabled(peer.id)) continue;

      // Backoff: exponential up to MAX_DELAY_MS, then steady at that interval.
      const retries = peerRetryCount.get(peer.id) || 0;
      const lastAttempt = peerLastAttempt.get(peer.id) || 0;
      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retries), MAX_DELAY_MS);
      if (now - lastAttempt < delay) {
        continue; // Too soon — backoff not elapsed
      }

      console.log(`[IPC] Reconnecting to peer: ${peer.name} at ${peer.host}:${peer.port} (attempt ${retries + 1})`);
      peerRetryCount.set(peer.id, retries + 1);
      peerLastAttempt.set(peer.id, now);
      peerManager.connectToPeer(peer);
    }
  }

  // Safety net: periodically check for disconnected peers and reconnect
  if (reconnectInterval) clearInterval(reconnectInterval);
  reconnectInterval = setInterval(reconnectDisconnectedPeers, 30000);

  // Wire discovery events to renderer
  discovery.start({
    onPeerDiscovered: (peer: PeerInfo) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('peer-discovered', peer);
      }

      // Fresh discovery resets retry backoff for this peer
      peerRetryCount.delete(peer.id);
      peerLastAttempt.delete(peer.id);

      // Auto-connect: try to establish a P2P connection immediately.
      // Skip if:
      // - Already connected (incoming connection already established)
      // - Invalid host/port (peer added via addIncomingPeer - they connected to us)
      // - peerManager not ready yet
      // - Device is disabled by user
      const hasValidAddress = peer.host && peer.port > 0;
      const deviceEnabled = isDeviceEnabled(peer.id);

      if (!deviceEnabled) {
        console.log(`[IPC] Skipping auto-connect for ${peer.name} (device disabled by user)`);
      } else if (peerManager && hasValidAddress && !peerManager.isConnected(peer.id)) {
        const delay = 500 + Math.random() * 1500;
        setTimeout(() => {
          // Re-check enabled state in case user disabled during delay
          if (peerManager && !peerManager.isConnected(peer.id) && isDeviceEnabled(peer.id)) {
            console.log(`[IPC] Auto-connecting to discovered peer: ${peer.name} at ${peer.host}:${peer.port}`);
            peerManager.connectToPeer(peer);
          }
        }, delay);
      } else if (!hasValidAddress) {
        console.log(`[IPC] Skipping auto-connect for ${peer.name} (incoming peer, no outbound address)`);
      }
    },
    onPeerLost: (peerId: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('peer-lost', peerId);
      }
      // Also disconnect P2P if connected
      if (peerManager) {
        peerManager.disconnectFromPeer(peerId);
      }
    },
  });

  return { reconnectDisconnectedPeers };
}

export function registerP2PIPC(
  mainWindow: BrowserWindow,
  discovery: DiscoveryManager,
  localId: string,
  localName: string,
  localPort: number,
  uploadsDir?: string,
) {
  peerManager = new PeerConnectionManager(localId, localName, localPort, {
    onPeerConnected: (peer: PeerInfo) => {
      // Successful connection resets retry backoff
      peerRetryCount.delete(peer.id);
      peerLastAttempt.delete(peer.id);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('peer-connected', peer);
      }
    },
    onPeerDisconnected: (peerId: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('peer-disconnected', peerId);
      }
    },
    onFileReceived: async (data) => {
      // Persist to DB via local server before notifying renderer
      try {
        const http = require('http') as typeof import('http');
        const body = JSON.stringify({
          filename: data.file.filename,
          originalName: data.file.originalName,
          mimeType: data.file.mimeType,
          size: data.file.size,
          content: data.file.content,
          isClipboard: data.file.isClipboard,
          fromDeviceName: data.fromDevice,
        });
        const savedFile = await new Promise<any>((resolve, reject) => {
          const req = http.request(`http://127.0.0.1:${localPort}/api/files/record-received`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            timeout: 5000,
          }, (res) => {
            let chunks = '';
            res.on('data', (chunk: string) => { chunks += chunk; });
            res.on('end', () => {
              try { resolve(JSON.parse(chunks)); } catch { reject(new Error('Invalid JSON')); }
            });
          });
          req.on('error', reject);
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
          req.write(body);
          req.end();
        });
        // Send persisted file (with real DB id) to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file-received', { file: savedFile, fromDevice: data.fromDevice });
        }
      } catch (err) {
        console.error('[P2P] Failed to persist received file, sending unpersisted:', err);
        // Fallback: send original data so user still sees the file
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file-received', data);
        }
      }
    },
    onRelayDevicesUpdated: (devices) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('relay-devices-updated', devices);
      }
    },
    onChunkProgress: (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chunk-progress', data);
      }
    },
  }, uploadsDir);

  ipcMain.handle('connect-to-peer', async (_event, peerId: string) => {
    // Skip if already connected
    if (peerManager && peerManager.isConnected(peerId)) {
      console.log(`[IPC] Already connected to peer: ${peerId}`);
      return { status: 'already-connected' };
    }

    // Reset retry backoff for this peer so the reconnect loop doesn't block it
    peerRetryCount.delete(peerId);
    peerLastAttempt.delete(peerId);
    console.log(`[IPC] Retry: reset backoff for ${peerId}`);

    // Restart discovery to refresh mDNS and get updated host/port
    discovery.restart();
    console.log(`[IPC] Retry: restarted discovery, waiting 2s for refresh`);

    // Wait 2 seconds for discovery to settle and find fresh addresses
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Re-fetch peer from discovery to get freshest address
    const peers = discovery.getPeers();
    const peer = peers.find(p => p.id === peerId);
    if (peer && peerManager) {
      // Skip if peer has invalid address (incoming peer that connected to us)
      if (!peer.host || peer.port <= 0) {
        console.log(`[IPC] Cannot connect to ${peer.name}: no valid address (they connected to us)`);
        return { status: 'no-address' };
      }
      console.log(`[IPC] Retry: connecting to ${peer.name} at ${peer.host}:${peer.port}`);
      peerManager.connectToPeer(peer);
      return { status: 'connecting' };
    } else {
      console.log(`[IPC] Retry: peer ${peerId} not found in discovery after refresh`);
      return { status: 'not-found' };
    }
  });

  ipcMain.handle('disconnect-from-peer', (_event, peerId: string) => {
    if (peerManager) {
      peerManager.disconnectFromPeer(peerId);
    }
  });

  ipcMain.handle('send-file-to-peer', async (_event, peerId: string, fileData: any) => {
    if (peerManager) {
      return peerManager.sendFileToPeer(peerId, fileData);
    }
    return false;
  });

  ipcMain.handle('send-relay-file', (_event, targetClientId: string, fileData: any) => {
    if (peerManager) {
      const hubPeerId = peerManager.getHubForRelayDevice(targetClientId);
      if (hubPeerId) {
        return peerManager.sendRelayFileToPeer(hubPeerId, targetClientId, fileData);
      }
    }
    return false;
  });

  // Chunked file transfer
  ipcMain.handle('send-chunked-file-to-peer', async (_event, peerId: string, fileData: any) => {
    if (peerManager) {
      return peerManager.sendChunkedFileToPeer(peerId, fileData);
    }
    return false;
  });

  ipcMain.handle('should-use-chunked-transfer', (_event, size: number) => {
    return size > CHUNK_THRESHOLD;
  });

  // Get currently connected peers (for renderer sync on mount)
  ipcMain.handle('get-connected-peers', () => {
    if (peerManager) {
      return peerManager.getConnectedPeers();
    }
    return [];
  });

  return peerManager;
}

export function getPeerManager(): PeerConnectionManager | null {
  return peerManager;
}
