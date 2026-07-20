"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, Trash2, Loader2, AlertCircle, CheckCircle, X, RefreshCw, Filter, Search } from "lucide-react";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const API_BASE = "/internal/backend/api/notifications";

  const getHeaders = () => {
    const token = localStorage.getItem("api_center_token");
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
  };

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) setNotifications(data.data || []);
      else setError(data.error || "Failed to load");
    } catch (err) {
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkRead = async (id: number) => {
    try {
      await fetch(`${API_BASE}/${id}`, { method: "PATCH", headers: getHeaders(), body: JSON.stringify({ read: true }) });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API_BASE}/read-all`, { method: "POST", headers: getHeaders() });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${API_BASE}/${id}`, { method: "DELETE", headers: getHeaders() });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch {}
  };

  const handleDeleteSelected = async () => {
    for (const id of selectedIds) await handleDelete(id);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const filtered = notifications.filter(n => {
    if (filterRead === "unread" && n.read) return false;
    if (filterRead === "read" && !n.read) return false;
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase()) && !n.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        <span className="ml-3 text-gray-400">Loading notifications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm text-blue-400 hover:bg-blue-500/20 transition-all">
              <CheckCheck size={14} /> Mark All Read
            </button>
          )}
          <button onClick={fetchNotifications} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-all">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchNotifications} className="ml-auto text-sm text-blue-400 hover:text-blue-300">Try Again</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search notifications..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        <select value={filterRead} onChange={e => setFilterRead(e.target.value as any)} className="px-3 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white text-sm focus:outline-none">
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        {selectedIds.size > 0 && (
          <button onClick={handleDeleteSelected} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400 hover:bg-red-500/20 transition-all">
            <Trash2 size={14} /> Delete ({selectedIds.size})
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 border border-gray-800 rounded-2xl bg-gray-900/30">
          <Bell className="h-12 w-12 opacity-20 mb-3" />
          <p className="text-sm font-medium">No notifications found</p>
          <p className="text-xs mt-1">{searchQuery || filterRead !== "all" ? "Try adjusting filters" : "You're all caught up!"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div key={n.id} className={`rounded-xl border transition-all duration-200 ${n.read ? "border-gray-800 bg-gray-900/20" : "border-blue-500/20 bg-blue-500/5"}`}>
              <div className="flex items-start gap-3 p-4">
                <input type="checkbox" checked={selectedIds.has(n.id)} onChange={() => toggleSelect(n.id)} className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-medium ${n.read ? "text-gray-400" : "text-white"}`}>{n.title}</h3>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />}
                    <span className="text-[10px] text-gray-500 ml-auto">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{n.message}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.read && (
                    <button onClick={() => handleMarkRead(n.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Mark read">
                      <CheckCircle size={14} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-600 pt-4 border-t border-gray-800">
        <span>{filtered.length} of {notifications.length} shown</span>
        <span>{unreadCount} unread</span>
      </div>
    </div>
  );
}
