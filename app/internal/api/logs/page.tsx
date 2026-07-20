// FILE: app/internal/api/logs/page.tsx
// PURPOSE: Logs Center - View and filter audit logs
// SCOPE: Audit logs, pagination, filters, exports
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Calendar,
  Clock,
  Key,
  Cpu,
  User,
  Globe,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Activity,
  ShieldCheck,
  Package,
  Link2,
  Repeat,
  RotateCcw,
  Unlink,
  Eye,
} from "lucide-react";

// ============================================================
// TYPES - Based on actual logs API response
// ============================================================

interface LogEntry {
  id: number;
  event_type: string;
  message: string;
  timestamp: string;
  ip_address: string;
  license_key: string;
  hardware_id: string;
}

interface LogsResponse {
  success: boolean;
  data: LogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  error?: string;
}

// ============================================================
// STATISTICS CARD COMPONENT
// ============================================================

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "cyan" | "amber" | "red";
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)]",
    green: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
    purple: "border-[var(--api-purple-500-20)] bg-[var(--api-purple-500-5)]",
    cyan: "border-[var(--api-cyan-500-20)] bg-[var(--api-cyan-500-5)]",
    amber: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
    red: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
  };

  const iconColors = {
    blue: "text-[var(--api-blue-400)] bg-[var(--api-blue-500-10)]",
    green: "text-[var(--api-green-400)] bg-[var(--api-green-500-10)]",
    purple: "text-[var(--api-purple-400)] bg-[var(--api-purple-500-10)]",
    cyan: "text-[var(--api-cyan-400)] bg-[var(--api-cyan-500-10)]",
    amber: "text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)]",
    red: "text-[var(--api-red-400)] bg-[var(--api-red-500-10)]",
  };

  return (
    <div className={`rounded-2xl border ${colorClasses[color]} p-5 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-2.5 ${iconColors[color]}`}>
          {icon}
        </div>
        <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mt-2">{title}</p>
    </div>
  );
}

// ============================================================
// LOG ENTRY COMPONENT
// ============================================================

interface LogEntryItemProps {
  log: LogEntry;
}

