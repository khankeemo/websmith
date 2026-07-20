/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/types.ts
 * Purpose: Shared types for SDK Generation UI components
 * Author: Websmith
 * 
 * FIXED: Added SDKGenerationStateWithStages for better stage management
 * FIXED: Added ETA calculation fields
 * FIXED: Added stage progress tracking
 * ---------------------------------------------------------
 */

// ============================================================
// JOB STATUS (Matches Backend)
// ============================================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// ============================================================
// STAGE ID (Matches Backend)
// Backend stages: validate, config, runtime, manifest, zip
// ============================================================

export type SDKStageId = 'validate' | 'config' | 'runtime' | 'manifest' | 'zip';

// ============================================================
// STATUS RESPONSE (From /api/internal/publisher/status/[jobId])
// ============================================================

export interface StatusResponse {
  success: boolean;
  job_id: string;
  status: JobStatus;
  created: number;
  started?: number;
  completed?: number;
  error?: string;
  download_url?: string;
  filename?: string;
  product_name?: string;
  
  // Checkpoint/Resume fields from backend
  current_stage?: string | null;
  retry_count?: number;
  max_retries?: number;
  resume_count?: number;
  checkpoints?: Record<string, number>;
  stage_metrics?: Record<string, number>;
  stage_errors?: Record<string, string>;
}

// ============================================================
// SDK GENERATION STATE (UI State)
// ============================================================

export interface SDKGenerationState {
  jobId: string | null;
  status: JobStatus | null;
  created: number | null;
  started: number | null;
  completed: number | null;
  error: string | null;
  downloadUrl: string | null;
  filename: string | null;
  productName: string | null;
  
  // Checkpoint state from backend
  currentStage?: string | null;
  retryCount?: number;
  maxRetries?: number;
  resumeCount?: number;
  checkpoints?: Record<string, number>;
  stageMetrics?: Record<string, number>;
  stageErrors?: Record<string, string>;
  
  // UI State
  startTime?: number;
  elapsedTime?: number;
  progress?: number;
}

// ============================================================
// STAGE STATUS (For Timeline)
// ============================================================

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface Stage {
  id: string;
  name: string;
  status: StageStatus;
  duration?: number; // milliseconds
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// ============================================================
// LOG ENTRY (For Live Logs)
// ============================================================

export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  stage?: string;
}

// ============================================================
// PERFORMANCE METRIC (For Performance Table)
// ============================================================

export interface PerformanceMetric {
  stage: string;
  duration: number; // milliseconds
  status: 'completed' | 'failed' | 'skipped';
}

// ============================================================
// FILE PROGRESS (For File Progress)
// ============================================================

export interface FileProgress {
  name: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  size?: number;
}

// ============================================================
// PERFORMANCE SUMMARY
// ============================================================

export interface PerformanceSummary {
  totalTime: number; // milliseconds
  stages: PerformanceMetric[];
  longestStage: PerformanceMetric | null;
  fastestStage: PerformanceMetric | null;
}

// ============================================================
// DIALOG PROPS
// ============================================================

export interface SDKGenerationDialogProps {
  open: boolean;
  jobId: string | null;
  onClose: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  onComplete?: (downloadUrl: string, filename: string, productName?: string) => void;
  onFailed?: (error: string) => void;
}

// ============================================================
// HOOK RETURN TYPE
// ============================================================

export interface UseSDKGenerationReturn {
  // State
  state: SDKGenerationState;
  stages: Stage[];
  logs: LogEntry[];
  progress: number; // 0-100
  elapsedTime: number; // seconds
  estimatedTimeRemaining: number; // seconds - NEW
  isWaiting: boolean;
  isComplete: boolean;
  isFailed: boolean;
  isCancelled: boolean;
  performanceSummary: PerformanceSummary | null;
  fileProgress: FileProgress[];
  retryCount: number;
  
  // Current stage info - NEW
  currentStage: string | null;
  currentStageName: string | null;
  currentStageIndex: number;
  totalStages: number;
  
  // Actions
  startPolling: () => void;
  stopPolling: () => void;
  reset: () => void;
  retry: () => void;
  cancel: () => void;
}