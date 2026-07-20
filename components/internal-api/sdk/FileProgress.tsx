/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/FileProgress.tsx
 * Purpose: File generation progress for SDK generation
 * Author: Websmith
 * ---------------------------------------------------------
 */

'use client';

import { FileProgress as FileProgressType } from './types';
import { DEBUG_SDK_PROGRESS } from './constants';

interface FileProgressProps {
  files: FileProgressType[];
  currentFile?: string;
  totalFiles?: number;
  completedFiles?: number;
  className?: string;
}

export function FileProgress({
  files,
  currentFile,
  totalFiles,
  completedFiles,
  className = '',
}: FileProgressProps) {
  // Only show in debug mode or if files exist
  if (!DEBUG_SDK_PROGRESS && files.length === 0 && !currentFile) {
    return null;
  }

  const displayFiles = files.slice(0, 20);

  // Get status icon
  const getStatusIcon = (status: FileProgressType['status']): string => {
    switch (status) {
      case 'completed': return '✓';
      case 'generating': return '⏳';
      case 'failed': return '✗';
      default: return '○';
    }
  };

  // Get status color
  const getStatusColor = (status: FileProgressType['status']): string => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'generating': return 'text-blue-500 animate-pulse';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const hasFiles = files.length > 0 || completedFiles !== undefined;

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium text-[var(--text-secondary)]">Files</span>
        {totalFiles !== undefined && completedFiles !== undefined && (
          <span className="text-xs text-[var(--text-secondary)]/50 font-mono">
            {completedFiles} / {totalFiles}
          </span>
        )}
        {currentFile && (
          <span className="text-xs text-[var(--text-secondary)]/50 truncate max-w-[200px]">
            {currentFile}
          </span>
        )}
      </div>

      {/* Progress Bar for files */}
      {totalFiles !== undefined && completedFiles !== undefined && totalFiles > 0 && (
        <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${(completedFiles / totalFiles) * 100}%` }}
          />
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)] scrollbar-track-transparent">
          {displayFiles.map((file, index) => (
            <div
              key={index}
              className={`flex items-center gap-1.5 text-xs ${getStatusColor(file.status)}`}
            >
              <span className="w-4 text-center">{getStatusIcon(file.status)}</span>
              <span className="truncate font-mono">
                {file.name}
                {file.size && (
                  <span className="text-[10px] text-[var(--text-secondary)]/30 ml-1">
                    ({(file.size / 1024).toFixed(1)}KB)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* More files indicator */}
      {files.length > 20 && (
        <div className="mt-1 text-[10px] text-[var(--text-secondary)]/30 text-center">
          + {files.length - 20} more files
        </div>
      )}

      {/* No files state */}
      {!hasFiles && (
        <div className="text-sm text-[var(--text-secondary)]/50 italic">
          No file progress available yet.
        </div>
      )}
    </div>
  );
}