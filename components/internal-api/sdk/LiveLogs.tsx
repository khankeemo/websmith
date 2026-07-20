/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: components/internal-api/sdk/LiveLogs.tsx
 * Purpose: Real-time log stream for SDK generation
 * Author: Websmith
 * 
 * FIXED: Better log formatting with emojis
 * FIXED: Color-coded log entries (Green=success, Yellow=warning, Red=error)
 * FIXED: Timestamp now shows elapsed time from start
 * FIXED: Auto-scroll with smooth behavior
 * FIXED: Log entry count and filtering
 * ---------------------------------------------------------
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { LogEntry } from './types';
import { DEBUG_SDK_PROGRESS } from './constants';
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';

interface LiveLogsProps {
  logs: LogEntry[];
  className?: string;
  maxEntries?: number;
  startTime?: number;
}

export function LiveLogs({
  logs,
  className = '',
  maxEntries = 100,
  startTime,
}: LiveLogsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (containerRef.current && logs.length > 0 && !isCollapsed && autoScroll) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isCollapsed, autoScroll]);

  // Handle scroll to detect user scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Only show in debug mode or if logs exist
  if (!DEBUG_SDK_PROGRESS && logs.length === 0) {
    return null;
  }

  const displayLogs = logs.slice(-maxEntries);

  // Format timestamp relative to start time
  const formatTime = (timestamp: number): string => {
    if (startTime) {
      const elapsed = (timestamp - startTime) / 1000;
      if (elapsed < 60) return `${elapsed.toFixed(1)}s`;
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      return `${mins}m ${secs}s`;
    }
    const seconds = (timestamp / 1000).toFixed(1);
    return seconds.padStart(6, '0');
  };

  // Get color for log type
  const getLogColor = (type: LogEntry['type']): string => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  // Get emoji for log type
  const getLogEmoji = (type: LogEntry['type']): string => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '•';
    }
  };

  // Get background for log type
  const getLogBg = (type: LogEntry['type']): string => {
    switch (type) {
      case 'error': return 'bg-red-500/5';
      case 'warning': return 'bg-yellow-500/5';
      default: return '';
    }
  };

  // Count logs by type
  const logCounts = logs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={`${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-left text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/30"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        <Terminal className="w-4 h-4" />
        <span>Live Logs</span>
        {logs.length > 0 && (
          <span className="text-xs text-[var(--text-secondary)]/50">
            ({logs.length} entries)
          </span>
        )}
        {logCounts.error && (
          <span className="text-xs text-red-400">
            ⚠️ {logCounts.error} errors
          </span>
        )}
        {logs.length > 0 && (
          <span className="text-xs text-green-400 animate-pulse ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        )}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 p-2 font-mono text-xs scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)] scrollbar-track-transparent"
        >
          {logs.length === 0 ? (
            <div className="text-[var(--text-secondary)]/50 italic p-2 text-center">
              <Terminal className="w-4 h-4 mx-auto mb-1 opacity-30" />
              Waiting for logs...
            </div>
          ) : (
            <div className="space-y-0.5">
              {displayLogs.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 px-2 py-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]/30 ${getLogBg(log.type)}`}
                >
                  <span className="text-[var(--text-secondary)]/30 whitespace-nowrap select-none min-w-[70px]">
                    [{formatTime(log.timestamp)}]
                  </span>
                  <span className="text-[var(--text-secondary)]/40 select-none">
                    {getLogEmoji(log.type)}
                  </span>
                  <span className={`${getLogColor(log.type)} break-all`}>
                    {log.message}
                  </span>
                  {log.stage && (
                    <span className="text-[var(--text-secondary)]/20 text-[10px] whitespace-nowrap ml-auto">
                      {log.stage}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Scroll indicator */}
          {logs.length > maxEntries && (
            <div className="mt-1 text-[10px] text-[var(--text-secondary)]/30 text-center">
              Showing last {maxEntries} of {logs.length} entries
            </div>
          )}

          {/* Bottom indicator */}
          {logs.length > 0 && !autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (containerRef.current) {
                  containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
              }}
              className="mt-1 text-[10px] text-blue-400 hover:text-blue-300 text-center w-full transition-colors"
            >
              ↓ Scroll to bottom
            </button>
          )}
        </div>
      )}
    </div>
  );
}