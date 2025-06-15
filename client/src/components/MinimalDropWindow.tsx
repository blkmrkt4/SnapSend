import { useState, useRef, useCallback } from 'react';
import { CloudUpload, Clipboard, Camera, Minus, Expand, FileImage, Check } from 'lucide-react';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { MistAnimation } from './MistAnimation';
import { type File } from '@shared/schema';

interface MinimalDropWindowProps {
  onSendFile: (fileData: any) => void;
  recentFiles: File[];
  onToggleExpanded: () => void;
  onMinimize: () => void;
  hasConnections: boolean;
}

export function MinimalDropWindow({ 
  onSendFile, 
  recentFiles, 
  onToggleExpanded, 
  onMinimize,
  hasConnections 
}: MinimalDropWindowProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMist, setShowMist] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { readFileAsText, readFileAsDataURL } = useFileTransfer();

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

  const handleScreenshot = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        video.addEventListener('loadedmetadata', () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0);
          
          // Convert canvas to base64 data URL
          const dataURL = canvas.toDataURL('image/png');
          const filename = `screenshot-${Date.now()}.png`;
          
          // Calculate approximate size from base64 string
          const base64Length = dataURL.split(',')[1].length;
          const sizeInBytes = Math.round(base64Length * 0.75);
          
          // Use setTimeout to avoid async in event listener
          setTimeout(async () => {
            await onSendFile({
              filename,
              originalName: filename,
              mimeType: 'image/png',
              size: sizeInBytes,
              content: dataURL,
              isClipboard: false,
            });
          }, 0);

          stream.getTracks().forEach(track => track.stop());
        });
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
    }
  }, [onSendFile]);

  return (
    <div className="w-80 bg-white rounded-xl shadow-2xl border border-primary/30 overflow-hidden">
      <div className="bg-gradient-to-r from-primary to-secondary px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CloudUpload className="text-primary-foreground w-5 h-5" />
          <h2 className="text-primary-foreground font-bold">QuickDrop - Send</h2>
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
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
            hasConnections ? 'cursor-pointer group' : 'cursor-not-allowed'
          } ${
            isDragOver && hasConnections
              ? 'border-primary bg-primary/10' 
              : hasConnections
              ? 'border-primary/30 hover:border-primary hover:bg-primary/5'
              : 'border-muted-foreground/30 bg-muted/20'
          }`}
          onDragOver={hasConnections ? handleDragOver : undefined}
          onDragLeave={hasConnections ? handleDragLeave : undefined}
          onDrop={hasConnections ? handleDrop : undefined}
          onClick={hasConnections ? handleFileSelect : undefined}
        >
          <div className="space-y-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto transition-colors ${
              !hasConnections
                ? 'bg-muted/30'
                : isDragOver 
                ? 'bg-primary/20' 
                : 'bg-primary/10 group-hover:bg-primary/20'
            }`}>
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <CloudUpload className={`w-6 h-6 ${hasConnections ? 'text-primary' : 'text-muted-foreground'}`} />
              )}
            </div>
            <div>
              <p className={`font-semibold ${hasConnections ? 'text-foreground' : 'text-muted-foreground'}`}>
                {isUploading ? 'Uploading...' : hasConnections ? 'Drop files here' : 'No Live Connections'}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hasConnections ? 'or paste from clipboard' : 'Connect to a device first'}
              </p>
            </div>
            {!isUploading && hasConnections && (
              <button className="text-primary text-sm font-semibold hover:text-primary/80 transition-colors">
                Browse files
              </button>
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

      <div className="px-6 pb-6">
        <div className="flex space-x-2">
          <button 
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors shadow-sm border ${
              hasConnections 
                ? 'bg-accent hover:bg-accent/80 text-foreground border-primary/20' 
                : 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
            }`}
            onClick={hasConnections ? handlePasteFromClipboard : undefined}
            disabled={!hasConnections}
          >
            <Clipboard className="w-4 h-4 mr-2 inline" />Clipboard
          </button>
          <button 
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
              hasConnections 
                ? 'bg-secondary hover:bg-secondary/90 text-secondary-foreground' 
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
            onClick={hasConnections ? handleScreenshot : undefined}
            disabled={!hasConnections}
          >
            <Camera className="w-4 h-4 mr-2 inline" />Screenshot
          </button>
        </div>
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
    </div>
  );
}
