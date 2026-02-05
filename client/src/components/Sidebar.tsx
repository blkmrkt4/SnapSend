import { Badge } from '@/components/ui/badge';
import {
  ArrowLeftRight,
  FileText,
  Settings,
  Home,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface SidebarProps {
  activeSection: 'home' | 'connections' | 'files' | 'settings';
  onSectionChange: (section: 'home' | 'connections' | 'files' | 'settings') => void;
  connectionCount: number;
  fileCount: number;
  deviceName?: string;
}

export function Sidebar({
  activeSection,
  onSectionChange,
  connectionCount,
  fileCount,
  deviceName
}: SidebarProps) {
  const navItems = [
    {
      id: 'connections' as const,
      icon: ArrowLeftRight,
      label: 'Devices',
      badge: connectionCount,
    },
    {
      id: 'files' as const,
      icon: FileText,
      label: 'Files',
      badge: fileCount,
    },
    {
      id: 'settings' as const,
      icon: Settings,
      label: 'Settings',
      badge: 0,
    },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-12 px-4">
        {/* Left: Logo / Home link */}
        <button
          onClick={() => onSectionChange('home')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          title="SnapSend Home"
        >
          <Home className="h-5 w-5" />
          <span className="font-bold text-sm hidden sm:inline">SnapSend</span>
        </button>

        {/* Center: Nav icons */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
                {item.badge > 0 && (
                  <Badge
                    variant={isActive ? 'secondary' : 'default'}
                    className="h-5 min-w-[20px] px-1 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Device name + connection status */}
        <div className="flex items-center gap-2">
          {connectionCount > 0 ? (
            <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
              <Wifi className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium text-green-600">{connectionCount}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
              <WifiOff className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs font-medium text-red-500">0</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[120px]">
            {deviceName || 'Device'}
          </span>
        </div>
      </div>
    </header>
  );
}
