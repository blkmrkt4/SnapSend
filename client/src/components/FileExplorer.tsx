import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
// Using simple state-based expand/collapse instead of Radix Collapsible for compatibility
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Code,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  User,
  RefreshCw,
  Search,
  X,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Pencil,
  Tag
} from 'lucide-react';
import { type File as FileType } from '@shared/schema';
import { MetadataPanel } from './MetadataPanel';
import { TagEditor } from './TagEditor';

interface ExtendedFile extends FileType {
  transferType?: 'sent' | 'received' | 'queued';
  fromDevice?: string;
}

interface FileExplorerProps {
  files: ExtendedFile[];
  onPreviewFile: (file: ExtendedFile) => void;
  onRefresh: () => void;
  onClearAll: () => void;
  onDeleteFile: (fileId: number) => void;
  onRenameFile: (fileId: number, newName: string) => void;
  onUpdateTags: (fileId: number, tags: string[]) => void;
  onAddTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
  allTags: string[];
  currentDevice: any;
}

type DirectionFilter = 'all' | 'received' | 'sent' | 'pending';
type TypeFilter = 'all' | 'clipboard' | 'screenshot' | 'image' | 'pdf' | 'excel' | 'docx' | 'ppt' | 'document' | 'file';

export function FileExplorer({
  files,
  onPreviewFile,
  onRefresh,
  onClearAll,
  onDeleteFile,
  onRenameFile,
  onUpdateTags,
  onAddTag,
  onDeleteTag,
  allTags,
  currentDevice
}: FileExplorerProps) {
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'type'>('date');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [editingFileId, setEditingFileId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedFileIds, setExpandedFileIds] = useState<Set<number>>(new Set());
  const editInputRef = useRef<HTMLInputElement>(null);
  const editingNameRef = useRef('');

  function splitFilename(name: string): { stem: string; ext: string } {
    const lastDot = name.lastIndexOf('.');
    if (lastDot <= 0) return { stem: name, ext: '' };
    return { stem: name.substring(0, lastDot), ext: name.substring(lastDot) };
  }

  const startEditing = (file: ExtendedFile) => {
    const { stem } = splitFilename(file.originalName);
    setEditingFileId(file.id);
    setEditingName(stem);
    editingNameRef.current = stem;
  };

  const setEditingNameTracked = (value: string) => {
    setEditingName(value);
    editingNameRef.current = value;
  };

  const commitRename = (file: ExtendedFile) => {
    const { ext } = splitFilename(file.originalName);
    const trimmed = editingNameRef.current.trim();
    if (trimmed && trimmed + ext !== file.originalName) {
      onRenameFile(file.id, trimmed + ext);
    }
    setEditingFileId(null);
  };

  const cancelEditing = () => {
    setEditingFileId(null);
  };

  const toggleExpanded = (fileId: number) => {
    setExpandedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const parseFileTags = (file: ExtendedFile): string[] => {
    if (!file.tags) return [];
    try {
      const parsed = JSON.parse(file.tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (editingFileId !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingFileId]);

  const hasActiveFilters = directionFilter !== 'all' || typeFilter !== 'all' || tagFilter !== '' || searchQuery.trim() !== '' || dateRange.from !== undefined;

  const clearAllFilters = () => {
    setDirectionFilter('all');
    setTypeFilter('all');
    setTagFilter('');
    setSearchQuery('');
    setDateRange({ from: undefined, to: undefined });
  };

  const getFileLabel = (file: ExtendedFile): string => {
    const mime = file.mimeType.toLowerCase();
    const name = file.originalName.toLowerCase();

    if (file.isClipboard === 1) return 'Clipboard';
    if (name.startsWith('screenshot') && mime.startsWith('image/')) return 'Screenshot';
    if (mime.startsWith('image/')) return 'Image';
    if (mime.startsWith('video/')) return 'Video';
    if (mime.startsWith('audio/')) return 'Audio';
    if (mime.includes('pdf')) return 'PDF';
    if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xlsx|xls|csv)$/.test(name)) return 'Spreadsheet';
    if (mime.includes('wordprocessing') || mime.includes('msword') || /\.(docx|doc)$/.test(name)) return 'Document';
    if (mime.includes('presentation') || mime.includes('powerpoint') || /\.(pptx|ppt)$/.test(name)) return 'Presentation';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive') || /\.(zip|rar|7z|tar|gz)$/.test(name)) return 'Archive';
    if (mime.includes('javascript') || mime.includes('html') || mime.includes('css') || mime.includes('json')) return 'Code';
    if (mime.startsWith('text/')) return 'Text';
    return 'File';
  };

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
    if (file.transferType === 'queued') return 'text-amber-600 dark:text-amber-400';
    if (file.transferType === 'sent') return 'text-red-600 dark:text-red-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getFileBorderColor = (file: ExtendedFile) => {
    if (file.transferType === 'queued') return 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20';
    if (file.transferType === 'sent') return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20';
    return 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20';
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

  const isPreviewable = (file: ExtendedFile) => {
    if (file.isClipboard && file.content) return true;
    if (file.mimeType.startsWith('image/') && file.content?.startsWith('data:')) return true;
    if (file.mimeType.startsWith('text/') && file.content) return true;
    return false;
  };

  const handleDownload = async (file: ExtendedFile) => {
    try {
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
      const response = await fetch(`/api/files/${file.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.originalName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleOpenInNewTab = async (file: ExtendedFile) => {
    try {
      if (file.content) {
        if (file.mimeType.startsWith('image/') && file.content.startsWith('data:')) {
          const w = window.open();
          if (w) {
            w.document.write(`<html><head><title>${file.originalName}</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0;"><img src="${file.content}" alt="${file.originalName}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body></html>`);
          }
        } else if (file.mimeType.startsWith('text/') || file.isClipboard) {
          const w = window.open();
          if (w) {
            w.document.write(`<html><head><title>${file.originalName}</title></head><body style="margin:20px;font-family:monospace;white-space:pre-wrap;">${file.content}</body></html>`);
          }
        } else if (file.content.startsWith('data:')) {
          const res = await fetch(file.content);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }
        return;
      }
      const response = await fetch(`/api/files/${file.id}/download`);
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: file.mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        if (file.mimeType.startsWith('image/')) {
          const w = window.open();
          if (w) {
            w.document.write(`<html><head><title>${file.originalName}</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0;"><img src="${url}" alt="${file.originalName}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body></html>`);
          }
        } else {
          window.open(url, '_blank');
        }
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  // --- Filter pipeline ---
  const filteredFiles = files
    // Direction filter
    .filter(file => {
      if (directionFilter === 'all') return true;
      if (directionFilter === 'pending') return file.transferType === 'queued';
      return file.transferType === directionFilter;
    })
    // Type filter
    .filter(file => {
      if (typeFilter === 'all') return true;
      const mime = file.mimeType.toLowerCase();
      const name = file.originalName.toLowerCase();
      switch (typeFilter) {
        case 'clipboard':
          return file.isClipboard === 1;
        case 'screenshot':
          return name.startsWith('screenshot') && mime.startsWith('image/');
        case 'image':
          return mime.startsWith('image/');
        case 'pdf':
          return mime.includes('pdf');
        case 'excel':
          return mime.includes('spreadsheet') || mime.includes('excel') || /\.(xlsx|xls|csv)$/.test(name);
        case 'docx':
          return mime.includes('wordprocessing') || mime.includes('msword') || /\.(docx|doc)$/.test(name);
        case 'ppt':
          return mime.includes('presentation') || mime.includes('powerpoint') || /\.(pptx|ppt)$/.test(name);
        case 'document':
          return (mime.startsWith('text/') || mime.includes('document'))
            && !mime.includes('pdf')
            && !mime.includes('spreadsheet') && !mime.includes('excel')
            && !mime.includes('wordprocessing') && !mime.includes('msword')
            && !mime.includes('presentation') && !mime.includes('powerpoint');
        case 'file': {
          const isImage = mime.startsWith('image/');
          const isClipboard = file.isClipboard === 1;
          const isPdf = mime.includes('pdf');
          const isExcel = mime.includes('spreadsheet') || mime.includes('excel') || /\.(xlsx|xls|csv)$/.test(name);
          const isDocx = mime.includes('wordprocessing') || mime.includes('msword') || /\.(docx|doc)$/.test(name);
          const isPpt = mime.includes('presentation') || mime.includes('powerpoint') || /\.(pptx|ppt)$/.test(name);
          const isDocument = (mime.startsWith('text/') || mime.includes('document'))
            && !isPdf && !isExcel && !isDocx && !isPpt;
          return !isImage && !isClipboard && !isPdf && !isExcel && !isDocx && !isPpt && !isDocument;
        }
        default:
          return true;
      }
    })
    // Search filter
    .filter(file => {
      if (!searchQuery.trim()) return true;
      return file.originalName.toLowerCase().includes(searchQuery.trim().toLowerCase());
    })
    // Tag filter
    .filter(file => {
      if (!tagFilter) return true;
      const fileTags = parseFileTags(file);
      return fileTags.includes(tagFilter);
    })
    // Date filter
    .filter(file => {
      if (!dateRange.from) return true;
      const fileDate = new Date(file.transferredAt || 0);
      const from = startOfDay(dateRange.from);
      if (dateRange.to) {
        const to = endOfDay(dateRange.to);
        return fileDate >= from && fileDate <= to;
      }
      return fileDate >= from && fileDate <= endOfDay(dateRange.from);
    })
    // Sort
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

  const filteredCount = filteredFiles.length;
  const totalCount = files.length;

  const dateRangeLabel = dateRange.from
    ? dateRange.to
      ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`
      : format(dateRange.from, 'MMM d')
    : null;

  const applyPreset = (from: Date, to: Date) => {
    setDateRange({ from, to });
    setDatePopoverOpen(false);
  };

  return (
    <Card className="h-full border-primary/20 shadow-lg w-full">
      <CardHeader
        className="text-secondary-foreground"
        style={{
          background: 'linear-gradient(to right, var(--secondary), color-mix(in srgb, var(--secondary) 60%, white))',
        }}
      >
        {/* Row 1: Title + actions */}
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-secondary-foreground flex items-center gap-2">
            Shared Files{' '}
            <span className="text-sm font-normal text-secondary-foreground/70">
              {hasActiveFilters ? `(${filteredCount}/${totalCount})` : `(${totalCount})`}
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-normal text-secondary-foreground/60 hover:text-secondary-foreground underline ml-1"
              >
                Clear all filters
              </button>
            )}
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

        {/* Row 2: Search + Date + Sort */}
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="pl-8 pr-8 h-8 text-sm bg-white/10 border-secondary-foreground/30 text-secondary-foreground placeholder:text-secondary-foreground/40 focus-visible:ring-secondary-foreground/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-foreground/50 hover:text-secondary-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Date popover */}
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  dateRange.from
                    ? "border border-solid border-secondary-foreground/50 bg-white/20 text-secondary-foreground"
                    : "border border-dashed border-secondary-foreground/30 bg-white/5 text-secondary-foreground/70 hover:bg-white/10"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {dateRangeLabel || 'Date'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset(startOfDay(new Date()), new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset(startOfDay(subDays(new Date(), 1)), endOfDay(subDays(new Date(), 1)))}>
                  Yesterday
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset(startOfDay(subDays(new Date(), 6)), new Date())}>
                  Last 7 Days
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset(startOfDay(subDays(new Date(), 29)), new Date())}>
                  Last 30 Days
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset(startOfMonth(new Date()), new Date())}>
                  This Month
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setDateRange({ from: undefined, to: undefined }); setDatePopoverOpen(false); }}>
                  All Time
                </Button>
              </div>
              <Separator className="mb-3" />
              <Calendar
                mode="range"
                selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } as DateRange : undefined}
                onSelect={(range: DateRange | undefined) => setDateRange({ from: range?.from, to: range?.to })}
                numberOfMonths={1}
                initialFocus
              />
              <Separator className="my-3" />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setDateRange({ from: undefined, to: undefined })}
                >
                  Clear
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-medium text-secondary-foreground/70">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs border border-secondary-foreground/30 rounded px-2 py-1 bg-white/90 text-gray-800 focus:border-secondary-foreground focus:bg-white shadow-sm"
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="type">Type</option>
            </select>
          </div>
        </div>

        {/* Row 3: Direction filter */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs font-medium text-secondary-foreground/70 w-16 shrink-0">Direction:</span>
          <div className="flex rounded-md overflow-hidden border border-secondary-foreground/30">
            {(['all', 'received', 'sent', 'pending'] as const).map((value) => {
              const labels: Record<DirectionFilter, string> = { all: 'All', received: 'Received', sent: 'Sent', pending: 'Pending' };
              const isActive = directionFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setDirectionFilter(value)}
                  className={`px-3 py-1 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-white text-secondary'
                      : 'bg-white/10 text-secondary-foreground/80 hover:bg-white/20'
                  }`}
                >
                  {labels[value]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 4: Type filter */}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs font-medium text-secondary-foreground/70 w-16 shrink-0">Type:</span>
          <div className="flex rounded-md overflow-hidden border border-secondary-foreground/30 flex-wrap">
            {(['all', 'clipboard', 'screenshot', 'image', 'pdf', 'excel', 'docx', 'ppt', 'document', 'file'] as const).map((value) => {
              const labels: Record<TypeFilter, string> = {
                all: 'All', clipboard: 'Clipboard', screenshot: 'Screenshot', image: 'Image',
                pdf: 'PDF', excel: 'Excel', docx: 'DOCX', ppt: 'PPT', document: 'Document', file: 'File'
              };
              const isActive = typeFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setTypeFilter(value)}
                  className={`px-3 py-1 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-white text-secondary'
                      : 'bg-white/10 text-secondary-foreground/80 hover:bg-white/20'
                  }`}
                >
                  {labels[value]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 5: Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-medium text-secondary-foreground/70 w-16 shrink-0">Tag:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setTagFilter('')}
                className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors ${
                  tagFilter === ''
                    ? 'bg-white text-secondary border-white'
                    : 'bg-white/10 text-secondary-foreground/80 border-secondary-foreground/30 hover:bg-white/20'
                }`}
              >
                All
              </button>
              {allTags.slice(0, 8).map(tag => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors ${
                    tagFilter === tag
                      ? 'bg-white text-secondary border-white'
                      : 'bg-white/10 text-secondary-foreground/80 border-secondary-foreground/30 hover:bg-white/20'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {allTags.length > 8 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="px-3 py-1 text-xs font-semibold rounded-md border border-dashed border-secondary-foreground/30 bg-white/5 text-secondary-foreground/70 hover:bg-white/10 transition-colors">
                      +{allTags.length - 8} more
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {allTags.slice(8).map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            setTagFilter(tag);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors ${
                            tagFilter === tag ? 'bg-accent font-medium' : ''
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No files to display</p>
              <p className="text-sm">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Files you send and receive will appear here'}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isExpanded = expandedFileIds.has(file.id);
              const fileTags = parseFileTags(file);

              return (
                <div
                  key={file.id}
                  className={`rounded-lg border transition-all ${getFileBorderColor(file)} ${isExpanded ? 'shadow-md' : 'hover:shadow-md'}`}
                >
                  {/* Main row content */}
                  <div
                    className="p-3 cursor-pointer"
                    onDoubleClick={() => handleOpenInNewTab(file)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">

                          <div className={getFileTypeColor(file)}>
                            {getFileIcon(file)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {editingFileId === file.id ? (
                                <span className="flex items-center gap-0 min-w-0">
                                  <input
                                    ref={editInputRef}
                                    value={editingName}
                                    onChange={(e) => setEditingNameTracked(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') commitRename(file);
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                    onBlur={() => commitRename(file)}
                                    className="font-medium bg-background border border-input rounded px-1 py-0 text-sm min-w-[60px] max-w-[200px] focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                  {splitFilename(file.originalName).ext && (
                                    <span className="text-sm text-muted-foreground">{splitFilename(file.originalName).ext}</span>
                                  )}
                                </span>
                              ) : (
                                <h4
                                  className="font-medium truncate cursor-text hover:underline decoration-dotted"
                                  onClick={(e) => { e.stopPropagation(); startEditing(file); }}
                                >
                                  {file.originalName}
                                </h4>
                              )}
                              <Badge
                                variant={file.transferType === 'queued' ? 'outline' : file.transferType === 'sent' ? 'destructive' : 'secondary'}
                                className={`text-xs ${file.transferType === 'queued' ? 'border-amber-400 text-amber-700 bg-amber-50' : ''}`}
                              >
                                {file.transferType === 'queued' ? 'Queued' : file.transferType === 'sent' ? 'Sent' : 'Received'}
                              </Badge>
                              {file.isClipboard === 1 && (
                                <Badge variant="outline" className="text-xs">
                                  Clipboard
                                </Badge>
                              )}
                              {/* Inline tag badges */}
                              {fileTags.slice(0, 3).map(tag => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs bg-primary/5 border-primary/20 text-primary"
                                >
                                  <Tag className="h-2.5 w-2.5 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                              {fileTags.length > 3 && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  +{fileTags.length - 3} more
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(file.transferredAt || new Date())}
                              </span>

                              <span>{formatFileSize(file.size)}</span>

                              <span>{getFileLabel(file)}</span>

                              {file.transferType === 'received' && file.fromDevice && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  from {file.fromDevice}
                                </span>
                              )}

                              {file.transferType === 'queued' && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <User className="h-3 w-3" />
                                  {file.toDeviceName ? `for ${file.toDeviceName}` : 'waiting for connection'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-4">
                          {/* Expand/collapse toggle - next to eye icon */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(file.id);
                            }}
                            title={isExpanded ? "Hide details" : "Show details & tags"}
                            className={isExpanded ? "bg-primary/10" : ""}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPreviewFile(file);
                            }}
                            title={isPreviewable(file) ? "Preview file" : "No preview available"}
                          >
                            {isPreviewable(file) ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-red-400" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInNewTab(file);
                            }}
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(file);
                            }}
                            title="Rename file"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteFile(file.id);
                            }}
                            title="Delete file permanently"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                  {/* Expanded content: Tags first (prominent), then additional metadata */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0">
                      <Separator className="mb-3" />
                      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                        {/* Tags section - prominent at top */}
                        <TagEditor
                          tags={fileTags}
                          allTags={allTags}
                          onTagsChange={(newTags) => onUpdateTags(file.id, newTags)}
                          onAddTag={onAddTag}
                          onDeleteTag={onDeleteTag}
                        />
                        {/* Additional metadata - only show info not already visible in row */}
                        <MetadataPanel file={file} compact />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
