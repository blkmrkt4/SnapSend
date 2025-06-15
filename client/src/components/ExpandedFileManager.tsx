import { useState, useMemo } from 'react';
import { Search, RefreshCw, Trash2, Download, Eye, FileImage, FileText, Clipboard } from 'lucide-react';
import { type File } from '@shared/schema';
import { useFileTransfer } from '@/hooks/useFileTransfer';

interface ExpandedFileManagerProps {
  files: File[];
  onPreviewFile: (file: File) => void;
  onRefresh: () => void;
  onClearAll: () => void;
  onDeleteFile: (fileId: number) => void;
}

export function ExpandedFileManager({ 
  files, 
  onPreviewFile, 
  onRefresh, 
  onClearAll,
  onDeleteFile 
}: ExpandedFileManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const { downloadFile } = useFileTransfer();

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch = searchQuery === '' || 
        file.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (file.content && file.content.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === 'all' || 
        (typeFilter === 'images' && file.mimeType.startsWith('image/')) ||
        (typeFilter === 'documents' && (file.mimeType.includes('pdf') || file.mimeType.includes('document'))) ||
        (typeFilter === 'text' && (file.mimeType.startsWith('text/') || file.isClipboard)) ||
        (typeFilter === 'other' && !file.mimeType.startsWith('image/') && !file.mimeType.includes('pdf') && !file.mimeType.includes('document') && !file.mimeType.startsWith('text/') && !file.isClipboard);

      return matchesSearch && matchesType;
    });
  }, [files, searchQuery, typeFilter, deviceFilter]);

  const getFileIcon = (file: File) => {
    if (file.isClipboard) return Clipboard;
    if (file.mimeType.startsWith('image/')) return FileImage;
    return FileText;
  };

  const getFileIconColor = (file: File) => {
    if (file.isClipboard) return 'text-green-600 bg-green-100';
    if (file.mimeType.startsWith('image/')) return 'text-blue-600 bg-blue-100';
    if (file.mimeType.includes('pdf')) return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  const handleDownload = async (file: File, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await downloadFile(file.id);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const copyToClipboard = async (content: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(content);
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-xl shadow-xl border border-gray-200 max-w-4xl">
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FileText className="text-primary w-5 h-5" />
            <h2 className="text-xl font-semibold text-gray-800">Received Files</h2>
            <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
              {files.length} files
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg"
              onClick={onRefresh}
            >
              <RefreshCw className="text-gray-500 w-4 h-4" />
            </button>
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg"
              onClick={onClearAll}
            >
              <Trash2 className="text-gray-500 w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search files, text content, or device names..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="images">Images</option>
            <option value="documents">Documents</option>
            <option value="text">Text</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="p-6">
        {filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No files found</p>
            {searchQuery && (
              <p className="text-sm text-gray-400 mt-2">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {filteredFiles.map((file) => {
              const IconComponent = getFileIcon(file);
              const iconColorClass = getFileIconColor(file);
              
              return (
                <div
                  key={file.id}
                  className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                  onClick={() => onPreviewFile(file)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColorClass}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Received
                      </span>
                      <button
                        className="p-1 hover:bg-white rounded"
                        onClick={(e) => handleDownload(file, e)}
                        title="Download file"
                      >
                        <Download className="text-gray-400 w-4 h-4" />
                      </button>
                      <button
                        className="p-1 hover:bg-white rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to permanently delete "${file.originalName}"?`)) {
                            onDeleteFile(file.id);
                          }
                        }}
                        title="Delete file permanently"
                      >
                        <Trash2 className="text-red-400 hover:text-red-600 w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {file.isClipboard && file.content ? (
                    <div className="w-full h-32 bg-gradient-to-br from-green-50 to-green-100 rounded-lg mb-3 p-3 overflow-hidden">
                      <p className="text-sm text-gray-600 line-clamp-4">
                        {file.content.length > 100 ? `${file.content.substring(0, 100)}...` : file.content}
                      </p>
                    </div>
                  ) : file.mimeType.startsWith('image/') ? (
                    <div className="w-full h-32 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg mb-3 flex items-center justify-center">
                      <FileImage className="text-blue-300 w-8 h-8" />
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mb-3 flex items-center justify-center">
                      <IconComponent className="text-gray-300 w-8 h-8" />
                    </div>
                  )}

                  <h3 
                    className="font-medium text-gray-800 text-sm mb-1 truncate cursor-pointer hover:text-blue-600 transition-colors"
                    onDoubleClick={() => onPreviewFile(file)}
                    title="Double-click to preview file"
                  >
                    {file.originalName}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>From Device</span>
                    <span>
                      {file.transferredAt 
                        ? new Date(file.transferredAt).toLocaleTimeString()
                        : 'Just now'
                      }
                    </span>
                  </div>

                  {file.isClipboard && file.content && (
                    <button
                      className="mt-2 w-full bg-green-100 text-green-800 py-1.5 px-3 rounded text-xs font-medium hover:bg-green-200 transition-colors"
                      onClick={(e) => copyToClipboard(file.content!, e)}
                    >
                      Copy to Clipboard
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
