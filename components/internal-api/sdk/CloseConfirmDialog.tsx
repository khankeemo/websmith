/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/CloseConfirmDialog.tsx
 * Purpose: Confirm close dialog for SDK generation
 * Author: Websmith
 * ---------------------------------------------------------
 */

'use client';

import { X, AlertTriangle } from 'lucide-react';

interface CloseConfirmDialogProps {
  open: boolean;
  onContinue: () => void;
  onCloseAnyway: () => void;
}

export function CloseConfirmDialog({
  open,
  onContinue,
  onCloseAnyway,
}: CloseConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl shadow-2xl border border-[var(--border-color)] p-6 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Close Generation?
            </h3>
          </div>
          <button
            onClick={onContinue}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          SDK generation is still running. Are you sure you want to close?
          <br />
          <span className="text-xs text-[var(--text-secondary)]/50">
            Generation will continue in the background.
          </span>
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium"
          >
            Continue Generation
          </button>
          <button
            onClick={onCloseAnyway}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Close Anyway
          </button>
        </div>
      </div>
    </div>
  );
}