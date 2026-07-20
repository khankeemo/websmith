/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/PerformanceTable.tsx
 * Purpose: Performance timing breakdown for SDK generation
 * Author: Websmith
 * ---------------------------------------------------------
 */

'use client';

import { PerformanceMetric, PerformanceSummary } from './types';
import { DEBUG_SDK_PROGRESS } from './constants';

interface PerformanceTableProps {
  metrics: PerformanceMetric[];
  totalTime: number;
  className?: string;
}

export function PerformanceTable({
  metrics,
  totalTime,
  className = '',
}: PerformanceTableProps) {
  // Only show in debug mode or if metrics exist
  if (!DEBUG_SDK_PROGRESS && metrics.length === 0) {
    return null;
  }

  // Calculate summary
  const summary: PerformanceSummary = {
    totalTime,
    stages: metrics,
    longestStage: null,
    fastestStage: null,
  };

  if (metrics.length > 0) {
    const sorted = [...metrics].sort((a, b) => b.duration - a.duration);
    summary.longestStage = sorted[0] || null;
    summary.fastestStage = sorted[sorted.length - 1] || null;
  }

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Calculate percentage of total
  const getPercentage = (duration: number): number => {
    if (totalTime === 0) return 0;
    return (duration / totalTime) * 100;
  };

  // Get bar color based on duration percentage
  const getBarColor = (percentage: number): string => {
    if (percentage > 50) return 'bg-red-500/80';
    if (percentage > 30) return 'bg-yellow-500/80';
    if (percentage > 15) return 'bg-blue-500/80';
    return 'bg-green-500/80';
  };

  if (metrics.length === 0) {
    return (
      <div className={`text-sm text-[var(--text-secondary)]/50 italic ${className}`}>
        No performance data available yet.
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-3 text-xs">
        <div className="text-center p-2 bg-[var(--bg-tertiary)]/50 rounded">
          <div className="text-[var(--text-secondary)]/60">Total Time</div>
          <div className="font-mono font-medium text-[var(--text-primary)]">
            {formatDuration(totalTime)}
          </div>
        </div>
        {summary.longestStage && (
          <div className="text-center p-2 bg-[var(--bg-tertiary)]/50 rounded">
            <div className="text-[var(--text-secondary)]/60">Longest Stage</div>
            <div className="font-mono font-medium text-red-400">
              {summary.longestStage.stage} ({formatDuration(summary.longestStage.duration)})
            </div>
          </div>
        )}
        {summary.fastestStage && (
          <div className="text-center p-2 bg-[var(--bg-tertiary)]/50 rounded">
            <div className="text-[var(--text-secondary)]/60">Fastest Stage</div>
            <div className="font-mono font-medium text-green-400">
              {summary.fastestStage.stage} ({formatDuration(summary.fastestStage.duration)})
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="space-y-1.5">
        {metrics.map((metric) => {
          const percentage = getPercentage(metric.duration);
          const isLongest = summary.longestStage?.stage === metric.stage;
          const isFastest = summary.fastestStage?.stage === metric.stage;

          return (
            <div key={metric.stage} className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-secondary)] w-28 flex-shrink-0 truncate">
                {metric.stage}
              </span>

              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(percentage)}`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>

                <span className="text-xs font-mono text-[var(--text-secondary)] w-16 text-right flex-shrink-0">
                  {formatDuration(metric.duration)}
                </span>

                {isLongest && (
                  <span className="text-[10px] text-red-400 font-medium">🔴</span>
                )}
                {isFastest && !isLongest && (
                  <span className="text-[10px] text-green-400 font-medium">🟢</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}