import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Wifi, WifiOff, Key, Check, X, Trash2 } from 'lucide-react';
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
}: ConnectionManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [verificationKey, setVerificationKey] = useState('');

  useEffect(() => {
    if (pendingRequests.length > 0) {
      setSelectedRequest(pendingRequests[0]);
      setShowConnectionDialog(true);
    }
  }, [pendingRequests]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearchUsers(searchQuery);
    }
  };

  const handleApprove = () => {
    if (selectedRequest && verificationKey) {
      onRespondToConnection(selectedRequest.connectionId, true, verificationKey);
      setShowConnectionDialog(false);
      setVerificationKey('');
      setSelectedRequest(null);
    }
  };

  const handleReject = () => {
    if (selectedRequest) {
      onRespondToConnection(selectedRequest.connectionId, false);
      setShowConnectionDialog(false);
      setVerificationKey('');
      setSelectedRequest(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Device Status */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-secondary/5 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/20 to-secondary/10">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Device Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Device Name:</span>
            <span className="font-medium text-foreground">{currentDevice?.nickname || 'Not Set'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Active Connections:</span>
            <Badge variant={connections.length > 0 ? "default" : "secondary"}>
              {connections.length}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <div className="flex items-center gap-2">
              {connections.length > 0 ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">No Connections</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Users */}
      <Card className="border-accent/30 bg-gradient-to-r from-accent/10 to-primary/5 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-accent/20 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Search className="h-5 w-5 text-secondary" />
            Find Users
          </CardTitle>
          <CardDescription>
            Search for users to connect with by their device nickname
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter device nickname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !searchQuery.trim()}
              className="shadow-sm"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Search Results</Label>
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border border-accent/30 rounded-lg bg-white shadow-sm">
                  <span className="font-medium text-foreground">{user.nickname}</span>
                  <Button
                    size="sm"
                    onClick={() => onRequestConnection(user.nickname)}
                    className="border-primary/30 text-primary hover:bg-primary/10 shadow-sm"
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
        <Card className="border-success/30 bg-gradient-to-r from-success/10 to-primary/5 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-success/20 to-primary/10">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Wifi className="h-5 w-5 text-green-500" />
              Active Connections ({connections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between p-3 border border-success/30 rounded-lg bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-medium text-foreground">Connected Device</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTerminateConnection(connection.id)}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 shadow-sm"
                >
                  <X className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <Card className="border-warning/30 bg-gradient-to-r from-warning/10 to-primary/5 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-warning/20 to-primary/10">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Key className="h-5 w-5 text-yellow-500" />
              Pending Outgoing Requests ({outgoingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outgoingRequests.map((request, index) => (
              <div key={index} className="p-3 border border-warning/30 rounded-lg bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Connection Request Sent</span>
                  <Badge variant="secondary">Waiting for Key</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Waiting for the other device to provide verification key
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Connection Request Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection Request</DialogTitle>
            <DialogDescription>
              {selectedRequest && `${selectedRequest.requesterNickname} wants to connect with you.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="verification-key">Enter verification key from the requesting device:</Label>
              <Input
                id="verification-key"
                type="text"
                value={verificationKey}
                onChange={(e) => setVerificationKey(e.target.value)}
                placeholder="Enter key..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApprove} disabled={!verificationKey} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button onClick={handleReject} variant="outline" className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}