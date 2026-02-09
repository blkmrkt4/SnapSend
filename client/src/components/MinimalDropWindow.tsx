import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowDown, Clipboard, Camera, Minus, PanelRightOpen, PanelRightClose, FileImage, ChevronDown, Monitor, Maximize, Crop } from 'lucide-react';

// Stylized liquid droplet icon for branding
function LiquidDropletIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Droplet outline */}
      <path
        d="M12 2.5C12 2.5 5 10.5 5 15C5 18.866 8.134 22 12 22C15.866 22 19 18.866 19 15C19 10.5 12 2.5 12 2.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Liquid wave inside */}
      <path
        d="M7 15.5C7.5 14 9 13 12 13.5C15 14 16.5 13 17 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Highlight reflection */}
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
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { MistAnimation } from './MistAnimation';
import { ScreenshotCropper } from './ScreenshotCropper';
import { type File, type Device } from '@shared/schema';
import { type KnownDevice, LOCAL_DEVICE_ID } from '@/hooks/useConnectionSystem';

interface MinimalDropWindowProps {
  onSendFile: (fileData: any) => void;
  recentFiles: File[];
  onToggleExpanded: () => void;
  onMinimize: () => void;
  isExpanded: boolean;
  connections: any[];
  onlineDevices: Device[];
  knownDevices: KnownDevice[];
  currentDevice: Device | null;
  selectedTargetId: string | null;
  onSelectTarget: (id: string | null) => void;
  pendingFileCount: number;
}

export function MinimalDropWindow({
  onSendFile,
  recentFiles,
  onToggleExpanded,
  onMinimize,
  isExpanded,
  connections,
  onlineDevices,
  knownDevices,
  currentDevice,
  selectedTargetId,
  onSelectTarget,
  pendingFileCount,
}: MinimalDropWindowProps) {
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

  // Window-level drag detection for vortex activation
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

    // Trigger ripple and flash animations
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
        } else if (file.type.startsWith('image/') || file.size < 5 * 1024 * 1024) { // Under 5MB
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

      // Trigger mist animation after successful file transfer
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
        } else if (file.type.startsWith('image/') || file.size < 5 * 1024 * 1024) { // Under 5MB
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
      
      // Trigger mist animation after successful file transfer
      setShowMist(true);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
    }

    // Reset input
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
          
          // Trigger mist animation after successful clipboard transfer
          setShowMist(true);
        }
      }
    } catch (error) {
      console.error('Error reading clipboard:', error);
    }
  }, [onSendFile]);

  // Global Cmd/Ctrl+V paste handler — uses the paste event which already has
  // user-granted permission, so no extra browser prompt appears.
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept paste into input/textarea fields
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

  const [showScreenshotPicker, setShowScreenshotPicker] = useState(false);

  const captureScreen = useCallback(async (surfaceHint?: string): Promise<{ dataURL: string; width: number; height: number } | null> => {
    try {
      // Use Electron desktopCapturer when available
      if (window.electronAPI?.captureScreenshot) {
        const mode = surfaceHint === 'window' ? 'window' : 'fullscreen';
        return await window.electronAPI.captureScreenshot(mode);
      }

      // Fallback: browser getDisplayMedia API
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
    <div className="w-80 bg-white rounded-xl shadow-2xl border border-primary/30 overflow-hidden">
      <div className="bg-gradient-to-r from-primary to-secondary px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <LiquidDropletIcon className="text-primary-foreground w-5 h-5" />
          <h2 className="text-primary-foreground font-bold">Liquid <em>Relay</em></h2>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            className="text-primary-foreground/80 hover:text-primary-foreground p-1 rounded hover:bg-white/20 transition-colors"
            onClick={onMinimize}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            className="text-primary-foreground/80 hover:text-primary-foreground p-1 rounded hover:bg-white/20 transition-colors"
            onClick={onToggleExpanded}
            title={isExpanded ? 'Hide shared files' : 'Show shared files'}
          >
            {isExpanded ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Target device dropdown */}
        <div className="mb-3 relative" ref={dropdownRef}>
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
              {/* You are Live */}
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border-b border-primary/10">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-700">You are Live</span>
                {currentDevice && (
                  <span className="text-xs text-green-600 ml-auto truncate max-w-[140px]">{currentDevice.name}</span>
                )}
              </div>

              {/* This Device (local save only) - DEFAULT */}
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

        {/* Status text - outside the oval */}
        <p className="text-muted-foreground text-xs text-center mb-2">
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

        <div
          className={`vortex-zone liquid-bg p-8 text-center ${
            isDragOver ? 'is-dragging' : ''
          } ${windowDragActive && !isDragOver ? 'window-drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          {/* Ripple effect */}
          <div className={`vortex-ripple ${showRipple ? 'active' : ''}`} />
          {/* Flash effect */}
          <div className={`vortex-flash ${showFlash ? 'active' : ''}`} />

          <MistAnimation
            isVisible={showMist}
            onComplete={() => setShowMist(false)}
          />

          <div className="vortex-content">
            {/* Top: Main heading */}
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

            {/* Bottom: Browse + Arrow only */}
            <div className="flex flex-col items-center gap-2">
              {!isUploading && (
                <button className="text-[var(--liquid-teal-dark)] text-sm font-semibold hover:text-[var(--liquid-teal)] transition-colors">
                  Browse files
                </button>
              )}

              {/* Arrow icon at bottom, pointing up */}
              <div className="vortex-icon-wrapper">
                {isUploading ? (
                  <div className="w-6 h-6 border-2 border-[var(--liquid-teal-dark)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowDown className="vortex-icon rotate-180" />
                )}
              </div>
            </div>
            {/* Only show queued indicator for specific device targets (not "This Device" or "All Devices") */}
            {pendingFileCount > 0 && selectedTargetId && selectedTargetId !== LOCAL_DEVICE_ID && (
              <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                {pendingFileCount} file{pendingFileCount > 1 ? 's' : ''} queued
              </div>
            )}
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      <div className="px-6 pb-6 space-y-2">
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

      <div className="border-t border-primary/20 px-6 py-4">
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
    </div>
  );
}
