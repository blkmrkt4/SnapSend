import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Monitor, KeyRound, Wifi, Pencil, Check, Pin, Ghost, Sparkles, FileText, ScrollText, Trash2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { LicenseStatus, OllamaStatus } from '@/types/electron';
import { SmartNamingSetupModal } from './SmartNamingSetupModal';

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
  const [connectionMode, setConnectionMode] = useState<'server' | 'client'>('server');
  const [remoteServerUrl, setRemoteServerUrl] = useState('');
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [lanAddresses, setLanAddresses] = useState<string[]>([]);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [ghostOpacity, setGhostOpacity] = useState(0.25);
  const [smartNaming, setSmartNaming] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);

  const isElectronProd = window.electronAPI?.isElectron && !window.electronAPI?.isDev;

  useEffect(() => {
    if (isElectronProd) {
      window.electronAPI!.getLicenseStatus().then(setLicenseStatus).catch(() => {});
      window.electronAPI!.getPortSetting().then((port) => setPortSetting(String(port))).catch(() => {});
      window.electronAPI!.getConnectionMode().then((mode) => setConnectionMode(mode as 'server' | 'client')).catch(() => {});
      window.electronAPI!.getRemoteServerUrl().then(setRemoteServerUrl).catch(() => {});
      window.electronAPI!.getLanAddresses().then(setLanAddresses).catch(() => {});
      window.electronAPI!.getAlwaysOnTop().then(setAlwaysOnTop).catch(() => {});
      window.electronAPI!.getGhostMode().then(setGhostMode).catch(() => {});
      window.electronAPI!.getWindowOpacity().then(setGhostOpacity).catch(() => {});
      window.electronAPI!.getSmartNaming().then(setSmartNaming).catch(() => {});
      window.electronAPI!.checkOllamaStatus().then(setOllamaStatus).catch(() => {});
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

      {/* Window */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <Pin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Window</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">Always on Top</div>
            <div className="text-xs text-muted-foreground">Keep window above other applications for easy drag-and-drop</div>
          </div>
          <Switch
            checked={alwaysOnTop}
            onCheckedChange={async (checked) => {
              setAlwaysOnTop(checked);
              try {
                await window.electronAPI!.setAlwaysOnTop(checked);
                toast({
                  title: checked ? 'Window pinned' : 'Window unpinned',
                  description: checked
                    ? 'Window will stay above other apps.'
                    : 'Window returned to normal stacking.',
                });
              } catch {
                setAlwaysOnTop(!checked);
                toast({
                  title: 'Failed to update',
                  description: 'Could not change always-on-top setting.',
                  variant: 'destructive',
                });
              }
            }}
          />
        </div>

        <div className="border-t">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Ghost className="h-4 w-4" />
                Ghost Mode
              </div>
              <div className="text-xs text-muted-foreground">Make the window translucent so you can see through to apps behind it</div>
            </div>
            <Switch
              checked={ghostMode}
              onCheckedChange={async (checked) => {
                setGhostMode(checked);
                try {
                  await window.electronAPI!.setGhostMode(checked);
                  toast({
                    title: checked ? 'Ghost Mode enabled' : 'Ghost Mode disabled',
                    description: checked
                      ? 'Window is now translucent and floating.'
                      : 'Window restored to normal.',
                  });
                } catch {
                  setGhostMode(!checked);
                  toast({
                    title: 'Failed to update',
                    description: 'Could not change ghost mode setting.',
                    variant: 'destructive',
                  });
                }
              }}
            />
          </div>

          {ghostMode && (
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Ghost Opacity</span>
                <span className="text-xs font-mono font-semibold text-foreground">{Math.round(ghostOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.50"
                step="0.05"
                value={ghostOpacity}
                onChange={async (e) => {
                  const val = parseFloat(e.target.value);
                  setGhostOpacity(val);
                  try {
                    await window.electronAPI!.setWindowOpacity(val);
                  } catch {}
                }}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>10%</span>
                <span>50%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI / Smart Naming */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">AI / Smart Naming</span>
          {ollamaStatus && (
            <Badge className={`ml-auto text-xs ${ollamaStatus.running ? 'bg-green-600' : 'bg-red-600'}`}>
              {ollamaStatus.running ? 'Ollama Connected' : 'Ollama Not Running'}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">Smart Naming</div>
            <div className="text-xs text-muted-foreground">Use local AI to auto-suggest descriptive names for transferred files</div>
          </div>
          <Switch
            checked={smartNaming}
            onCheckedChange={async (checked) => {
              setSmartNaming(checked);
              try {
                await window.electronAPI!.setSmartNaming(checked);
                toast({
                  title: checked ? 'Smart Naming enabled' : 'Smart Naming disabled',
                  description: checked
                    ? 'Files will be renamed with AI-suggested names.'
                    : 'Files will keep their original names.',
                });
              } catch {
                setSmartNaming(!checked);
                toast({
                  title: 'Failed to update',
                  description: 'Could not change Smart Naming setting.',
                  variant: 'destructive',
                });
              }
            }}
          />
        </div>

        {ollamaStatus?.running && (
          <div className="border-t px-4 py-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Models</div>
            {[
              { name: 'moondream', label: 'Moondream (Vision)' },
              { name: 'phi3:mini', label: 'Phi-3 Mini (Text)' },
            ].map(({ name, label }) => {
              const available = ollamaStatus.models.some(
                (m) => m === name || m.startsWith(`${name}:`)
              );
              return (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{label}</span>
                  <Badge className={`text-xs ${available ? 'bg-green-600' : ''}`} variant={available ? 'default' : 'secondary'}>
                    {available ? 'Available' : 'Not Pulled'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Prompt Config & Debug */}
        <div className="border-t px-4 py-3 space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Prompt Configuration</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={async () => {
                try {
                  await window.electronAPI?.openPromptConfig();
                } catch {
                  toast({ title: 'Failed to open config', variant: 'destructive' });
                }
              }}
            >
              <FileText className="h-3.5 w-3.5" />
              Open Prompt Config
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={async () => {
                try {
                  await window.electronAPI?.openPromptLog();
                } catch {
                  toast({ title: 'Failed to open log', variant: 'destructive' });
                }
              }}
            >
              <ScrollText className="h-3.5 w-3.5" />
              Open Prompt Log
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={async () => {
                try {
                  await window.electronAPI?.clearPromptLog();
                  toast({ title: 'Prompt log cleared' });
                } catch {
                  toast({ title: 'Failed to clear log', variant: 'destructive' });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Log
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={async () => {
                try {
                  await window.electronAPI?.resetPromptConfig();
                  toast({ title: 'Prompt config reset to defaults' });
                } catch {
                  toast({ title: 'Failed to reset config', variant: 'destructive' });
                }
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </Button>
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            Edit the config JSON to customize prompts and models. Available template variables:{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{original_name}}'}</code>{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{file_extension}}'}</code>{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{file_stem}}'}</code>{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{mime_type}}'}</code>{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{file_size}}'}</code>{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{file_size_human}}'}</code>{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{is_clipboard}}'}</code>{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{from_device}}'}</code>{' '}
            <code className="text-[10px] bg-muted px-1 rounded">{'{{text_preview}}'}</code> (text files only).
            Changes take effect on the next file transfer.
          </div>
        </div>

        <div className="border-t px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setShowSetupModal(true)}
          >
            {smartNaming ? 'Re-run Setup' : 'Run Setup Wizard'}
          </Button>
        </div>
      </div>

      <SmartNamingSetupModal open={showSetupModal} onOpenChange={(open) => {
        setShowSetupModal(open);
        if (!open) {
          // Refresh state when modal closes
          window.electronAPI?.getSmartNaming().then(setSmartNaming).catch(() => {});
          window.electronAPI?.checkOllamaStatus().then(setOllamaStatus).catch(() => {});
        }
      }} />

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
                  {lanAddresses.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Share this address:</span>
                      {lanAddresses.map((ip) => (
                        <code key={ip} className="text-xs font-semibold font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                          http://{ip}:{portSetting || '53000'}
                        </code>
                      ))}
                      <span className="text-xs text-muted-foreground">— if another device needs to be in Client Mode to connect</span>
                    </div>
                  )}
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
                    <span className="text-xs text-muted-foreground">Change if the default port is already in use</span>
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
              disabled={isSavingMode || (connectionMode === 'client' && !remoteServerUrl.trim()) || (connectionMode === 'server' && !portSetting.trim())}
              onClick={async () => {
                if (!isElectronProd) return;

                // Validate port in server mode
                if (connectionMode === 'server') {
                  const port = parseInt(portSetting, 10);
                  if (isNaN(port) || port < 1 || port > 65535) {
                    toast({
                      title: 'Invalid port',
                      description: 'Port must be between 1 and 65535.',
                      variant: 'destructive',
                    });
                    return;
                  }
                }

                setIsSavingMode(true);
                try {
                  await window.electronAPI!.setConnectionMode(connectionMode);
                  if (connectionMode === 'server') {
                    await window.electronAPI!.setPortSetting(parseInt(portSetting, 10));
                  } else {
                    await window.electronAPI!.setRemoteServerUrl(remoteServerUrl.trim());
                  }
                  toast({
                    title: 'Settings saved',
                    description: 'Restart Liquid Relay for changes to take effect.',
                  });
                } catch {
                  toast({
                    title: 'Failed to save',
                    description: 'Could not save connection settings.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsSavingMode(false);
                }
              }}
            >
              {isSavingMode ? 'Saving...' : 'Save'}
            </Button>
            <span className="text-xs text-muted-foreground">Restart Liquid Relay for changes to take effect</span>
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
