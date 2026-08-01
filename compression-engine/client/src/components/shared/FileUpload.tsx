import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { Accept } from 'react-dropzone';
import { Upload, File as FileIcon, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FileUploadProps {
  onFilesAccepted: (files: File[]) => void | Promise<void>;
  accept?: Accept;
  maxSize?: number;
  maxFiles?: number;
  currentFile?: File | null;
  onRemove?: () => void;
  loading?: boolean;
  progress?: number;
  compact?: boolean;
}

const DEFAULT_ACCEPT: Accept = {
  'text/plain': ['.txt'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/markdown': ['.md'],
  'application/json': ['.json'],
  'text/csv': ['.csv'],
  'text/x-python': ['.py'],
  'text/javascript': ['.js'],
  'text/typescript': ['.ts'],
  'text/x-java': ['.java'],
  'text/x-c++src': ['.cpp'],
};

export function FileUpload({
  onFilesAccepted,
  accept = DEFAULT_ACCEPT,
  maxSize = 10 * 1024 * 1024,
  maxFiles = 1,
  currentFile,
  onRemove,
  loading,
  progress,
  compact = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    setUploading(true);
    try {
      await onFilesAccepted(files);
    } finally {
      setUploading(false);
    }
  }, [onFilesAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
  });

  const isLoading = loading || uploading;

  return (
    <div
      {...getRootProps()}
      className={cn(
        'glass-card border-2 border-dashed cursor-pointer transition-all',
        compact ? 'p-4' : 'p-6',
        isDragActive
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50'
      )}
    >
      <input {...getInputProps()} />

      {currentFile ? (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] flex-shrink-0">
            <FileIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentFile.name}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {(currentFile.size / 1024).toFixed(1)} KB
            </p>
            {progress !== undefined && progress > 0 && progress < 100 && (
              <div className="mt-1 h-1 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--primary))] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
          {onRemove && !isLoading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1.5 hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload
            className={cn(
              compact ? 'w-6 h-6' : 'w-8 h-8',
              isDragActive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'
            )}
          />
          <div>
            <p className="text-sm font-medium">
              {isLoading ? 'Uploading...' : 'Drop file here or click to browse'}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              TXT, PDF, DOCX, MD, JSON, CSV, Python, JS, Java, C++, Logs (max{' '}
              {(maxSize / (1024 * 1024)).toFixed(0)}MB)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
