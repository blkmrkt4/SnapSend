import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Lock, 
  CreditCard, 
  Settings, 
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SettingsPageProps {
  currentDevice: any;
  onDeviceNicknameUpdate?: (nickname: string) => void;
}

export function SettingsPage({ currentDevice, onDeviceNicknameUpdate }: SettingsPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Account settings state
  const [accountForm, setAccountForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    nickname: user?.nickname || '',
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Device settings state
  const [deviceNickname, setDeviceNickname] = useState(currentDevice?.nickname || '');

  // UI state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingDevice, setIsUpdatingDevice] = useState(false);

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingAccount(true);
    
    try {
      const response = await fetch('/api/user/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });

      if (response.ok) {
        toast({
          title: "Account updated",
          description: "Your account details have been saved successfully.",
        });
      } else {
        throw new Error('Failed to update account');
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Could not update account details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 4) {
      toast({
        title: "Password too short",
        description: "Password must be at least 4 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);
    
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (response.ok) {
        toast({
          title: "Password updated",
          description: "Your password has been changed successfully.",
        });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update password');
      }
    } catch (error) {
      toast({
        title: "Password update failed",
        description: error instanceof Error ? error.message : "Could not update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeviceUpdate = async () => {
    if (!deviceNickname.trim()) {
      toast({
        title: "Invalid nickname",
        description: "Device nickname cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingDevice(true);
    
    try {
      if (onDeviceNicknameUpdate) {
        onDeviceNicknameUpdate(deviceNickname);
        toast({
          title: "Device updated",
          description: "Your device nickname has been updated.",
        });
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Could not update device nickname. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingDevice(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Update your personal details and account preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccountUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">Display Nickname</Label>
                <Input
                  id="nickname"
                  value={accountForm.nickname}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, nickname: e.target.value }))}
                  placeholder="Your display name"
                />
              </div>
            </div>
            <Button type="submit" disabled={isUpdatingAccount}>
              <Save className="h-4 w-4 mr-2" />
              {isUpdatingAccount ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password for enhanced security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Enter your current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Enter new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <Button type="submit" disabled={isUpdatingPassword}>
              <Lock className="h-4 w-4 mr-2" />
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Device Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Current Device</CardTitle>
          <CardDescription>
            Manage settings for this device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Device Nickname</p>
                <p className="text-sm text-muted-foreground">
                  This name will be visible to other connected devices
                </p>
              </div>
              <Badge variant="secondary">
                {currentDevice?.isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Input
                value={deviceNickname}
                onChange={(e) => setDeviceNickname(e.target.value)}
                placeholder="Device nickname"
                className="flex-1"
              />
              <Button 
                onClick={handleDeviceUpdate}
                disabled={isUpdatingDevice || !deviceNickname.trim()}
              >
                {isUpdatingDevice ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>
            Manage your subscription and billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Current Plan</p>
                <p className="text-sm text-muted-foreground">Premium Access</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>Your account has premium access to all file sharing features.</p>
              <p className="mt-2">Subscription management will be available soon.</p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" disabled>
                Manage Subscription
              </Button>
              <Button variant="outline" disabled>
                Billing History
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}