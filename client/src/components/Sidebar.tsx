import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, 
  Users, 
  FileText, 
  Settings, 
  LogOut, 
  User,
  X,
  Home,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

interface SidebarProps {
  activeSection: 'connections' | 'files' | 'settings';
  onSectionChange: (section: 'connections' | 'files' | 'settings') => void;
  connectionCount: number;
  fileCount: number;
}

export function Sidebar({ 
  activeSection, 
  onSectionChange, 
  connectionCount, 
  fileCount 
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logoutMutation } = useAuth();

  const menuItems = [
    {
      id: 'get-started' as const,
      label: 'Get Started',
      icon: Home,
      badge: null,
      description: 'Landing page and features',
      isExternal: true,
      href: '/'
    },
    {
      id: 'connections' as const,
      label: 'Connections',
      icon: Users,
      badge: connectionCount,
      description: 'Manage device connections'
    },
    {
      id: 'files' as const,
      label: 'File Transfer',
      icon: FileText,
      badge: fileCount,
      description: 'Share and manage files'
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: Settings,
      badge: null,
      description: 'Account and preferences'
    }
  ];

  const handleSectionChange = (section: 'connections' | 'files' | 'settings') => {
    onSectionChange(section);
    setIsOpen(false);
  };

  return (
    <>
      {/* Connection Status Indicator */}
      <div className="fixed top-4 left-16 z-50 flex items-center gap-2">
        {connectionCount > 0 ? (
          <div className="flex items-center gap-1 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1">
            <Wifi className="h-4 w-4 text-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {connectionCount}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded-full px-3 py-1 pl-[17px] pr-[17px] ml-[44px] mr-[44px]">
            <WifiOff className="h-4 w-4 text-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              0
            </span>
          </div>
        )}
      </div>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button 
            size="lg" 
            className="fixed top-4 left-4 z-50 bg-purple-900 hover:bg-purple-800 text-white border-2 border-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b bg-gradient-to-r from-primary/10 to-secondary/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">SnapSend</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-4">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                
                // Handle external links (like Get Started)
                if ('isExternal' in item && item.isExternal) {
                  return (
                    <Link key={item.id} href={item.href}>
                      <button
                        onClick={() => setIsOpen(false)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left hover:bg-muted"
                      >
                        <Icon className="h-5 w-5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    </Link>
                  );
                }
                
                // Handle internal navigation
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSectionChange(item.id as 'connections' | 'files' | 'settings')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.label}</span>
                        {item.badge !== null && item.badge > 0 && (
                          <Badge 
                            variant={isActive ? "secondary" : "default"}
                            className="ml-2"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-xs mt-1 ${
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}>
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </SheetContent>
      </Sheet>
    </>
  );
}