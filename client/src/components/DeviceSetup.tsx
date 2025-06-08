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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Setup Your Device</CardTitle>
          <CardDescription>
            Choose a nickname to identify your device on the network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Device Nickname</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="e.g., John's Laptop"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={isConnecting}
                maxLength={50}
                required
              />
              <p className="text-sm text-muted-foreground">
                This name will be visible to other users when you connect
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
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