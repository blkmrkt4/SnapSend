import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowDown, Clipboard, Camera, FileImage, ChevronDown, Monitor, Maximize, Crop, Wifi, WifiOff, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { HamburgerMenu } from './HamburgerMenu';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { MistAnimation } from './MistAnimation';
import { ScreenshotCropper } from './ScreenshotCropper';
import { type File, type Device } from '@shared/schema';
import { type KnownDevice, LOCAL_DEVICE_ID } from '@/hooks/useConnectionSystem';

// Stylized liquid droplet icon for branding
function LiquidDropletIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2.5C12 2.5 5 10.5 5 15C5 18.866 8.134 22 12 22C15.866 22 19 18.866 19 15C19 10.5 12 2.5 12 2.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 15.5C7.5 14 9 13 12 13.5C15 14 16.5 13 17 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <ellipse
        cx="9"
        cy="12"
        rx="1.5"
        ry="2"
        fill="currentColor"
        fillOpacity="0.4"
      />
    </svg>
  );
}

interface LeftSidebarProps {
  activeSection: 'home' | 'connections' | 'files' | 'settings';
  onSectionChange: (section: 'home' | 'connections' | 'files' | 'settings') => void;
  connectionCount: number;
  fileCount: number;
  deviceName?: string;
  onSendFile: (fileData: any) => void;
  recentFiles: File[];
  connections: any[];
  onlineDevices: Device[];
  knownDevices: KnownDevice[];
  currentDevice: Device | null;
  selectedTargetId: string | null;
  onSelectTarget: (id: string | null) => void;
  pendingFileCount: number;
  showFilesPanel: boolean;
  onToggleFilesPanel: () => void;
}

