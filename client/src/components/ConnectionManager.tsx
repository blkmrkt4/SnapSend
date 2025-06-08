import { useState } from 'react';
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
  searchResults: Device[];
  pendingRequests: any[];
  isSearching: boolean;
}

export function ConnectionManager({
  currentDevice,
  connections,
  onSearchUsers,
  onRequestConnection,
  onRespondToConnection,
  onTerminateConnection,
  searchResults,
  pendingRequests,
  isSearching
}: ConnectionManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [enteredKey, setEnteredKey] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchUsers(searchQuery.trim());
    }
  };

  const handleConnectionRequest = (targetNickname: string) => {
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
    <div className="space-y-6">
      {/* Current Device Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-500" />
            Device Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{currentDevice?.nickname}</p>
              <p className="text-sm text-muted-foreground">Online and ready to connect</p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Online
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Active Connections */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Connections ({connections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Connection Active</p>
                  <p className="text-sm text-muted-foreground">
                    Files can be shared between devices
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTerminateConnection(connection.id)}
                >
                  <WifiOff className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending Connection Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Pending Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.connectionId} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{request.requesterNickname}</p>
                  <p className="text-sm text-muted-foreground">
                    Wants to connect with key: {request.connectionKey}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openConnectionDialog(request)}
                >
                  Respond
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search for Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Connect to Users
          </CardTitle>
          <CardDescription>
            Search for users by nickname to request a connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by nickname..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
              />
              <Button type="submit" disabled={!searchQuery.trim() || isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <Label>Found Users:</Label>
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{user.nickname}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!user.isOnline}
                    onClick={() => handleConnectionRequest(user.nickname)}
                  >
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Response Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection Request</DialogTitle>
            <DialogDescription>
              {selectedRequest?.requesterNickname} wants to connect with you
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="connectionKey">Enter the 2-digit connection key</Label>
              <Input
                id="connectionKey"
                type="text"
                placeholder="Enter key (e.g., 42)"
                value={enteredKey}
                onChange={(e) => setEnteredKey(e.target.value)}
                maxLength={2}
                pattern="[0-9]{2}"
              />
              <p className="text-sm text-muted-foreground mt-1">
                The requester should provide you with this key
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleRespondToRequest(false)}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={() => handleRespondToRequest(true)}
                disabled={enteredKey.length !== 2}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}