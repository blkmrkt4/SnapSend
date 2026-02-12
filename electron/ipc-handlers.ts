import { ipcMain, type BrowserWindow } from 'electron';
import { DiscoveryManager, type PeerInfo } from './discovery';
import { PeerConnectionManager } from './peer-connection';
import { isDeviceEnabled } from './main';

// Chunked transfer threshold (must match shared/schema.ts)
const CHUNK_THRESHOLD = 70 * 1024 * 1024; // 70MB

let peerManager: PeerConnectionManager | null = null;

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

  // Wire discovery events to renderer
  discovery.start({
    onPeerDiscovered: (peer: PeerInfo) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('peer-discovered', peer);
      }
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
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('peer-connected', peer);
      }
    },
    onPeerDisconnected: (peerId: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('peer-disconnected', peerId);
      }
    },
    onFileReceived: (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file-received', data);
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

  ipcMain.handle('connect-to-peer', (_event, peerId: string) => {
    // Skip if already connected
    if (peerManager && peerManager.isConnected(peerId)) {
      console.log(`[IPC] Already connected to peer: ${peerId}`);
      return;
    }
    const peers = discovery.getPeers();
    const peer = peers.find(p => p.id === peerId);
    if (peer && peerManager) {
      // Skip if peer has invalid address (incoming peer that connected to us)
      if (!peer.host || peer.port <= 0) {
        console.log(`[IPC] Cannot connect to ${peer.name}: no valid address (they connected to us)`);
        return;
      }
      peerManager.connectToPeer(peer);
    }
  });

  ipcMain.handle('disconnect-from-peer', (_event, peerId: string) => {
    if (peerManager) {
      peerManager.disconnectFromPeer(peerId);
    }
  });

  ipcMain.handle('send-file-to-peer', (_event, peerId: string, fileData: any) => {
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

  return peerManager;
}

export function getPeerManager(): PeerConnectionManager | null {
  return peerManager;
}
