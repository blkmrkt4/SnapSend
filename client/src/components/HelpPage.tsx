import { useState } from 'react';
import {
  ChevronDown,
  ArrowDown,
  Clipboard,
  Camera,
  Ghost,
  Wifi,
  FileText,
  Sparkles,
  Tags,
  Settings,
  Bug,
  Monitor,
  Maximize,
  Crop,
} from 'lucide-react';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export function HelpPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['drop-zone']));

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sections: HelpSection[] = [
    {
      id: 'drop-zone',
      title: 'Drop Zone',
      icon: ArrowDown,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Drag and drop files onto the sidebar drop zone, or click <strong>Browse</strong> to select files.</p>
          <p>Files are sent to whichever device is selected in the target picker. If <strong>"This Device"</strong> is selected, files are saved locally instead of being transferred.</p>
          <p>You can also drop multiple files at once — each will be sent as a separate transfer.</p>
        </div>
      ),
    },
    {
      id: 'clipboard',
      title: 'Clipboard',
      icon: Clipboard,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Click the <Clipboard className="inline h-3.5 w-3.5 mx-0.5" /> clipboard button or press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Cmd/Ctrl+V</kbd> in the app window.</p>
          <p>Captures whatever is on your clipboard — text snippets, copied images, or URLs — packages it as a file, and sends it to the selected target device.</p>
        </div>
      ),
    },
    {
      id: 'screenshot',
      title: 'Screenshot',
      icon: Camera,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Three capture modes available from the screenshot button:</p>
          <ul className="space-y-1.5 ml-1">
            <li className="flex items-start gap-2">
              <Monitor className="h-4 w-4 mt-0.5 shrink-0" />
              <span><strong>Window</strong> — Select a specific window to capture.</span>
            </li>
            <li className="flex items-start gap-2">
              <Maximize className="h-4 w-4 mt-0.5 shrink-0" />
              <span><strong>Full Screen</strong> — Captures your entire screen.</span>
            </li>
            <li className="flex items-start gap-2">
              <Crop className="h-4 w-4 mt-0.5 shrink-0" />
              <span><strong>Select Area</strong> — Draw a rectangle to capture a region.</span>
            </li>
          </ul>
          <p>Screenshots are automatically sent to the selected target device.</p>
        </div>
      ),
    },
    {
      id: 'ghost-mode',
      title: 'Ghost Mode',
      icon: Ghost,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Toggle ghost mode from the <Ghost className="inline h-3.5 w-3.5 mx-0.5" /> icon in the header.</p>
          <p>The window becomes translucent, shrinks to just the sidebar, and pins itself on top of other windows. Hover over the window to temporarily reveal it.</p>
          <p>Useful for keeping Liquid Relay accessible while working in other apps — drop files onto it without switching windows.</p>
        </div>
      ),
    },
    {
      id: 'discovery',
      title: 'Devices & Discovery',
      icon: Wifi,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Devices on the same LAN are discovered automatically via mDNS — no configuration needed.</p>
          <p>In the device list: a <span className="inline-block h-2 w-2 rounded-full bg-green-500 mx-0.5" /> green dot means connected, <span className="inline-block h-2 w-2 rounded-full bg-red-500 mx-0.5" /> red means offline.</p>
          <p>Select a single device to send to it directly, or choose <strong>"All Devices"</strong> to broadcast to every connected peer.</p>
          <p>Toggle devices on or off to control which peers you connect to.</p>
        </div>
      ),
    },
    {
      id: 'files',
      title: 'Files',
      icon: FileText,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>The right panel shows all transferred and saved files with search, sort, and filter controls.</p>
          <p><strong>Double-click</strong> a file to open it in your default application.</p>
          <p><strong>Drag</strong> a file from the list back onto the drop zone to re-share it with another device.</p>
          <p>Right-click for options: rename, delete, add tags, or copy the file path.</p>
        </div>
      ),
    },
    {
      id: 'smart-naming',
      title: 'Smart Naming',
      icon: Sparkles,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>When enabled, Liquid Relay uses a local AI model (via Ollama) to automatically rename files based on their content.</p>
          <p>Images are analyzed with a vision model, text files are summarized, and the result is used as a descriptive filename.</p>
          <p>Set up Ollama and select a model in <strong>Settings → Smart Naming</strong>. All processing happens locally — nothing is sent to the cloud.</p>
        </div>
      ),
    },
    {
      id: 'tags',
      title: 'Tags',
      icon: Tags,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Color-coded tags help you organize files. Create tags from the Files panel tag menu or the file context menu.</p>
          <p>Assign multiple tags to any file. Filter by tag to quickly find related files.</p>
          <p>Tags can be renamed or deleted — deleting a tag removes it from all files.</p>
        </div>
      ),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: Settings,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Port</strong> — Configure which port the embedded server listens on (default: auto-assigned).</p>
          <p><strong>Connection Mode</strong> — Choose server mode (accept incoming connections) or client mode (connect to a specific server).</p>
          <p><strong>Always on Top</strong> — Pin the window above all other applications.</p>
          <p><strong>Device Name</strong> — Change how this machine appears to other peers on the network.</p>
        </div>
      ),
    },
    {
      id: 'diagnostics',
      title: 'Diagnostics',
      icon: Bug,
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Export Diagnostics</strong> — Save a JSON file with system info, connection state, and device details for troubleshooting.</p>
          <p><strong>View Logs</strong> — Open the application log file to inspect recent activity.</p>
          <p><strong>Check Firewall</strong> (Windows) — Probes your own server from each LAN interface to see if the firewall is blocking inbound connections.</p>
          <p><strong>Fix Windows Firewall</strong> (Windows) — Adds a firewall rule to allow Liquid Relay traffic on the current port.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 max-w-2xl">
      <h2 className="text-lg font-semibold">Help</h2>
      <p className="text-sm text-muted-foreground">
        A guide to every feature in Liquid Relay.
      </p>

      <div className="space-y-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);

          return (
            <div key={section.id} className="rounded-lg border bg-card shadow-sm">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-2 w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{section.title}</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {isExpanded && (
                <div className="px-4 pb-3">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
