/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/ProgressBar.tsx
 * Purpose: Animated progress bar for SDK generation
 * Author: Websmith
 * 
 * FIXED: Green = Running (0-99%), Orange = Complete (100%), Gray = Pending (0%)
 * FIXED: Moving stripes animation for active progress
 * FIXED: Status-based colors for better UX
 * FIXED: Added showStage prop for current stage display
 * ---------------------------------------------------------
 */

'use client';

import { useEffect, useState } from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  showStage?: string;
  className?: string;
}

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  showStage,
  className = '',
}: ProgressBarProps) {
  const [width, setWidth] = useState(0);
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Animate to new progress
  useEffect(() => {
    requestAnimationFrame(() => {
      setWidth(Math.min(100, Math.max(0, clampedProgress)));
    });
  }, [clampedProgress]);

  // Determine color based on progress
  const getBarColor = () => {
    if (clampedProgress === 0) {
      // Pending - Gray
      return 'bg-gray-400/30';
    }
    if (clampedProgress >= 100) {
      // Complete - Orange
      return 'bg-gradient-to-r from-orange-400 to-orange-500';
    }
    // Running - Green with gradient
    return 'bg-gradient-to-r from-green-400 to-emerald-500';
  };

  const getBarGlow = () => {
    if (clampedProgress === 0) return '';
    if (clampedProgress >= 100) return 'shadow-lg shadow-orange-500/20';
    return 'shadow-lg shadow-green-500/20';
  };

  // Stripes animation - only when running (0 < progress < 100)
  const shouldAnimateStripes = clampedProgress > 0 && clampedProgress < 100;

  return (
    <div className={`w-full ${className}`}>
      {/* Label & Percentage */}
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm mb-1.5">
          {label && (
            <span className="text-[var(--text-secondary)] font-medium">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className={`font-mono text-sm font-medium
              ${clampedProgress === 0 ? 'text-gray-400' : ''}
              ${clampedProgress > 0 && clampedProgress < 100 ? 'text-green-400' : ''}
              ${clampedProgress >= 100 ? 'text-orange-400' : ''}
            `}>
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Progress Bar Container */}
      <div className={`relative w-full h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden ${getBarGlow()}`}>
        {/* Progress Fill */}
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${getBarColor()}`}
          style={{ width: `${clampedProgress}%` }}
        >
          {/* Animated Stripes - only when running */}
          {shouldAnimateStripes && (
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div
                className="h-full w-[200%] animate-stripe-move"
                style={{
                  background: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 8px,
                    rgba(255, 255, 255, 0.15) 8px,
                    rgba(255, 255, 255, 0.15) 16px
                  )`,
                  backgroundSize: '200% 100%',
                }}
              />
            </div>
          )}
        </div>

        {/* Glow pulse - only when running */}
        {shouldAnimateStripes && (
          <div className="absolute inset-0 rounded-full animate-pulse-glow">
            <div className="absolute inset-0 rounded-full bg-green-400/10 blur-sm" />
          </div>
        )}
      </div>

      {/* Stage Info below bar */}
      {showStage && (
        <div className="flex items-center gap-2 mt-1.5 text-xs">
          <span className="text-[var(--text-secondary)]/60">
            {showStage}
          </span>
          {clampedProgress > 0 && clampedProgress < 100 && (
            <span className="text-green-400 animate-pulse text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
              Processing...
            </span>
          )}
          {clampedProgress >= 100 && (
            <span className="text-orange-400 text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              Complete ✓
            </span>
          )}
          {clampedProgress === 0 && (
            <span className="text-gray-400 text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Waiting...
            </span>
          )}
        </div>
      )}
    </div>
  );
}