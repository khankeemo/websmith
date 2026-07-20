/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/StepTimeline.tsx
 * Purpose: Step-by-step timeline for SDK generation
 * Author: Websmith
 * 
 * FIXED: Color scheme - Green=Running, Orange=Completed, Gray=Pending
 * FIXED: Added border styling for better visibility
 * FIXED: Better time formatting with real-time updates
 * FIXED: Stage status indicator with badge
 * ---------------------------------------------------------
 */

'use client';

import { Stage } from './types';
import { STAGE_STATUS_CONFIG } from './constants';

interface StepTimelineProps {
  stages: Stage[];
  currentStage?: string | null;
  className?: string;
}

export function StepTimeline({ stages, currentStage, className = '' }: StepTimelineProps) {
  const formatDuration = (ms?: number): string => {
    if (!ms) return '';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {stages.map((stage, index) => {
        const isActive = stage.status === 'running' || stage.id === currentStage;
        const isCompleted = stage.status === 'completed';
        const isPending = stage.status === 'pending';
        const isFailed = stage.status === 'failed';
        const isSkipped = stage.status === 'skipped';

        // Get status config
        const statusConfig = STAGE_STATUS_CONFIG[stage.status];

        // Determine color scheme
        let statusColor = 'text-gray-400';
        let borderColor = 'border-gray-500/20';
        let bgColor = 'bg-gray-500/5';
        let icon = '○';
        let badge = '';

        if (isActive) {
          statusColor = 'text-green-400';
          borderColor = 'border-green-500/40';
          bgColor = 'bg-green-500/10';
          icon = '⏳';
          badge = 'processing...';
        } else if (isCompleted) {
          statusColor = 'text-orange-400';
          borderColor = 'border-orange-500/40';
          bgColor = 'bg-orange-500/10';
          icon = '✅';
          badge = 'done ✓';
        } else if (isFailed) {
          statusColor = 'text-red-400';
          borderColor = 'border-red-500/40';
          bgColor = 'bg-red-500/10';
          icon = '❌';
          badge = 'failed ✗';
        } else if (isSkipped) {
          statusColor = 'text-gray-400';
          borderColor = 'border-gray-500/20';
          bgColor = 'bg-gray-500/5';
          icon = '⏭️';
          badge = 'skipped';
        } else {
          statusColor = 'text-gray-400';
          borderColor = 'border-gray-500/20';
          bgColor = 'bg-gray-500/5';
          icon = '○';
          badge = '';
        }

        return (
          <div
            key={stage.id}
            className={`flex items-center gap-3 p-2 rounded-lg border-2 transition-all duration-300 ${borderColor} ${bgColor}`}
          >
            {/* Status Icon with Border */}
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-300 ${borderColor} ${bgColor} ${statusColor}`}
            >
              {icon}
            </div>

            {/* Stage Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium transition-colors duration-300 ${statusColor}`}
                >
                  {stage.name}
                  {isActive && '...'}
                </span>

                {/* Duration - shows real time for running stages */}
                {stage.duration !== undefined && stage.duration > 0 && (
                  <span className="text-xs text-gray-500 font-mono">
                    {formatDuration(stage.duration)}
                  </span>
                )}

                {/* Status Badge */}
                {badge && (
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'text-green-400 bg-green-500/20 animate-pulse'
                        : isCompleted
                        ? 'text-orange-400 bg-orange-500/20'
                        : isFailed
                        ? 'text-red-400 bg-red-500/20'
                        : 'text-gray-400 bg-gray-500/10'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </div>

              {/* Stage Number Indicator */}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-500/50">
                  Step {index + 1} of {stages.length}
                </span>
                {isActive && (
                  <span className="text-[10px] text-green-400 animate-pulse">
                    ● Live
                  </span>
                )}
                {isCompleted && (
                  <span className="text-[10px] text-orange-400">● Done</span>
                )}
              </div>
            </div>

            {/* Progress indicator for running stage */}
            {isActive && (
              <div className="flex items-center gap-1 ml-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse delay-150" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse delay-300" />
              </div>
            )}

            {/* Checkmark for completed */}
            {isCompleted && (
              <span className="text-orange-400 text-sm ml-auto">✓</span>
            )}
          </div>
        );
      })}
    </div>
  );
}