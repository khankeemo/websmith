/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/TimelineView.tsx
 * Purpose: Timestamped event timeline for SDK generation
 * Author: Websmith
 * ---------------------------------------------------------
 */

'use client';

import { LogEntry } from './types';
import { DEBUG_SDK_PROGRESS } from './constants';
import { useRef, useEffect } from 'react';

interface TimelineViewProps {
  logs: LogEntry[];
  className?: string;
  maxEntries?: number;
}

export function TimelineView({
  logs,
  className = '',
  maxEntries = 50,
}: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (containerRef.current && logs.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  // Only show in debug mode or if logs exist
  if (!DEBUG_SDK_PROGRESS && logs.length === 0) {
    return null;
  }

  const displayLogs = logs.slice(-maxEntries);

  // Format timestamp (milliseconds to seconds)
  const formatTime = (timestamp: number): string => {
    const seconds = (timestamp / 1000).toFixed(3);
    return seconds.padStart(7, '0');
  };

  // Get color for log type
  const getLogColor = (type: LogEntry['type']): string => {
    switch (type) {
      case 'success': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  if (logs.length === 0) {
    return (
      <div className={`text-sm text-[var(--text-secondary)]/50 italic ${className}`}>
        No timeline events yet.
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div
        ref={containerRef}
        className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)] scrollbar-track-transparent"
      >
        <div className="space-y-0.5 font-mono text-xs">
          {displayLogs.map((log, index) => (
            <div
              key={index}
              className="flex items-start gap-3 px-1 py-0.5 hover:bg-[var(--bg-tertiary)]/50 rounded transition-colors"
            >
              <span className="text-[var(--text-secondary)]/50 whitespace-nowrap select-none">
                [{formatTime(log.timestamp)}]
              </span>
              <span className={`${getLogColor(log.type)} truncate`}>
                {log.message}
              </span>
              {log.stage && (
                <span className="text-[var(--text-secondary)]/30 text-[10px] whitespace-nowrap">
                  {log.stage}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      {logs.length > maxEntries && (
        <div className="mt-1 text-[10px] text-[var(--text-secondary)]/50 text-center">
          Showing last {maxEntries} of {logs.length} events
        </div>
      )}
    </div>
  );
}