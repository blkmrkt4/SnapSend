import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { type PeerInfo } from './discovery';

// Chunked transfer constants (must match shared/schema.ts)
const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB raw data per chunk
const CHUNK_THRESHOLD = 70 * 1024 * 1024; // 70MB - files larger than this use chunked transfer

// Chunked transfer state interface
interface ChunkedTransferState {
  transferId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  receivedChunks: number;
  isClipboard?: boolean;
  fromId?: string;
  fromName?: string;
  startedAt: number;
}

export interface PeerConnectionCallbacks {
  onPeerConnected: (peer: PeerInfo) => void;
  onPeerDisconnected: (peerId: string) => void;
  onFileReceived: (data: { file: any; fromDevice: string }) => void;
  onRelayDevicesUpdated: (devices: { id: string; name: string }[]) => void;
  onChunkProgress?: (data: { transferId: string; progress: number; direction: 'send' | 'receive' }) => void;
}

// Track in-progress chunked transfers (receiver side)
interface InProgressChunkTransfer extends ChunkedTransferState {
  tempFilePath: string;
  writeStream: fs.WriteStream | null;
  peerId: string;
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
  private inProgressTransfers: Map<string, InProgressChunkTransfer> = new Map(); // transferId → transfer state
  private uploadsDir: string;

  constructor(
    localId: string,
    localName: string,
    localPort: number,
    callbacks: PeerConnectionCallbacks,
    uploadsDir?: string
  ) {
    this.localId = localId;
    this.localName = localName;
    this.localPort = localPort;
    this.callbacks = callbacks;
    this.uploadsDir = uploadsDir || path.join(process.cwd(), 'uploads');

    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }

    // Clean up stale transfers after 5 minutes of inactivity
    setInterval(() => this.cleanupStaleTransfers(), 60000);
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

