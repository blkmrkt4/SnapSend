import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface DeviceSetupProps {
  onSetupComplete: (name: string) => void;
  isConnecting: boolean;
}

export function DeviceSetup({ onSetupComplete, isConnecting }: DeviceSetupProps) {
  const [name, setName] = useState('');

  // Auto-submit if name is in localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('snapsend-device-name');
    if (savedName) {
      onSetupComplete(savedName);
    }
  }, [onSetupComplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      localStorage.setItem('snapsend-device-name', name.trim());
      onSetupComplete(name.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/20">
      <Card className="w-full max-w-md border-primary/30 shadow-2xl">
        <CardHeader className="text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-t-lg">
          <CardTitle className="text-3xl font-bold text-foreground">Liquid <em>Relay</em></CardTitle>
          <CardDescription className="text-muted-foreground text-lg">
            Name this device to start sharing files
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-foreground font-semibold">Device Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., Robin's MacBook"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isConnecting}
                maxLength={50}
                required
                autoFocus
                className="border-primary/30 focus:border-primary text-lg p-3"
              />
              <p className="text-sm text-muted-foreground">
                Other devices on the network will see this name
              </p>
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-3 shadow-lg"
              disabled={!name.trim() || isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Start Sharing'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
