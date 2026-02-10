import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Home, ArrowLeftRight, FileText, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HamburgerMenuProps {
  activeSection: 'home' | 'connections' | 'files' | 'settings';
  onSectionChange: (section: 'home' | 'connections' | 'files' | 'settings') => void;
  connectionCount: number;
  fileCount: number;
}

export function HamburgerMenu({
  activeSection,
  onSectionChange,
  connectionCount,
  fileCount,
}: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    {
      id: 'home' as const,
      icon: Home,
      label: 'Home',
      badge: 0,
    },
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

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  const handleItemClick = (id: 'home' | 'connections' | 'files' | 'settings') => {
    onSectionChange(id);
    setIsOpen(false);
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5" />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Menu className="h-5 w-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute top-full right-0 mt-2 w-48 bg-background border rounded-xl shadow-lg overflow-hidden z-50"
          >
            <div className="py-1">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge > 0 && (
                      <Badge
                        variant={isActive ? 'secondary' : 'default'}
                        className="h-5 min-w-[20px] px-1.5 text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
