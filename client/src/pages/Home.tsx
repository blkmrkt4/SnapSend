import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { SettingsPage } from '@/components/SettingsPage';
import { ConnectionManager } from '@/components/ConnectionManager';
import { MinimalDropWindow } from '@/components/MinimalDropWindow';
import { FileExplorer } from '@/components/FileExplorer';
import { NotificationWindow } from '@/components/NotificationWindow';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { useConnectionSystem } from '@/hooks/useConnectionSystem';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { useAuth } from '@/hooks/use-auth';
import { type File } from '@shared/schema';

export default function Home() {
  const [activeSection, setActiveSection] = useState<'connections' | 'files' | 'settings'>('connections');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExpanded, setShowExpanded] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const { user } = useAuth();
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
    clearAllNotifications,
    clearAllFiles,
    refreshFiles,
    deleteFile,
  } = useConnectionSystem();

  const { downloadFile } = useFileTransfer();

  // Auto-setup device with user's nickname if not already setup
  useEffect(() => {
    if (!isSetup && user && !isConnecting) {
      // Use user's nickname as default device name
      setupDevice(user.nickname, user.id);
    }
  }, [isSetup, user, isConnecting, setupDevice]);

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
    refreshFiles();
  };

  const handleClearAll = () => {
    clearAllFiles();
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

  const handleDeviceNicknameUpdate = (nickname: string) => {
    if (user?.id) {
      setupDevice(nickname, user.id);
    }
  };

  const renderMainContent = () => {
    switch (activeSection) {
      case 'connections':
        return (
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
            notifications={notifications}
            onDismissNotification={dismissNotification}
            onClearAllNotifications={clearAllNotifications}
            onOpenFile={handleOpenFile}
            onSaveFile={handleSaveFile}
          />
        );
      
      case 'files':
        return (
          <div className="flex space-x-6">
            <MinimalDropWindow
              onSendFile={handleSendFile}
              recentFiles={files.filter(file => file.transferType === 'sent').slice(0, 3)}
              onToggleExpanded={handleToggleExpanded}
              onMinimize={handleMinimize}
              hasConnections={connections.length > 0}
            />

            {showExpanded && (
              <div className="flex-1 min-w-0">
                <FileExplorer
                  files={files}
                  onPreviewFile={handlePreviewFile}
                  onRefresh={handleRefresh}
                  onClearAll={handleClearAll}
                  onDeleteFile={deleteFile}
                  currentDevice={currentDevice}
                />
              </div>
            )}
          </div>
        );
      
      case 'settings':
        return (
          <SettingsPage
            currentDevice={currentDevice}
            onDeviceNicknameUpdate={handleDeviceNicknameUpdate}
          />
        );
      
      default:
        return null;
    }
  };

  if (isMinimized) {
    return (
      <div className="min-h-screen p-4 bg-gradient-to-br from-background to-primary/20">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-foreground">{currentDevice?.nickname}</h1>
          <p className="text-muted-foreground text-lg">
            {connections.length} active connection{connections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="fixed bottom-4 right-4">
          <button
            className="bg-primary text-primary-foreground p-4 rounded-full shadow-xl hover:bg-primary/90 transition-all duration-200 hover:scale-105"
            onClick={() => setIsMinimized(false)}
          >
            Open File Share
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        connectionCount={connections.length}
        fileCount={files.length}
      />
      
      <main className="pl-4 pr-4 pt-16 pb-4">
        <div className="max-w-7xl mx-auto">
          {renderMainContent()}
        </div>
      </main>

      {/* Notification Window */}
      {notifications.length > 0 && (
        <NotificationWindow
          notifications={notifications}
          onDismiss={dismissNotification}
          onOpenFile={handleOpenFile}
          onSaveFile={handleSaveFile}
        />
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={handleClosePreview}
      />
    </div>
  );
}
