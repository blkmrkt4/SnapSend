import {
  Wifi,
  WifiOff,
} from 'lucide-react';
import { HamburgerMenu } from './HamburgerMenu';

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
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center h-12 px-4 pl-20">
        {/* Left: Hamburger Menu + Status + Device Name */}
        <div className="flex items-center gap-2">
          <HamburgerMenu
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            connectionCount={connectionCount}
            fileCount={fileCount}
          />
          {connectionCount > 0 ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <span className="text-xs font-medium text-muted-foreground truncate max-w-[140px]">
            {connectionCount > 0 && <span className="text-green-500 mr-1">{connectionCount}</span>}
            {deviceName || 'Device'}
          </span>
        </div>
      </div>
    </header>
  );
}
