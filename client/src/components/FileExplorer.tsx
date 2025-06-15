import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  File, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  Code,
  Download,
  Eye,
  Trash2,
  Clock,
  User,
  RefreshCw
} from 'lucide-react';
import { type File as FileType } from '@shared/schema';

interface ExtendedFile extends FileType {
  transferType?: 'sent' | 'received';
  fromDevice?: string;
}

interface FileExplorerProps {
  files: ExtendedFile[];
  onPreviewFile: (file: ExtendedFile) => void;
  onRefresh: () => void;
  onClearAll: () => void;
  currentDevice: any;
}

export function FileExplorer({ 
  files, 
  onPreviewFile, 
  onRefresh, 
  onClearAll,
  currentDevice 
}: FileExplorerProps) {
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'type'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'sent' | 'received'>('all');

  const getFileIcon = (file: ExtendedFile) => {
    const mimeType = file.mimeType.toLowerCase();
    const size = "h-5 w-5";
    
    if (mimeType.startsWith('image/')) return <Image className={size} />;
    if (mimeType.startsWith('video/')) return <Video className={size} />;
    if (mimeType.startsWith('audio/')) return <Music className={size} />;
    if (mimeType.includes('pdf')) return <FileText className={size} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return <Archive className={size} />;
    if (mimeType.includes('javascript') || mimeType.includes('html') || mimeType.includes('css')) return <Code className={size} />;
    return <File className={size} />;
  };

  const getFileTypeColor = (file: ExtendedFile) => {
    return file.transferType === 'sent' 
      ? 'text-red-600 dark:text-red-400' 
      : 'text-green-600 dark:text-green-400';
  };

  const getFileBorderColor = (file: ExtendedFile) => {
    return file.transferType === 'sent' 
      ? 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20' 
      : 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  const handleDoubleClick = async (file: ExtendedFile) => {
    try {
      if (file.content) {
        // For files with content (text, clipboard, small images)
        if (file.mimeType.startsWith('image/') && file.content.startsWith('data:')) {
          // Open image in new tab
          const newWindow = window.open();
          if (newWindow) {
            newWindow.document.write(`
              <html>
                <head><title>${file.originalName}</title></head>
                <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0;">
                  <img src="${file.content}" alt="${file.originalName}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                </body>
              </html>
            `);
          }
        } else if (file.mimeType.startsWith('text/') || file.isClipboard) {
          // Open text content in new tab
          const newWindow = window.open();
          if (newWindow) {
            newWindow.document.write(`<html><head><title>${file.originalName}</title></head><body style="margin:20px;font-family:monospace;white-space:pre-wrap;">${file.content}</body></html>`);
          }
        }
      } else {
        // For files without content, try to download them
        const response = await fetch(`/api/files/${file.id}/download`);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.originalName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const sortedAndFilteredFiles = files
    .filter(file => {
      if (filterBy === 'all') return true;
      return file.transferType === filterBy;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.originalName.localeCompare(b.originalName);
        case 'type':
          return a.mimeType.localeCompare(b.mimeType);
        case 'date':
        default:
          return new Date(b.transferredAt || 0).getTime() - 
                 new Date(a.transferredAt || 0).getTime();
      }
    });

  return (
    <Card className="h-full border-primary/20 shadow-lg w-full">
      <CardHeader className="bg-gradient-to-r from-secondary to-secondary/90 text-secondary-foreground">
        {/* Title Bar - Line 1 */}
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-secondary-foreground">
            Shared Files <span className="text-sm font-normal text-secondary-foreground/70">({files.length})</span>
          </CardTitle>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10 shadow-sm bg-white/10"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              className="border-red-300 text-red-600 hover:bg-red-50 shadow-sm bg-white/20"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
        
        {/* Title Bar - Line 2 - Filters */}
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-secondary-foreground">Filter:</span>
            <select 
              value={filterBy} 
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="text-sm border border-secondary-foreground/30 rounded px-3 py-1 bg-white/90 focus:border-secondary-foreground focus:bg-white shadow-sm"
            >
              <option value="all">All Files</option>
              <option value="sent">Sent Files</option>
              <option value="received">Received Files</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-secondary-foreground">Sort by:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border border-secondary-foreground/30 rounded px-3 py-1 bg-white/90 focus:border-secondary-foreground focus:bg-white shadow-sm"
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="type">Type</option>
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedAndFilteredFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No files to display</p>
              <p className="text-sm">Files you send and receive will appear here</p>
            </div>
          ) : (
            sortedAndFilteredFiles.map((file) => (
              <div
                key={file.id}
                className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getFileBorderColor(file)}`}
                onDoubleClick={() => handleDoubleClick(file)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={getFileTypeColor(file)}>
                      {getFileIcon(file)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{file.originalName}</h4>
                        <Badge 
                          variant={file.transferType === 'sent' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {file.transferType === 'sent' ? 'Sent' : 'Received'}
                        </Badge>
                        {file.isClipboard === 1 && (
                          <Badge variant="outline" className="text-xs">
                            Clipboard
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(file.transferredAt || new Date())}
                        </span>
                        
                        <span>{formatFileSize(file.size)}</span>
                        
                        <span className="capitalize">
                          {file.mimeType.split('/')[0]} file
                        </span>
                        
                        {file.transferType === 'received' && file.fromDevice && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            from {file.fromDevice}
                          </span>
                        )}
                        
                        {file.transferType === 'sent' && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            sent by {currentDevice?.nickname || 'you'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewFile(file);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDoubleClick(file);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}