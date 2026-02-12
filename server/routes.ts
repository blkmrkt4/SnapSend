import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import multer from "multer";
import { type WebSocketMessage, type ChunkedTransferState, CHUNK_THRESHOLD } from "@shared/schema";
import path from "path";
import fs from "fs";

// Track in-progress chunked transfers (server side - for browser mode)
interface ServerChunkTransfer extends ChunkedTransferState {
  tempFilePath: string;
  writeStream: fs.WriteStream | null;
  clientId: string;
}

const inProgressChunkTransfers = new Map<string, ServerChunkTransfer>();

// Clean up stale transfers periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  inProgressChunkTransfers.forEach((transfer, transferId) => {
    if (now - transfer.startedAt > timeout) {
      console.log(`Cleaning up stale chunked transfer: ${transferId}`);
      cleanupChunkTransfer(transferId);
    }
  });
}, 60000);

function cleanupChunkTransfer(transferId: string): void {
  const transfer = inProgressChunkTransfers.get(transferId);
  if (transfer) {
    try {
      transfer.writeStream?.destroy();
      if (fs.existsSync(transfer.tempFilePath)) {
        fs.unlinkSync(transfer.tempFilePath);
      }
    } catch (e) {
      console.warn(`Error cleaning up transfer ${transferId}:`, e);
    }
    inProgressChunkTransfers.delete(transferId);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

export interface RouteOptions {
  onP2PFileReceived?: (data: { file: any; fromDevice: string; isClipboard: boolean; clipboardContent?: string }) => void;
  onPeerHandshake?: (ws: any, peerId: string, peerName: string) => void;
}

export async function registerRoutes(app: Express, options?: RouteOptions): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store connected clients (local renderer clients, keyed by device ID)
  const connectedClients = new Map<string, WebSocket>();

  // Store connected P2P peers (remote Electron instances)
  const connectedPeers = new Map<string, WebSocket>();

  // Name maps for relay visibility
  const peerNameMap = new Map<string, string>();     // peerId → display name
  const clientNameMap = new Map<string, string>();   // clientId → display name

  // Build virtual device entries representing P2P peers (for browser clients)
  function getPeerVirtualDevices(): any[] {
    const devices: any[] = [];
    peerNameMap.forEach((name, pid) => {
      devices.push({
        id: 0,
        name,
        uuid: null,
        socketId: `peer:${pid}`,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    });
    return devices;
  }

  // Build simple device entries representing browser clients (for P2P peers)
  function getClientVirtualDevices(): { id: string; name: string }[] {
    const devices: { id: string; name: string }[] = [];
    clientNameMap.forEach((name, cid) => {
      devices.push({ id: cid, name });
    });
    return devices;
  }

  // Push current client list to all connected P2P peers
  function broadcastRelayDevicesToPeers() {
    const devices = getClientVirtualDevices();
    const msg = JSON.stringify({ type: 'relay-devices', data: { devices } });
    connectedPeers.forEach((peerWs) => {
      if (peerWs.readyState === WebSocket.OPEN) {
        peerWs.send(msg);
      }
    });
  }

  // Push updated peer list to all browser clients as device-connected/disconnected events
  function broadcastPeerAsDeviceToClients(peerId: string, peerName: string, connected: boolean) {
    const virtualDevice = {
      id: 0,
      name: peerName,
      uuid: null,
      socketId: `peer:${peerId}`,
      isOnline: connected,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const msgType = connected ? 'device-connected' : 'device-disconnected';
    connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: msgType,
          data: { device: virtualDevice }
        }));
      }
    });
  }

  wss.on('connection', async (ws: WebSocket, req) => {
    let device: any = null;
    let clientId: string = '';
    let socketId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let isPeerConnection = false;
    let peerId: string | null = null;

    try {
      // Send setup required message immediately (for local renderer clients)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'setup-required',
          data: { socketId }
        }));
      }

      // Handle WebSocket messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());

          // ─── P2P Peer Handshake (remote Electron instance) ───
          if (message.type === 'peer-handshake') {
            isPeerConnection = true;
            peerId = message.data.id;
            const peerName = message.data.name;

            console.log(`Peer handshake from: ${peerName} (${peerId})`);

            connectedPeers.set(peerId!, ws);
            peerNameMap.set(peerId!, peerName);

            // Notify Electron main process so PeerConnectionManager can also track this connection.
            // handleIncomingHandshake sends the ack with the real device ID/name.
            if (options?.onPeerHandshake) {
              options.onPeerHandshake(ws, peerId!, peerName);
            } else {
              // Standalone server mode (no Electron): send ack ourselves
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'peer-handshake-ack',
                  data: { id: socketId, name: 'local-server' }
                }));
              }
            }

            // Send current browser clients to this new peer
            if (ws.readyState === WebSocket.OPEN) {
              const clientDevices = getClientVirtualDevices();
              if (clientDevices.length > 0) {
                ws.send(JSON.stringify({
                  type: 'relay-devices',
                  data: { devices: clientDevices }
                }));
              }
            }

            // Notify all browser clients about this new peer
            broadcastPeerAsDeviceToClients(peerId!, peerName, true);

            return;
          }

          // ─── P2P File Transfer from remote peer ───
          if (isPeerConnection && message.type === 'file-transfer') {
            const fileData = message.data;
            console.log(`P2P file received from ${fileData.fromName}: ${fileData.originalName}`);

            let filename = fileData.filename || `${Date.now()}_${fileData.originalName}`;

            // Save file to disk if not clipboard
            if (fileData.content && !fileData.isClipboard) {
              try {
                const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }

                const filePath = path.join(uploadsDir, filename);
                if (fileData.content.startsWith('data:')) {
                  const base64Data = fileData.content.split(',')[1];
                  const buffer = Buffer.from(base64Data, 'base64');
                  fs.writeFileSync(filePath, buffer);
                } else if (fileData.mimeType?.startsWith('text/')) {
                  fs.writeFileSync(filePath, fileData.content, 'utf8');
                } else {
                  fs.writeFileSync(filePath, fileData.content);
                }
              } catch (error) {
                console.error('Error saving P2P file to disk:', error);
              }
            }

            // Save to DB (omit large content for non-clipboard files — it's already on disk)
            const savedFile = await storage.createFile({
              filename,
              originalName: fileData.originalName,
              mimeType: fileData.mimeType,
              size: fileData.size,
              content: fileData.isClipboard ? fileData.content : null,
              fromDeviceId: null,
              toDeviceId: null,
              connectionId: null,
              isClipboard: fileData.isClipboard ? 1 : 0,
              fromDeviceName: fileData.fromName || 'Unknown',
              toDeviceName: 'local',
            });

            // Forward to local renderer
            connectedClients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'file-received',
                  data: { file: savedFile, fromDevice: fileData.fromName || 'Unknown' }
                }));

                if (fileData.isClipboard) {
                  client.send(JSON.stringify({
                    type: 'clipboard-sync',
                    data: { content: fileData.content, fromDevice: fileData.fromName, file: savedFile }
                  }));
                }
              }
            });

            // Notify Electron renderer via IPC callback (connectedClients may be empty in P2P mode)
            if (options?.onP2PFileReceived) {
              options.onP2PFileReceived({
                file: savedFile,
                fromDevice: fileData.fromName || 'Unknown',
                isClipboard: !!fileData.isClipboard,
                clipboardContent: fileData.isClipboard ? fileData.content : undefined,
              });
            }

            // Send ack back to peer
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'file-received-ack',
                data: { filename }
              }));
            }

            return;
          }

          // ─── P2P Relay File Transfer (peer → specific browser client) ───
          if (isPeerConnection && message.type === 'relay-file-transfer') {
            const { targetClientId, ...fileTransferData } = message.data;
            const targetWs = connectedClients.get(targetClientId);

            let filename = fileTransferData.filename || `${Date.now()}_${fileTransferData.originalName}`;

            // Save file to disk if not clipboard
            if (fileTransferData.content && !fileTransferData.isClipboard) {
              try {
                const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }
                const filePath = path.join(uploadsDir, filename);
                if (fileTransferData.content.startsWith('data:')) {
                  const base64Data = fileTransferData.content.split(',')[1];
                  const buffer = Buffer.from(base64Data, 'base64');
                  fs.writeFileSync(filePath, buffer);
                } else if (fileTransferData.mimeType?.startsWith('text/')) {
                  fs.writeFileSync(filePath, fileTransferData.content, 'utf8');
                } else {
                  fs.writeFileSync(filePath, fileTransferData.content);
                }
              } catch (error) {
                console.error('Error saving relay file to disk:', error);
              }
            }

            // Save to DB
            const savedFile = await storage.createFile({
              filename,
              originalName: fileTransferData.originalName,
              mimeType: fileTransferData.mimeType,
              size: fileTransferData.size,
              content: fileTransferData.isClipboard ? fileTransferData.content : null,
              fromDeviceId: null,
              toDeviceId: null,
              connectionId: null,
              isClipboard: fileTransferData.isClipboard ? 1 : 0,
              fromDeviceName: peerNameMap.get(peerId!) || fileTransferData.fromName || 'Unknown',
              toDeviceName: clientNameMap.get(targetClientId) || 'Unknown',
            });

            // Forward to the specific browser client
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'file-received',
                data: { file: savedFile, fromDevice: peerNameMap.get(peerId!) || fileTransferData.fromName || 'Unknown' }
              }));

              if (fileTransferData.isClipboard) {
                targetWs.send(JSON.stringify({
                  type: 'clipboard-sync',
                  data: { content: fileTransferData.content, fromDevice: peerNameMap.get(peerId!) || fileTransferData.fromName, file: savedFile }
                }));
              }
            }

            // Send ack back to peer
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'relay-file-ack',
                data: { filename }
              }));
            }

            return;
          }

          // ─── Local Renderer Client Messages (browser mode) ───

          // Update last seen for this device if it exists
          if (device) {
            await storage.updateDeviceLastSeen(device.socketId);
          }

          // Handle device setup
          if (message.type === 'device-setup') {
            console.log(`Received device setup request for: ${message.data.name} (uuid: ${message.data.uuid || 'none'})`);
            if (!device) {
              try {
                // Look up by UUID first (stable identity), then fall back to name
                const clientUUID = message.data.uuid;
                let existing: any = null;
                if (clientUUID) {
                  existing = await storage.getDeviceByUUID(clientUUID);
                }
                if (!existing) {
                  existing = await storage.getDeviceByName(message.data.name);
                }

                if (existing) {
                  device = await storage.reactivateDevice(existing.id, socketId, message.data.name) || existing;
                } else {
                  device = await storage.createDevice({
                    name: message.data.name,
                    uuid: clientUUID || null,
                    socketId: socketId,
                  });
                }

                clientId = device.id.toString();
                connectedClients.set(clientId, ws);
                clientNameMap.set(clientId, device.name);

                console.log(`Device setup completed: ${message.data.name} (${clientId})`);

                // Get all online devices + virtual peers
                const onlineDevices = await storage.getOnlineDevices();
                const allDevices = [...onlineDevices, ...getPeerVirtualDevices()];

                // Send setup confirmation with device list (includes virtual peers)
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'setup-complete',
                    data: { device, onlineDevices: allDevices }
                  }));
                }

                // Notify all P2P peers about this new browser client
                broadcastRelayDevicesToPeers();

                // Notify all clients about new connection
                const connectMessage: WebSocketMessage = {
                  type: 'device-connected',
                  data: { device, onlineDevices, totalDevices: connectedClients.size }
                };

                broadcast(connectMessage, clientId);

                // Auto-pair: if exactly 2 devices online and not already paired
                if (onlineDevices.length === 2) {
                  const other = onlineDevices.find(d => d.id !== device.id);
                  if (other) {
                    const existingConnections = await storage.getActiveConnectionsForDevice(device.id);
                    const alreadyPaired = existingConnections.some(
                      c => (c.deviceAId === device.id && c.deviceBId === other.id) ||
                           (c.deviceAId === other.id && c.deviceBId === device.id)
                    );
                    if (!alreadyPaired) {
                      const connection = await storage.createConnection({
                        deviceAId: device.id,
                        deviceBId: other.id,
                        status: 'active',
                      });

                      const autoPairMsg = {
                        type: 'auto-paired',
                        data: { connection, partnerDevice: other }
                      };

                      // Send to this device
                      if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(autoPairMsg));
                      }

                      // Send to the other device
                      const otherClient = connectedClients.get(other.id.toString());
                      if (otherClient && otherClient.readyState === WebSocket.OPEN) {
                        otherClient.send(JSON.stringify({
                          type: 'auto-paired',
                          data: { connection, partnerDevice: device }
                        }));
                      }

                      console.log(`Auto-paired ${device.name} with ${other.name}`);
                    }
                  }
                }
              } catch (error) {
                console.error('Error during device setup:', error);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'error',
                    data: { message: 'Failed to setup device: ' + (error as Error).message }
                  }));
                }
                return;
              }
            }
            return;
          }

          // Handle device name update
          if (message.type === 'device-name-update' && device) {
            const newName = message.data.name?.trim();
            if (newName) {
              const updated = await storage.updateDeviceName(device.id, newName);
              if (updated) {
                device = updated;
                clientNameMap.set(clientId, newName);
                console.log(`Device renamed to: ${newName} (${device.id})`);
                // Notify P2P peers about updated client list
                broadcastRelayDevicesToPeers();

                // Send confirmation back
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'name-updated',
                    data: { device: updated }
                  }));
                }

                // Notify other clients about the name change
                const onlineDevices = await storage.getOnlineDevices();
                broadcast({
                  type: 'device-connected',
                  data: { device: updated, onlineDevices, totalDevices: connectedClients.size }
                }, clientId);
              }
            }
            return;
          }

          // Require device setup before handling other messages
          if (!device) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: 'Device setup required' }
            }));
            return;
          }

          // Handle pair request
          if (message.type === 'pair-request') {
            const targetDeviceId = message.data.targetDeviceId;
            const targetDevice = await storage.getDevice(targetDeviceId);

            if (!targetDevice || !targetDevice.isOnline) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Device not found or offline' }
              }));
              return;
            }

            // Check if already paired
            const existingConnections = await storage.getActiveConnectionsForDevice(device.id);
            const alreadyPaired = existingConnections.some(
              c => (c.deviceAId === device.id && c.deviceBId === targetDeviceId) ||
                   (c.deviceAId === targetDeviceId && c.deviceBId === device.id)
            );

            if (alreadyPaired) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Already paired with this device' }
              }));
              return;
            }

            const connection = await storage.createConnection({
              deviceAId: device.id,
              deviceBId: targetDeviceId,
              status: 'active',
            });

            // Notify both devices
            ws.send(JSON.stringify({
              type: 'pair-accepted',
              data: { connection, partnerDevice: targetDevice }
            }));

            const targetClient = connectedClients.get(targetDeviceId.toString());
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                type: 'pair-accepted',
                data: { connection, partnerDevice: device }
              }));
            }

            console.log(`Paired ${device.name} with ${targetDevice.name}`);
            return;
          }

          // Handle file transfer
          if (message.type === 'file-transfer') {
            // ─── C→B Relay: browser client targeting a P2P peer ───
            const targetPeerId = message.data.targetPeerId;
            if (targetPeerId && connectedPeers.has(targetPeerId)) {
              const peerWs = connectedPeers.get(targetPeerId)!;
              let filename = message.data.filename;

              // Save file to disk if not clipboard
              if (message.data.content && !message.data.isClipboard) {
                const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }
                const filePath = path.join(uploadsDir, filename);
                try {
                  if (message.data.content.startsWith('data:')) {
                    const base64Data = message.data.content.split(',')[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    fs.writeFileSync(filePath, buffer);
                  } else if (message.data.mimeType?.startsWith('text/')) {
                    fs.writeFileSync(filePath, message.data.content, 'utf8');
                  } else {
                    fs.writeFileSync(filePath, message.data.content);
                  }
                } catch (error) {
                  console.error('Error saving relay file to disk:', error);
                }
              }

              // Save to DB
              const savedFile = await storage.createFile({
                filename,
                originalName: message.data.originalName,
                mimeType: message.data.mimeType,
                size: message.data.size,
                content: message.data.isClipboard ? message.data.content : null,
                fromDeviceId: device.id,
                toDeviceId: null,
                connectionId: null,
                isClipboard: message.data.isClipboard ? 1 : 0,
                fromDeviceName: device.name,
                toDeviceName: peerNameMap.get(targetPeerId) || 'Unknown',
              });

              // Forward to the P2P peer as a standard file-transfer
              if (peerWs.readyState === WebSocket.OPEN) {
                peerWs.send(JSON.stringify({
                  type: 'file-transfer',
                  data: {
                    filename,
                    originalName: message.data.originalName,
                    mimeType: message.data.mimeType,
                    size: message.data.size,
                    content: message.data.content,
                    isClipboard: message.data.isClipboard,
                    fromId: clientId,
                    fromName: device.name,
                  }
                }));
              }

              // Send confirmation back to browser client
              ws.send(JSON.stringify({
                type: 'file-sent-confirmation',
                data: {
                  filename: message.data.originalName,
                  recipientCount: 1,
                  isClipboard: message.data.isClipboard,
                  file: savedFile,
                }
              }));

              return;
            }

            const activeConnections = await storage.getActiveConnectionsForDevice(device.id);

            if (activeConnections.length === 0) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'No active connections for file transfer' }
              }));
              return;
            }

            let filename = message.data.filename;

            // Save files to disk if they have content and aren't clipboard
            if (message.data.content && !message.data.isClipboard) {
              const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }

              const filePath = path.join(uploadsDir, filename);

              try {
                if (message.data.content.startsWith('data:')) {
                  const base64Data = message.data.content.split(',')[1];
                  const buffer = Buffer.from(base64Data, 'base64');
                  fs.writeFileSync(filePath, buffer);
                } else if (message.data.mimeType.startsWith('text/')) {
                  fs.writeFileSync(filePath, message.data.content, 'utf8');
                } else {
                  fs.writeFileSync(filePath, message.data.content);
                }
              } catch (error) {
                console.error('Error saving file to disk:', error);
              }
            }

            // Send file to all active connections
            let successfulTransfers = 0;
            for (const connection of activeConnections) {
              const partnerId = connection.deviceAId === device.id ? connection.deviceBId : connection.deviceAId;

              const file = await storage.createFile({
                filename: filename,
                originalName: message.data.originalName,
                mimeType: message.data.mimeType,
                size: message.data.size,
                content: message.data.content,
                fromDeviceId: device.id,
                toDeviceId: partnerId,
                connectionId: connection.id,
                isClipboard: message.data.isClipboard ? 1 : 0,
              });

              const partnerClient = connectedClients.get(partnerId.toString());
              if (partnerClient && partnerClient.readyState === WebSocket.OPEN) {
                partnerClient.send(JSON.stringify({
                  type: 'file-received',
                  data: { file, fromDevice: device.name }
                }));
                successfulTransfers++;

                if (message.data.isClipboard) {
                  partnerClient.send(JSON.stringify({
                    type: 'clipboard-sync',
                    data: { content: message.data.content, fromDevice: device.name, file }
                  }));
                }
              }
            }

            if (successfulTransfers > 0) {
              const senderFile = await storage.createFile({
                filename: filename,
                originalName: message.data.originalName,
                mimeType: message.data.mimeType,
                size: message.data.size,
                content: message.data.content,
                fromDeviceId: device.id,
                toDeviceId: null,
                connectionId: null,
                isClipboard: message.data.isClipboard ? 1 : 0,
              });

              ws.send(JSON.stringify({
                type: 'file-sent-confirmation',
                data: {
                  filename: message.data.originalName,
                  recipientCount: successfulTransfers,
                  isClipboard: message.data.isClipboard,
                  file: senderFile
                }
              }));
            }
            return;
          }

          // Handle connection termination
          if (message.type === 'terminate-connection') {
            const connectionId = message.data.connectionId;
            const connection = await storage.getConnection(connectionId);

            if (connection && (connection.deviceAId === device.id || connection.deviceBId === device.id)) {
              await storage.terminateConnection(connectionId);

              const partnerId = connection.deviceAId === device.id ? connection.deviceBId : connection.deviceAId;
              const partnerClient = connectedClients.get(partnerId.toString());

              if (partnerClient && partnerClient.readyState === WebSocket.OPEN) {
                partnerClient.send(JSON.stringify({
                  type: 'connection-terminated',
                  data: { connectionId, terminatedBy: device.name }
                }));
              }

              ws.send(JSON.stringify({
                type: 'connection-terminated',
                data: { connectionId, terminatedBy: device.name }
              }));
            }
            return;
          }

          // ─── Chunked Transfer: chunk-start ───
          if (message.type === 'chunk-start') {
            const { transferId, filename, originalName, mimeType, size, totalChunks, isClipboard, targetConnectionId, targetPeerId } = message.data;
            console.log(`Chunked transfer starting from ${device.name}: ${originalName} (${totalChunks} chunks)`);

            const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const tempFilePath = path.join(uploadsDir, `${transferId}.tmp`);

            try {
              const writeStream = fs.createWriteStream(tempFilePath);

              const transfer: ServerChunkTransfer = {
                transferId,
                filename,
                originalName,
                mimeType,
                totalSize: size,
                totalChunks,
                receivedChunks: 0,
                isClipboard,
                fromId: device.id.toString(),
                fromName: device.name,
                startedAt: Date.now(),
                tempFilePath,
                writeStream,
                clientId: clientId,
              };

              // Store target info for forwarding when complete
              (transfer as any).targetConnectionId = targetConnectionId;
              (transfer as any).targetPeerId = targetPeerId;

              inProgressChunkTransfers.set(transferId, transfer);

              ws.send(JSON.stringify({
                type: 'chunk-ack',
                data: { transferId, status: 'ok' }
              }));
            } catch (error) {
              console.error('Error starting chunked receive:', error);
              ws.send(JSON.stringify({
                type: 'chunk-ack',
                data: { transferId, status: 'error', error: (error as Error).message }
              }));
            }
            return;
          }

          // ─── Chunked Transfer: chunk-data ───
          if (message.type === 'chunk-data') {
            const { transferId, chunkIndex, content } = message.data;
            const transfer = inProgressChunkTransfers.get(transferId);

            if (!transfer) {
              ws.send(JSON.stringify({
                type: 'chunk-error',
                data: { transferId, error: 'Unknown transfer', chunkIndex }
              }));
              return;
            }

            try {
              const chunkBuffer = Buffer.from(content, 'base64');
              transfer.writeStream?.write(chunkBuffer);
              transfer.receivedChunks++;

              ws.send(JSON.stringify({
                type: 'chunk-ack',
                data: { transferId, chunkIndex, status: 'ok' }
              }));
            } catch (error) {
              console.error('Error writing chunk:', error);
              ws.send(JSON.stringify({
                type: 'chunk-ack',
                data: { transferId, chunkIndex, status: 'error', error: (error as Error).message }
              }));
            }
            return;
          }

          // ─── Chunked Transfer: chunk-end ───
          if (message.type === 'chunk-end') {
            const { transferId } = message.data;
            const transfer = inProgressChunkTransfers.get(transferId);

            if (!transfer) {
              ws.send(JSON.stringify({
                type: 'chunk-error',
                data: { transferId, error: 'Unknown transfer' }
              }));
              return;
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
              const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
              const finalPath = path.join(uploadsDir, transfer.filename);
              fs.renameSync(transfer.tempFilePath, finalPath);

              console.log(`Chunked transfer complete: ${transfer.originalName}`);

              // Save to database (no content stored for large files - it's on disk)
              const savedFile = await storage.createFile({
                filename: transfer.filename,
                originalName: transfer.originalName,
                mimeType: transfer.mimeType,
                size: transfer.totalSize,
                content: null, // Large file - content is on disk
                fromDeviceId: device.id,
                toDeviceId: null,
                connectionId: null,
                isClipboard: transfer.isClipboard ? 1 : 0,
                fromDeviceName: device.name,
                toDeviceName: null,
              });

              // Forward to connected devices (same logic as regular file transfer)
              const targetPeerId = (transfer as any).targetPeerId;
              const targetConnectionId = (transfer as any).targetConnectionId;

              if (targetPeerId && connectedPeers.has(targetPeerId)) {
                // Forward to P2P peer
                const peerWs = connectedPeers.get(targetPeerId)!;
                if (peerWs.readyState === WebSocket.OPEN) {
                  // For large files, we need to re-read and send chunks to the peer
                  // For now, send metadata and let peer know file is available
                  peerWs.send(JSON.stringify({
                    type: 'file-transfer',
                    data: {
                      filename: transfer.filename,
                      originalName: transfer.originalName,
                      mimeType: transfer.mimeType,
                      size: transfer.totalSize,
                      content: null, // Large file - receiver should request download
                      isClipboard: transfer.isClipboard,
                      fromId: clientId,
                      fromName: device.name,
                      isLargeFile: true,
                    }
                  }));
                }
              } else {
                // Forward to browser clients via connections
                const activeConnections = await storage.getActiveConnectionsForDevice(device.id);
                for (const connection of activeConnections) {
                  const partnerId = connection.deviceAId === device.id ? connection.deviceBId : connection.deviceAId;
                  const partnerClient = connectedClients.get(partnerId.toString());

                  if (partnerClient && partnerClient.readyState === WebSocket.OPEN) {
                    partnerClient.send(JSON.stringify({
                      type: 'file-received',
                      data: { file: savedFile, fromDevice: device.name, isLargeFile: true }
                    }));
                  }
                }
              }

              // Send confirmation to sender
              ws.send(JSON.stringify({
                type: 'chunk-ack',
                data: { transferId, status: 'ok' }
              }));

              ws.send(JSON.stringify({
                type: 'file-sent-confirmation',
                data: {
                  filename: transfer.originalName,
                  recipientCount: 1,
                  isClipboard: transfer.isClipboard,
                  file: savedFile
                }
              }));

              // Clean up
              inProgressChunkTransfers.delete(transferId);
            } catch (error) {
              console.error('Error finalizing chunked transfer:', error);
              ws.send(JSON.stringify({
                type: 'chunk-ack',
                data: { transferId, status: 'error', error: (error as Error).message }
              }));
              cleanupChunkTransfer(transferId);
            }
            return;
          }

          // ─── Chunked Transfer: chunk-error ───
          if (message.type === 'chunk-error') {
            const { transferId } = message.data;
            console.error(`Chunked transfer error: ${message.data.error}`);
            cleanupChunkTransfer(transferId);
            return;
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: 'Internal server error' }
            }));
          }
        }
      });

      // Handle disconnect
      ws.on('close', async () => {
        if (isPeerConnection && peerId) {
          const peerName = peerNameMap.get(peerId) || 'Unknown';
          console.log(`Peer disconnected: ${peerName} (${peerId})`);
          connectedPeers.delete(peerId);
          peerNameMap.delete(peerId);
          // Notify browser clients that this peer is gone
          broadcastPeerAsDeviceToClients(peerId, peerName, false);
          return;
        }

        console.log(`Device disconnected: ${device?.name || 'Unknown'} (${clientId})`);

        if (device) {
          await storage.setDeviceOffline(device.socketId);
        }

        connectedClients.delete(clientId);
        clientNameMap.delete(clientId);

        // Clean up any in-progress chunked transfers for this client
        inProgressChunkTransfers.forEach((transfer, transferId) => {
          if (transfer.clientId === clientId) {
            cleanupChunkTransfer(transferId);
          }
        });

        // Notify P2P peers about updated client list
        broadcastRelayDevicesToPeers();

        if (device) {
          const onlineDevices = await storage.getOnlineDevices();
          const disconnectMessage: WebSocketMessage = {
            type: 'device-disconnected',
            data: { device, onlineDevices, totalDevices: connectedClients.size }
          };

          broadcast(disconnectMessage, clientId);
        }
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  });

  function broadcast(message: WebSocketMessage, excludeClientId?: string) {
    connectedClients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // API Routes
  app.get('/api/devices', async (req, res) => {
    try {
      const allDevices = await storage.getOnlineDevices();
      res.json(allDevices);
    } catch (error) {
      console.error('Error fetching devices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/files', async (req, res) => {
    try {
      const tag = req.query.tag as string | undefined;
      let allFiles;
      if (tag) {
        allFiles = await storage.getFilesByTag(tag);
      } else {
        allFiles = await storage.getAllFiles();
      }
      res.json(allFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get all unique tags
  app.get('/api/tags', async (req, res) => {
    try {
      const tags = await storage.getAllTags();
      res.json(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create a new tag in the vocabulary
  app.post('/api/tags', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Tag name is required' });
      }

      const success = await storage.addTag(name.trim());
      if (success) {
        const allTags = await storage.getAllTags();
        res.json({ success: true, tags: allTags });
      } else {
        res.status(500).json({ error: 'Failed to add tag' });
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete a tag from vocabulary and all files
  app.delete('/api/tags/:tag', async (req, res) => {
    try {
      const tag = decodeURIComponent(req.params.tag);
      const updatedCount = await storage.deleteTag(tag);
      const allTags = await storage.getAllTags();
      res.json({ success: true, filesUpdated: updatedCount, tags: allTags });
    } catch (error) {
      console.error('Error deleting tag:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/connections/:deviceId', async (req, res) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const deviceConnections = await storage.getConnectionsByDevice(deviceId);
      res.json(deviceConnections);
    } catch (error) {
      console.error('Error fetching connections:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/files/:deviceId', async (req, res) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const deviceFiles = await storage.getFilesByDevice(deviceId);
      res.json(deviceFiles);
    } catch (error) {
      console.error('Error fetching device files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Record a sent file (for P2P mode where sender needs to persist to their own DB)
  app.post('/api/files/record-sent', async (req, res) => {
    try {
      const { filename, originalName, mimeType, size, content, isClipboard, toDeviceName } = req.body;

      if (!originalName || !mimeType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Save file to disk if it has content and isn't clipboard
      let savedFilename = filename || `${Date.now()}_${originalName}`;
      if (content && !isClipboard) {
        const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, savedFilename);
        try {
          if (content.startsWith('data:')) {
            const base64Data = content.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);
          } else {
            fs.writeFileSync(filePath, content);
          }
        } catch (error) {
          console.error('Error saving sent file to disk:', error);
        }
      }

      const savedFile = await storage.createFile({
        filename: savedFilename,
        originalName,
        mimeType,
        size: size || 0,
        content: isClipboard ? content : null,
        fromDeviceId: null,
        toDeviceId: null,
        connectionId: null,
        isClipboard: isClipboard ? 1 : 0,
        fromDeviceName: 'local',
        toDeviceName: toDeviceName || null,
      });

      res.json(savedFile);
    } catch (error) {
      console.error('Error recording sent file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // File upload endpoint
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.file;
      const { deviceId } = req.body;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
      }

      const uploadsDir = (process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads'));
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `${Date.now()}_${file.originalname}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      const savedFile = await storage.createFile({
        filename: filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        fromDeviceId: parseInt(deviceId),
        toDeviceId: null,
        connectionId: null,
        isClipboard: 0,
      });

      res.json(savedFile);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // File download endpoint
  app.get('/api/files/:id/download', async (req, res) => {
    try {
      const fileIdStr = req.params.id;

      let file;
      if (fileIdStr.match(/^\d+$/)) {
        const fileId = parseInt(fileIdStr);
        file = await storage.getFile(fileId);
      } else {
        file = await storage.getFileByFilename(fileIdStr);
      }

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = path.join(process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads'), file.filename);

      if (fs.existsSync(filePath)) {
        res.download(filePath, file.originalName);
      } else {
        res.status(404).json({ error: 'File not found on disk' });
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // File rename endpoint
  app.patch('/api/files/:id', async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const { originalName } = req.body;

      if (!originalName || typeof originalName !== 'string' || !originalName.trim()) {
        return res.status(400).json({ error: 'A non-empty originalName is required' });
      }

      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const updated = await storage.renameFile(fileId, originalName.trim());
      res.json(updated);
    } catch (error) {
      console.error('Error renaming file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update file tags
  app.patch('/api/files/:id/tags', async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'tags must be an array of strings' });
      }

      // Validate and clean tags
      const cleanedTags = tags
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const updated = await storage.updateFileTags(fileId, cleanedTags);
      res.json(updated);
    } catch (error) {
      console.error('Error updating file tags:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update file metadata
  app.patch('/api/files/:id/metadata', async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const { metadata } = req.body;

      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return res.status(400).json({ error: 'metadata must be an object' });
      }

      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const updated = await storage.updateFileMetadata(fileId, metadata);
      res.json(updated);
    } catch (error) {
      console.error('Error updating file metadata:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // File delete endpoint
  app.delete('/api/files/:id', async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = path.join(process.env.SNAPSEND_UPLOADS_DIR || path.join(process.cwd(), 'uploads'), file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await storage.deleteFile(fileId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return httpServer;
}
