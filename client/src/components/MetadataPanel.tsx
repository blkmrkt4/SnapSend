import { type File as FileType, type FileMetadata } from '@shared/schema';
import { FileType as FileTypeIcon, Maximize2 } from 'lucide-react';

interface MetadataPanelProps {
  file: FileType & { fromDevice?: string };
  compact?: boolean; // If true, hide info already shown in the file row
}

export function MetadataPanel({ file, compact = false }: MetadataPanelProps) {
  // Parse metadata from JSON string if present
  let metadata: FileMetadata | null = null;
  if (file.metadata) {
    try {
      metadata = JSON.parse(file.metadata);
    } catch {
      // Ignore parse errors
    }
  }

  // Check if we have any extra info to show
  const hasImageDimensions = metadata?.width && metadata?.height;
  const hasDuration = metadata?.duration;
  const hasPageCount = metadata?.pageCount;
  const hasExtraInfo = hasImageDimensions || hasDuration || hasPageCount || !compact;

  // In compact mode, only show info not already in the row
  if (compact && !hasExtraInfo) {
    return null; // Nothing extra to show
  }

  return (
    <div className="space-y-2 text-sm">
      {(!compact || hasImageDimensions || hasDuration || hasPageCount) && (
        <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          {compact ? 'Additional Info' : 'Details'}
        </h4>
      )}

      {/* Dimensions for images - always show if available */}
      {hasImageDimensions && (
        <div className="flex items-center gap-2">
          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Dimensions</span>
          <span className="ml-auto font-medium">{metadata!.width} x {metadata!.height}</span>
        </div>
      )}

      {/* MIME type - only in non-compact mode */}
      {!compact && (
        <div className="flex items-center gap-2">
          <FileTypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">MIME type</span>
          <span className="ml-auto font-medium font-mono text-xs">{file.mimeType}</span>
        </div>
      )}

      {/* Duration for video/audio - always show if available */}
      {hasDuration && (
        <div className="flex items-center gap-2">
          <span className="w-3.5" />
          <span className="text-muted-foreground">Duration</span>
          <span className="ml-auto font-medium">{Math.floor(metadata!.duration! / 60)}:{String(Math.floor(metadata!.duration! % 60)).padStart(2, '0')}</span>
        </div>
      )}

      {/* Page count for PDFs - always show if available */}
      {hasPageCount && (
        <div className="flex items-center gap-2">
          <span className="w-3.5" />
          <span className="text-muted-foreground">Pages</span>
          <span className="ml-auto font-medium">{metadata!.pageCount}</span>
        </div>
      )}
    </div>
  );
}
