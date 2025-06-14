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
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Connections</h2>
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="font-medium text-sm">{currentDevice?.nickname}</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
              Online
            </Badge>
            {connections.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                {connections.length} Connected
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Connect to New Device - moved to top */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
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
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={!searchQuery.trim() || isSearching}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSearching ? 'Searching...' : 'Find'}
              </Button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-2 border border-green-200 rounded bg-green-50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="font-medium text-sm">{user.nickname}</span>
                  </div>
                  <Button
                    disabled={!user.isOnline}
                    onClick={() => handleConnectionRequest(user.nickname)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-xs"
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
        <Card className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Active Connections ({connections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between p-2 border rounded bg-green-50 border-green-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-medium text-sm text-green-800">
                    {(connection as any).partnerNickname || 'Partner'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTerminateConnection(connection.id)}
                  className="border-red-300 text-red-700 hover:bg-red-50 text-xs"
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
        <Card className="border-blue-200 bg-blue-50 w-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
              <Key className="h-4 w-4" />
              Incoming Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {pendingRequests.map((request) => (
              <div key={request.connectionId} className="p-3 border border-blue-200 rounded bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-blue-800">
                    {request.requesterNickname} wants to connect
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRespondToConnection(request.connectionId, false)}
                    className="border-red-300 text-red-700 hover:bg-red-50 text-xs"
                  >
                    Reject
                  </Button>
                </div>
                <div className="flex items-center gap-2 p-2 bg-blue-100 rounded">
                  <Key className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-800">Share this code:</span>
                  <span className="text-lg font-bold text-blue-900 bg-white px-2 py-1 rounded">
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
        <Card className="border-blue-200 bg-blue-50 w-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
              <Key className="h-4 w-4" />
              Your Requests ({outgoingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {outgoingRequests.map((request) => (
              <div key={request.connectionId} className="p-3 border border-blue-200 rounded bg-white">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Request sent - Ask for verification key</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="2-digit key"
                      value={verificationKey}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setVerificationKey(value);
                      }}
                      maxLength={2}
                      className="w-16 text-center font-mono"
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
                      className="bg-green-600 hover:bg-green-700 text-xs"
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
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-900">
              <Users className="h-5 w-5" />
              Recent Activity ({notifications.length})
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Connection and file transfer notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-4 border border-yellow-200 rounded-lg bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{notification.title}</p>
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
                        className="text-xs"
                      >
                        View
                      </Button>
                    )}
                    {notification.file && onSaveFile && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSaveFile(notification)}
                        className="text-xs"
                      >
                        Save
                      </Button>
                    )}
                    {onDismissNotification && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDismissNotification(notification.id)}
                        className="text-xs"
                      >
                        <X className="h-3 w-3" />
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