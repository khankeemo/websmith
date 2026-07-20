/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/useSDKGeneration.ts
 * Purpose: Core hook for SDK generation polling and state management
 * Author: Websmith
 * 
 * MATCHES BACKEND:
 * - Stages: validate, config, runtime, manifest, zip
 * - Retry: DEFAULT_MAX_RETRIES = 3
 * - Checkpoints: Used for progress calculation
 * - Status: pending → processing → completed/failed
 * ---------------------------------------------------------
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SDKGenerationState,
  Stage,
  LogEntry,
  PerformanceSummary,
  FileProgress,
  UseSDKGenerationReturn,
  StatusResponse,
  SDKStageId,
} from './types';
import {
  SDK_STAGES,
  STAGE_WEIGHTS,
  POLLING_INTERVAL_MS,
  WAITING_THRESHOLD_MS,
  DEFAULT_SDK_STATE,
  STAGE_LABELS,
} from './constants';

// Match queue's DEFAULT_MAX_RETRIES
const MAX_RETRIES = 3;

interface UseSDKGenerationOptions {
  jobId: string | null;
  onComplete?: () => void;
  onFailed?: (error: string) => void;
  onWaiting?: () => void;
}

export function useSDKGeneration({
  jobId,
  onComplete,
  onFailed,
  onWaiting,
}: UseSDKGenerationOptions): UseSDKGenerationReturn {
  // ============================================================
  // STATE
  // ============================================================

  const [state, setState] = useState<SDKGenerationState>(DEFAULT_SDK_STATE);
  const [stages, setStages] = useState<Stage[]>(() =>
    SDK_STAGES.map((s) => ({
      id: s.id,
      name: s.label,
      status: 'pending',
      duration: 0,
    }))
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  // ============================================================
  // REFS
  // ============================================================

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number | null>(null);
  const waitingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const stageStartTimesRef = useRef<Record<string, number>>({});
  const progressHistoryRef = useRef<{ time: number; progress: number }[]>([]);
  const statusRef = useRef<StatusResponse['status']>('pending');

  // ============================================================
  // HELPERS
  // ============================================================

  const calculateProgressFromCheckpoints = (
    checkpoints: Record<string, number> | undefined,
    currentStage?: string | null
  ): number => {
    if (!checkpoints) return 0;
    
    let completedWeight = 0;
    
    for (const stage of SDK_STAGES) {
      if (checkpoints[stage.id]) {
        const weight = STAGE_WEIGHTS[stage.id as SDKStageId] || 0;
        completedWeight += weight;
      }
    }
    
    if (currentStage) {
      const currentWeight = STAGE_WEIGHTS[currentStage as SDKStageId] || 0;
      if (!checkpoints[currentStage]) {
        completedWeight += currentWeight * 0.5;
      }
    }
    
    return Math.min(100, Math.max(0, completedWeight));
  };

  const addLog = useCallback(
    (message: string, type: LogEntry['type'] = 'info', stage?: string) => {
      const timestamp = Date.now();
      setLogs((prev) => [...prev, { timestamp, message, type, stage }]);
    },
    []
  );

  const calculateETA = useCallback((): number => {
    if (progress === 0 || progress >= 100) return 0;
    
    const history = progressHistoryRef.current;
    if (history.length < 2) {
      return (elapsedTime / progress) * (100 - progress);
    }
    
    const recent = history.slice(-5);
    let totalRate = 0;
    let count = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const timeDiff = recent[i].time - recent[i-1].time;
      const progDiff = recent[i].progress - recent[i-1].progress;
      if (timeDiff > 0 && progDiff > 0) {
        totalRate += progDiff / timeDiff;
        count++;
      }
    }
    
    const avgRate = count > 0 ? totalRate / count : progress / elapsedTime;
    const remaining = 100 - progress;
    
    return avgRate > 0 ? remaining / avgRate : (elapsedTime / progress) * remaining;
  }, [progress, elapsedTime]);

  // ============================================================
  // POLLING LOGIC
  // ============================================================

  const fetchStatus = useCallback(async () => {
    if (!jobId || !isPollingRef.current || isCancelled) return;

    try {
      const response = await fetch(
        `/api/internal/publisher/status/${jobId}`
      );
      const data: StatusResponse = await response.json();

      if (!data.success) {
        addLog(`Failed to fetch status: ${data.error || 'Unknown error'}`, 'error');
        return;
      }

      // Update status ref for interval checks
      statusRef.current = data.status;

      setState((prev) => ({
        ...prev,
        jobId: data.job_id,
        status: data.status,
        created: data.created,
        started: data.started || prev.started,
        completed: data.completed || prev.completed,
        error: data.error || prev.error,
        downloadUrl: data.download_url || prev.downloadUrl,
        filename: data.filename || prev.filename,
        productName: data.product_name || prev.productName,
        currentStage: data.current_stage || null,
        retryCount: data.retry_count || 0,
        maxRetries: data.max_retries || 3,
        resumeCount: data.resume_count || 0,
        checkpoints: data.checkpoints || {},
        stageMetrics: data.stage_metrics || {},
        stageErrors: data.stage_errors || {},
      }));

      if (data.retry_count !== undefined) {
        setRetryCount(data.retry_count);
      }

      lastUpdateRef.current = Date.now();

      if (data.status === 'processing') {
        const checkpoints = data.checkpoints || {};
        const currentStage = data.current_stage;

        const newStages = SDK_STAGES.map((stageDef) => {
          const isCompleted = !!checkpoints[stageDef.id];
          const isRunning = currentStage === stageDef.id;
          
          let status: Stage['status'] = 'pending';
          if (isCompleted) {
            status = 'completed';
          } else if (isRunning) {
            status = 'running';
          }
          
          let duration = 0;
          if (data.stage_metrics && data.stage_metrics[`${stageDef.id}_duration`]) {
            duration = data.stage_metrics[`${stageDef.id}_duration`] * 1000;
          }
          
          return {
            id: stageDef.id,
            name: stageDef.label,
            status,
            duration,
          };
        });

        setStages(newStages);

        const newProgress = calculateProgressFromCheckpoints(checkpoints, currentStage);
        setProgress(newProgress);

        progressHistoryRef.current.push({
          time: Date.now(),
          progress: newProgress,
        });
        if (progressHistoryRef.current.length > 20) {
          progressHistoryRef.current.shift();
        }

        const eta = calculateETA();
        setEstimatedTimeRemaining(eta);

        if (currentStage) {
          const stageDef = SDK_STAGES.find(s => s.id === currentStage);
          if (stageDef && !stageStartTimesRef.current[currentStage]) {
            stageStartTimesRef.current[currentStage] = Date.now();
            addLog(`⏳ Starting: ${stageDef.label}...`, 'info', currentStage);
          }
        }
      }

      if (data.status === 'completed') {
        setProgress(100);
        setEstimatedTimeRemaining(0);

        const completedStages = SDK_STAGES.map((stageDef) => {
          let duration = 0;
          if (data.stage_metrics && data.stage_metrics[`${stageDef.id}_duration`]) {
            duration = data.stage_metrics[`${stageDef.id}_duration`] * 1000;
          }
          return {
            id: stageDef.id,
            name: stageDef.label,
            status: 'completed' as const,
            duration,
          };
        });
        setStages(completedStages);

        addLog('🎉 SDK generation completed successfully!', 'success');
        if (onComplete) onComplete();
        stopPolling();
      }

      if (data.status === 'failed') {
        const currentStage = data.current_stage;
        const failedStages = SDK_STAGES.map((stageDef) => {
          const isCompleted = !!(data.checkpoints && data.checkpoints[stageDef.id]);
          const isFailed = currentStage === stageDef.id;
          
          let status: Stage['status'] = 'pending';
          if (isCompleted) {
            status = 'completed';
          } else if (isFailed) {
            status = 'failed';
          }
          
          let duration = 0;
          if (data.stage_metrics && data.stage_metrics[`${stageDef.id}_duration`]) {
            duration = data.stage_metrics[`${stageDef.id}_duration`] * 1000;
          }
          
          return {
            id: stageDef.id,
            name: stageDef.label,
            status,
            duration,
            error: isFailed ? data.error : undefined,
          };
        });
        setStages(failedStages);

        const finalProgress = calculateProgressFromCheckpoints(data.checkpoints || {});
        setProgress(finalProgress);
        setEstimatedTimeRemaining(0);

        addLog(`❌ Generation failed: ${data.error || 'Unknown error'}`, 'error');
        if (onFailed) onFailed(data.error || 'Unknown error');
        stopPolling();
      }

      setIsWaiting(false);

    } catch (error) {
      console.error('Status fetch error:', error);
      if (lastUpdateRef.current && Date.now() - lastUpdateRef.current > WAITING_THRESHOLD_MS) {
        setIsWaiting(true);
        if (onWaiting) onWaiting();
      }
    }
  }, [jobId, addLog, onComplete, onFailed, onWaiting, calculateETA, isCancelled]);

  // ============================================================
  // POLLING CONTROL
  // ============================================================

  const stopPolling = useCallback(() => {
    isPollingRef.current = false;

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (waitingTimerRef.current) {
      clearInterval(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  }, []);

  const progressRef = useRef(progress);
  progressRef.current = progress;
  const isCancelledRef = useRef(isCancelled);
  isCancelledRef.current = isCancelled;

  const startPolling = useCallback(() => {
    if (!jobId) return;
    if (isPollingRef.current) return;

    isPollingRef.current = true;
    startTimeRef.current = Date.now();
    lastUpdateRef.current = Date.now();
    setIsCancelled(false);
    statusRef.current = 'pending';

    addLog('🚀 Starting SDK generation...', 'info');

    fetchStatus();

    pollTimerRef.current = setInterval(fetchStatus, POLLING_INTERVAL_MS);

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedTime((Date.now() - startTimeRef.current!) / 1000);
        const currentProgress = progressRef.current;
        if (currentProgress > 0 && currentProgress < 100) {
          const eta = calculateETA();
          setEstimatedTimeRemaining(eta);
        }
      }
    }, 1000);

    waitingTimerRef.current = setInterval(() => {
      const currentStatus = statusRef.current;
      if (currentStatus === 'completed' || currentStatus === 'failed' || isCancelledRef.current) {
        setIsWaiting(false);
        return;
      }
      
      if (isPollingRef.current && lastUpdateRef.current) {
        const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
        if (timeSinceLastUpdate > WAITING_THRESHOLD_MS) {
          setIsWaiting(true);
          if (onWaiting) onWaiting();
        }
      }
    }, 5000);
  }, [jobId, fetchStatus, addLog, onWaiting, calculateETA]);

  const reset = useCallback(() => {
    stopPolling();
    setState(DEFAULT_SDK_STATE);
    setStages(SDK_STAGES.map((s) => ({ id: s.id, name: s.label, status: 'pending', duration: 0 })));
    setLogs([]);
    setProgress(0);
    setElapsedTime(0);
    setEstimatedTimeRemaining(0);
    setIsWaiting(false);
    setIsCancelled(false);
    setPerformanceSummary(null);
    setFileProgress([]);
    setRetryCount(0);
    statusRef.current = 'pending';
    progressHistoryRef.current = [];
    startTimeRef.current = null;
    lastUpdateRef.current = null;
    stageStartTimesRef.current = {};
  }, [stopPolling]);

  const retry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      addLog('Maximum retries reached. Please try again later.', 'error');
      return;
    }

    addLog(`🔄 Retry attempt ${retryCount + 1} of ${MAX_RETRIES}...`, 'warning');
    setIsWaiting(false);
    setIsCancelled(false);
    statusRef.current = 'pending';
    lastUpdateRef.current = Date.now();

    if (isPollingRef.current) {
      stopPolling();
    }
    startPolling();
  }, [retryCount, addLog, stopPolling, startPolling]);

  const cancel = useCallback(() => {
    setIsCancelled(true);
    stopPolling();
    addLog('⏹️ Generation cancelled by user', 'warning');
    setState(prev => ({ ...prev, status: 'cancelled' }));
  }, [addLog, stopPolling]);

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    if (jobId) {
      reset();
      startPolling();
    }

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Build performance summary on completion
  useEffect(() => {
    if (state.status === 'completed' || state.status === 'failed') {
      const stageMetrics = state.stageMetrics || {};
      
      const completedStages = SDK_STAGES
        .filter((s) => {
          const isCompleted = state.checkpoints && state.checkpoints[s.id];
          return isCompleted || state.status === 'completed';
        })
        .map((s) => {
          const duration = stageMetrics[`${s.id}_duration`] ? stageMetrics[`${s.id}_duration`] * 1000 : 0;
          return {
            stage: s.label,
            duration,
            status: 'completed' as const,
          };
        });

      const totalTime = state.completed
        ? state.completed - (state.started || state.created || 0)
        : elapsedTime * 1000;

      setPerformanceSummary({
        totalTime: totalTime > 0 ? totalTime : elapsedTime * 1000,
        stages: completedStages,
        longestStage: completedStages.length > 0
          ? completedStages.reduce((a, b) => a.duration > b.duration ? a : b)
          : null,
        fastestStage: completedStages.length > 0
          ? completedStages.reduce((a, b) => a.duration < b.duration ? a : b)
          : null,
      });
    }
  }, [state.status, state.checkpoints, state.stageMetrics, state.completed, state.started, state.created, elapsedTime]);

  // ============================================================
  // DERIVED VALUES
  // ============================================================

  const isComplete = state.status === 'completed';
  const isFailed = state.status === 'failed';

  const currentStage = state.currentStage || null;
  const currentStageName = currentStage ? STAGE_LABELS[currentStage as SDKStageId] || currentStage : null;
  const currentStageIndex = currentStage ? SDK_STAGES.findIndex(s => s.id === currentStage) : -1;
  const totalStages = SDK_STAGES.length;

  // ============================================================
  // RETURN
  // ============================================================

  return {
    state,
    stages,
    logs,
    progress,
    elapsedTime,
    estimatedTimeRemaining,
    isWaiting,
    isComplete,
    isFailed,
    isCancelled,
    performanceSummary,
    fileProgress,
    retryCount,
    currentStage,
    currentStageName,
    currentStageIndex,
    totalStages,
    startPolling,
    stopPolling,
    reset,
    retry,
    cancel,
  };
}