  // Send a large file in chunks
  async sendChunkedFileToPeer(
    peerId: string,
    fileData: {
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      filePath?: string; // Path to file on disk (for Electron)
      content?: string;  // Base64 content (fallback)
      isClipboard?: boolean;
    },
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const totalChunks = Math.ceil(fileData.size / CHUNK_SIZE);
    const transferId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    // Send chunk-start message
    const startSent = this.sendToPeer(peerId, {
      type: 'chunk-start',
      data: {
        transferId,
        filename: fileData.filename,
        originalName: fileData.originalName,
        mimeType: fileData.mimeType,
        size: fileData.size,
        totalChunks,
        isClipboard: fileData.isClipboard,
        fromId: this.localId,
        fromName: this.localName,
      },
    });

    if (!startSent) {
      return false;
    }

    // Read and send chunks
    try {
      if (fileData.filePath && fs.existsSync(fileData.filePath)) {
        // Read from file on disk
        const fd = fs.openSync(fileData.filePath, 'r');
        const buffer = Buffer.alloc(CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
          const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, i * CHUNK_SIZE);
          const chunkData = buffer.subarray(0, bytesRead).toString('base64');

          const chunkSent = this.sendToPeer(peerId, {
            type: 'chunk-data',
            data: {
              transferId,
              chunkIndex: i,
              content: chunkData,
            },
          });

          if (!chunkSent) {
            fs.closeSync(fd);
            this.sendToPeer(peerId, {
              type: 'chunk-error',
              data: { transferId, error: 'Failed to send chunk', chunkIndex: i },
            });
            return false;
          }

          const progress = ((i + 1) / totalChunks) * 100;
          onProgress?.(progress);
          this.callbacks.onChunkProgress?.({ transferId, progress, direction: 'send' });
        }

        fs.closeSync(fd);
      } else if (fileData.content) {
        // Content is base64 data URL or raw base64
        let base64Data = fileData.content;
        if (base64Data.startsWith('data:')) {
          base64Data = base64Data.split(',')[1];
        }
        const fullBuffer = Buffer.from(base64Data, 'base64');

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fullBuffer.length);
          const chunkData = fullBuffer.subarray(start, end).toString('base64');

          const chunkSent = this.sendToPeer(peerId, {
            type: 'chunk-data',
            data: {
              transferId,
              chunkIndex: i,
              content: chunkData,
            },
          });

          if (!chunkSent) {
            this.sendToPeer(peerId, {
              type: 'chunk-error',
              data: { transferId, error: 'Failed to send chunk', chunkIndex: i },
            });
            return false;
          }

          const progress = ((i + 1) / totalChunks) * 100;
          onProgress?.(progress);
          this.callbacks.onChunkProgress?.({ transferId, progress, direction: 'send' });
        }
      } else {
        this.sendToPeer(peerId, {
          type: 'chunk-error',
          data: { transferId, error: 'No file content available' },
        });
        return false;
      }

      // Send chunk-end message
      this.sendToPeer(peerId, {
        type: 'chunk-end',
        data: { transferId },
      });

      return true;
    } catch (error) {
      console.error(`[P2P] Error sending chunked file:`, error);
      this.sendToPeer(peerId, {
        type: 'chunk-error',
        data: { transferId, error: (error as Error).message },
      });
      return false;
    }
  }

  // Check if a file should use chunked transfer
  shouldUseChunkedTransfer(size: number): boolean {
    return size > CHUNK_THRESHOLD;
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

  private async handleMessage(peerId: string, message: any): Promise<void> {
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

      case 'chunk-start': {
        const { transferId, filename, originalName, mimeType, size, totalChunks, isClipboard, fromId, fromName } = message.data;
        console.log(`[P2P] Chunked transfer starting from ${fromName}: ${originalName} (${totalChunks} chunks)`);

        // Create temp file for receiving chunks
        const tempFilePath = path.join(this.uploadsDir, `${transferId}.tmp`);

        try {
          const writeStream = fs.createWriteStream(tempFilePath);

          const transfer: InProgressChunkTransfer = {
            transferId,
            filename,
            originalName,
            mimeType,
            totalSize: size,
            totalChunks,
            receivedChunks: 0,
            isClipboard,
            fromId,
            fromName,
            startedAt: Date.now(),
            tempFilePath,
            writeStream,
            peerId,
          };

          this.inProgressTransfers.set(transferId, transfer);

          // Send ack
          this.sendToPeer(peerId, {
            type: 'chunk-ack',
            data: { transferId, status: 'ok' },
          });
        } catch (error) {
          console.error(`[P2P] Error starting chunked receive:`, error);
          this.sendToPeer(peerId, {
            type: 'chunk-ack',
            data: { transferId, status: 'error', error: (error as Error).message },
          });
        }
        break;
      }

      case 'chunk-data': {
        const { transferId, chunkIndex, content } = message.data;
        const transfer = this.inProgressTransfers.get(transferId);

        if (!transfer) {
          console.warn(`[P2P] Received chunk for unknown transfer: ${transferId}`);
          this.sendToPeer(peerId, {
            type: 'chunk-error',
            data: { transferId, error: 'Unknown transfer', chunkIndex },
          });
          break;
        }

        try {
          // Decode and write chunk
          const chunkBuffer = Buffer.from(content, 'base64');
          transfer.writeStream?.write(chunkBuffer);
          transfer.receivedChunks++;

          const progress = (transfer.receivedChunks / transfer.totalChunks) * 100;
          this.callbacks.onChunkProgress?.({ transferId, progress, direction: 'receive' });

          // Send ack for this chunk
          this.sendToPeer(peerId, {
            type: 'chunk-ack',
            data: { transferId, chunkIndex, status: 'ok' },
          });
        } catch (error) {
          console.error(`[P2P] Error writing chunk:`, error);
          this.sendToPeer(peerId, {
            type: 'chunk-ack',
            data: { transferId, chunkIndex, status: 'error', error: (error as Error).message },
          });
        }
        break;
      }

      case 'chunk-end': {
        const { transferId } = message.data;
        const transfer = this.inProgressTransfers.get(transferId);

        if (!transfer) {
          console.warn(`[P2P] Received chunk-end for unknown transfer: ${transferId}`);
          break;
        }

        try {
          // Close the write stream
          await new Promise<void>((resolve, reject) => {
            if (transfer.writeStream) {
              transfer.writeStream.end(() => resolve());
              transfer.writeStream.on('error', reject);
            } else {
              resolve();
            }
          });

          // Rename temp file to final filename
          const finalPath = path.join(this.uploadsDir, transfer.filename);
          fs.renameSync(transfer.tempFilePath, finalPath);

          console.log(`[P2P] Chunked transfer complete: ${transfer.originalName}`);

          // Notify callback
          this.callbacks.onFileReceived({
            file: {
              filename: transfer.filename,
              originalName: transfer.originalName,
              mimeType: transfer.mimeType,
              size: transfer.totalSize,
              isClipboard: transfer.isClipboard,
            },
            fromDevice: transfer.fromName || 'Unknown',
          });

          // Send final ack
          this.sendToPeer(peerId, {
            type: 'chunk-ack',
            data: { transferId, status: 'ok' },
          });

          // Clean up
          this.inProgressTransfers.delete(transferId);
        } catch (error) {
          console.error(`[P2P] Error finalizing chunked transfer:`, error);
          this.sendToPeer(peerId, {
            type: 'chunk-ack',
            data: { transferId, status: 'error', error: (error as Error).message },
          });
          // Clean up temp file on error
          this.cleanupTransfer(transferId);
        }
        break;
      }

      case 'chunk-ack':
        // For sender: acknowledgment received (can be used for flow control if needed)
        break;

      case 'chunk-error': {
        const { transferId, error: errorMsg } = message.data;
        console.error(`[P2P] Chunked transfer error: ${errorMsg}`);
        // Clean up any in-progress receive
        this.cleanupTransfer(transferId);
        break;
      }
    }
  }

  private cleanupTransfer(transferId: string): void {
    const transfer = this.inProgressTransfers.get(transferId);
    if (transfer) {
      try {
        transfer.writeStream?.destroy();
        if (fs.existsSync(transfer.tempFilePath)) {
          fs.unlinkSync(transfer.tempFilePath);
        }
      } catch (e) {
        console.warn(`[P2P] Error cleaning up transfer ${transferId}:`, e);
      }
      this.inProgressTransfers.delete(transferId);
    }
  }

  private cleanupStaleTransfers(): void {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    this.inProgressTransfers.forEach((transfer, transferId) => {
      if (now - transfer.startedAt > timeout) {
        console.warn(`[P2P] Cleaning up stale transfer: ${transferId}`);
        this.cleanupTransfer(transferId);
      }
    });
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

    // Clean up all in-progress transfers
    this.inProgressTransfers.forEach((_, transferId) => {
      this.cleanupTransfer(transferId);
    });
  }

  // Clean up transfers from a specific peer when they disconnect
  cleanupPeerTransfers(peerId: string): void {
    this.inProgressTransfers.forEach((transfer, transferId) => {
      if (transfer.peerId === peerId) {
        this.cleanupTransfer(transferId);
      }
    });
  }

  // Get current transfer progress for UI
  getTransferProgress(transferId: string): number | null {
    const transfer = this.inProgressTransfers.get(transferId);
    if (!transfer) return null;
    return (transfer.receivedChunks / transfer.totalChunks) * 100;
  }

  // Get all active transfers
  getActiveTransfers(): ChunkedTransferState[] {
    return Array.from(this.inProgressTransfers.values()).map(t => ({
      transferId: t.transferId,
      filename: t.filename,
      originalName: t.originalName,
      mimeType: t.mimeType,
      totalSize: t.totalSize,
      totalChunks: t.totalChunks,
      receivedChunks: t.receivedChunks,
      isClipboard: t.isClipboard,
      fromId: t.fromId,
      fromName: t.fromName,
      startedAt: t.startedAt,
    }));
  }
}
