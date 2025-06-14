import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface DeviceSetupProps {
  onSetupComplete: (nickname: string) => void;
  isConnecting: boolean;
}

export function DeviceSetup({ onSetupComplete, isConnecting }: DeviceSetupProps) {
  const [nickname, setNickname] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      onSetupComplete(nickname.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/20">
      <Card className="w-full max-w-md border-primary/30 shadow-2xl">
        <CardHeader className="text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-t-lg">
          <CardTitle className="text-3xl font-bold text-foreground">Setup Your Device</CardTitle>
          <CardDescription className="text-muted-foreground text-lg">
            Choose a nickname to identify your device on the network
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="nickname" className="text-foreground font-semibold">Device Nickname</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="e.g., John's Laptop"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={isConnecting}
                maxLength={50}
                required
                className="border-primary/30 focus:border-primary text-lg p-3"
              />
              <p className="text-sm text-muted-foreground">
                This name will be visible to other users when you connect
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-3 shadow-lg" 
              disabled={!nickname.trim() || isConnecting}
            >
              {isConnecting ? 'Setting up...' : 'Start Sharing'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}