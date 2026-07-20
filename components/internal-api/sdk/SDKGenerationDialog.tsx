/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/SDKGenerationDialog.tsx
 * Purpose: Main dialog for SDK generation with all components
 * Author: Websmith
 * 
 * Color Coding: Green=Running, Orange=Completed, Gray=Pending
 * ---------------------------------------------------------
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Clock, Zap } from 'lucide-react';
import { useSDKGeneration } from './useSDKGeneration';
import { ProgressBar } from './ProgressBar';
import { LiveLogs } from './LiveLogs';
import { PerformanceTable } from './PerformanceTable';
import { RetryInfo } from './RetryInfo';
import { SuccessActions } from './SuccessActions';
import { CloseConfirmDialog } from './CloseConfirmDialog';
import { STATUS_MESSAGES, MAX_RETRIES } from './constants';
import { SDKGenerationDialogProps } from './types';

export function SDKGenerationDialog({
  open,
  jobId,
  onClose,
  onRetry,
  onCancel,
  onComplete,
  onFailed: onFailedProp,
}: SDKGenerationDialogProps) {
  // ============================================================
  // STATE
  // ============================================================

  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const notifiedRef = useRef(false);

  const {
    state,
    stages,
    logs,
    progress,
    elapsedTime,
    estimatedTimeRemaining,
    isWaiting,
    isComplete,
    isFailed,
    performanceSummary,
    retryCount,
    retry,
    reset,
    stopPolling,
  } = useSDKGeneration({
    jobId: open ? jobId : null,
    onComplete: () => {},
    onFailed: () => {},
  });

  // Notify parent once when job completes or fails
  useEffect(() => {
    if (isComplete && state.downloadUrl && state.filename && !notifiedRef.current) {
      notifiedRef.current = true;
      if (onComplete) onComplete(state.downloadUrl, state.filename, state.productName || undefined);
    }
    if (!isComplete && !isFailed) {
      notifiedRef.current = false;
    }
  }, [isComplete, isFailed, state.downloadUrl, state.filename, state.productName, onComplete]);

  useEffect(() => {
    if (isFailed && state.error && !notifiedRef.current) {
      notifiedRef.current = true;
      if (onFailedProp) onFailedProp(state.error);
    }
  }, [isFailed, state.error, onFailedProp]);

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    if (!open) {
      setIsClosing(false);
      setShowConfirmClose(false);
    }
  }, [open]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleClose = () => {
    if (!isComplete && !isFailed && state.status === 'processing') {
      setShowConfirmClose(true);
      return;
    }
    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setIsClosing(true);
    stopPolling();
    reset();
    onClose();
  };

  const handleContinueGeneration = () => {
    setShowConfirmClose(false);
  };

  const handleRetry = () => {
    retry();
    if (onRetry) onRetry();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    handleCloseDialog();
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const getStatusIcon = () => {
    if (isComplete) {
      return <CheckCircle className="w-6 h-6 text-orange-400" />;
    }
    if (isFailed) {
      return <AlertCircle className="w-6 h-6 text-red-400" />;
    }
    if (isWaiting) {
      return <AlertCircle className="w-6 h-6 text-yellow-400" />;
    }
    return <Loader2 className="w-6 h-6 text-green-400 animate-spin" />;
  };

  const getStatusMessage = () => {
    if (isComplete) return '✅ SDK Generated Successfully!';
    if (isFailed) return '❌ Generation Failed';
    if (isWaiting) return '⏳ Waiting for backend update...';
    if (state.status === 'pending') return STATUS_MESSAGES.pending;
    return STATUS_MESSAGES.processing;
  };

  const getStatusColor = () => {
    if (isComplete) return 'text-orange-400';
    if (isFailed) return 'text-red-400';
    if (isWaiting) return 'text-yellow-400';
    return 'text-green-400';
  };

  const formatTimeShort = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatETA = (seconds: number): string => {
    if (seconds <= 0) return 'calculating...';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}m ${secs}s`;
    }
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (!open) return null;

  // Find current running stage for display
  const runningStage = stages.find((s) => s.status === 'running');
  const currentStageName = runningStage?.name || 'Starting...';

  return (
    <>
      {/* Main Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-3xl max-h-[90vh] bg-[var(--bg-primary)] rounded-2xl shadow-2xl border border-[var(--border-color)] flex flex-col animate-in fade-in zoom-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] flex-shrink-0">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>SDK Generation</span>
                  {!isComplete && !isFailed && (
                    <span className="text-xs font-normal text-green-400 animate-pulse bg-green-500/10 px-2 py-0.5 rounded-full">
                      Live
                    </span>
                  )}
                </h2>
                <p className={`text-sm font-medium ${getStatusColor()}`}>
                  {getStatusMessage()}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              disabled={isClosing}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)] scrollbar-track-transparent">
            {/* ============================================================
                SECTION 1: Progress Overview
                ============================================================ */}
            <div className="space-y-3 bg-[var(--bg-tertiary)]/10 rounded-xl p-4 border border-[var(--border-color)]">
              <ProgressBar progress={progress} label="Overall Progress" />
              
              <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-[var(--text-secondary)]">Elapsed:</span>
                    <span className="font-mono text-[var(--text-primary)] font-medium">
                      {formatTimeShort(elapsedTime)}
                    </span>
                  </div>
                  {!isComplete && !isFailed && progress > 0 && progress < 100 && (
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-[var(--text-secondary)]">ETA:</span>
                      <span className="font-mono text-yellow-400 font-medium">
                        {formatETA(estimatedTimeRemaining)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)]">Progress:</span>
                    <span className="font-mono text-[var(--text-primary)] font-medium">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>
                {isWaiting && (
                  <span className="text-yellow-500 text-xs animate-pulse">
                    ⚠️ No update for 10s+
                  </span>
                )}
              </div>

              {/* Current Stage Header */}
              {!isComplete && !isFailed && (
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-color)]">
                  {state.status === 'processing' ? (
                    <>
                      <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                      <span className="text-sm text-green-400 font-medium">
                        ⏳ {currentStageName}...
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-[var(--text-secondary)]">
                      ⏳ Starting...
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ============================================================
                SECTION 2: Stage Timeline (Card-based)
                ============================================================ */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Generation Steps
              </h3>
              <div className="space-y-2">
                {stages.map((stage, index) => {
                  const isActive = stage.status === 'running';
                  const isCompleted = stage.status === 'completed';
                  const isPending = stage.status === 'pending';
                  const isFailed = stage.status === 'failed';

                  let statusIcon = '○';
                  let statusText = 'Pending';
                  let statusColor = 'text-gray-400';
                  let bgColor = 'bg-gray-500/5';
                  let borderColor = 'border-gray-500/20';
                  let badgeColor = 'text-gray-400';

                  if (isActive) {
                    statusIcon = '⏳';
                    statusText = 'Processing...';
                    statusColor = 'text-green-400';
                    bgColor = 'bg-green-500/5';
                    borderColor = 'border-green-500/40';
                    badgeColor = 'text-green-400';
                  } else if (isCompleted) {
                    statusIcon = '✅';
                    statusText = 'Done ✓';
                    statusColor = 'text-orange-400';
                    bgColor = 'bg-orange-500/5';
                    borderColor = 'border-orange-500/40';
                    badgeColor = 'text-orange-400';
                  } else if (isFailed) {
                    statusIcon = '❌';
                    statusText = 'Failed ✗';
                    statusColor = 'text-red-400';
                    bgColor = 'bg-red-500/5';
                    borderColor = 'border-red-500/40';
                    badgeColor = 'text-red-400';
                  }

                  const duration = stage.duration ? 
                    (stage.duration < 1000 ? `${Math.round(stage.duration)}ms` : `${(stage.duration / 1000).toFixed(2)}s`) : 
                    '';

                  return (
                    <div
                      key={stage.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-300 ${borderColor} ${bgColor}`}
                    >
                      {/* Status Icon */}
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-300 ${borderColor} ${bgColor} ${statusColor}`}>
                        {statusIcon}
                      </div>

                      {/* Stage Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${statusColor}`}>
                            {stage.name}
                            {isActive && '...'}
                          </span>
                          {duration && (
                            <span className="text-xs text-gray-500 font-mono">
                              {duration}
                            </span>
                          )}
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isActive ? 'bg-green-500/20 text-green-400 animate-pulse' : isCompleted ? 'bg-orange-500/20 text-orange-400' : isFailed ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/10 text-gray-400'}`}>
                            {statusText}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500/50">
                            Step {index + 1} of {stages.length}
                          </span>
                          {isActive && (
                            <span className="text-[10px] text-green-400 animate-pulse flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              Live
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] text-orange-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                              Done
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right indicator */}
                      {isActive && (
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                        </div>
                      )}
                      {isCompleted && (
                        <span className="text-orange-400 text-sm ml-auto">✓</span>
                      )}
                      {isPending && (
                        <span className="text-gray-400 text-sm ml-auto">○</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================
                SECTION 3: Live Logs
                ============================================================ */}
            {logs.length > 0 && (
              <div className="space-y-2">
                <LiveLogs logs={logs} />
              </div>
            )}

            {/* ============================================================
                SECTION 4: Performance Summary
                ============================================================ */}
            {isComplete && performanceSummary && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Performance Summary
                </h3>
                <PerformanceTable
                  metrics={performanceSummary.stages}
                  totalTime={performanceSummary.totalTime}
                />
              </div>
            )}

            {/* ============================================================
                SECTION 5: Success Actions
                ============================================================ */}
            {isComplete && state.downloadUrl && state.filename && (
              <div className="space-y-2">
                <SuccessActions
                  downloadUrl={state.downloadUrl}
                  filename={state.filename}
                  productName={state.productName || undefined}
                />
              </div>
            )}

            {/* ============================================================
                SECTION 6: Error / Retry
                ============================================================ */}
            {isFailed && (
              <div className="space-y-2">
                <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                    <span>❌</span>
                    <span>{state.error || 'Generation failed. Please try again.'}</span>
                  </p>
                </div>
                <RetryInfo
                  retryCount={retryCount}
                  maxRetries={MAX_RETRIES}
                  isRetrying={state.status === 'processing' && retryCount > 0}
                  lastError={state.error || undefined}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-[var(--border-color)] flex-shrink-0">
            <div className="flex items-center gap-2">
              {isFailed && (
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  🔄 Retry
                </button>
              )}
              {state.status === 'processing' && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isComplete && (
                <button
                  onClick={handleCloseDialog}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Close
                </button>
              )}
              {isFailed && (
                <button
                  onClick={handleCloseDialog}
                  className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium"
                >
                  Close
                </button>
              )}
              {state.status === 'pending' && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Close Confirm Dialog */}
      <CloseConfirmDialog
        open={showConfirmClose}
        onContinue={handleContinueGeneration}
        onCloseAnyway={handleCloseDialog}
      />
    </>
  );
}