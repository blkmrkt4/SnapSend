import { useState } from 'react';
import { DeviceSetup } from '@/components/DeviceSetup';
import { ConnectionManager } from '@/components/ConnectionManager';
import { MinimalDropWindow } from '@/components/MinimalDropWindow';
import { FileExplorer } from '@/components/FileExplorer';
import { NotificationWindow } from '@/components/NotificationWindow';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { useConnectionSystem } from '@/hooks/useConnectionSystem';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { type File } from '@shared/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExpanded, setShowExpanded] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const { 
    isSetup,
    isConnecting,
    currentDevice,
    connections,
    files,
    notifications,
    searchResults,
    pendingRequests,
    outgoingRequests,
    isSearching,
    setupDevice,
    searchUsers,
    requestConnection,
    respondToConnection,
    terminateConnection,
    sendFile,
    submitVerificationKey,
    dismissNotification,
  } = useConnectionSystem();

  const { downloadFile } = useFileTransfer();

  // Show device setup if not configured
  if (!isSetup) {
    return (
      <DeviceSetup 
        onSetupComplete={setupDevice}
        isConnecting={isConnecting}
      />
    );
  }

  const handleSendFile = async (fileData: any) => {
    try {
      sendFile(fileData);
    } catch (error) {
      console.error('Error sending file:', error);
    }
  };

  const handlePreviewFile = (file: File) => {
    setPreviewFile(file);
  };

  const handleClosePreview = () => {
    setPreviewFile(null);
  };

  const handleToggleExpanded = () => {
    setShowExpanded(!showExpanded);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleRefresh = () => {
    // Refresh connections and files
    console.log('Refresh connections');
  };

  const handleClearAll = () => {
    console.log('Clear all files');
  };

  const handleOpenFile = (notification: any) => {
    if (notification.file) {
      setPreviewFile(notification.file);
    }
  };

  const handleSaveFile = async (notification: any) => {
    if (notification.file) {
      try {
        await downloadFile(notification.file.id);
      } catch (error) {
        console.error('Error saving file:', error);
      }
    }
  };

  if (isMinimized) {
    return (
      <div className="min-h-screen p-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold">{currentDevice?.nickname}</h1>
          <p className="text-muted-foreground">
            {connections.length} active connection{connections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="fixed bottom-4 right-4">
          <button
            className="bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
            onClick={() => setIsMinimized(false)}
          >
            Open File Share
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Secure File Sharing</h1>
          <p className="text-muted-foreground">
            Connected as {currentDevice?.nickname} • {connections.length} active connection{connections.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Tabs defaultValue="connections" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="files">File Transfer</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="mt-6">
            <ConnectionManager
              currentDevice={currentDevice}
              connections={connections}
              onSearchUsers={searchUsers}
              onRequestConnection={requestConnection}
              onRespondToConnection={respondToConnection}
              onTerminateConnection={terminateConnection}
              onSubmitVerificationKey={submitVerificationKey}
              searchResults={searchResults}
              pendingRequests={pendingRequests}
              outgoingRequests={outgoingRequests}
              isSearching={isSearching}
            />
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            <div className="flex space-x-6">
              <MinimalDropWindow
                onSendFile={handleSendFile}
                recentFiles={files.slice(0, 3)}
                onToggleExpanded={handleToggleExpanded}
                onMinimize={handleMinimize}
              />

              {showExpanded && (
                <FileExplorer
                  files={files}
                  onPreviewFile={handlePreviewFile}
                  onRefresh={handleRefresh}
                  onClearAll={handleClearAll}
                  currentDevice={currentDevice}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <NotificationWindow
              notifications={notifications}
              onDismiss={dismissNotification}
              onOpenFile={handleOpenFile}
              onSaveFile={handleSaveFile}
            />
          </TabsContent>
        </Tabs>

        <FilePreviewModal
          file={previewFile}
          isOpen={!!previewFile}
          onClose={handleClosePreview}
        />
      </div>
    </div>
  );
}
