import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Users, Monitor, Pencil, Check, RefreshCw } from 'lucide-react';
import { type Device } from '@shared/schema';
import { type KnownDevice } from '@/hooks/useConnectionSystem';

interface ConnectionManagerProps {
  currentDevice: Device | null;
  onlineDevices: Device[];
  connections: any[];
  knownDevices: KnownDevice[];
  onPairWithDevice: (targetDeviceId: number | string) => void;
  onTerminateConnection: (connectionId: number | string) => void;
  onToggleDeviceEnabled: (deviceId: string, enabled: boolean) => void;
  onDeviceNameUpdate?: (name: string) => void;
  onRefreshDiscovery?: () => void;
}

export function ConnectionManager({
  currentDevice,
  onlineDevices,
  connections,
  knownDevices,
  onPairWithDevice,
  onTerminateConnection,
  onToggleDeviceEnabled,
  onDeviceNameUpdate,
  onRefreshDiscovery,
}: ConnectionManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  // Filter out current device from the online list and deduplicate by name
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
      const existingIsPaired = connections.some(c => c.peerId === existingDevice.socketId);
      const newIsPaired = connections.some(c => c.peerId === device.socketId);
      if (newIsPaired && !existingIsPaired) {
        seenNames.set(name, device);
      }
    }
  }
  const otherDevices = Array.from(seenNames.values());

  // Check if a device is connected (has active connection)
  const isConnected = (device: Device) => {
    return connections.some(c => {
      if (c.peerId && device.socketId) {
        return c.peerId === device.socketId;
      }
      return (c.deviceAId === device.id || c.deviceBId === device.id) &&
             (c.deviceAId === currentDevice?.id || c.deviceBId === currentDevice?.id);
    });
  };

  // Check if a device is enabled (from knownDevices)
  const isEnabled = (device: Device): boolean => {
    const deviceId = device.socketId || String(device.id);
    const known = knownDevices.find(k => k.id === deviceId || k.uuid === deviceId || k.name === device.name);
    return known?.enabled ?? true; // Default to enabled if not found
  };

  // Get the device ID for toggle (prefer socketId for P2P)
  const getDeviceId = (device: Device): string => {
    return device.socketId || String(device.id);
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

  // Count enabled and connected devices
  const enabledCount = otherDevices.filter(d => isEnabled(d)).length;
  const connectedCount = connections.length;

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

        {connectedCount > 0 ? (
          <Badge className="flex-shrink-0 bg-green-600 text-xs">
            Connected · {connectedCount}
          </Badge>
        ) : (
          <Badge variant="secondary" className="flex-shrink-0 text-xs">
            No Connections
          </Badge>
        )}
      </div>

      {/* Devices on Network — with enable/disable toggles */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Devices on Network
          </span>
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {enabledCount}/{otherDevices.length} enabled
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
              const enabled = isEnabled(device);
              const connected = isConnected(device);
              const deviceId = getDeviceId(device);

              return (
                <div
                  key={device.socketId || device.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* Connection status indicator */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    connected ? 'bg-green-500' : enabled ? 'bg-yellow-500' : 'bg-gray-400'
                  }`} />

                  {/* Device name */}
                  <span className={`text-sm font-medium flex-1 min-w-0 truncate ${
                    enabled ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {device.name}
                  </span>

                  {/* Status badge */}
                  {connected ? (
                    <Badge variant="default" className="bg-green-600 text-xs flex-shrink-0">
                      Connected
                    </Badge>
                  ) : enabled ? (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      Enabled
                    </Badge>
                  ) : null}

                  {/* Enable/Disable toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs ${enabled ? 'text-green-600' : 'text-red-500'}`}>
                      {enabled ? 'On' : 'Off'}
                    </span>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => onToggleDeviceEnabled(deviceId, checked)}
                      className={`${enabled ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
