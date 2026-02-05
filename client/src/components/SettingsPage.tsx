import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Monitor, KeyRound, Wifi, Pencil, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { LicenseStatus } from '@/types/electron';

interface SettingsPageProps {
  currentDevice: any;
  onDeviceNameUpdate?: (name: string) => void;
}

export function SettingsPage({ currentDevice, onDeviceNameUpdate }: SettingsPageProps) {
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [portSetting, setPortSetting] = useState('');
  const [isSavingPort, setIsSavingPort] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'server' | 'client'>('server');
  const [remoteServerUrl, setRemoteServerUrl] = useState('');
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [lanAddresses, setLanAddresses] = useState<string[]>([]);

  const isElectronProd = window.electronAPI?.isElectron && !window.electronAPI?.isDev;

  useEffect(() => {
    if (isElectronProd) {
      window.electronAPI!.getLicenseStatus().then(setLicenseStatus).catch(() => {});
      window.electronAPI!.getPortSetting().then((port) => setPortSetting(String(port))).catch(() => {});
      window.electronAPI!.getConnectionMode().then((mode) => setConnectionMode(mode as 'server' | 'client')).catch(() => {});
      window.electronAPI!.getRemoteServerUrl().then(setRemoteServerUrl).catch(() => {});
      window.electronAPI!.getLanAddresses().then(setLanAddresses).catch(() => {});
    } else {
      // DEV PREVIEW: mock data so all sections are visible
      setPortSetting('53000');
      setLanAddresses(['192.168.1.5']);
      setLicenseStatus({ isActivated: false, key: 'XXXX-XXXX-XXXX-XXXX', customerName: 'Test User' });
    }
  }, [isElectronProd]);

  const handleStartEdit = () => {
    setEditName(currentDevice?.name || '');
    setIsEditingName(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== currentDevice?.name) {
      onDeviceNameUpdate?.(trimmed);
    }
    setIsEditingName(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setIsEditingName(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Device preferences</p>
        </div>
      </div>

      {/* Device Settings */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card shadow-sm">
        <Monitor className="h-5 w-5 text-primary flex-shrink-0" />

        {isEditingName ? (
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

        {currentDevice?.isOnline !== false ? (
          <Badge className="flex-shrink-0 bg-green-600 text-xs">
            Online
          </Badge>
        ) : (
          <Badge variant="secondary" className="flex-shrink-0 text-xs">
            Offline
          </Badge>
        )}
      </div>

      {/* Connection Mode */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <Wifi className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Connection Mode</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {connectionMode === 'server' ? 'Server' : 'Client'}
          </Badge>
        </div>

        <div className="divide-y">
          <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20">
            <input
              type="radio"
              name="connectionMode"
              value="server"
              checked={connectionMode === 'server'}
              onChange={() => setConnectionMode('server')}
              className="accent-primary mt-1"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground">Server Mode (Recommended)</span>
              <span className="text-xs text-muted-foreground ml-2">Automatically finds nearby devices. Use this unless devices can't see each other.</span>

              {connectionMode === 'server' && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">Your address:</span>
                    {window.electronAPI?.isElectron ? (
                      lanAddresses.length > 0 ? (
                        lanAddresses.map((ip) => (
                          <code key={ip} className="text-xs font-semibold font-mono text-foreground">
                            http://{ip}:{portSetting || '53000'}
                          </code>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No network addresses detected</span>
                      )
                    ) : (
                      <code className="text-xs font-semibold font-mono text-foreground">
                        {window.location.origin}
                      </code>
                    )}
                    {(lanAddresses.length > 0 || !window.electronAPI?.isElectron) && (
                      <span className="text-xs text-muted-foreground">— share with other devices to connect in Client Mode</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex-shrink-0">Port:</span>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      value={portSetting}
                      onChange={(e) => setPortSetting(e.target.value)}
                      placeholder="53000"
                      className="w-28 h-7 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      disabled={isSavingPort || !portSetting.trim()}
                      onClick={async () => {
                        if (!isElectronProd) return;
                        const port = parseInt(portSetting, 10);
                        if (isNaN(port) || port < 1 || port > 65535) {
                          toast({
                            title: 'Invalid port',
                            description: 'Port must be between 1 and 65535.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setIsSavingPort(true);
                        try {
                          await window.electronAPI!.setPortSetting(port);
                          toast({
                            title: 'Port saved',
                            description: `SnapSend will use port ${port} after restart.`,
                          });
                        } catch {
                          toast({
                            title: 'Failed to save port',
                            description: 'Could not save port setting.',
                            variant: 'destructive',
                          });
                        } finally {
                          setIsSavingPort(false);
                        }
                      }}
                    >
                      {isSavingPort ? 'Saving...' : 'Save'}
                    </Button>
                    <span className="text-xs text-muted-foreground">Restart SnapSend to apply</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Change if the default port is already in use by another app
                  </div>
                </div>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20">
            <input
              type="radio"
              name="connectionMode"
              value="client"
              checked={connectionMode === 'client'}
              onChange={() => setConnectionMode('client')}
              className="accent-primary mt-1"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground">Client Mode</span>
              <span className="text-xs text-muted-foreground ml-2">Connect by entering the address of a device running in Server Mode. Use this if automatic discovery isn't working.</span>

              {connectionMode === 'client' && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex-shrink-0">Connect to:</span>
                    <Input
                      value={remoteServerUrl}
                      onChange={(e) => setRemoteServerUrl(e.target.value)}
                      placeholder="192.168.1.10:53000"
                      className="flex-1 h-7 text-sm"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Enter the IP address shown on the other device's Settings page
                  </div>
                </div>
              )}
            </div>
          </label>

          <div className="flex items-center gap-2 px-4 py-3">
            <Button
              size="sm"
              className="h-7 text-xs px-2.5"
              disabled={isSavingMode || (connectionMode === 'client' && !remoteServerUrl.trim())}
              onClick={async () => {
                if (!isElectronProd) return;
                setIsSavingMode(true);
                try {
                  await window.electronAPI!.setConnectionMode(connectionMode);
                  if (connectionMode === 'client') {
                    await window.electronAPI!.setRemoteServerUrl(remoteServerUrl.trim());
                  }
                  toast({
                    title: 'Connection mode saved',
                    description: 'Restart the app for changes to take effect.',
                  });
                } catch {
                  toast({
                    title: 'Failed to save',
                    description: 'Could not save connection mode.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsSavingMode(false);
                }
              }}
            >
              {isSavingMode ? 'Saving...' : 'Save'}
            </Button>
            <span className="text-xs text-muted-foreground">Restart SnapSend for changes to take effect</span>
          </div>
        </div>
      </div>

      {/* License */}
      {licenseStatus && (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">License</span>
            {licenseStatus.isActivated ? (
              <Badge className="ml-auto bg-green-600 text-xs">Active</Badge>
            ) : (
              <Badge variant="destructive" className="ml-auto text-xs">Inactive</Badge>
            )}
          </div>

          <div className="divide-y">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs text-muted-foreground flex-shrink-0">Key:</span>
              <code className="text-sm font-mono text-foreground truncate">
                {licenseStatus.key
                  ? licenseStatus.key.slice(0, 8) + '...' + licenseStatus.key.slice(-4)
                  : 'N/A'}
              </code>
            </div>

            {licenseStatus.customerName && (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs text-muted-foreground flex-shrink-0">Customer:</span>
                <span className="text-sm font-medium text-foreground">{licenseStatus.customerName}</span>
              </div>
            )}

            {licenseStatus.isActivated && (
              <div className="px-4 py-3">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  disabled={isDeactivating}
                  onClick={async () => {
                    if (!isElectronProd) return;
                    setIsDeactivating(true);
                    try {
                      await window.electronAPI!.deactivateLicense();
                      toast({
                        title: 'License deactivated',
                        description: 'This seat has been freed. The app will close.',
                      });
                      setTimeout(() => window.location.reload(), 1500);
                    } catch {
                      toast({
                        title: 'Deactivation failed',
                        description: 'Could not deactivate license. Try again.',
                        variant: 'destructive',
                      });
                    } finally {
                      setIsDeactivating(false);
                    }
                  }}
                >
                  {isDeactivating ? 'Deactivating...' : 'Deactivate License'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
