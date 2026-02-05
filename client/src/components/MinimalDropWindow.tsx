import { useState, useRef, useCallback, useEffect } from 'react';
import { CloudUpload, Clipboard, Camera, Minus, Expand, FileImage, Check, ChevronDown, Monitor, Maximize, Crop } from 'lucide-react';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { MistAnimation } from './MistAnimation';
import { ScreenshotCropper } from './ScreenshotCropper';
import { type File, type Device } from '@shared/schema';
import { type KnownDevice } from '@/hooks/useConnectionSystem';

interface MinimalDropWindowProps {
  onSendFile: (fileData: any) => void;
  recentFiles: File[];
  onToggleExpanded: () => void;
  onMinimize: () => void;
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
  connections,
  onlineDevices,
  knownDevices,
  currentDevice,
  selectedTargetId,
  onSelectTarget,
  pendingFileCount,
}: MinimalDropWindowProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMist, setShowMist] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [screenshotData, setScreenshotData] = useState<{
    dataURL: string;
    width: number;
    height: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { readFileAsText, readFileAsDataURL } = useFileTransfer();

  const selectedTargetName = selectedTargetId
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
    setIsUploading(true);

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
          <CloudUpload className="text-primary-foreground w-5 h-5" />
          <h2 className="text-primary-foreground font-bold">Snap Send</h2>
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
          >
            <Expand className="w-4 h-4" />
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
              {selectedTargetId
                ? selectedTargetName
                : 'All connected devices'}
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

              {/* All connected devices */}
              <button
                onClick={() => { onSelectTarget(null); setDropdownOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  selectedTargetId === null ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
                }`}
              >
                <span className="truncate">All connected devices</span>
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

        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer group ${
            isDragOver
              ? 'border-primary bg-primary/10'
              : 'border-primary/30 hover:border-primary hover:bg-primary/5'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          <MistAnimation
            isVisible={showMist}
            onComplete={() => setShowMist(false)}
          />
          <div className="space-y-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto transition-colors ${
              isDragOver
                ? 'bg-primary/20'
                : 'bg-primary/10 group-hover:bg-primary/20'
            }`}>
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <CloudUpload className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {isUploading
                  ? 'Uploading...'
                  : selectedTargetId
                    ? `Drop files for ${selectedTargetName}`
                    : connections.length > 0
                      ? 'Drop files here'
                      : 'Drop files to queue'}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {connections.length > 0
                  ? 'or press ⌘V to paste clipboard'
                  : selectedTargetId
                    ? 'Files will send when connected'
                    : 'Files will send when a device connects'}
              </p>
            </div>
            {!isUploading && (
              <button className="text-primary text-sm font-semibold hover:text-primary/80 transition-colors">
                Browse files
              </button>
            )}
            {pendingFileCount > 0 && (
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
