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
          
          // Handle device setup
          if (message.type === 'device-setup') {
            if (!device) {
              device = await storage.createDevice({
                nickname: message.data.nickname,
                socketId: socketId,
              });

              clientId = device.id.toString();
              connectedClients.set(clientId, ws);

              console.log(`Device setup completed: ${message.data.nickname} (${clientId})`);

              // Send setup confirmation
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'setup-complete',
                  data: { device }
                }));
              }

              // Notify all clients about new connection
              const connectMessage: WebSocketMessage = {
                type: 'device-connected',
                data: { device, totalDevices: connectedClients.size }
              };
              
              broadcast(connectMessage, clientId);
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
            // Don't include current device in results
            const filteredResults = searchResults.filter(d => d.id !== device.id);
            
            ws.send(JSON.stringify({
              type: 'scan-results',
              data: { users: filteredResults }
            }));
            return;
          }

          // Handle connection request
          if (message.type === 'connection-request') {
            console.log(`Connection request from ${device.nickname} to ${message.data.targetNickname}`);
            
            const targetDevice = await storage.getDeviceByNickname(message.data.targetNickname);
            if (!targetDevice) {
              console.log(`Target device not found: ${message.data.targetNickname}`);
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'User not found' }
              }));
              return;
            }

            console.log(`Target device found: ${targetDevice.nickname} (ID: ${targetDevice.id})`);

            // Generate 2-digit connection key
            const connectionKey = Math.floor(10 + Math.random() * 90).toString();
            
            const connection = await storage.createConnection({
              requesterDeviceId: device.id,
              targetDeviceId: targetDevice.id,
              connectionKey: connectionKey,
              status: 'pending'
            });

            console.log(`Created connection with ID: ${connection.id}, key: ${connectionKey}`);

            // Send connection request to target device
            const targetClient = Array.from(connectedClients.entries())
              .find(([id, client]) => parseInt(id) === targetDevice.id)?.[1];
            
            console.log(`Looking for target client with ID: ${targetDevice.id}`);
            console.log(`Connected clients: ${Array.from(connectedClients.keys()).join(', ')}`);
            
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              console.log(`Sending connection request to target device`);
              targetClient.send(JSON.stringify({
                type: 'connection-request',
                data: {
                  requesterNickname: device.nickname,
                  connectionKey: connectionKey,
                  connectionId: connection.id
                }
              }));
            } else {
              console.log(`Target client not found or not connected`);
            }

            // Confirm request sent to requester
            console.log(`Sending confirmation to requester`);
            ws.send(JSON.stringify({
              type: 'connection-request-sent',
              data: { connectionId: connection.id, connectionKey }
            }));
            return;
          }

          // Handle connection response (approve/reject)
          if (message.type === 'connection-response') {
            const connection = await storage.getConnection(message.data.connectionId);
            if (!connection || connection.targetDeviceId !== device.id) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid connection request' }
              }));
              return;
            }

            if (message.data.approved && message.data.enteredKey === connection.connectionKey) {
              // Approve connection
              await storage.updateConnectionStatus(connection.id, 'active', new Date());
              
              // Notify both parties
              const requesterClient = Array.from(connectedClients.entries())
                .find(([id, client]) => parseInt(id) === connection.requesterDeviceId)?.[1];
              
              if (requesterClient && requesterClient.readyState === WebSocket.OPEN) {
                requesterClient.send(JSON.stringify({
                  type: 'connection-approved',
                  data: { connectionId: connection.id, partnerNickname: device.nickname }
                }));
              }

              ws.send(JSON.stringify({
                type: 'connection-approved',
                data: { connectionId: connection.id, partnerNickname: (await storage.getDevice(connection.requesterDeviceId))?.nickname }
              }));
            } else {
              // Reject connection
              await storage.updateConnectionStatus(connection.id, 'rejected');
              
              const requesterClient = Array.from(connectedClients.entries())
                .find(([id, client]) => parseInt(id) === connection.requesterDeviceId)?.[1];
              
              if (requesterClient && requesterClient.readyState === WebSocket.OPEN) {
                requesterClient.send(JSON.stringify({
                  type: 'connection-rejected',
                  data: { connectionId: connection.id }
                }));
              }
            }
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
            for (const connection of activeConnections) {
              const file = await storage.createFile({
                filename: filename,
                originalName: message.data.originalName,
                mimeType: message.data.mimeType,
                size: message.data.size,
                content: message.data.isClipboard ? message.data.content : undefined,
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
        }
      });

      ws.on('close', async () => {
        if (device && clientId) {
          connectedClients.delete(clientId);
          await storage.updateDeviceOnlineStatus(device.socketId, false);
          
          const disconnectMessage: WebSocketMessage = {
            type: 'device-disconnected',
            data: { deviceNickname: device.nickname, totalDevices: connectedClients.size }
          };
          
          broadcast(disconnectMessage);
          console.log(`Device disconnected: ${device.nickname} (${clientId})`);
        }
      });

      // Don't send initial data until device is set up

    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      ws.close();
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
      res.status(500).json({ error: 'Failed to fetch devices' });
    }
  });

  app.get('/api/connections/:deviceId', async (req, res) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const connections = await storage.getActiveConnectionsForDevice(deviceId);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch connections' });
    }
  });

  app.post('/api/search-users', async (req, res) => {
    try {
      const { query } = req.body;
      const users = await storage.searchDevicesByNickname(query);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  app.get('/api/files', async (req, res) => {
    try {
      const { search } = req.query;
      
      let files;
      if (search && typeof search === 'string') {
        files = await storage.searchFiles(search);
      } else {
        files = await storage.getAllFiles();
      }
      
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  });

  app.post('/api/files/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const { deviceId } = req.body;
      
      // Save file to disk (in a real app, you'd use cloud storage)
      const filename = `${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(process.cwd(), 'uploads', filename);
      
      // Ensure uploads directory exists
      const uploadsDir = path.dirname(filePath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, req.file.buffer);

      const file = await storage.createFile({
        filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        content: req.file.mimetype.startsWith('text/') ? req.file.buffer.toString('utf-8') : undefined,
        fromDeviceId: deviceId ? parseInt(deviceId) : null,
        toDeviceId: null,
        isClipboard: 0,
      });

      // Broadcast to WebSocket clients
      const message: WebSocketMessage = {
        type: 'file-received',
        data: { file, fromDevice: 'Upload' }
      };
      broadcast(message);

      res.json(file);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  app.post('/api/clipboard', async (req, res) => {
    try {
      const { content, deviceId } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'No content provided' });
      }

      const file = await storage.createFile({
        filename: 'clipboard-content',
        originalName: 'Clipboard Content',
        mimeType: 'text/plain',
        size: content.length,
        content,
        fromDeviceId: deviceId ? parseInt(deviceId) : null,
        toDeviceId: null,
        isClipboard: 1,
      });

      // Broadcast to WebSocket clients
      const message: WebSocketMessage = {
        type: 'clipboard-sync',
        data: { content, fromDevice: 'Manual', file }
      };
      broadcast(message);

      res.json(file);
    } catch (error) {
      res.status(500).json({ error: 'Failed to sync clipboard' });
    }
  });

  app.get('/api/files/:id/download', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getFile(id);
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      if (file.isClipboard && file.content) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}.txt"`);
        res.send(file.content);
      } else {
        const filePath = path.join(process.cwd(), 'uploads', file.filename);
        
        if (fs.existsSync(filePath)) {
          res.download(filePath, file.originalName);
        } else {
          res.status(404).json({ error: 'File not found on disk' });
        }
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to download file' });
    }
  });

  app.delete('/api/files/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFile(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  return httpServer;
}
