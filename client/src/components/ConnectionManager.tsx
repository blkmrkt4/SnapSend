import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Wifi, WifiOff, Key, Check, X } from 'lucide-react';
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
  const [verificationKeys, setVerificationKeys] = useState<{[key: number]: string}>({});

  const handleVerificationKeyChange = (connectionId: number, key: string) => {
    setVerificationKeys(prev => ({
      ...prev,
      [connectionId]: key
    }));
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearchUsers(searchQuery);
    }
  };

  const handleApproveConnection = (request: any) => {
    onRespondToConnection(request.connectionId, true, request.connectionKey);
  };

  const handleRejectConnection = (request: any) => {
    onRespondToConnection(request.connectionId, false);
  };

  const handleSubmitVerificationKey = (connectionId: number) => {
    const key = verificationKeys[connectionId];
    if (key) {
      onSubmitVerificationKey(connectionId, key);
      setVerificationKeys(prev => {
        const newKeys = { ...prev };
        delete newKeys[connectionId];
        return newKeys;
      });
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

      {/* Incoming Connection Requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-primary/5 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-500/20 to-primary/10">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-blue-500" />
              Incoming Connection Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.connectionId} className="p-4 border border-blue-500/30 rounded-lg bg-white shadow-sm space-y-3">
                <div>
                  <span className="font-medium text-foreground">{request.requesterNickname} wants to connect</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share this verification key with them to approve the connection
                  </p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Label className="text-sm font-medium text-blue-700">Verification Key:</Label>
                  <div className="mt-1 p-2 bg-white border rounded font-mono text-xl font-bold text-center text-blue-800">
                    {request.connectionKey}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApproveConnection(request)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Allow Connection
                  </Button>
                  <Button
                    onClick={() => handleRejectConnection(request)}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
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
              <div key={index} className="p-4 border border-warning/30 rounded-lg bg-white shadow-sm space-y-3">
                <div>
                  <span className="font-medium text-foreground">Connection Request Sent</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ask the other user for their verification key
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Enter verification key:</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={verificationKeys[request.connectionId] || ''}
                      onChange={(e) => handleVerificationKeyChange(request.connectionId, e.target.value)}
                      placeholder="Enter key..."
                      className="font-mono text-center"
                    />
                    <Button
                      onClick={() => handleSubmitVerificationKey(request.connectionId)}
                      disabled={!verificationKeys[request.connectionId]}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Connect
                    </Button>
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