/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/SuccessActions.tsx
 * Purpose: Success actions for SDK generation
 * Author: Websmith
 * ---------------------------------------------------------
 */

'use client';

import { Download, FolderOpen, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface SuccessActionsProps {
  downloadUrl: string;
  filename: string;
  productName?: string;
  className?: string;
  onDownload?: () => void;
}

export function SuccessActions({
  downloadUrl,
  filename,
  productName,
  className = '',
  onDownload,
}: SuccessActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPath = () => {
    const path = `${filename}`;
    navigator.clipboard.writeText(path).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (onDownload) onDownload();
    window.open(downloadUrl, '_blank');
  };

  // Open folder is not possible in browser, so we show copy path
  const handleOpenFolder = () => {
    handleCopyPath();
  };

  return (
    <div className={`${className}`}>
      <div className="flex flex-col gap-2">
        {/* Success Message */}
        <div className="text-center">
          <p className="text-sm text-green-500 font-medium">
            SDK Generated Successfully
          </p>
          {productName && (
            <p className="text-xs text-[var(--text-secondary)]/50 mt-0.5">
              {productName}
            </p>
          )}
        </div>

        {/* File Info */}
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-[var(--text-secondary)]/50 bg-[var(--bg-tertiary)]/30 rounded-lg px-3 py-1.5">
          <span className="truncate max-w-[200px]">{filename}</span>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {/* Download ZIP */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download ZIP
          </button>

          {/* Open Folder / Copy Path */}
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium border border-[var(--border-color)]"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Path
              </>
            )}
          </button>
        </div>

        {/* Info note */}
        <p className="text-[10px] text-[var(--text-secondary)]/30 text-center">
          Path: D:\Downloads\SDKs\{filename}
        </p>
      </div>
    </div>
  );
}