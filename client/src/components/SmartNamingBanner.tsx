import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';

interface SmartNamingBannerProps {
  onSetup: () => void;
}

const DISMISSED_KEY = 'smart-naming-banner-dismissed';

export function SmartNamingBanner({ onSetup }: SmartNamingBannerProps) {
  const [dismissed, setDismissed] = useState(true);
  const [smartNamingEnabled, setSmartNamingEnabled] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY) === 'true') {
      setDismissed(true);
      return;
    }

    // Don't show if smart naming is already enabled
    if (window.electronAPI?.isElectron) {
      window.electronAPI.getSmartNaming().then((enabled) => {
        setSmartNamingEnabled(enabled);
        if (!enabled) setDismissed(false);
      }).catch(() => setDismissed(false));
    }
  }, []);

  if (dismissed || smartNamingEnabled) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mb-3 rounded-lg border border-primary/20 bg-primary/5">
      <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="text-sm text-foreground flex-1">
        <strong>Smart Naming</strong> can use local AI to auto-describe your files.
      </span>
      <Button size="sm" variant="default" className="h-7 text-xs px-3" onClick={onSetup}>
        Set Up
      </Button>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground p-0.5"
        title="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
