/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/constants.ts
 * Purpose: Constants for SDK Generation UI components
 * Author: Websmith
 * 
 * FIXED: Stages now match backend (validate, config, runtime, manifest, zip)
 * FIXED: Stage weights recalculated to total 100%
 * FIXED: Status colors: Green=Running, Orange=Completed, Gray=Pending
 * ---------------------------------------------------------
 */

import { JobStatus } from './types';

// ============================================================
// STAGES (SDK Generation Pipeline) - MATCHES BACKEND
// Backend stages from app/internal/publisher/index.ts:
// const STAGES = ['validate', 'config', 'runtime', 'manifest', 'zip']
// ============================================================

export const SDK_STAGES = [
  { id: 'validate', label: 'Validate API Key & Product' },
  { id: 'config', label: 'Build Configuration' },
  { id: 'runtime', label: 'Build Runtime Package' },
  { id: 'manifest', label: 'Generate Manifest' },
  { id: 'zip', label: 'Create ZIP Archive' },
] as const;

export type SDKStageId = typeof SDK_STAGES[number]['id'];

// ============================================================
// STAGE LABELS - MATCHES BACKEND
// ============================================================

export const STAGE_LABELS: Record<SDKStageId, string> = {
  validate: 'Validate API Key & Product',
  config: 'Build Configuration',
  runtime: 'Build Runtime Package',
  manifest: 'Generate Manifest',
  zip: 'Create ZIP Archive',
};

// ============================================================
// STAGE STATUS CONFIG - COLOR SCHEME
// Running = Green, Completed = Orange, Pending = Gray, Failed = Red
// ============================================================

export const STAGE_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'text-gray-400',
    bg: 'bg-gray-500/5',
    border: 'border-gray-500/20',
    icon: '○',
  },
  running: {
    label: 'Processing',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/40',
    icon: '⏳',
  },
  completed: {
    label: 'Done ✓',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    icon: '✅',
  },
  failed: {
    label: 'Failed ✗',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    icon: '❌',
  },
  skipped: {
    label: 'Skipped',
    color: 'text-gray-400',
    bg: 'bg-gray-500/5',
    border: 'border-gray-500/20',
    icon: '⏭️',
  },
} as const;

// ============================================================
// POLLING CONFIGURATION
// ============================================================

export const POLLING_INTERVAL_MS = 2000; // 2 seconds
export const MAX_POLLING_ATTEMPTS = 30; // 30 attempts
export const WAITING_THRESHOLD_MS = 10000; // 10 seconds

// ============================================================
// PROGRESS ESTIMATION - TOTAL = 100%
// ============================================================

export const STAGE_WEIGHTS: Record<SDKStageId, number> = {
  validate: 15,
  config: 10,
  runtime: 30,
  manifest: 15,
  zip: 30,
};

// ============================================================
// DEBUG MODE
// ============================================================

export const DEBUG_SDK_PROGRESS = 
  process.env.NEXT_PUBLIC_DEBUG_SDK === 'true' ||
  process.env.NODE_ENV === 'development';

// ============================================================
// MESSAGES
// ============================================================

export const STATUS_MESSAGES = {
  pending: 'Waiting for queue...',
  processing: 'Generating SDK...',
  completed: '✅ SDK generated successfully!',
  failed: '❌ SDK generation failed.',
  waiting: '⏳ Waiting for backend update...',
} as const;

// ============================================================
// RETRY CONFIGURATION
// ============================================================

export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 5000; // 5 seconds

// ============================================================
// DEFAULT STATE
// ============================================================

export const DEFAULT_SDK_STATE = {
  jobId: null,
  status: null as JobStatus | null,
  created: null,
  started: null,
  completed: null,
  error: null,
  downloadUrl: null,
  filename: null,
  productName: null,
  currentStage: null as string | null,
};

// ============================================================
// DIALOG SIZES
// ============================================================

export const DIALOG_WIDTH = 'max-w-4xl';
export const DIALOG_HEIGHT = 'max-h-[90vh]';