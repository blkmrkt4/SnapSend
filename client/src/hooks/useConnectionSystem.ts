import { useState, useEffect, useCallback, useRef } from 'react';
import { type Device, type Connection, type File } from '@shared/schema';

export interface ConnectionSystemState {
  isSetup: boolean;
  isConnecting: boolean;
  currentDevice: Device | null;
  connections: any[];
  files: File[];
  notifications: any[];
  searchResults: Device[];
  pendingRequests: any[];
  outgoingRequests: any[];
  isSearching: boolean;
}

export function useConnectionSystem() {
  const [state, setState] = useState<ConnectionSystemState>({
    isSetup: false,
    isConnecting: false,
    currentDevice: null,
    connections: [],
    files: [],
    notifications: [],
    searchResults: [],
    pendingRequests: [],
    outgoingRequests: [],
    isSearching: false
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message.type, message.data);

        switch (message.type) {
          case 'setup-required':
            setState(prev => ({ ...prev, isSetup: false, isConnecting: false }));
            break;

          case 'setup-complete':
            setState(prev => ({ 
              ...prev, 
              isSetup: true, 
              isConnecting: false, 
              currentDevice: message.data.device 
            }));
            break;

          case 'scan-results':
            setState(prev => ({ 
              ...prev, 
              searchResults: message.data.users,
              isSearching: false 
            }));
            break;

          case 'connection-request':
            setState(prev => ({ 
              ...prev, 
              pendingRequests: [...prev.pendingRequests, message.data]
            }));
            break;

          case 'connection-request-sent':
            console.log('Connection request sent, adding to outgoing requests:', message.data);
            setState(prev => ({ 
              ...prev, 
              outgoingRequests: [...prev.outgoingRequests, {
                connectionId: message.data.connectionId,
                status: 'waiting-for-key',
                timestamp: new Date()
              }],
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'connection-request-sent',
                title: 'Connection Request Sent',
                message: `Waiting for the other user to share their verification key with you`,
                connectionId: message.data.connectionId,
                timestamp: new Date()
              }]
            }));
            break;

          case 'connection-approved':
            console.log('Connection approved received:', message.data);
            // Create a proper connection object or fetch from API
            const newConnection = {
              id: message.data.connectionId,
              requesterDeviceId: 0, // Will be updated when we fetch full connection data
              targetDeviceId: 0,
              connectionKey: '',
              status: 'active',
              createdAt: new Date(),
              approvedAt: new Date(),
              terminatedAt: null
            };
            
            setState(prev => ({ 
              ...prev, 
              connections: [...prev.connections, newConnection],
              // Clear both pending and outgoing requests for this connection
              pendingRequests: prev.pendingRequests.filter(r => r.connectionId !== message.data.connectionId),
              outgoingRequests: prev.outgoingRequests.filter(r => r.connectionId !== message.data.connectionId),
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'connection-approved',
                title: 'Connection approved',
                message: `Connected to ${message.data.partnerNickname}`,
                timestamp: new Date()
              }]
            }));
            break;

          case 'connection-rejected':
            setState(prev => ({ 
              ...prev, 
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'connection-rejected',
                title: 'Connection rejected',
                message: 'Connection request was rejected',
                timestamp: new Date()
              }]
            }));
            break;

          case 'connection-terminated':
            setState(prev => ({ 
              ...prev, 
              connections: prev.connections.filter(c => c.id !== message.data.connectionId),
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'connection-terminated',
                title: 'Connection terminated',
                message: `Disconnected from partner`,
                timestamp: new Date()
              }]
            }));
            break;

          case 'file-received':
            setState(prev => ({ 
              ...prev, 
              files: [message.data.file, ...prev.files],
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'file',
                title: 'File received',
                message: `${message.data.file.originalName} from ${message.data.fromDevice}`,
                file: message.data.file,
                timestamp: new Date()
              }]
            }));
            break;

          case 'clipboard-sync':
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(message.data.content).catch(console.error);
            }
            
            setState(prev => ({ 
              ...prev, 
              files: message.data.file ? [message.data.file, ...prev.files] : prev.files,
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'clipboard',
                title: 'Clipboard synced',
                message: `Text from ${message.data.fromDevice}`,
                content: message.data.content,
                timestamp: new Date()
              }]
            }));
            break;

          case 'file-sent-confirmation':
            setState(prev => ({ 
              ...prev, 
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'file-sent',
                title: message.data.isClipboard ? 'Clipboard shared' : 'File sent',
                message: `${message.data.filename} sent to ${message.data.recipientCount} device${message.data.recipientCount > 1 ? 's' : ''}`,
                timestamp: new Date()
              }]
            }));
            break;

          case 'error':
            setState(prev => ({ 
              ...prev, 
              notifications: [...prev.notifications, {
                id: Date.now(),
                type: 'error',
                title: 'Error',
                message: message.data.message,
                timestamp: new Date()
              }]
            }));
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      wsRef.current = null;
      
      // Attempt to reconnect after 3 seconds
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const setupDevice = useCallback((nickname: string) => {
    setState(prev => ({ ...prev, isConnecting: true }));
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'device-setup',
        data: { nickname }
      }));
    }
  }, []);

  const searchUsers = useCallback((query: string) => {
    setState(prev => ({ ...prev, isSearching: true, searchResults: [] }));
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'scan-users',
        data: { query }
      }));
    }
  }, []);

  const requestConnection = useCallback((targetNickname: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'connection-request',
        data: { targetNickname }
      }));
    }
  }, []);

  const respondToConnection = useCallback((connectionId: number, approved: boolean, enteredKey?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'connection-response',
        data: { connectionId, approved, enteredKey }
      }));
    }
    
    // Remove from pending requests
    setState(prev => ({ 
      ...prev, 
      pendingRequests: prev.pendingRequests.filter(r => r.connectionId !== connectionId)
    }));
  }, []);

  const terminateConnection = useCallback((connectionId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'terminate-connection',
        data: { connectionId }
      }));
    }
  }, []);

  const sendFile = useCallback((fileData: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'file-transfer',
        data: fileData
      }));
    }
  }, []);

  const submitVerificationKey = useCallback((connectionId: number, verificationKey: string) => {
    console.log(`Submitting verification key: connectionId=${connectionId}, key="${verificationKey}"`);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'submit-verification-key',
        data: { connectionId, verificationKey }
      }));
      console.log('Verification key sent to server');
    } else {
      console.log('WebSocket not open, cannot send verification key');
    }
    
    // Remove from outgoing requests
    setState(prev => ({ 
      ...prev, 
      outgoingRequests: prev.outgoingRequests.filter(r => r.connectionId !== connectionId)
    }));
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setState(prev => ({ 
      ...prev, 
      notifications: prev.notifications.filter(n => n.id !== id)
    }));
  }, []);

  return {
    ...state,
    setupDevice,
    searchUsers,
    requestConnection,
    respondToConnection,
    terminateConnection,
    sendFile,
    submitVerificationKey,
    dismissNotification,
  };
}