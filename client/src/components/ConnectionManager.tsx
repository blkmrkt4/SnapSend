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
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <Key className="h-5 w-5" />
              Incoming Connection Requests ({pendingRequests.length})
            </CardTitle>
            <CardDescription className="text-orange-700">
              Someone wants to connect with you. Verify the connection key before approving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.connectionId} className="p-4 border border-orange-200 rounded-lg bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{request.requesterNickname}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      wants to connect with you
                    </p>
                    <div className="flex items-center gap-2 p-2 bg-orange-100 rounded border-orange-300 border">
                      <Key className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">
                        Connection Key: 
                      </span>
                      <span className="text-xl font-bold text-orange-900 bg-white px-2 py-1 rounded border">
                        {request.connectionKey}
                      </span>
                    </div>
                    <p className="text-xs text-orange-600 mt-1">
                      Ask {request.requesterNickname} to confirm this key matches what they see
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      onClick={() => openConnectionDialog(request)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRespondToRequest(false)}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Connect to New Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Connect to New Device
          </CardTitle>
          <CardDescription>
            Search for users by nickname and send a connection request. They will need to approve your request and enter a 2-digit verification key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search for a user</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Enter user's nickname..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isSearching}
                />
                <Button type="submit" disabled={!searchQuery.trim() || isSearching}>
                  {isSearching ? 'Searching...' : 'Find User'}
                </Button>
              </div>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <Label className="text-sm font-medium">Available Users:</Label>
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <p className="font-medium">{user.nickname}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.isOnline ? 'Online and available' : 'Currently offline'}
                      </p>
                    </div>
                  </div>
                  <Button
                    disabled={!user.isOnline}
                    onClick={() => handleConnectionRequest(user.nickname)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {user.isOnline ? 'Send Connection Request' : 'Offline'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="mt-4 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              <p className="text-sm text-yellow-800">
                No users found with nickname "{searchQuery}". Make sure the nickname is correct and the user is online.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">How Connection Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <div className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>Search for a user by their nickname and send a connection request</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>You'll receive a 2-digit verification key - share this key with the other user</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>The other user approves your request by entering the verification key</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold">4.</span>
            <span>Once approved, you can securely share files with each other</span>
          </div>
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