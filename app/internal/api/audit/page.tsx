"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollText, Search, RefreshCw, Loader2, AlertCircle, Filter, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLog {
  id: number;
  event_type: string;
  message: string;
  ip_address: string | null;
  license_key: string | null;
  hardware_id: string | null;
  timestamp: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const API_BASE = "/internal/backend/admin/logs";

  const getHeaders = () => {
    const token = localStorage.getItem("api_center_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}?limit=${pageSize}&offset=${currentPage * pageSize}`, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
        setTotalCount(data.total || data.data?.length || 0);
      } else setError(data.error || "Failed to load");
    } catch {
      setError("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const getEventColor = (type: string) => {
    switch (type) {
      case "create": case "generated": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "delete": case "revoked": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "update": case "edited": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "activate": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "deactivate": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default: return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  const filtered = logs.filter(l => {
    if (filterType !== "all" && l.event_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!l.message?.toLowerCase().includes(q) && !l.license_key?.toLowerCase().includes(q) && !l.hardware_id?.toLowerCase().includes(q) && !l.ip_address?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const eventTypes = [...new Set(logs.map(l => l.event_type))].filter(Boolean);

  const totalPages = Math.ceil(totalCount / pageSize);

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        <span className="ml-3 text-gray-400">Loading audit logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-gray-400 mt-1">{totalCount} total events recorded</p>
        </div>
        <button onClick={fetchLogs} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchLogs} className="ml-auto text-sm text-blue-400 hover:text-blue-300">Retry</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by message, license, hardware, IP..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white text-sm focus:outline-none">
          <option value="all">All Events</option>
          {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 border border-gray-800 rounded-2xl bg-gray-900/30">
          <ScrollText className="h-12 w-12 opacity-20 mb-3" />
          <p className="text-sm font-medium">No audit logs found</p>
          <p className="text-xs mt-1">{searchQuery || filterType !== "all" ? "Try adjusting filters" : "No events recorded yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(l => (
            <div key={l.id} className="rounded-xl border border-gray-800 bg-gray-900/20 p-4 hover:border-gray-700 transition-all">
              <div className="flex items-start gap-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${getEventColor(l.event_type)}`}>
                  {l.event_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300">{l.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {l.license_key && <span className="text-[10px] text-gray-500 font-mono">License: {l.license_key}</span>}
                    {l.hardware_id && <span className="text-[10px] text-gray-500 font-mono">HW: {l.hardware_id.substring(0, 16)}...</span>}
                    {l.ip_address && <span className="text-[10px] text-gray-500">IP: {l.ip_address}</span>}
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 flex-shrink-0">{new Date(l.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-400">Page {currentPage + 1} of {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
