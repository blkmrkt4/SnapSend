import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Wifi, WifiOff, Key, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type Device, type Connection } from '@shared/schema';

interface ConnectionManagerProps {
  currentDevice: Device | null;
  connections: Connection[];
  onSearchUsers: (query: string) => void;
  onRequestConnection: (targetNickname: string) => void;
  onRespondToConnection: (connectionId: number, approved: boolean, enteredKey?: string) => void;
  onTerminateConnection: (connectionId: number) => void;
  onSubmitVerificationKey: (connectionId: number, verificationKey: string) => void;
  searchResults: Device[];
  pendingRequests: any[];
  outgoingRequests: any[];
  isSearching: boolean;
  notifications?: any[];
  onDismissNotification?: (id: number) => void;
  onOpenFile?: (notification: any) => void;
  onSaveFile?: (notification: any) => void;
}

export function ConnectionManager({
  currentDevice,
  connections,
  onSearchUsers,
  onRequestConnection,
  onRespondToConnection,
  onTerminateConnection,
  onSubmitVerificationKey,
  searchResults,
  pendingRequests,
  outgoingRequests,
  isSearching,
  notifications = [],
  onDismissNotification,
  onOpenFile,
  onSaveFile,
}: ConnectionManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [enteredKey, setEnteredKey] = useState('');
  const [verificationKey, setVerificationKey] = useState('');

  useEffect(() => {
    console.log('Outgoing requests updated:', outgoingRequests);
  }, [outgoingRequests]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchUsers(searchQuery.trim());
    }
  };

  const handleConnectionRequest = (targetNickname: string) => {
    console.log('Requesting connection to:', targetNickname);
    onRequestConnection(targetNickname);
    setSearchQuery('');
  };

  const handleRespondToRequest = (approved: boolean) => {
    if (selectedRequest) {
      onRespondToConnection(selectedRequest.connectionId, approved, enteredKey);
      setShowConnectionDialog(false);
      setSelectedRequest(null);
      setEnteredKey('');
    }
  };

  const openConnectionDialog = (request: any) => {
    setSelectedRequest(request);
    setShowConnectionDialog(true);
    setEnteredKey('');
  };



  return (
    <div className="space-y-4">
      {/* Compact Header with Device Status */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-primary/20">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground">Connections</h2>
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">{currentDevice?.nickname}</span>
            <Badge className="bg-primary text-primary-foreground shadow-sm">
              Online
            </Badge>
            {connections.length > 0 && (
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground shadow-sm">
                {connections.length} Connected
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Connect to New Device - moved to top */}
      <Card className="w-full border-primary/20 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground font-semibold">
            <Search className="h-5 w-5 text-primary" />
            Connect to New Device
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter user's nickname..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
                className="flex-1 border-primary/30 focus:border-primary"
              />
              <Button 
                type="submit" 
                disabled={!searchQuery.trim() || isSearching}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              >
                {isSearching ? 'Searching...' : 'Find'}
              </Button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border border-primary/30 rounded-lg bg-gradient-to-r from-primary/5 to-accent/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shadow-sm ${user.isOnline ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                    <span className="font-semibold text-foreground">{user.nickname}</span>
                  </div>
                  <Button
                    disabled={!user.isOnline}
                    onClick={() => handleConnectionRequest(user.nickname)}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                  >
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Connections */}
      {connections.length > 0 && (
        <Card className="w-full border-primary/20 shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-secondary/5 to-primary/5">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground font-semibold">
              <Users className="h-5 w-5 text-secondary" />
              Active Connections ({connections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-sm"></div>
                  <span className="font-semibold text-foreground">
                    {(connection as any).partnerNickname || 'Partner'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTerminateConnection(connection.id)}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 shadow-sm"
                >
                  Disconnect
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending Connection Requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-secondary/30 bg-gradient-to-r from-secondary/5 to-accent/5 w-full shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-secondary/10 to-accent/10">
            <CardTitle className="flex items-center gap-2 text-foreground text-lg font-semibold">
              <Key className="h-5 w-5 text-secondary" />
              Incoming Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.connectionId} className="p-3 border border-secondary/30 rounded-lg bg-white shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-foreground">
                    {request.requesterNickname} wants to connect
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRespondToConnection(request.connectionId, false)}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 shadow-sm"
                  >
                    Reject
                  </Button>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-accent/20 to-primary/10 rounded-lg border border-primary/20">
                  <Key className="h-5 w-5 text-secondary" />
                  <span className="text-sm font-medium text-foreground">Share this code:</span>
                  <span className="text-xl font-bold text-foreground bg-white px-3 py-1 rounded-lg shadow-sm border border-primary/30">
                    {request.connectionKey}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Outgoing Connection Requests */}
      {outgoingRequests.length > 0 && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5 w-full shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-secondary/10">
            <CardTitle className="flex items-center gap-2 text-foreground text-lg font-semibold">
              <Key className="h-5 w-5 text-primary" />
              Your Requests ({outgoingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {outgoingRequests.map((request) => (
              <div key={request.connectionId} className="p-3 border border-primary/30 rounded-lg bg-white shadow-sm">
                <div className="space-y-3">
                  <p className="font-semibold text-foreground">Request sent - Enter verification key</p>
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      placeholder="XX"
                      value={verificationKey}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setVerificationKey(value);
                      }}
                      maxLength={2}
                      className="w-20 text-center font-mono text-lg border-primary/30 focus:border-primary"
                    />
                    <Button
                      onClick={() => {
                        if (verificationKey && verificationKey.length === 2) {
                          onSubmitVerificationKey(request.connectionId, verificationKey);
                          setVerificationKey('');
                        }
                      }}
                      disabled={!verificationKey || verificationKey.length !== 2}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                    >
                      Connect
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notifications Section */}
      {notifications && notifications.length > 0 && (
        <Card className="border-accent/30 bg-gradient-to-r from-accent/10 to-primary/5 w-full shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-accent/20 to-primary/10">
            <CardTitle className="flex items-center gap-2 text-foreground text-lg font-semibold">
              <Users className="h-5 w-5 text-secondary" />
              Recent Activity ({notifications.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-3 border border-accent/30 rounded-lg bg-white shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {notification.file && onOpenFile && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenFile(notification)}
                        className="border-primary/30 text-primary hover:bg-primary/10 shadow-sm"
                      >
                        View
                      </Button>
                    )}
                    {notification.file && onSaveFile && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSaveFile(notification)}
                        className="border-secondary/30 text-secondary hover:bg-secondary/10 shadow-sm"
                      >
                        Save
                      </Button>
                    )}
                    {onDismissNotification && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDismissNotification(notification.id)}
                        className="text-muted-foreground hover:bg-muted/50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}