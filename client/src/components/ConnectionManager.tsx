import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Monitor, X, Link, Pencil, Check, RefreshCw } from 'lucide-react';
import { type Device } from '@shared/schema';

interface ConnectionManagerProps {
  currentDevice: Device | null;
  onlineDevices: Device[];
  connections: any[];
  onPairWithDevice: (targetDeviceId: number | string) => void;
  onTerminateConnection: (connectionId: number | string) => void;
  onDeviceNameUpdate?: (name: string) => void;
  onRefreshDiscovery?: () => void;
}

export function ConnectionManager({
  currentDevice,
  onlineDevices,
  connections,
  onPairWithDevice,
  onTerminateConnection,
  onDeviceNameUpdate,
  onRefreshDiscovery,
}: ConnectionManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  // Filter out current device from the online list and deduplicate by name
  // (in case the same device appears via mDNS discovery AND incoming connection)
  const otherDevicesRaw = onlineDevices.filter(d => {
    if (currentDevice?.socketId && d.socketId) {
      return d.socketId !== currentDevice.socketId;
    }
    return d.id !== currentDevice?.id;
  });

  // Deduplicate: prefer entries that are already connected
  const seenNames = new Map<string, Device>();
  for (const device of otherDevicesRaw) {
    const name = device.name;
    const existingDevice = seenNames.get(name);
    if (!existingDevice) {
      seenNames.set(name, device);
    } else {
      // If the new one is connected and old one isn't, prefer new one
      const existingIsPaired = connections.some(c => c.peerId === existingDevice.socketId);
      const newIsPaired = connections.some(c => c.peerId === device.socketId);
      if (newIsPaired && !existingIsPaired) {
        seenNames.set(name, device);
      }
    }
  }
  const otherDevices = Array.from(seenNames.values());

  // Check if a device is already paired
  const isPaired = (device: Device) => {
    return connections.some(c => {
      if (c.peerId && device.socketId) {
        return c.peerId === device.socketId;
      }
      return (c.deviceAId === device.id || c.deviceBId === device.id) &&
             (c.deviceAId === currentDevice?.id || c.deviceBId === currentDevice?.id);
    });
  };

  // Get the connection ID for a paired device (to disconnect)
  const getConnectionId = (device: Device): number | string | null => {
    const conn = connections.find(c => {
      if (c.peerId && device.socketId) {
        return c.peerId === device.socketId;
      }
      return (c.deviceAId === device.id || c.deviceBId === device.id) &&
             (c.deviceAId === currentDevice?.id || c.deviceBId === currentDevice?.id);
    });
    return conn?.id ?? null;
  };

  const getPairId = (device: Device): number | string => {
    if (device.socketId && device.id === 0) {
      return device.socketId;
    }
    return device.id;
  };

  const handleStartEdit = () => {
    setEditName(currentDevice?.name || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== currentDevice?.name) {
      onDeviceNameUpdate?.(trimmed);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* This Device — compact single row */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card shadow-sm">
        <Monitor className="h-5 w-5 text-primary flex-shrink-0" />

        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={handleEditKeyDown}
              autoFocus
              className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-b-2 border-primary outline-none py-0.5"
            />
            <button
              onClick={handleSaveEdit}
              className="text-primary hover:text-primary/80 p-0.5"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-muted-foreground flex-shrink-0">Your Device:</span>
            <span className="text-sm font-semibold text-foreground truncate">
              {currentDevice?.name || 'Not Set'}
            </span>
            {onDeviceNameUpdate && (
              <button
                onClick={handleStartEdit}
                className="text-muted-foreground hover:text-foreground p-0.5 flex-shrink-0"
                title="Rename device"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {connections.length > 0 ? (
          <Badge className="flex-shrink-0 bg-green-600 text-xs">
            Online · {connections.length}
          </Badge>
        ) : (
          <Badge variant="secondary" className="flex-shrink-0 text-xs">
            Offline
          </Badge>
        )}
      </div>

      {/* Devices on Network — combined list with pair/disconnect actions */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Devices on Network
          </span>
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {otherDevices.length}
          </Badge>
          {onRefreshDiscovery && (
            <button
              onClick={onRefreshDiscovery}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Refresh device discovery"
            >
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="divide-y">
          {otherDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No other devices online. Open Liquid Relay on another machine to get started.
            </p>
          ) : (
            otherDevices.map((device) => {
              const paired = isPaired(device);
              const connId = paired ? getConnectionId(device) : null;

              return (
                <div
                  key={device.socketId || device.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    paired ? 'bg-green-500' : 'bg-green-400 animate-pulse'
                  }`} />
                  <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                    {device.name}
                  </span>

                  {paired ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="default" className="bg-green-600 text-xs">
                        Paired
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => connId != null && onTerminateConnection(connId)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Disconnect"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPairWithDevice(getPairId(device))}
                      className="h-7 text-xs px-2.5"
                    >
                      <Link className="h-3.5 w-3.5 mr-1" />
                      Pair
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
