import { useEffect, useRef, useState, useCallback } from 'react';
import { type WebSocketMessage, type Device, type File } from '@shared/schema';

export interface WebSocketState {
  isConnected: boolean;
  devices: Device[];
  currentDevice: Device | null;
  error: string | null;
}

export function useWebSocket(deviceName: string) {
  const ws = useRef<WebSocket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    devices: [],
    currentDevice: null,
    error: null,
  });

  const [files, setFiles] = useState<File[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);
      
      // Set device name header (this is a limitation of WebSocket - headers can't be set this way)
      // In a real implementation, you'd send this as the first message
      
      ws.current.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        
        // Send device identification after connection is established
        setTimeout(() => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'device-identification',
              data: { name: deviceName }
            }));
          }
        }, 100);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message.type, message.data);
          
          switch (message.type) {
            case 'initial-data':
              console.log('Setting initial files:', message.data.files);
              setFiles(message.data.files || []);
              setState(prev => ({
                ...prev,
                devices: message.data.devices || [],
                currentDevice: message.data.currentDevice || null,
              }));
              break;
              
            case 'device-connected':
              setState(prev => ({
                ...prev,
                devices: [...prev.devices, message.data.device],
              }));
              break;
              
            case 'device-disconnected':
              setState(prev => ({
                ...prev,
                devices: prev.devices.filter(d => d.name !== message.data.deviceName),
              }));
              break;
              
            case 'file-received':
              console.log('File received:', message.data.file);
              setFiles(prev => {
                const newFiles = [message.data.file, ...prev];
                console.log('Updated files list:', newFiles);
                return newFiles;
              });
              setNotifications(prev => [...prev, {
                id: Date.now(),
                type: 'file',
                title: 'File received',
                message: `${message.data.file.originalName} from ${message.data.fromDevice}`,
                file: message.data.file,
                timestamp: new Date(),
              }]);
              break;
              
            case 'clipboard-sync':
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(message.data.content).catch(console.error);
              }
              
              if (message.data.file) {
                setFiles(prev => [message.data.file, ...prev]);
              }
              
              setNotifications(prev => [...prev, {
                id: Date.now(),
                type: 'clipboard',
                title: 'Clipboard synced',
                message: `Text from ${message.data.fromDevice}`,
                content: message.data.content,
                timestamp: new Date(),
              }]);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ ...prev, error: 'Connection error' }));
      };

      ws.current.onclose = () => {
        setState(prev => ({ ...prev, isConnected: false }));
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (ws.current?.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 3000);
      };
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setState(prev => ({ ...prev, error: 'Failed to connect' }));
    }
  }, [deviceName]);

  const sendFile = useCallback((fileData: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    content?: string;
    isClipboard?: boolean;
  }) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'file-transfer',
        data: { ...fileData, fromDevice: deviceName }
      }));
    }
  }, [deviceName]);

  const dismissNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return {
    ...state,
    files,
    notifications,
    sendFile,
    dismissNotification,
    reconnect: connect,
  };
}
