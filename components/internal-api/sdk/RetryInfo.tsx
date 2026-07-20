/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/RetryInfo.tsx
 * Purpose: Retry information for SDK generation
 * Author: Websmith
 * ---------------------------------------------------------
 */

'use client';

import { RefreshCw, AlertCircle } from 'lucide-react';

interface RetryInfoProps {
  retryCount: number;
  maxRetries: number;
  isRetrying: boolean;
  lastError?: string;
  className?: string;
}

export function RetryInfo({
  retryCount,
  maxRetries,
  isRetrying,
  lastError,
  className = '',
}: RetryInfoProps) {
  const isExhausted = retryCount >= maxRetries;

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-3 text-sm">
        {/* Retry Icon */}
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full
            ${isRetrying ? 'bg-blue-500/20 text-blue-500' : ''}
            ${isExhausted ? 'bg-red-500/20 text-red-500' : ''}
            ${!isRetrying && !isExhausted ? 'bg-gray-500/20 text-gray-400' : ''}
          `}
        >
          {isRetrying ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : isExhausted ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <RefreshCw className="w-4 h-4 opacity-50" />
          )}
        </div>

        {/* Retry Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium
                ${isRetrying ? 'text-blue-500' : ''}
                ${isExhausted ? 'text-red-500' : ''}
                ${!isRetrying && !isExhausted ? 'text-[var(--text-secondary)]' : ''}
              `}
            >
              {isRetrying ? 'Retrying...' : isExhausted ? 'Retries Exhausted' : 'Ready'}
            </span>
            <span className="text-xs text-[var(--text-secondary)]/50 font-mono">
              {retryCount} / {maxRetries}
            </span>
            {isRetrying && (
              <span className="text-xs text-blue-400 animate-pulse">●</span>
            )}
          </div>

          {/* Progress Dots */}
          <div className="flex gap-1 mt-0.5">
            {Array.from({ length: maxRetries }, (_, i) => (
              <div
                key={i}
                className={`w-4 h-1 rounded-full transition-all duration-300
                  ${i < retryCount ? 'bg-red-500/50' : ''}
                  ${i === retryCount && isRetrying ? 'bg-blue-500 animate-pulse' : ''}
                  ${i >= retryCount ? 'bg-[var(--bg-tertiary)]' : ''}
                `}
                title={`Attempt ${i + 1}`}
              />
            ))}
          </div>

          {/* Error Message */}
          {lastError && (
            <p className="mt-1 text-xs text-red-400 truncate">
              Last error: {lastError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}