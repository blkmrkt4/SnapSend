import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface ScreenshotPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMac: boolean;
}

export function ScreenshotPermissionDialog({ open, onOpenChange, isMac }: ScreenshotPermissionDialogProps) {
  const [resetting, setResetting] = useState(false);
  const [wasReset, setWasReset] = useState(false);

  const handleOpenSettings = async () => {
    await window.electronAPI?.screenshotOpenSettings?.();
  };

  const handleReset = async () => {
    setResetting(true);
    const result = await window.electronAPI?.screenshotResetPermission?.();
    setResetting(false);
    if (result?.success) {
      setWasReset(true);
    } else {
      toast({
        title: 'Reset failed',
        description: result?.error || 'Could not reset screen recording permission.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Screen Recording Permission Required</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {!wasReset ? (
                <>
                  <p>
                    Liquid Relay needs permission to capture your screen. macOS sometimes loses track of
                    this permission after updates — even if the toggle looks enabled in System Settings.
                  </p>
                  {isMac && (
                    <p className="text-muted-foreground">
                      If opening System Settings doesn't help, use <strong>Reset &amp; Re-grant</strong> to
                      clear the stale permission entry, then quit and relaunch Liquid Relay.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">Permission reset successfully.</p>
                  <p>
                    Please <strong>quit Liquid Relay completely</strong> (⌘Q) and relaunch it. The next time
                    you take a screenshot, macOS will show the permission prompt — click <strong>Allow</strong>.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          {isMac && !wasReset && (
            <Button variant="outline" onClick={handleReset} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset & Re-grant'}
            </Button>
          )}
          {!wasReset && (
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleOpenSettings(); }}>
              Open System Settings
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
