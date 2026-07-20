// FILE: app/internal/api/licenses/generate/tabs/LogsSummaryTab.tsx
// PURPOSE: Tab 8 - Logs Summary
// SCOPE: View recent logs (license_generated, license_validated, device_bound, etc.)
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors
// RULE: Logs page owns logs - show summary only

"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Loader2,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface LogEntry {
  id: number;
  event_type: string;
  message: string;
  timestamp: string;
  license_key: string;
}

// ============================================================
// LOGS SUMMARY TAB
// ============================================================

export function LogsSummaryTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = "/internal/backend";

  // ============================================================
  // FETCH LOGS
  // ============================================================
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE}/logs?limit=5`);
        const data = await response.json();
        if (data.success) {
          setLogs(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  // ============================================================
  // HELPERS
  // ============================================================
  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      license_generated: "text-[var(--api-blue-400)]",
      license_validated: "text-[var(--api-green-400)]",
      device_bound: "text-[var(--api-cyan-400)]",
      device_replaced: "text-[var(--api-amber-400)]",
      product_created: "text-[var(--api-purple-400)]",
    };
    return colors[type] || "text-[var(--text-muted)]";
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-[var(--api-blue-400)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Logs List */}
      {logs.length === 0 ? (
        <div className="text-center text-[var(--text-muted)] py-4">
          <FileText className="h-8 w-8 opacity-20 mx-auto mb-2" />
          <p className="text-sm">No recent logs</p>
          <p className="text-xs mt-1">Logs appear when license events occur</p>
        </div>
      ) : (
        logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5"
          >
            <div
              className={`p-1.5 rounded-lg bg-[var(--bg-tertiary)]/30 ${getEventColor(
                log.event_type
              )}`}
            >
              <FileText className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)]">{log.message}</p>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
                <span>{new Date(log.timestamp).toLocaleString()}</span>
                {log.license_key && (
                  <span className="font-mono">{log.license_key}</span>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* View Full Logs Center */}
      <div className="pt-2 border-t border-[var(--border-color)]">
        <button
          onClick={() => (window.location.href = "/internal/api/logs")}
          className="text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors"
        >
          View Full Logs Center →
        </button>
      </div>
    </div>
  );
}