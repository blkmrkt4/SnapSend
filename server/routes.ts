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
    let deviceName = req.headers['x-device-name'] as string || 'Unknown Device';
    let device: any = null;
    let clientId: string = '';
    
    try {
      // Generate a unique socket ID
      const socketId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create device record
      device = await storage.createDevice({
        name: deviceName,
        socketId: socketId,
      });

      clientId = device.id.toString();
      connectedClients.set(clientId, ws);

      console.log(`Device connected: ${deviceName} (${clientId})`);

      // Notify all clients about new connection
      const connectMessage: WebSocketMessage = {
        type: 'device-connected',
        data: { device, totalDevices: connectedClients.size }
      };
      
      broadcast(connectMessage, clientId);

      // Handle WebSocket messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle device identification
          if (message.type === 'device-identification') {
            deviceName = message.data.name;
            // Update device name in storage
            if (device) {
              await storage.updateDeviceLastSeen(device.socketId);
            }
            return;
          }
          
          if (message.type === 'file-transfer') {
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
            
            // Save file to storage
            const file = await storage.createFile({
              filename: filename,
              originalName: message.data.originalName,
              mimeType: message.data.mimeType,
              size: message.data.size,
              content: message.data.isClipboard ? message.data.content : undefined, // Only store content for clipboard items
              fromDeviceId: device.id,
              toDeviceId: null, // Broadcast to all
              isClipboard: message.data.isClipboard ? 1 : 0,
            });

            // Broadcast to all clients (including sender for confirmation)
            const transferMessage: WebSocketMessage = {
              type: 'file-received',
              data: { file, fromDevice: deviceName }
            };
            
            // Send to all clients including the sender
            connectedClients.forEach((client, id) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(transferMessage));
              }
            });

            // If it's clipboard content, also send clipboard sync
            if (message.data.isClipboard) {
              const clipboardMessage: WebSocketMessage = {
                type: 'clipboard-sync',
                data: { content: message.data.content, fromDevice: deviceName }
              };
              broadcast(clipboardMessage, clientId);
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      });

      ws.on('close', async () => {
        connectedClients.delete(clientId);
        if (device) {
          await storage.removeDevice(device.socketId);
        }
        
        const disconnectMessage: WebSocketMessage = {
          type: 'device-disconnected',
          data: { deviceName, totalDevices: connectedClients.size }
        };
        
        broadcast(disconnectMessage);
        console.log(`Device disconnected: ${deviceName}`);
      });

      // Send initial data
      const allFiles = await storage.getAllFiles();
      const allDevices = await storage.getAllDevices();
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'initial-data',
          data: { files: allFiles, devices: allDevices, currentDevice: device }
        }));
      }

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
      const devices = await storage.getAllDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch devices' });
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
