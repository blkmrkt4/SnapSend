import WebSocket from 'ws';
import http from 'http';
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

  // Ack-confirmed delivery: pending acks keyed by filename
  private pendingAcks: Map<string, { resolve: (v: boolean) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }> = new Map();

  // In-flight connection protection
  private connectingPeers: Set<string> = new Set();
  private connectingStartTimes: Map<string, number> = new Map();

  // Health ping
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

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

    // Health ping: every 15s, ping all connected peers
    this.pingInterval = setInterval(() => this.sendPings(), 15000);
  }

  /**
   * Lightweight HTTP health probe. Returns { ok, reason } so the caller
   * can decide whether to skip the heavier WebSocket attempt.
   */
  private probeHealth(host: string, port: number): Promise<{ ok: boolean; reason?: string }> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (result: { ok: boolean; reason?: string }) => {
        if (done) return;
        done = true;
        req.destroy();
        resolve(result);
      };

      const req = http.get(`http://${host}:${port}/health`, { timeout: 3000 }, (res) => {
        res.resume();
        finish({ ok: true });
      });

      req.on('timeout', () => finish({ ok: false, reason: 'timeout' }));
      req.on('error', (err: any) => finish({ ok: false, reason: err.code || err.message }));
    });
  }

  connectToPeer(peer: PeerInfo): void {
    // Skip if we already have a healthy (OPEN) connection
    const existing = this.connections.get(peer.id);
    if (existing && existing.readyState === WebSocket.OPEN) {
      console.log(`[P2P] Already connected to ${peer.name} (OPEN)`);
      return;
    }

    // Deterministic tiebreak: when both peers discover each other simultaneously,
    // both would race to open outbound WebSockets. The side with the lexicographically
    // higher localId defers by 2.5s — long enough for the lower-id side's incoming
    // connection to land. If it does, the early-return at the top of this function
    // takes the deferred call's no-op path. If it doesn't, the deferred call goes
    // ahead. Net: avoids most cross-connection races without losing connectivity.
    if (this.localId > peer.id && !this.handshaked.has(peer.id)) {
      this.connectingPeers.add(peer.id);
      this.connectingStartTimes.set(peer.id, Date.now());
      setTimeout(() => {
        this.connectingPeers.delete(peer.id);
        this.connectingStartTimes.delete(peer.id);
        // Re-check state — the peer may have connected to us in the interim.
        const cur = this.connections.get(peer.id);
        if (cur && cur.readyState === WebSocket.OPEN) {
          console.log(`[P2P] Deferred connect to ${peer.name} not needed (incoming arrived)`);
          return;
        }
        this.connectToPeer(peer);
      }, 2500);
      console.log(`[P2P] Deferring outbound connect to ${peer.name} (tiebreak — waiting for incoming)`);
      return;
    }

    // In-flight protection: skip if already connecting (unless stale >20s)
    if (this.connectingPeers.has(peer.id)) {
      const startTime = this.connectingStartTimes.get(peer.id) || 0;
      if (Date.now() - startTime < 20000) {
        console.log(`[P2P] Already connecting to ${peer.name} (in-flight), skipping`);
        return;
      }
      console.log(`[P2P] Stale in-flight connection to ${peer.name} (>20s), retrying`);
    }

    // If there's a stale/connecting WS, remove it so we can reconnect
    if (existing) {
      console.log(`[P2P] Replacing stale connection to ${peer.name} (readyState=${existing.readyState})`);
      this.connections.delete(peer.id);
      this.peerInfo.delete(peer.id);
      try { existing.close(); } catch {}
    }

    // Validate peer has a valid address
    if (!peer.host || peer.port <= 0) {
      console.log(`[P2P] Cannot connect to ${peer.name}: invalid address (host='${peer.host}', port=${peer.port})`);
      return;
    }

    const wsUrl = `ws://${peer.host}:${peer.port}/ws`;
    console.log(`[P2P] Connecting to ${peer.name} at ${wsUrl}`);

    // Mark as in-flight
    this.connectingPeers.add(peer.id);
    this.connectingStartTimes.set(peer.id, Date.now());

    const ws = new WebSocket(wsUrl);

    // Run health probe as a preflight diagnostic hint (runs concurrently with WS handshake)
    this.probeHealth(peer.host, peer.port).then(({ ok, reason }) => {
      if (ok) {
        console.log(`[P2P] Health probe OK for ${peer.host}:${peer.port}`);
      } else {
        console.log(`[P2P] Health probe failed for ${peer.host}:${peer.port} (${reason})`);
        // On hard ECONNREFUSED, the peer is definitely not listening — abort early
        if (reason === 'ECONNREFUSED') {
          console.log(`[P2P] Aborting WS connect to ${peer.name} — peer not listening`);
          this.connectingPeers.delete(peer.id);
          this.connectingStartTimes.delete(peer.id);
          try { ws.terminate(); } catch {}
          return;
        }
        // On timeout or other errors, proceed — the WS timeout is the real gate
      }
    });

    // 20s connection timeout
    const connectTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log(`[P2P] Connection timeout for ${peer.name} (20s), terminating`);
        ws.terminate();
      }
    }, 20000);

    ws.on('open', () => {
      clearTimeout(connectTimeout);
      this.connectingPeers.delete(peer.id);
      this.connectingStartTimes.delete(peer.id);

      // Store the connection only once it's actually open
      this.connections.set(peer.id, ws);
      this.peerInfo.set(peer.id, peer);
      console.log(`[P2P] Outgoing connection to ${peer.name} is OPEN`);

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
      clearTimeout(connectTimeout);
      this.connectingPeers.delete(peer.id);
      this.connectingStartTimes.delete(peer.id);

      // Only clean up if this WS is still the active one (it may have been replaced)
      if (this.connections.get(peer.id) === ws) {
        this.connections.delete(peer.id);
        this.peerInfo.delete(peer.id);
        this.cancelPongTimer(peer.id);
        const wasHandshaked = this.handshaked.has(peer.id);
        this.handshaked.delete(peer.id);
        if (wasHandshaked) {
          console.log(`[P2P] Disconnected from ${peer.name}`);
          this.callbacks.onPeerDisconnected(peer.id);
        } else {
          console.log(`[P2P] Connection to ${peer.name} failed (pre-handshake)`);
        }
      } else {
        console.log(`[P2P] Stale outgoing WS to ${peer.name} closed (already replaced)`);
      }
    });

    ws.on('error', (err: any) => {
      clearTimeout(connectTimeout);
      this.connectingPeers.delete(peer.id);
      this.connectingStartTimes.delete(peer.id);
      console.warn(`[P2P] Connection error with ${peer.name}: ${err.message || err.code || err}`);
    });
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
    console.warn(`[P2P] sendToPeer FAILED for ${peerId}: ws=${ws ? 'exists' : 'missing'}, readyState=${ws?.readyState ?? 'N/A'}, type=${message.type}`);
    return false;
  }

  sendFileToPeer(peerId: string, fileData: any): Promise<boolean> {
    console.log(`[P2P] sendFileToPeer called: peerId=${peerId}, file=${fileData.originalName}, connections=[${Array.from(this.connections.keys()).join(', ')}]`);
    const sent = this.sendToPeer(peerId, {
      type: 'file-transfer',
      data: {
        ...fileData,
        fromId: this.localId,
        fromName: this.localName,
      },
    });

    if (!sent) {
      return Promise.resolve(false);
    }

    // Wait for file-received-ack from peer (keyed by filename)
    const ackKey = fileData.filename;
    return new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(ackKey);
        console.warn(`[P2P] Ack timeout for ${fileData.originalName} to peer ${peerId}`);
        resolve(false); // Resolve false instead of reject to avoid unhandled promise
      }, 12000);

      this.pendingAcks.set(ackKey, { resolve, reject, timer });
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

    const peer: PeerInfo = { id: peerId, name: peerName, host: '', port: 0 };
    const alreadyConnected = this.connections.has(peerId);
    const alreadyHandshaked = this.handshaked.has(peerId);

    const existingWs = this.connections.get(peerId);
    const existingIsOpen = existingWs?.readyState === WebSocket.OPEN;
    console.log(`[P2P] handleIncomingHandshake: peer=${peerName} (${peerId}), alreadyConnected=${alreadyConnected}, existingIsOpen=${existingIsOpen}, alreadyHandshaked=${alreadyHandshaked}`);

    // Store this incoming WS if we don't have one, or if the existing one isn't OPEN.
    // The incoming WS is guaranteed to be working (it just delivered a handshake message).
    if (!alreadyConnected || !existingIsOpen) {
      if (alreadyConnected && !existingIsOpen) {
        console.log(`[P2P] Replacing non-OPEN outgoing WS (readyState=${existingWs?.readyState}) with working incoming WS for ${peerName}`);
        try { existingWs?.close(); } catch {}
      }
      this.connections.set(peerId, ws);
      this.peerInfo.set(peerId, peer);

      // CRITICAL: Add message handler on incoming WS so responses (file-received-ack,
      // peer-pong, chunk-ack, etc.) are processed when this WS is the active connection.
      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(peerId, message);
        } catch (err) {
          console.error(`[P2P] Error parsing message from incoming ${peerName}:`, err);
        }
      });

      ws.on('error', (err: any) => {
        console.warn(`[P2P] Incoming WS error from ${peerName}: ${err.message || err.code || err}`);
      });

      ws.on('close', () => {
        // Only clean up if this WS is still the active one
        if (this.connections.get(peerId) === ws) {
          this.connections.delete(peerId);
          this.peerInfo.delete(peerId);
          this.cancelPongTimer(peerId);
          this.handshaked.delete(peerId);
          this.callbacks.onPeerDisconnected(peerId);
        }
      });
    }

    // Always notify renderer if this is a new handshake (regardless of who initiated)
    if (!alreadyHandshaked) {
      this.handshaked.add(peerId);
      console.log(`[P2P] Incoming handshake complete with ${peerName}`);
      this.callbacks.onPeerConnected(peer);
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

      case 'file-received-ack': {
        const ackFilename = message.data.filename;
        console.log(`[P2P] File ack from peer: ${ackFilename}`);
        const pending = this.pendingAcks.get(ackFilename);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingAcks.delete(ackFilename);
          pending.resolve(true);
        }
        break;
      }

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

      case 'peer-ping':
        // Respond immediately with pong
        this.sendToPeer(peerId, { type: 'peer-pong', data: {} });
        break;

      case 'peer-pong':
        // Peer is alive — cancel the dead-connection timer
        this.cancelPongTimer(peerId);
        break;
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

  // Get all connected peers with their info (for renderer sync)
  getConnectedPeers(): PeerInfo[] {
    const peers: PeerInfo[] = [];
    for (const peerId of this.handshaked) {
      const info = this.peerInfo.get(peerId);
      if (info) {
        peers.push(info);
      }
    }
    return peers;
  }

  isConnected(peerId: string): boolean {
    const ws = this.connections.get(peerId);
    return !!ws && ws.readyState === WebSocket.OPEN;
  }

  disconnectAll(): void {
    // Notify renderer for each handshaked peer BEFORE clearing maps.
    // ws.on('close') won't fire the callback because we clear() synchronously
    // before the async close event, so we must notify explicitly here.
    const disconnectedPeerIds: string[] = [];
    this.handshaked.forEach(peerId => disconnectedPeerIds.push(peerId));

    this.connections.forEach((ws) => {
      try { ws.terminate(); } catch {} // terminate() is immediate, no lingering
    });
    this.connections.clear();
    this.peerInfo.clear();
    this.relayDeviceToHub.clear();
    this.handshaked.clear();
    this.connectingPeers.clear();
    this.connectingStartTimes.clear();

    // Cancel all pending acks
    this.pendingAcks.forEach(({ timer }) => clearTimeout(timer));
    this.pendingAcks.clear();

    // Cancel all pong timers
    this.pongTimers.forEach((timer) => clearTimeout(timer));
    this.pongTimers.clear();

    // Clean up all in-progress transfers
    this.inProgressTransfers.forEach((_, transferId) => {
      this.cleanupTransfer(transferId);
    });

    // Fire disconnect callbacks after cleanup so renderer state is in sync
    for (const peerId of disconnectedPeerIds) {
      this.callbacks.onPeerDisconnected(peerId);
    }
  }

  // ─── Health Ping ────────────────────────────────────────────────────

  private sendPings(): void {
    this.connections.forEach((ws, peerId) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!this.handshaked.has(peerId)) return;

      // Send ping
      try {
        ws.send(JSON.stringify({ type: 'peer-ping', data: {} }));
      } catch {
        return;
      }

      // Start 5s pong timeout (only if not already waiting)
      if (!this.pongTimers.has(peerId)) {
        const timer = setTimeout(() => {
          this.pongTimers.delete(peerId);
          const currentWs = this.connections.get(peerId);
          if (currentWs === ws) {
            const peerName = this.peerInfo.get(peerId)?.name || peerId;
            console.warn(`[P2P] No pong from ${peerName} within 5s — closing dead connection`);
            this.connections.delete(peerId);
            this.peerInfo.delete(peerId);
            this.handshaked.delete(peerId);
            try { ws.terminate(); } catch {}
            this.callbacks.onPeerDisconnected(peerId);
          }
        }, 5000);
        this.pongTimers.set(peerId, timer);
      }
    });
  }

  private cancelPongTimer(peerId: string): void {
    const timer = this.pongTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.pongTimers.delete(peerId);
    }
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

  getDebugState() {
    const connections: { peerId: string; name: string; readyState: number; handshaked: boolean }[] = [];
    this.connections.forEach((ws, peerId) => {
      const info = this.peerInfo.get(peerId);
      connections.push({
        peerId,
        name: info?.name || peerId,
        readyState: ws.readyState,
        handshaked: this.handshaked.has(peerId),
      });
    });

    return {
      connectionCount: this.connections.size,
      connections,
      handshakedPeers: Array.from(this.handshaked),
      connectingPeers: Array.from(this.connectingPeers),
      pendingAckCount: this.pendingAcks.size,
      pendingAckKeys: Array.from(this.pendingAcks.keys()),
      activeTransferCount: this.inProgressTransfers.size,
      activeTransfers: Array.from(this.inProgressTransfers.values()).map(t => ({
        transferId: t.transferId,
        originalName: t.originalName,
        progress: t.totalChunks > 0 ? Math.round((t.receivedChunks / t.totalChunks) * 100) : 0,
        peerId: t.peerId,
      })),
      relayDeviceCount: this.relayDeviceToHub.size,
    };
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