export function LeftSidebar({
  activeSection,
  onSectionChange,
  connectionCount,
  fileCount,
  deviceName,
  onSendFile,
  recentFiles,
  connections,
  onlineDevices,
  knownDevices,
  currentDevice,
  selectedTargetId,
  onSelectTarget,
  pendingFileCount,
  showFilesPanel,
  onToggleFilesPanel,
}: LeftSidebarProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [windowDragActive, setWindowDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMist, setShowMist] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const [screenshotData, setScreenshotData] = useState<{
    dataURL: string;
    width: number;
    height: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { readFileAsText, readFileAsDataURL } = useFileTransfer();
  const [showScreenshotPicker, setShowScreenshotPicker] = useState(false);

  const selectedTargetName = selectedTargetId === LOCAL_DEVICE_ID
    ? `${currentDevice?.name || 'This Device'} (This Device)`
    : selectedTargetId
      ? knownDevices.find(d => d.id === selectedTargetId)?.name
        || onlineDevices.find(d => d.socketId === selectedTargetId)?.name
        || 'device'
      : null;

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Window-level drag detection
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setWindowDragActive(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setWindowDragActive(false);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleWindowDrop = (e: DragEvent) => {
      dragCounterRef.current = 0;
      setWindowDragActive(false);
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setWindowDragActive(false);
    dragCounterRef.current = 0;
    setIsUploading(true);

    setShowRipple(true);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);
    setTimeout(() => setShowRipple(false), 600);

    try {
      const files = Array.from(e.dataTransfer.files);

      for (const file of files) {
        let content: string | undefined;

        if (file.type.startsWith('text/')) {
          content = await readFileAsText(file);
        } else if (file.type.startsWith('image/') || file.size < 5 * 1024 * 1024) {
          content = await readFileAsDataURL(file);
        }

        await onSendFile({
          filename: `${Date.now()}-${file.name}`,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          content,
          isClipboard: false,
        });
      }

      setShowMist(true);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
    }
  }, [onSendFile, readFileAsText, readFileAsDataURL]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setIsUploading(true);

    try {
      for (const file of files) {
        let content: string | undefined;

        if (file.type.startsWith('text/')) {
          content = await readFileAsText(file);
        } else if (file.type.startsWith('image/') || file.size < 5 * 1024 * 1024) {
          content = await readFileAsDataURL(file);
        }

        await onSendFile({
          filename: `${Date.now()}-${file.name}`,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          content,
          isClipboard: false,
        });
      }

      setShowMist(true);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onSendFile, readFileAsText, readFileAsDataURL]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          await onSendFile({
            filename: 'clipboard-content',
            originalName: 'Clipboard Content',
            mimeType: 'text/plain',
            size: text.length,
            content: text,
            isClipboard: true,
          });

          setShowMist(true);
        }
      }
    } catch (error) {
      console.error('Error reading clipboard:', error);
    }
  }, [onSendFile]);

  // Global Cmd/Ctrl+V paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        e.preventDefault();
        await onSendFile({
          filename: 'clipboard-content',
          originalName: 'Clipboard Content',
          mimeType: 'text/plain',
          size: text.length,
          content: text,
          isClipboard: true,
        });
        setShowMist(true);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onSendFile]);

  const captureScreen = useCallback(async (surfaceHint?: string): Promise<{ dataURL: string; width: number; height: number } | null> => {
    try {
      if (window.electronAPI?.captureScreenshot) {
        const mode = surfaceHint === 'window' ? 'window' : 'fullscreen';
        return await window.electronAPI.captureScreenshot(mode);
      }

      if (!navigator.mediaDevices?.getDisplayMedia) return null;

      const constraints: any = { video: true };
      if (surfaceHint) {
        constraints.video = { displaySurface: surfaceHint };
      }
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        video.addEventListener('loadedmetadata', () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0);
          stream.getTracks().forEach(track => track.stop());
          setTimeout(() => window.focus(), 100);
          resolve({
            dataURL: canvas.toDataURL('image/png'),
            width: video.videoWidth,
            height: video.videoHeight,
          });
        });
      });
    } catch {
      return null;
    }
  }, []);

  const sendScreenshot = useCallback(async (dataURL: string) => {
    const filename = `screenshot-${Date.now()}.png`;
    const base64Length = dataURL.split(',')[1].length;
    const sizeInBytes = Math.round(base64Length * 0.75);

    await onSendFile({
      filename,
      originalName: filename,
      mimeType: 'image/png',
      size: sizeInBytes,
      content: dataURL,
      isClipboard: false,
    });
    setShowMist(true);
  }, [onSendFile]);

  const handleScreenshotWindow = useCallback(async () => {
    setShowScreenshotPicker(false);
    const result = await captureScreen('window');
    if (result) await sendScreenshot(result.dataURL);
  }, [captureScreen, sendScreenshot]);

  const handleScreenshotFullScreen = useCallback(async () => {
    setShowScreenshotPicker(false);
    const result = await captureScreen('monitor');
    if (result) await sendScreenshot(result.dataURL);
  }, [captureScreen, sendScreenshot]);

  const handleScreenshotCropMode = useCallback(async () => {
    setShowScreenshotPicker(false);
    const result = await captureScreen('monitor');
    if (result) {
      setScreenshotData(result);
    }
  }, [captureScreen]);

  const handleScreenshotCrop = useCallback(async (croppedDataURL: string) => {
    setScreenshotData(null);
    await sendScreenshot(croppedDataURL);
  }, [sendScreenshot]);

  const handleScreenshotCancel = useCallback(() => {
    setScreenshotData(null);
  }, []);

  return (
    <aside
      className="w-80 h-screen flex-shrink-0 bg-white border-r border-primary/20 flex flex-col overflow-hidden"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Header with branding and controls */}
      <div
        className="flex items-center gap-2 px-3 py-3 border-b border-primary/20 pl-20"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Branding - right after traffic light space */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <LiquidDropletIcon className="text-primary w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-bold text-foreground">
            Liquid <em>Relay</em>
          </span>
        </div>

        {/* Hamburger menu */}
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <HamburgerMenu
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            connectionCount={connectionCount}
            fileCount={fileCount}
          />
        </div>

        {/* Files panel toggle */}
        <button
          onClick={() => {
            if (!showFilesPanel) {
              // Opening panel - also switch to Files section
              onSectionChange('files');
            }
            onToggleFilesPanel();
          }}
          className="p-1.5 rounded hover:bg-muted/50 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title={showFilesPanel ? 'Hide panel' : 'Show files'}
        >
          {showFilesPanel ? (
            <PanelRightClose className="w-4 h-4 text-muted-foreground" />
          ) : (
            <PanelRightOpen className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Target device dropdown */}
        <div className="mb-2 relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(prev => !prev)}
            className="w-full flex items-center justify-between bg-background border border-primary/20 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:border-primary transition-colors"
          >
            <span className="truncate">
              {selectedTargetId === LOCAL_DEVICE_ID
                ? `${currentDevice?.name || 'This Device'} (This Device)`
                : selectedTargetId
                  ? selectedTargetName
                  : 'All Connected Devices'}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-background border border-primary/20 rounded-lg shadow-lg overflow-hidden">
              {/* Connection status */}
              <div className={`flex items-center gap-2 px-3 py-2 border-b border-primary/10 ${connectionCount > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {connectionCount > 0 ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-green-700">
                      {connectionCount} device{connectionCount > 1 ? 's' : ''} connected
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-red-700">No devices connected</span>
                  </>
                )}
                {currentDevice && (
                  <span className={`text-xs ml-auto truncate max-w-[100px] ${connectionCount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currentDevice.name}
                  </span>
                )}
              </div>

              {/* This Device (local save only) */}
              <button
                onClick={() => { onSelectTarget(LOCAL_DEVICE_ID); setDropdownOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  selectedTargetId === LOCAL_DEVICE_ID ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="truncate">{currentDevice?.name || 'This Device'} (This Device)</span>
              </button>

              {/* All Connected Devices */}
              <button
                onClick={() => { onSelectTarget(null); setDropdownOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  selectedTargetId === null ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
                }`}
              >
                <span className="truncate">All Connected Devices</span>
              </button>

              {/* Known devices */}
              <div className="max-h-40 overflow-y-auto">
                {knownDevices.map((device) => {
                  const isOnline = onlineDevices.some(d => d.socketId === device.id);
                  const isConnected = connections.some(
                    (c: any) => c.peerId === device.id || c.id === device.id || String(c.id) === device.id
                  );
                  const isSelected = selectedTargetId === device.id;

                  return (
                    <button
                      key={device.id}
                      onClick={() => { onSelectTarget(device.id); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isSelected ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isConnected ? 'bg-green-500' : isOnline ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span className={`truncate ${isConnected || isOnline ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {device.name}
                      </span>
                      {!isOnline && (
                        <span className="text-[10px] text-red-400 ml-auto flex-shrink-0">offline</span>
                      )}
                    </button>
                  );
                })}

                {knownDevices.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    No devices discovered yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status text */}
        <p className="text-muted-foreground text-xs text-center mb-3">
          {selectedTargetId === LOCAL_DEVICE_ID
            ? 'Files save to this device only'
            : selectedTargetId
              ? connections.some((c: any) => c.peerId === selectedTargetId || c.id === selectedTargetId)
                ? 'Press ⌘V to paste clipboard'
                : `Files will send when ${selectedTargetName} connects`
              : connections.length > 0
                ? 'Press ⌘V to paste clipboard'
                : 'No devices connected — files save locally'}
        </p>

        {/* Drop zone */}
        <div
          className={`vortex-zone liquid-bg p-6 text-center ${
            isDragOver ? 'is-dragging' : ''
          } ${windowDragActive && !isDragOver ? 'window-drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          <div className={`vortex-ripple ${showRipple ? 'active' : ''}`} />
          <div className={`vortex-flash ${showFlash ? 'active' : ''}`} />

          <MistAnimation
            isVisible={showMist}
            onComplete={() => setShowMist(false)}
          />

          <div className="vortex-content">
            <p className="font-semibold text-foreground">
              {isUploading
                ? 'Pouring...'
                : isDragOver
                  ? 'Release to Pour'
                  : selectedTargetId === LOCAL_DEVICE_ID
                    ? 'Drop files here'
                    : selectedTargetId
                      ? `Drop files for ${selectedTargetName}`
                      : connections.length > 0
                        ? 'Drop files here'
                        : 'Drop files here'}
            </p>

            <div className="flex flex-col items-center gap-2">
              {!isUploading && (
                <button className="text-[var(--liquid-teal-dark)] text-sm font-semibold hover:text-[var(--liquid-teal)] transition-colors">
                  Browse files
                </button>
              )}

              <div className="vortex-icon-wrapper">
                {isUploading ? (
                  <div className="w-6 h-6 border-2 border-[var(--liquid-teal-dark)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowDown className="vortex-icon rotate-180" />
                )}
              </div>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Action buttons */}
        <div className="mt-4 space-y-2">
          <div className="flex space-x-2">
            <button
              className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors shadow-sm border bg-accent hover:bg-accent/80 text-foreground border-primary/20"
              onClick={handlePasteFromClipboard}
            >
              <Clipboard className="w-4 h-4 mr-2 inline" />Clipboard
            </button>
            <button
              className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              onClick={() => setShowScreenshotPicker(prev => !prev)}
            >
              <Camera className="w-4 h-4 mr-2 inline" />Screenshot
            </button>
          </div>

          {showScreenshotPicker && (
            <div className="flex rounded-lg border border-primary/20 overflow-hidden">
              <button
                onClick={handleScreenshotWindow}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-xs font-medium hover:bg-primary/10 transition-colors border-r border-primary/10"
              >
                <Monitor className="w-4 h-4 text-primary" />
                Window
              </button>
              <button
                onClick={handleScreenshotFullScreen}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-xs font-medium hover:bg-primary/10 transition-colors border-r border-primary/10"
              >
                <Maximize className="w-4 h-4 text-primary" />
                Full
              </button>
              <button
                onClick={handleScreenshotCropMode}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-xs font-medium hover:bg-primary/10 transition-colors"
              >
                <Crop className="w-4 h-4 text-primary" />
                Select Area
              </button>
            </div>
          )}
        </div>

        {/* Queued files indicator */}
        {pendingFileCount > 0 && selectedTargetId && selectedTargetId !== LOCAL_DEVICE_ID && (
          <div className="mt-3 flex justify-center">
            <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              {pendingFileCount} file{pendingFileCount > 1 ? 's' : ''} queued
            </div>
          </div>
        )}

        {/* Recently Sent */}
        <div className="mt-6 pt-4 border-t border-primary/20">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Recently Sent</h3>
          <div className="space-y-2">
            {recentFiles.slice(0, 3).map((file) => (
              <div key={file.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileImage className="text-green-600 w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{file.originalName}</p>
                  <p className="text-xs text-gray-500">
                    {file.transferredAt ? new Date(file.transferredAt).toLocaleTimeString() : 'Just now'}
                  </p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              </div>
            ))}
            {recentFiles.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No files sent yet</p>
            )}
          </div>
        </div>
      </div>

      {screenshotData && (
        <ScreenshotCropper
          imageDataURL={screenshotData.dataURL}
          imageWidth={screenshotData.width}
          imageHeight={screenshotData.height}
          onCrop={handleScreenshotCrop}
          onCancel={handleScreenshotCancel}
        />
      )}
    </aside>
  );
}
