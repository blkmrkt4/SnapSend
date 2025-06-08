import { useState, useRef, useCallback } from 'react';
import { CloudUpload, Clipboard, Camera, Minus, Expand, FileImage, Check } from 'lucide-react';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { type File } from '@shared/schema';

interface MinimalDropWindowProps {
  onSendFile: (fileData: any) => void;
  recentFiles: File[];
  onToggleExpanded: () => void;
  onMinimize: () => void;
}

export function MinimalDropWindow({ 
  onSendFile, 
  recentFiles, 
  onToggleExpanded, 
  onMinimize 
}: MinimalDropWindowProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
    }
  }, [onSendFile, readFileAsText]);

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
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onSendFile, readFileAsText]);

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
          
          canvas.toBlob(async (blob) => {
            if (blob) {
              const filename = `screenshot-${Date.now()}.png`;
              await onSendFile({
                filename,
                originalName: filename,
                mimeType: 'image/png',
                size: blob.size,
                isClipboard: false,
              });
            }
          }, 'image/png');

          stream.getTracks().forEach(track => track.stop());
        });
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
    }
  }, [onSendFile]);

  return (
    <div className="w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-primary to-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CloudUpload className="text-white w-4 h-4" />
          <h2 className="text-white font-semibold text-sm">QuickDrop - Send</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            className="text-white/80 hover:text-white p-1 rounded"
            onClick={onMinimize}
          >
            <Minus className="w-3 h-3" />
          </button>
          <button 
            className="text-white/80 hover:text-white p-1 rounded"
            onClick={onToggleExpanded}
          >
            <Expand className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer group ${
            isDragOver 
              ? 'border-primary bg-blue-50' 
              : 'border-gray-300 hover:border-primary hover:bg-blue-50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          <div className="space-y-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto transition-colors ${
              isDragOver 
                ? 'bg-primary/20' 
                : 'bg-primary/10 group-hover:bg-primary/20'
            }`}>
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <CloudUpload className="text-primary w-6 h-6" />
              )}
            </div>
            <div>
              <p className="text-gray-700 font-medium">
                {isUploading ? 'Uploading...' : 'Drop files here'}
              </p>
              <p className="text-gray-500 text-sm mt-1">or paste from clipboard</p>
            </div>
            {!isUploading && (
              <button className="text-primary text-sm font-medium hover:text-blue-700 transition-colors">
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
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
            onClick={handlePasteFromClipboard}
          >
            <Clipboard className="w-4 h-4 mr-2 inline" />Clipboard
          </button>
          <button 
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
            onClick={handleScreenshot}
          >
            <Camera className="w-4 h-4 mr-2 inline" />Screenshot
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 px-6 py-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent</h3>
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
