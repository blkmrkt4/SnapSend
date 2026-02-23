import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [ghostOpacity, setGhostOpacity] = useState(0.25);
  const preGhostFilesPanelRef = useRef(true);
  const preGhostWindowSizeRef = useRef<{ width: number; height: number } | null>(null);
  const prePanelSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Load ghost mode state on mount
  useEffect(() => {
    if (window.electronAPI?.isElectron) {
      window.electronAPI.getGhostMode().then((enabled) => {
        setIsGhostMode(enabled);
        if (enabled) {
          setShowFilesPanel(false);
        }
      }).catch(() => {});
      window.electronAPI.getWindowOpacity().then(setGhostOpacity).catch(() => {});
    }
  }, []);

  const {
    currentDevice,
    onlineDevices,
    connections,
    files,
    pendingFiles,
    selectedTargetId,
    knownDevices,
    allTags,
    chunkedTransfers,
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
    toggleDeviceEnabled,
  } = useConnectionSystem();

  // Listen for AI smart-rename events: rename via API, then refresh file list
  const renameFileRef = useRef(renameFile);
  renameFileRef.current = renameFile;
  const refreshFilesRef = useRef(refreshFiles);
  refreshFilesRef.current = refreshFiles;
  useEffect(() => {
    if (window.electronAPI?.isElectron) {
      window.electronAPI.onSmartRenamed((data) => {
        // Apply the AI-suggested name via the existing rename function
        renameFileRef.current(data.fileId, data.newName);
        // Refresh after a short delay to ensure DB update propagates
        setTimeout(() => refreshFilesRef.current(), 500);
      });
    }
  }, []);

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

  const handleToggleGhostMode = useCallback(async () => {
    if (!window.electronAPI?.isElectron) return;
    const newGhostMode = !isGhostMode;
    setIsGhostMode(newGhostMode);

    if (newGhostMode) {
      // Entering ghost mode: save state, collapse panel, shrink window
      preGhostFilesPanelRef.current = showFilesPanel;
      preGhostWindowSizeRef.current = await window.electronAPI.getWindowSize();
      setShowFilesPanel(false);
    } else {
      // Exiting ghost mode: keep current drawer state, resize based on it
      // Don't change showFilesPanel — leave whatever the user has open
      if (showFilesPanel && preGhostWindowSizeRef.current) {
        // Drawer is open — restore to full pre-ghost size
        await window.electronAPI.setWindowSize(
          preGhostWindowSizeRef.current.width,
          preGhostWindowSizeRef.current.height
        );
      }
      // If drawer is closed, window is already at 320 width — leave it
      preGhostWindowSizeRef.current = null;
    }

    try {
      await window.electronAPI.setGhostMode(newGhostMode);
    } catch {}
  }, [isGhostMode, showFilesPanel]);

  const handleMouseEnterGhost = useCallback(() => {
    if (isGhostMode && window.electronAPI?.isElectron) {
      window.electronAPI.setWindowOpacity(0.7).catch(() => {});
    }
  }, [isGhostMode]);

  const handleMouseLeaveGhost = useCallback(() => {
    if (isGhostMode && window.electronAPI?.isElectron) {
      window.electronAPI.setWindowOpacity(ghostOpacity).catch(() => {});
    }
  }, [isGhostMode, ghostOpacity]);

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
            knownDevices={knownDevices}
            onPairWithDevice={pairWithDevice}
            onTerminateConnection={terminateConnection}
            onToggleDeviceEnabled={toggleDeviceEnabled}
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
    <div
      className="h-screen flex bg-background overflow-hidden"
      onMouseEnter={handleMouseEnterGhost}
      onMouseLeave={handleMouseLeaveGhost}
    >
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
        onToggleFilesPanel={async () => {
          const newState = !showFilesPanel;
          setShowFilesPanel(newState);
          if (window.electronAPI?.isElectron) {
            const currentSize = await window.electronAPI.getWindowSize();
            if (!newState) {
              // Collapsing — save size and shrink to sidebar width
              prePanelSizeRef.current = currentSize;
              await window.electronAPI.setWindowSize(320, currentSize.height);
            } else {
              // Expanding — restore previous size, or default to 1200 if window is narrow
              const targetWidth = prePanelSizeRef.current?.width ?? 1200;
              const targetHeight = prePanelSizeRef.current?.height ?? currentSize.height;
              await window.electronAPI.setWindowSize(
                Math.max(targetWidth, 800),
                Math.max(targetHeight, 600)
              );
              prePanelSizeRef.current = null;
            }
          }
        }}
        chunkedTransfers={chunkedTransfers}
        isGhostMode={isGhostMode}
        onToggleGhostMode={handleToggleGhostMode}
      />

      {/* Main Content Area - collapsible, fills remaining width */}
      {showFilesPanel && (
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="p-6 flex-1 flex flex-col min-h-0">
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
