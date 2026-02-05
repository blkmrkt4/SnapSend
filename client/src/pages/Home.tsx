import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { SettingsPage } from '@/components/SettingsPage';
import { ConnectionManager } from '@/components/ConnectionManager';
import { MinimalDropWindow } from '@/components/MinimalDropWindow';
import { FileExplorer } from '@/components/FileExplorer';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { HomePage } from '@/components/HomePage';
import { useConnectionSystem } from '@/hooks/useConnectionSystem';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { type File } from '@shared/schema';

export default function Home() {
  const [activeSection, setActiveSection] = useState<'home' | 'connections' | 'files' | 'settings'>('connections');
  const [showExpanded, setShowExpanded] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const {
    currentDevice,
    onlineDevices,
    connections,
    files,
    pendingFiles,
    selectedTargetId,
    knownDevices,
    setupDevice,
    pairWithDevice,
    terminateConnection,
    sendFile,
    setSelectedTarget,
    clearAllFiles,
    refreshFiles,
    deleteFile,
    renameFile,
    refreshDiscovery,
  } = useConnectionSystem();

  const { downloadFile } = useFileTransfer();

  const handleSendFile = async (fileData: any) => {
    try {
      sendFile(fileData);
    } catch (error) {
      console.error('Error sending file:', error);
    }
  };

  const handleDeviceNameUpdate = (name: string) => {
    setupDevice(name);
  };

  const renderMainContent = () => {
    switch (activeSection) {
      case 'home':
        return <HomePage />;

      case 'connections':
        return (
          <ConnectionManager
            currentDevice={currentDevice}
            onlineDevices={onlineDevices}
            connections={connections}
            onPairWithDevice={pairWithDevice}
            onTerminateConnection={terminateConnection}
            onDeviceNameUpdate={handleDeviceNameUpdate}
            onRefreshDiscovery={refreshDiscovery}
          />
        );

      case 'files':
        return (
          <div className="flex space-x-6">
            <MinimalDropWindow
              onSendFile={handleSendFile}
              recentFiles={files.filter(file => file.transferType === 'sent').slice(0, 3)}
              onToggleExpanded={() => setShowExpanded(!showExpanded)}
              onMinimize={() => {}}
              connections={connections}
              onlineDevices={onlineDevices}
              knownDevices={knownDevices}
              currentDevice={currentDevice}
              selectedTargetId={selectedTargetId}
              onSelectTarget={setSelectedTarget}
              pendingFileCount={pendingFiles.length}
            />

            {showExpanded && (
              <div className="flex-1 min-w-0">
                <FileExplorer
                  files={files}
                  onPreviewFile={(file: File) => setPreviewFile(file)}
                  onRefresh={refreshFiles}
                  onClearAll={clearAllFiles}
                  onDeleteFile={deleteFile}
                  onRenameFile={renameFile}
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
            onDeviceNameUpdate={handleDeviceNameUpdate}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        connectionCount={connections.length}
        fileCount={files.length}
        deviceName={currentDevice?.name}
      />

      <main className="px-4 pt-14 pb-4">
        <div className="max-w-7xl mx-auto">
          {renderMainContent()}
        </div>
      </main>

      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />

      <div className="fixed bottom-2 right-3 text-[10px] text-muted-foreground/50 select-none pointer-events-none">
        SnapSend v{__APP_VERSION__}
      </div>
    </div>
  );
}
