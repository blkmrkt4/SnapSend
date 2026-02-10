import { useState } from 'react';
import { SettingsPage } from '@/components/SettingsPage';
import { ConnectionManager } from '@/components/ConnectionManager';
import { FileExplorer } from '@/components/FileExplorer';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { HomePage } from '@/components/HomePage';
import { LeftSidebar } from '@/components/LeftSidebar';
import { useConnectionSystem } from '@/hooks/useConnectionSystem';
import { type File } from '@shared/schema';

export default function Home() {
  const [activeSection, setActiveSection] = useState<'home' | 'connections' | 'files' | 'settings'>('files');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [showFilesPanel, setShowFilesPanel] = useState(true);

  const {
    currentDevice,
    onlineDevices,
    connections,
    files,
    pendingFiles,
    selectedTargetId,
    knownDevices,
    allTags,
    setupDevice,
    pairWithDevice,
    terminateConnection,
    sendFile,
    setSelectedTarget,
    clearAllFiles,
    refreshFiles,
    deleteFile,
    renameFile,
    updateFileTags,
    addTag,
    deleteTag,
    refreshDiscovery,
  } = useConnectionSystem();

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
          <FileExplorer
            files={files}
            onPreviewFile={(file: File) => setPreviewFile(file)}
            onRefresh={refreshFiles}
            onClearAll={clearAllFiles}
            onDeleteFile={deleteFile}
            onRenameFile={renameFile}
            onUpdateTags={updateFileTags}
            onAddTag={addTag}
            onDeleteTag={deleteTag}
            allTags={allTags}
            currentDevice={currentDevice}
          />
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
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Fixed Left Sidebar */}
      <LeftSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        connectionCount={connections.length}
        fileCount={files.length}
        deviceName={currentDevice?.name}
        onSendFile={handleSendFile}
        recentFiles={files.filter(file => file.transferType === 'sent' || file.transferType === 'saved').slice(0, 3)}
        connections={connections}
        onlineDevices={onlineDevices}
        knownDevices={knownDevices}
        currentDevice={currentDevice}
        selectedTargetId={selectedTargetId}
        onSelectTarget={setSelectedTarget}
        pendingFileCount={pendingFiles.length}
        showFilesPanel={showFilesPanel}
        onToggleFilesPanel={() => setShowFilesPanel(!showFilesPanel)}
      />

      {/* Main Content Area - collapsible, fills remaining width */}
      {showFilesPanel && (
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-[1200px]">
            {renderMainContent()}
          </div>
        </main>
      )}

      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onUpdateTags={updateFileTags}
        onAddTag={addTag}
        onDeleteTag={deleteTag}
        allTags={allTags}
      />

      {/* Version badge */}
      <div className="fixed bottom-2 left-2 text-[10px] text-muted-foreground/50 select-none pointer-events-none z-50">
        Liquid <em>Relay</em> v{__APP_VERSION__}
      </div>
    </div>
  );
}
