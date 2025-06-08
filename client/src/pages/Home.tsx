import { useState } from 'react';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { MinimalDropWindow } from '@/components/MinimalDropWindow';
import { ExpandedFileManager } from '@/components/ExpandedFileManager';
import { NotificationWindow } from '@/components/NotificationWindow';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { type File } from '@shared/schema';

export default function Home() {
  const [deviceName] = useState(() => {
    const saved = localStorage.getItem('deviceName');
    if (saved) return saved;
    
    // Create a more user-friendly device name
    const adjectives = ['Swift', 'Bright', 'Quick', 'Smart', 'Fast', 'Cool', 'Pro', 'Elite'];
    const nouns = ['Desktop', 'Laptop', 'Workstation', 'Computer', 'Device', 'System'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const newName = `${adj} ${noun}`;
    localStorage.setItem('deviceName', newName);
    return newName;
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const [showExpanded, setShowExpanded] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const { 
    isConnected, 
    devices, 
    currentDevice, 
    files, 
    notifications, 
    sendFile,
    dismissNotification,
    reconnect 
  } = useWebSocket(deviceName);

  const { downloadFile } = useFileTransfer();

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
    reconnect();
  };

  const handleClearAll = () => {
    // In a real app, this would make an API call to clear files
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
        <ConnectionStatus
          isConnected={isConnected}
          devices={devices}
          currentDevice={currentDevice}
        />
        <div className="fixed bottom-4 right-4">
          <button
            className="bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
            onClick={() => setIsMinimized(false)}
          >
            Open QuickDrop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <ConnectionStatus
        isConnected={isConnected}
        devices={devices}
        currentDevice={currentDevice}
      />

      <div className="flex space-x-6 max-w-7xl mx-auto mt-16">
        <MinimalDropWindow
          onSendFile={handleSendFile}
          recentFiles={files.slice(0, 3)}
          onToggleExpanded={handleToggleExpanded}
          onMinimize={handleMinimize}
        />

        {showExpanded && (
          <ExpandedFileManager
            files={files}
            onPreviewFile={handlePreviewFile}
            onRefresh={handleRefresh}
            onClearAll={handleClearAll}
          />
        )}

        <NotificationWindow
          notifications={notifications}
          onDismiss={dismissNotification}
          onOpenFile={handleOpenFile}
          onSaveFile={handleSaveFile}
        />
      </div>

      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={handleClosePreview}
      />
    </div>
  );
}
