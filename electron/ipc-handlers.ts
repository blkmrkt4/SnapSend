import { ipcMain, type BrowserWindow } from 'electron';
import { DiscoveryManager, type PeerInfo } from './discovery';
import { PeerConnectionManager } from './peer-connection';

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
      // If outgoing TCP is blocked (macOS LNP from Finder), this fails silently.
      // The other peer will also discover us and connect in the other direction.
      if (peerManager && !peerManager.isConnected(peer.id)) {
        const delay = 500 + Math.random() * 1500;
        setTimeout(() => {
          if (peerManager && !peerManager.isConnected(peer.id)) {
            console.log(`[IPC] Auto-connecting to discovered peer: ${peer.name}`);
            peerManager.connectToPeer(peer);
          }
        }, delay);
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
  });

  ipcMain.handle('connect-to-peer', (_event, peerId: string) => {
    const peers = discovery.getPeers();
    const peer = peers.find(p => p.id === peerId);
    if (peer && peerManager) {
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

  return peerManager;
}

export function getPeerManager(): PeerConnectionManager | null {
  return peerManager;
}
