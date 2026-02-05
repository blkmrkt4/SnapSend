import { X, Download, FileImage, FileText, Clipboard, EyeOff } from 'lucide-react';
import { type File } from '@shared/schema';
import { useFileTransfer } from '@/hooks/useFileTransfer';

interface FilePreviewModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FilePreviewModal({ file, isOpen, onClose }: FilePreviewModalProps) {
  const { downloadFile } = useFileTransfer();

  if (!isOpen || !file) return null;

  const handleDownload = async () => {
    try {
      // If we have content in memory (queued files or small transfers), use it directly
      if (file.content) {
        let blob: Blob;
        if (file.content.startsWith('data:')) {
          const res = await fetch(file.content);
          blob = await res.blob();
        } else {
          blob = new Blob([file.content], { type: file.mimeType });
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.originalName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return;
      }
      await downloadFile(file.id);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const getFileIcon = () => {
    if (file.isClipboard) return Clipboard;
    if (file.mimeType.startsWith('image/')) return FileImage;
    return FileText;
  };

  const getIconColor = () => {
    if (file.isClipboard) return 'text-green-600 bg-green-100';
    if (file.mimeType.startsWith('image/')) return 'text-blue-600 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const IconComponent = getFileIcon();
  const iconColorClass = getIconColor();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColorClass}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{file.originalName}</h3>
              <p className="text-sm text-gray-500">
                {formatFileSize(file.size)} • Received {file.transferredAt ? new Date(file.transferredAt).toLocaleString() : 'just now'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={handleDownload}
            >
              <Download className="text-gray-600 w-5 h-5" />
            </button>
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={onClose}
            >
              <X className="text-gray-600 w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {file.isClipboard && file.content ? (
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Clipboard Content</h4>
              <div className="bg-white rounded border p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {file.content}
                </pre>
              </div>
              <div className="mt-4 flex space-x-2">
                <button
                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  onClick={async () => {
                    try {
                      if (navigator.clipboard) {
                        await navigator.clipboard.writeText(file.content!);
                      }
                    } catch (error) {
                      console.error('Error copying to clipboard:', error);
                    }
                  }}
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          ) : file.mimeType.startsWith('image/') && file.content?.startsWith('data:') ? (
            <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4">
              <img
                src={file.content}
                alt={file.originalName}
                className="max-w-full max-h-[60vh] object-contain rounded"
              />
            </div>
          ) : file.mimeType.startsWith('image/') ? (
            <div className="flex items-center justify-center bg-gray-50 rounded-lg min-h-[400px]">
              <div className="text-center">
                <EyeOff className="w-16 h-16 text-red-300 mx-auto mb-4" />
                <p className="text-gray-500">Image preview not available</p>
                <p className="text-sm text-gray-400 mt-2">
                  Use the download button to view the image
                </p>
              </div>
            </div>
          ) : file.mimeType.startsWith('text/') && file.content ? (
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">File Content</h4>
              <div className="bg-white rounded border p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-800">
                  {file.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center bg-gray-50 rounded-lg min-h-[400px]">
              <div className="text-center">
                <EyeOff className="w-16 h-16 text-red-300 mx-auto mb-4" />
                <p className="text-gray-500">Preview not available for this file type</p>
                <p className="text-sm text-gray-400 mt-2">
                  Use the download button to access the file
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