function LogEntryItem({ log }: LogEntryItemProps) {
  const getEventIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      license_generated: <Key className="h-4 w-4 text-[var(--api-blue-400)]" />,
      license_validated: <ShieldCheck className="h-4 w-4 text-[var(--api-green-400)]" />,
      license_activated: <CheckCircle className="h-4 w-4 text-[var(--api-green-400)]" />,
      license_deactivated: <XCircle className="h-4 w-4 text-[var(--api-red-400)]" />,
      license_revoked: <XCircle className="h-4 w-4 text-[var(--api-red-400)]" />,
      device_bound: <Link2 className="h-4 w-4 text-[var(--api-cyan-400)]" />,
      device_replaced: <Repeat className="h-4 w-4 text-[var(--api-amber-400)]" />,
      device_reset: <RotateCcw className="h-4 w-4 text-[var(--api-red-400)]" />,
      device_unbound: <Unlink className="h-4 w-4 text-[var(--api-red-400)]" />,
      product_created: <Package className="h-4 w-4 text-[var(--api-purple-400)]" />,
      product_archived: <Package className="h-4 w-4 text-[var(--api-red-400)]" />,
      product_restored: <Package className="h-4 w-4 text-[var(--api-green-400)]" />,
      customer_created: <User className="h-4 w-4 text-[var(--api-green-400)]" />,
      trial_started: <Activity className="h-4 w-4 text-[var(--api-amber-400)]" />,
      trial_converted: <Activity className="h-4 w-4 text-[var(--api-green-400)]" />,
      trial_expired: <Activity className="h-4 w-4 text-[var(--api-red-400)]" />,
    };
    return icons[type] || <Info className="h-4 w-4 text-[var(--text-muted)]" />;
  };

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      license_generated: "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)]",
      license_validated: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
      license_activated: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
      license_deactivated: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
      license_revoked: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
      device_bound: "border-[var(--api-cyan-500-20)] bg-[var(--api-cyan-500-5)]",
      device_replaced: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
      device_reset: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
      device_unbound: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
      product_created: "border-[var(--api-purple-500-20)] bg-[var(--api-purple-500-5)]",
      product_archived: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
      product_restored: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
      customer_created: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
      trial_started: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
      trial_converted: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
      trial_expired: "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]",
    };
    return colors[type] || "border-[var(--border-color)] bg-[var(--bg-tertiary)]/5";
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      license_generated: "License Generated",
      license_validated: "License Validated",
      license_activated: "License Activated",
      license_deactivated: "License Deactivated",
      license_revoked: "License Revoked",
      device_bound: "Device Bound",
      device_replaced: "Device Replaced",
      device_reset: "Device Reset",
      device_unbound: "Device Unbound",
      product_created: "Product Created",
      product_archived: "Product Archived",
      product_restored: "Product Restored",
      customer_created: "Customer Created",
      trial_started: "Trial Started",
      trial_converted: "Trial Converted",
      trial_expired: "Trial Expired",
    };
    return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${getEventColor(log.event_type)} transition-all duration-200 hover:scale-[1.01]`}>
      <div className="mt-0.5 p-1.5 rounded-full bg-[var(--bg-tertiary)]/50">
        {getEventIcon(log.event_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)]/30 text-[var(--text-secondary)]">
            {getEventTypeLabel(log.event_type)}
          </span>
          <span className="text-sm text-[var(--text-primary)]">{log.message}</span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatTime(log.timestamp)}
          </span>
          {log.ip_address && (
            <span className="flex items-center gap-1">
              <Globe size={10} />
              {log.ip_address}
            </span>
          )}
          {log.license_key && (
            <span className="flex items-center gap-1 font-mono">
              <Key size={10} />
              {log.license_key}
            </span>
          )}
          {log.hardware_id && (
            <span className="flex items-center gap-1 font-mono">
              <Cpu size={10} />
              {log.hardware_id.slice(0, 12)}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN LOGS PAGE
// ============================================================

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);

  const API_BASE = "/internal/backend";

  const fetchLogs = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/logs?limit=${limit}&offset=${offset}`
      );
      const data: LogsResponse = await response.json();

      if (data.success) {
        setLogs(data.data || []);
        setTotal(data.pagination?.total || 0);
        setLastUpdated(new Date());

        // Extract unique event types
        const types = new Set<string>();
        data.data?.forEach((log) => {
          if (log.event_type) types.add(log.event_type);
        });
        setAvailableEventTypes(Array.from(types));
      } else {
        setError(data.error || "Failed to load logs");
      }
    } catch (err) {
      console.error("Logs fetch error:", err);
      setError("Failed to load logs. Please refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.license_key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.hardware_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ip_address?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      eventTypeFilter === "all" || log.event_type === eventTypeFilter;

    return matchesSearch && matchesType;
  });

  // Statistics
  const totalLogs = total;
  const uniqueEvents = availableEventTypes.length;

  const handleExport = () => {
    const csv = [
      ["ID", "Event Type", "Message", "Timestamp", "IP Address", "License Key", "Hardware ID"],
      ...filteredLogs.map((log) => [
        log.id,
        log.event_type,
        log.message,
        log.timestamp,
        log.ip_address || "",
        log.license_key || "",
        log.hardware_id || "",
      ]),
    ].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)] mt-3">Loading logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Logs Center</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            View and filter all system audit logs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={fetchLogs}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)]" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
            <button
              onClick={fetchLogs}
              className="ml-auto text-sm text-[var(--api-blue-400)] hover:text-blue-300"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Logs"
          value={totalLogs}
          icon={<FileText className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Event Types"
          value={uniqueEvents}
          icon={<Activity className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Current Page"
          value={currentPage}
          icon={<Eye className="h-5 w-5" />}
          color="cyan"
        />
        <StatCard
          title="Showing"
          value={filteredLogs.length}
          icon={<Info className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search logs by message, license key, hardware ID, or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
          >
            <option value="all">All Events</option>
            {availableEventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
          >
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
          </select>
        </div>
      </div>

      {/* Log List */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <FileText className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm font-medium">No logs found</p>
            <p className="text-xs mt-1">
              {searchQuery || eventTypeFilter !== "all"
                ? "Try adjusting your search or filters"
                : "No logs have been recorded yet"}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => <LogEntryItem key={log.id} log={log} />)
        )}
      </div>

      {/* Pagination */}
      {totalLogs > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-muted)]">
            Showing {offset + 1} to {Math.min(offset + filteredLogs.length, total)} of {total} logs
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0}
              className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-[var(--text-secondary)] px-3">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={handleNextPage}
              disabled={offset + limit >= total}
              className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${logs.length > 0 ? "bg-green-400 animate-pulse" : "bg-amber-400"}`} />
          <span>Logs API: {logs.length > 0 ? "Online" : "Active"}</span>
        </div>
        {lastUpdated && (
          <span>Last updated: {lastUpdated.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}