import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import multer from "multer";
import { insertFileSchema, type FileTransferMessage, type WebSocketMessage } from "@shared/schema";
import { z } from "zod";
import path from "path";
import fs from "fs";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store connected clients
  const connectedClients = new Map<string, WebSocket>();

  wss.on('connection', async (ws: WebSocket, req) => {
    let device: any = null;
    let clientId: string = '';
    let socketId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Send setup required message immediately
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
          
          // Update last seen for this device if it exists
          if (device) {
            await storage.updateDeviceLastSeen(device.socketId);
          }
          
          // Handle device setup
          if (message.type === 'device-setup') {
            console.log(`Received device setup request for: ${message.data.nickname}`);
            if (!device) {
              try {
                device = await storage.createDevice({
                  nickname: message.data.nickname,
                  socketId: socketId,
                });

                clientId = device.id.toString();
                connectedClients.set(clientId, ws);

                console.log(`Device setup completed: ${message.data.nickname} (${clientId})`);

                // Send setup confirmation
                if (ws.readyState === WebSocket.OPEN) {
                  const setupResponse = {
                    type: 'setup-complete',
                    data: { device }
                  };
                  console.log('Sending setup-complete message:', setupResponse);
                  ws.send(JSON.stringify(setupResponse));
                } else {
                  console.error('WebSocket not open when trying to send setup-complete');
                }

                // Notify all clients about new connection
                const connectMessage: WebSocketMessage = {
                  type: 'device-connected',
                  data: { device, totalDevices: connectedClients.size }
                };
                
                broadcast(connectMessage, clientId);
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

          // Require device setup before handling other messages
          if (!device) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: 'Device setup required' }
            }));
            return;
          }

          // Handle user search
          if (message.type === 'scan-users') {
            const searchResults = await storage.searchDevicesByNickname(message.data.query);
            // Only include online devices and exclude current device
            const filteredResults = searchResults.filter(d => d.id !== device.id && d.isOnline);
            
            ws.send(JSON.stringify({
              type: 'scan-results',
              data: { users: filteredResults }
            }));
            return;
          }

          // Handle connection request
          if (message.type === 'connection-request') {
            console.log(`Connection request from ${device.nickname} to ${message.data.targetNickname}`);
            
            // Find target device from currently connected clients only
            const connectedDeviceIds = Array.from(connectedClients.keys()).map(id => parseInt(id));
            console.log('Connected device IDs:', connectedDeviceIds);
            
            let targetDevice = null;
            for (const deviceId of connectedDeviceIds) {
              const device = await storage.getDevice(deviceId);
              if (device && device.nickname === message.data.targetNickname) {
                targetDevice = device;
                break;
              }
            }
            
            console.log('Target device found in connected clients:', targetDevice);
            
            if (!targetDevice) {
              console.log('Target device not found among connected clients');
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'User not found or not currently connected' }
              }));
              return;
            }

            // Generate 2-digit connection key
            const connectionKey = Math.floor(10 + Math.random() * 90).toString();
            
            const connection = await storage.createConnection({
              requesterDeviceId: device.id,
              targetDeviceId: targetDevice.id,
              connectionKey: connectionKey,
              status: 'pending'
            });

            // Send connection request to target device
            const targetClient = Array.from(connectedClients.entries())
              .find(([id, client]) => parseInt(id) === targetDevice.id)?.[1];
            
            console.log(`Looking for target client for device ID ${targetDevice.id}`);
            console.log('Connected clients:', Array.from(connectedClients.keys()));
            console.log('Target client found:', !!targetClient);
            
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              const requestMessage = {
                type: 'connection-request',
                data: {
                  requesterNickname: device.nickname,
                  connectionKey: connectionKey,
                  connectionId: connection.id
                }
              };
              console.log('Sending connection request to target:', requestMessage);
              targetClient.send(JSON.stringify(requestMessage));
            } else {
              console.log('Target client not found or not ready');
            }

            // Confirm request sent to requester
            ws.send(JSON.stringify({
              type: 'connection-request-sent',
              data: { connectionId: connection.id, connectionKey }
            }));
            return;
          }

          // Handle verification key submission from requester
          if (message.type === 'submit-verification-key') {
            console.log(`Verification key submitted by ${device.nickname}:`, message.data);
            const connection = await storage.getConnection(message.data.connectionId);
            console.log('Found connection:', connection);
            
            if (!connection || connection.requesterDeviceId !== device.id) {
              console.log('Invalid connection or requester mismatch');
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid connection request' }
              }));
              return;
            }

            // Validate connection key
            console.log(`Comparing keys: submitted="${message.data.verificationKey}", expected="${connection.connectionKey}"`);
            if (message.data.verificationKey !== connection.connectionKey) {
              console.log('Verification key mismatch');
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid verification key' }
              }));
              return;
            }

            console.log('Verification key valid, approving connection');
            // Key is valid, approve the connection
            await storage.updateConnectionStatus(connection.id, 'active', new Date());
            
            // Get target device info
            const targetDevice = await storage.getDevice(connection.targetDeviceId);
            console.log('Target device:', targetDevice?.nickname);
            
            // Notify both parties
            const targetClient = Array.from(connectedClients.entries())
              .find(([id, client]) => parseInt(id) === connection.targetDeviceId)?.[1];
            
            console.log('Sending approval to target device:', !!targetClient);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                type: 'connection-approved',
                data: { connectionId: connection.id, partnerNickname: device.nickname }
              }));
            }

            console.log('Sending approval to requester');
            ws.send(JSON.stringify({
              type: 'connection-approved',
              data: { connectionId: connection.id, partnerNickname: targetDevice?.nickname || 'Unknown' }
            }));
            return;
          }

          // Handle connection response (approve/reject) - simplified for receiver
          if (message.type === 'connection-response') {
            console.log(`Connection response from ${device.nickname}:`, message.data);
            const connection = await storage.getConnection(message.data.connectionId);
            console.log('Found connection for response:', connection);
            
            if (!connection || connection.targetDeviceId !== device.id) {
              console.log('Invalid connection or target mismatch for response');
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid connection request' }
              }));
              return;
            }

            if (!message.data.approved) {
              console.log('Connection rejected, updating status');
              await storage.updateConnectionStatus(connection.id, 'rejected');
              
              // Notify requester of rejection
              const requesterClient = Array.from(connectedClients.entries())
                .find(([id, client]) => parseInt(id) === connection.requesterDeviceId)?.[1];
              
              console.log('Sending rejection to requester:', !!requesterClient);
              if (requesterClient && requesterClient.readyState === WebSocket.OPEN) {
                requesterClient.send(JSON.stringify({
                  type: 'connection-rejected',
                  data: { connectionId: connection.id, rejectedBy: device.nickname }
                }));
              }

              // Also send confirmation to the person who rejected
              ws.send(JSON.stringify({
                type: 'connection-rejected',
                data: { connectionId: connection.id, rejectedBy: device.nickname }
              }));
            }
            // If approved, we wait for the requester to submit the verification key
            return;
          }
          
          // Handle file transfer - only within active connections
          if (message.type === 'file-transfer') {
            // Check if this is sent to a specific connection
            const activeConnections = await storage.getActiveConnectionsForDevice(device.id);
            if (activeConnections.length === 0) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'No active connections for file transfer' }
              }));
              return;
            }

            let filename = message.data.filename;
            
            // Always save files to disk if they have content
            if (message.data.content && !message.data.isClipboard) {
              const uploadsDir = path.join(process.cwd(), 'uploads');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              
              const filePath = path.join(uploadsDir, filename);
              
              try {
                if (message.data.content.startsWith('data:')) {
                  // Handle base64 encoded files (images, binary files)
                  const base64Data = message.data.content.split(',')[1];
                  const buffer = Buffer.from(base64Data, 'base64');
                  fs.writeFileSync(filePath, buffer);
                } else if (message.data.mimeType.startsWith('text/')) {
                  // Handle text files
                  fs.writeFileSync(filePath, message.data.content, 'utf8');
                } else {
                  // Handle other content as binary
                  fs.writeFileSync(filePath, message.data.content);
                }
              } catch (error) {
                console.error('Error saving file to disk:', error);
              }
            }
            
            // Send file to all active connections
            let successfulTransfers = 0;
            for (const connection of activeConnections) {
              const file = await storage.createFile({
                filename: filename,
                originalName: message.data.originalName,
                mimeType: message.data.mimeType,
                size: message.data.size,
                content: message.data.content, // Store content for all files (clipboard, images, text)
                fromDeviceId: device.id,
                toDeviceId: connection.requesterDeviceId === device.id ? connection.targetDeviceId : connection.requesterDeviceId,
                connectionId: connection.id,
                isClipboard: message.data.isClipboard ? 1 : 0,
              });

              // Send to the connected partner
              const partnerId = connection.requesterDeviceId === device.id ? connection.targetDeviceId : connection.requesterDeviceId;
              const partnerClient = Array.from(connectedClients.entries())
                .find(([id, client]) => parseInt(id) === partnerId)?.[1];
              
              if (partnerClient && partnerClient.readyState === WebSocket.OPEN) {
                partnerClient.send(JSON.stringify({
                  type: 'file-received',
                  data: { file, fromDevice: device.nickname }
                }));
                successfulTransfers++;
              }

              // If it's clipboard content, also send clipboard sync
              if (message.data.isClipboard) {
                if (partnerClient && partnerClient.readyState === WebSocket.OPEN) {
                  partnerClient.send(JSON.stringify({
                    type: 'clipboard-sync',
                    data: { content: message.data.content, fromDevice: device.nickname, file }
                  }));
                }
              }
            }

            // Send confirmation back to sender with file data
            if (successfulTransfers > 0) {
              // Create a file object for the sender's records
              const senderFile = {
                id: Date.now(), // Temporary ID for frontend
                filename: message.data.filename,
                originalName: message.data.originalName,
                mimeType: message.data.mimeType,
                size: message.data.size,
                content: message.data.isClipboard ? message.data.content : undefined,
                fromDeviceId: device.id,
                toDeviceId: null, // Multiple recipients
                connectionId: null,
                transferredAt: new Date(),
                isClipboard: message.data.isClipboard ? 1 : 0,
              };

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
            
            if (connection && (connection.requesterDeviceId === device.id || connection.targetDeviceId === device.id)) {
              await storage.terminateConnection(connectionId);
              
              // Notify the other party
              const partnerId = connection.requesterDeviceId === device.id ? connection.targetDeviceId : connection.requesterDeviceId;
              const partnerClient = Array.from(connectedClients.entries())
                .find(([id, client]) => parseInt(id) === partnerId)?.[1];
              
              if (partnerClient && partnerClient.readyState === WebSocket.OPEN) {
                partnerClient.send(JSON.stringify({
                  type: 'connection-terminated',
                  data: { connectionId, terminatedBy: device.nickname }
                }));
              }
              
              ws.send(JSON.stringify({
                type: 'connection-terminated',
                data: { connectionId, terminatedBy: device.nickname }
              }));
            }
            return;
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          // Send error to client but don't crash the connection
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
        console.log(`Device disconnected: ${device?.nickname || 'Unknown'} (${clientId})`);
        
        if (device) {
          console.log(`Setting device ${device.nickname} offline`);
          await storage.updateDeviceOnlineStatus(device.socketId, false);
        }
        
        connectedClients.delete(clientId);
        
        if (device) {
          const disconnectMessage: WebSocketMessage = {
            type: 'device-disconnected',
            data: { device, totalDevices: connectedClients.size }
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
      const devices = await storage.getOnlineDevices();
      res.json(devices);
    } catch (error) {
      console.error('Error fetching devices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/files', async (req, res) => {
    try {
      const files = await storage.getAllFiles();
      res.json(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/connections/:deviceId', async (req, res) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const connections = await storage.getConnectionsByDevice(deviceId);
      res.json(connections);
    } catch (error) {
      console.error('Error fetching connections:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/files/:deviceId', async (req, res) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const files = await storage.getFilesByDevice(deviceId);
      res.json(files);
    } catch (error) {
      console.error('Error fetching device files:', error);
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

      // Save file to uploads directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `${Date.now()}_${file.originalname}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      // Save file record to database
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
      console.log('Download request for file ID:', fileIdStr);
      
      // Handle both numeric IDs and filename-based IDs
      let file;
      if (fileIdStr.match(/^\d+$/)) {
        const fileId = parseInt(fileIdStr);
        if (fileId > 2147483647) { // PostgreSQL integer limit
          console.log('File ID too large for integer, treating as filename');
          file = await storage.getFileByFilename(fileIdStr);
        } else {
          file = await storage.getFile(fileId);
        }
      } else {
        // Treat as filename
        file = await storage.getFileByFilename(fileIdStr);
      }

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      
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

  // File delete endpoint
  app.delete('/api/files/:id', async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Delete file from disk
      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete file record from database
      await storage.deleteFile(fileId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return httpServer;
}