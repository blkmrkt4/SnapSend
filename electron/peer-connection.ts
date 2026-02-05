import WebSocket from 'ws';
import { type PeerInfo } from './discovery';

export interface PeerConnectionCallbacks {
  onPeerConnected: (peer: PeerInfo) => void;
  onPeerDisconnected: (peerId: string) => void;
  onFileReceived: (data: { file: any; fromDevice: string }) => void;
  onRelayDevicesUpdated: (devices: { id: string; name: string }[]) => void;
}

export class PeerConnectionManager {
  private localId: string;
  private localName: string;
  private localPort: number;
  private connections: Map<string, WebSocket> = new Map();
  private peerInfo: Map<string, PeerInfo> = new Map();
  private callbacks: PeerConnectionCallbacks;
  private relayDeviceToHub: Map<string, string> = new Map(); // relayDeviceId → hubPeerId
  private handshaked: Set<string> = new Set(); // peers that completed handshake

  constructor(
    localId: string,
    localName: string,
    localPort: number,
    callbacks: PeerConnectionCallbacks
  ) {
    this.localId = localId;
    this.localName = localName;
    this.localPort = localPort;
    this.callbacks = callbacks;
  }

  connectToPeer(peer: PeerInfo): void {
    if (this.connections.has(peer.id)) {
      console.log(`[P2P] Already connected to ${peer.name}`);
      return;
    }

    const wsUrl = `ws://${peer.host}:${peer.port}/ws`;
    console.log(`[P2P] Connecting to ${peer.name} at ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      // Send handshake
      ws.send(JSON.stringify({
        type: 'peer-handshake',
        data: { id: this.localId, name: this.localName },
      }));
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(peer.id, message);
      } catch (err) {
        console.error(`[P2P] Error parsing message from ${peer.name}:`, err);
      }
    });

    ws.on('close', () => {
      this.connections.delete(peer.id);
      this.peerInfo.delete(peer.id);
      const wasHandshaked = this.handshaked.has(peer.id);
      this.handshaked.delete(peer.id);
      if (wasHandshaked) {
        console.log(`[P2P] Disconnected from ${peer.name}`);
        this.callbacks.onPeerDisconnected(peer.id);
      } else {
        console.log(`[P2P] Connection to ${peer.name} failed (pre-handshake)`);
      }
    });

    ws.on('error', (err: any) => {
      console.warn(`[P2P] Connection error with ${peer.name}: ${err.message || err.code || err}`);
    });

    this.connections.set(peer.id, ws);
    this.peerInfo.set(peer.id, peer);
  }

  disconnectFromPeer(peerId: string): void {
    const ws = this.connections.get(peerId);
    if (ws) {
      ws.close();
      this.connections.delete(peerId);
      this.peerInfo.delete(peerId);
    }
  }

  sendToPeer(peerId: string, message: any): boolean {
    const ws = this.connections.get(peerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  sendFileToPeer(peerId: string, fileData: any): boolean {
    return this.sendToPeer(peerId, {
      type: 'file-transfer',
      data: {
        ...fileData,
        fromId: this.localId,
        fromName: this.localName,
      },
    });
  }

  sendRelayFileToPeer(hubPeerId: string, targetClientId: string, fileData: any): boolean {
    return this.sendToPeer(hubPeerId, {
      type: 'relay-file-transfer',
      data: {
        ...fileData,
        targetClientId,
        fromId: this.localId,
        fromName: this.localName,
      },
    });
  }

  getHubForRelayDevice(relayDeviceId: string): string | undefined {
    return this.relayDeviceToHub.get(relayDeviceId);
  }

  handleIncomingHandshake(ws: WebSocket, peerId: string, peerName: string): void {
    // Respond with handshake ack
    ws.send(JSON.stringify({
      type: 'peer-handshake-ack',
      data: { id: this.localId, name: this.localName },
    }));

    // Store this as an active connection
    if (!this.connections.has(peerId)) {
      this.connections.set(peerId, ws);
      const peer: PeerInfo = { id: peerId, name: peerName, host: '', port: 0 };
      this.peerInfo.set(peerId, peer);
      this.handshaked.add(peerId);
      this.callbacks.onPeerConnected(peer);

      ws.on('close', () => {
        this.connections.delete(peerId);
        this.peerInfo.delete(peerId);
        this.handshaked.delete(peerId);
        this.callbacks.onPeerDisconnected(peerId);
      });
    }
  }

  private handleMessage(peerId: string, message: any): void {
    switch (message.type) {
      case 'peer-handshake-ack': {
        if (this.handshaked.has(peerId)) break; // Already connected via another path
        const peer = this.peerInfo.get(peerId);
        if (peer) {
          this.handshaked.add(peerId);
          console.log(`[P2P] Handshake complete with ${message.data.name}`);
          this.callbacks.onPeerConnected(peer);
        }
        break;
      }

      case 'file-transfer': {
        console.log(`[P2P] File received from ${message.data.fromName}: ${message.data.originalName}`);
        this.callbacks.onFileReceived({
          file: {
            filename: message.data.filename,
            originalName: message.data.originalName,
            mimeType: message.data.mimeType,
            size: message.data.size,
            content: message.data.content,
            isClipboard: message.data.isClipboard,
          },
          fromDevice: message.data.fromName || 'Unknown',
        });

        // Send ack
        this.sendToPeer(peerId, {
          type: 'file-received-ack',
          data: { filename: message.data.filename },
        });
        break;
      }

      case 'file-received-ack':
        console.log(`[P2P] File ack from peer: ${message.data.filename}`);
        break;

      case 'relay-devices': {
        // Hub server is telling us about its browser clients
        const devices: { id: string; name: string }[] = message.data.devices || [];
        // Update relayDeviceToHub mapping — clear old entries for this hub, add new ones
        const toDelete: string[] = [];
        this.relayDeviceToHub.forEach((hubId, deviceId) => {
          if (hubId === peerId) toDelete.push(deviceId);
        });
        toDelete.forEach(id => this.relayDeviceToHub.delete(id));
        devices.forEach(d => this.relayDeviceToHub.set(d.id, peerId));
        this.callbacks.onRelayDevicesUpdated(devices);
        break;
      }

      case 'relay-file-ack':
        console.log(`[P2P] Relay file ack: ${message.data.filename}`);
        break;
    }
  }

  getConnectedPeerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  isConnected(peerId: string): boolean {
    const ws = this.connections.get(peerId);
    return !!ws && ws.readyState === WebSocket.OPEN;
  }

  disconnectAll(): void {
    this.connections.forEach((ws) => {
      ws.close();
    });
    this.connections.clear();
    this.peerInfo.clear();
    this.relayDeviceToHub.clear();
    this.handshaked.clear();
  }
}
