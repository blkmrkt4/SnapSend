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
  isSearching
}: ConnectionManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedOutgoingRequest, setSelectedOutgoingRequest] = useState<any>(null);
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

  const openVerificationDialog = (request: any) => {
    setSelectedOutgoingRequest(request);
    setShowVerificationDialog(true);
    setVerificationKey('');
  };

  const handleSubmitVerificationKey = () => {
    if (selectedOutgoingRequest && verificationKey.length === 2) {
      onSubmitVerificationKey(selectedOutgoingRequest.connectionId, verificationKey);
      setShowVerificationDialog(false);
      setSelectedOutgoingRequest(null);
      setVerificationKey('');
    }
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
              {connections.length > 0 ? (
                <p className="text-sm text-green-600 font-medium">
                  Connected to {connections.length} device{connections.length > 1 ? 's' : ''}: {' '}
                  {connections.map((conn: any) => conn.partnerNickname || 'Unknown').join(', ')}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Online and ready to connect</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Online
              </Badge>
              {connections.length > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  {connections.length} Connected
                </Badge>
              )}
            </div>
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
              <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <p className="font-medium text-green-800">
                      Connected to {(connection as any).partnerNickname || 'Partner'}
                    </p>
                    <p className="text-sm text-green-600">
                      Files can be shared instantly
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTerminateConnection(connection.id)}
                  className="border-red-300 text-red-700 hover:bg-red-50"
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
                      Share this key with {request.requesterNickname} - they need to enter it to verify their identity
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      onClick={() => handleRespondToRequest(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve Connection
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

      {/* Outgoing Connection Requests */}
      {outgoingRequests.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Key className="h-5 w-5" />
              Your Connection Requests ({outgoingRequests.length})
            </CardTitle>
            <CardDescription className="text-blue-700">
              Your connection requests are waiting for verification. Ask the other user for their verification key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {outgoingRequests.map((request) => (
              <div key={request.connectionId} className="p-4 border border-blue-200 rounded-lg bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">Connection Request Sent</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Waiting for the other user to share their verification key with you
                    </p>
                    <p className="text-xs text-blue-600">
                      Ask the other user to give you the 2-digit verification key they see on their screen
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      onClick={() => openVerificationDialog(request)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Enter Key
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
              <Label htmlFor="search">Search for a user to connect with</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Enter user's nickname (e.g., Glutathione)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isSearching}
                />
                <Button 
                  type="submit" 
                  disabled={!searchQuery.trim() || isSearching}
                  className="bg-blue-600 hover:bg-blue-700 min-w-[100px]"
                >
                  {isSearching ? 'Searching...' : 'Find User'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Type the exact nickname of the user you want to connect with, then click "Find User"
              </p>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6 p-4 border-2 border-green-200 rounded-lg bg-green-50">
              <Label className="text-sm font-semibold text-green-800 mb-3 block">Found Users - Click to Connect:</Label>
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-green-300 rounded-lg bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <p className="font-semibold text-lg">{user.nickname}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.isOnline ? '🟢 Online and ready to connect' : '🔴 Currently offline'}
                      </p>
                    </div>
                  </div>
                  <Button
                    disabled={!user.isOnline}
                    onClick={() => handleConnectionRequest(user.nickname)}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2"
                    size="lg"
                  >
                    {user.isOnline ? '📤 Send Connection Request' : 'Offline'}
                  </Button>
                </div>
              ))}
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Next step:</strong> Click "Send Connection Request" to initiate the connection. You'll receive a 2-digit key to share with the other user.
                </p>
              </div>
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

      {/* Quick Demo Section */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-900 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Quick Demo Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="p-3 bg-white rounded border border-purple-200">
            <p className="font-semibold text-purple-900 mb-2">To test the connection flow:</p>
            <div className="space-y-1 text-purple-800">
              <p>1. Open this app in two browser tabs/windows</p>
              <p>2. Set up each tab with different nicknames (like "Thyroxine" and "Glutathione")</p>
              <p>3. In one tab, search for the other nickname and click "Send Connection Request"</p>
              <p>4. Share the verification key with the other tab and approve the connection</p>
            </div>
          </div>
          <div className="text-xs text-purple-600">
            Each device needs a unique nickname to be discoverable by others.
          </div>
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

      {/* Verification Key Dialog for Outgoing Requests */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Verification Key</DialogTitle>
            <DialogDescription>
              Enter the 2-digit verification key that the other user shared with you
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="verificationKey">Verification Key</Label>
              <Input
                id="verificationKey"
                type="text"
                placeholder="Enter 2-digit key (e.g., 42)"
                value={verificationKey}
                onChange={(e) => setVerificationKey(e.target.value)}
                maxLength={2}
                pattern="[0-9]{2}"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Ask the other user for the verification key displayed on their screen
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowVerificationDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitVerificationKey}
                disabled={verificationKey.length !== 2}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Verify
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}