import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, KeyRound, ExternalLink } from 'lucide-react';

const CHECKOUT_URL = 'https://snapsend.lemonsqueezy.com/buy';

interface ActivationScreenProps {
  onActivated: () => void;
}

export function ActivationScreen({ onActivated }: ActivationScreenProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!key.trim()) {
      setError('Please enter a license key.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await window.electronAPI!.activateLicense(key.trim());
      if (result.success) {
        onActivated();
      } else {
        setError(result.error || 'Activation failed.');
      }
    } catch {
      setError('Failed to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Activate SnapSend</CardTitle>
          <CardDescription>
            Enter your license key to get started. Don't have one yet?{' '}
            <a
              href={CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Buy a license <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                className="pl-10"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleActivate}
              disabled={loading || !key.trim()}
              className="w-full"
            >
              {loading ? 'Activating...' : 'Activate License'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
