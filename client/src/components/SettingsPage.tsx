import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Monitor, KeyRound, Wifi, Pencil, Check, Pin, Ghost, Sparkles, ScrollText, Trash2, ChevronDown, Bug, Download, Shield, SearchCheck, CheckCircle2, XCircle } from 'lucide-react';
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
  const [smartNaming, setSmartNaming] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [imageModel, setImageModel] = useState<string>('llava');
  const [smartNamingOpen, setSmartNamingOpen] = useState(false);
  const [connectionModeOpen, setConnectionModeOpen] = useState(true);
  const [windowOpen, setWindowOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isFixingFirewall, setIsFixingFirewall] = useState(false);
  const [isCheckingFirewall, setIsCheckingFirewall] = useState(false);
  const [firewallCheckResult, setFirewallCheckResult] = useState<{ success: boolean; results: Array<{ ip: string; reachable: boolean; error?: string }>; message: string } | null>(null);
  const [platform, setPlatform] = useState('');
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);

  const isElectronProd = window.electronAPI?.isElectron && !window.electronAPI?.isDev;

  useEffect(() => {
    if (isElectronProd) {
      window.electronAPI!.getPlatform().then(setPlatform).catch(() => {});
      window.electronAPI!.getLicenseStatus().then(setLicenseStatus).catch(() => {});
      window.electronAPI!.getPortSetting().then((port) => setPortSetting(String(port))).catch(() => {});
      window.electronAPI!.getConnectionMode().then((mode) => setConnectionMode(mode as 'server' | 'client')).catch(() => {});
      window.electronAPI!.getRemoteServerUrl().then(setRemoteServerUrl).catch(() => {});
      window.electronAPI!.getLanAddresses().then(setLanAddresses).catch(() => {});
      window.electronAPI!.getAlwaysOnTop().then(setAlwaysOnTop).catch(() => {});
      window.electronAPI!.getSmartNaming().then(setSmartNaming).catch(() => {});
      window.electronAPI!.checkOllamaStatus().then(setOllamaStatus).catch(() => {});
      window.electronAPI!.getImageModel?.().then((m) => { if (m) setImageModel(m); }).catch(() => {});
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
    <div className="max-w-4xl mx-auto p-6 space-y-6 overflow-y-auto h-full">
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

      {/* Connection Mode — Collapsible, starts open */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setConnectionModeOpen(!connectionModeOpen)}
          className="flex items-center gap-2 px-4 py-3 w-full bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${connectionModeOpen ? 'rotate-180' : ''}`} />
          <Wifi className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Connection Mode</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {connectionMode === 'server' ? 'Server' : 'Client'}
          </Badge>
        </button>

        {connectionModeOpen && <div className="border-t divide-y">
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
        </div>}
      </div>

      {/* AI / Smart Naming — Collapsible */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
          <button
            onClick={() => setSmartNamingOpen(!smartNamingOpen)}
            className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
          >
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${smartNamingOpen ? 'rotate-180' : ''}`} />
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">AI / Smart Naming</span>
            {ollamaStatus && (
              <Badge className={`ml-auto mr-2 text-xs ${ollamaStatus.running ? 'bg-green-600' : 'bg-red-600'}`}>
                {ollamaStatus.running ? 'Ollama Connected' : 'Ollama Not Running'}
              </Badge>
            )}
          </button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-shrink-0"
            onClick={() => setShowSetupModal(true)}
          >
            {smartNaming ? 'Re-run Setup' : 'Run Setup'}
          </Button>
        </div>

        {smartNamingOpen && (
          <>
            <div className="border-t flex items-center justify-between gap-3 px-4 py-3">
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
              <div className="border-t px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Vision Model</div>
                  <button
                    onClick={() => setShowModelInfo(!showModelInfo)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
                  >
                    {showModelInfo ? 'Hide Info' : 'More Info'}
                  </button>
                </div>

                {showModelInfo && (
                  <div className="rounded-lg bg-muted/40 border border-muted px-3 py-2.5 space-y-1.5">
                    <div className="text-xs text-foreground font-medium">How memory works</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Models are only loaded into RAM briefly when a file needs naming, then automatically release memory after a few minutes of inactivity. They are <span className="font-medium text-foreground">not</span> a background service consuming memory constantly.
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">LLaVA</span> needs ~4.7 GB free during inference. Works well on most machines with 8 GB+ RAM.
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Moondream</span> uses ~1.7 GB during inference. A good choice if you frequently run memory-intensive apps alongside Liquid Relay.
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {[
                    { value: 'llava' as const, label: 'LLaVA', desc: 'Better accuracy' },
                    { value: 'moondream' as const, label: 'Moondream', desc: 'Lightweight' },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={async () => {
                        setImageModel(value);
                        try {
                          await window.electronAPI?.setImageModel?.(value);
                          toast({ title: `Vision model set to ${label}` });
                        } catch {
                          toast({ title: 'Failed to update model', variant: 'destructive' });
                        }
                      }}
                      className={`flex-1 rounded-lg border-2 p-2 text-left transition-colors ${
                        imageModel === value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">{label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground leading-relaxed">
                  Requires Ollama. Models are only loaded briefly during file naming and release memory automatically.
                </div>

                <div className="text-xs font-medium text-muted-foreground mt-3">Model Status</div>
                {[
                  { name: imageModel, label: `${imageModel === 'llava' ? 'LLaVA' : 'Moondream'} (Vision)` },
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

          </>
        )}
      </div>

      <SmartNamingSetupModal open={showSetupModal} onOpenChange={(open) => {
        setShowSetupModal(open);
        if (!open) {
          // Refresh state when modal closes
          window.electronAPI?.getSmartNaming().then(setSmartNaming).catch(() => {});
          window.electronAPI?.checkOllamaStatus().then(setOllamaStatus).catch(() => {});
          window.electronAPI?.getImageModel?.().then((m) => { if (m) setImageModel(m); }).catch(() => {});
        }
      }} />

      {/* Window — Collapsible */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setWindowOpen(!windowOpen)}
          className="flex items-center gap-2 px-4 py-3 w-full bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${windowOpen ? 'rotate-180' : ''}`} />
          <Pin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Window</span>
        </button>

        {windowOpen && (
          <>
            <div className="border-t flex items-center justify-between gap-3 px-4 py-3">
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
              <div className="flex items-start gap-3 px-4 py-3">
                <Ghost className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">Ghost Mode</div>
                  <div className="text-xs text-muted-foreground">Click on the 'Ghost' in the main interface to make the window translucent, so you can see through to apps behind it.</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Diagnostics — Collapsible */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
          className="flex items-center gap-2 px-4 py-3 w-full bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${diagnosticsOpen ? 'rotate-180' : ''}`} />
          <Bug className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Diagnostics</span>
        </button>

        {diagnosticsOpen && (
          <div className="border-t px-4 py-3 space-y-3">
            {/* Connection Logs */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Connection Logs</div>
              <div className="text-xs text-muted-foreground">
                Device info, discovery state, connections, and recent activity.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  disabled={isExporting}
                  onClick={async () => {
                    setIsExporting(true);
                    try {
                      const result = await window.electronAPI?.exportDiagnostics?.();
                      if (result?.success) {
                        toast({ title: 'Diagnostics exported', description: result.filePath });
                      } else if (result?.reason !== 'cancelled') {
                        toast({ title: 'Export failed', description: result?.reason || 'Unknown error', variant: 'destructive' });
                      }
                    } catch {
                      toast({ title: 'Export failed', variant: 'destructive' });
                    } finally {
                      setIsExporting(false);
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  {isExporting ? 'Exporting...' : 'Export Diagnostics'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={async () => {
                    try {
                      await window.electronAPI?.openLogFile?.();
                    } catch {
                      toast({ title: 'Failed to open log file', variant: 'destructive' });
                    }
                  }}
                >
                  <ScrollText className="h-3.5 w-3.5" />
                  Open Log File
                </Button>
              </div>
            </div>

            {/* AI Naming Logs */}
            <div className="border-t pt-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">AI Naming Logs</div>
              <div className="text-xs text-muted-foreground">
                Prompts sent to Ollama and the filenames it suggested.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={async () => {
                    try {
                      await window.electronAPI?.openPromptLog();
                    } catch {
                      toast({ title: 'Failed to open prompt log', variant: 'destructive' });
                    }
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Open AI Log
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={async () => {
                    try {
                      await window.electronAPI?.clearPromptLog();
                      toast({ title: 'AI naming log cleared' });
                    } catch {
                      toast({ title: 'Failed to clear log', variant: 'destructive' });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear AI Log
                </Button>
              </div>
            </div>

            {/* Windows Firewall — only visible on Windows */}
            {platform === 'win32' && (
              <div className="border-t pt-3 mt-1">
                <div className="text-xs text-muted-foreground mb-2">
                  If other devices can't connect to this machine, Windows Firewall may be blocking inbound connections.
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    disabled={isCheckingFirewall}
                    onClick={async () => {
                      setIsCheckingFirewall(true);
                      setFirewallCheckResult(null);
                      try {
                        const result = await window.electronAPI?.checkFirewall?.();
                        if (result) setFirewallCheckResult(result);
                      } catch {
                        toast({ title: 'Firewall check failed', variant: 'destructive' });
                      } finally {
                        setIsCheckingFirewall(false);
                      }
                    }}
                  >
                    <SearchCheck className="h-3.5 w-3.5" />
                    {isCheckingFirewall ? 'Checking...' : 'Check Firewall'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    disabled={isFixingFirewall}
                    onClick={async () => {
                      setIsFixingFirewall(true);
                      try {
                        const result = await window.electronAPI?.fixWindowsFirewall?.();
                        if (result?.success) {
                          toast({ title: 'Firewall rule added', description: 'Other devices should now be able to connect to this machine.' });
                        } else if (result?.reason) {
                          toast({ title: 'Firewall fix failed', description: result.reason, variant: 'destructive' });
                        }
                      } catch {
                        toast({ title: 'Firewall fix failed', variant: 'destructive' });
                      } finally {
                        setIsFixingFirewall(false);
                      }
                    }}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {isFixingFirewall ? 'Fixing...' : 'Fix Windows Firewall'}
                  </Button>
                </div>
                {firewallCheckResult && (
                  <div className={`mt-2 rounded-md px-3 py-2 text-xs ${firewallCheckResult.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'}`}>
                    <div className="flex items-center gap-1.5 font-medium mb-1">
                      {firewallCheckResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {firewallCheckResult.message}
                    </div>
                    {firewallCheckResult.results.length > 0 && (
                      <div className="flex flex-col gap-0.5 ml-5">
                        {firewallCheckResult.results.map((r) => (
                          <div key={r.ip} className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${r.reachable ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span>{r.ip}</span>
                            {r.error && <span className="text-muted-foreground">({r.error})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* License — Collapsible */}
      {licenseStatus && (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <button
            onClick={() => setLicenseOpen(!licenseOpen)}
            className="flex items-center gap-2 px-4 py-3 w-full bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${licenseOpen ? 'rotate-180' : ''}`} />
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">License</span>
            {licenseStatus.isActivated ? (
              <Badge className="ml-auto bg-green-600 text-xs">Active</Badge>
            ) : (
              <Badge variant="destructive" className="ml-auto text-xs">Inactive</Badge>
            )}
          </button>

          {licenseOpen && (
            <div className="border-t divide-y">
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
          )}
        </div>
      )}
      {/* Version */}
      <div className="text-center text-[11px] text-muted-foreground/50 pt-4 pb-2 select-none">
        Liquid <em>Relay</em> v{__APP_VERSION__}
      </div>
    </div>
  );
}
