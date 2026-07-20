"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, Gift, Clock, Search, Loader2, AlertCircle, RefreshCw, CheckCircle, XCircle, ArrowRight, Trash2, User, Mail, Cpu, Calendar } from "lucide-react";

interface Trial {
  id: number;
  hardware_id: string;
  status: string;
  started_at: string;
  expiry_date: string;
  days_left: number;
  product_id: string;
  product_name: string;
  plan_name: string;
  trial_days_limit: number;
  max_devices: number;
  converted_at: string | null;
  converted_to_license_key: string | null;
  can_convert: boolean;
  is_expired: boolean;
  is_converted: boolean;
  customer_name?: string;
  customer_email?: string;
}

export default function TrialsPage() {
  const router = useRouter();
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const API_BASE = "/internal/backend";

  const fetchTrials = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/trials`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) setTrials(data.trials || []);
      else setTrials([]);
    } catch {
      setError("Failed to load trials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrials(); }, []);

  const handleConvert = (t: Trial) => {
    if (!t.can_convert) return;
    router.push(`/internal/api/licenses/generate?trial=${t.hardware_id}&product=${t.product_id}`);
  };

  const handleExtend = async (t: Trial) => {
    const days = prompt("Enter additional days:", "7");
    if (!days || isNaN(parseInt(days)) || parseInt(days) < 1) return;
    setActionLoading(`extend-${t.id}`);
    try {
      const res = await fetch(`${API_BASE}/trials/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hardware_id: t.hardware_id, extend_days: parseInt(days) }),
      });
      const data = await res.json();
      if (data.success) { alert(`✅ Extended by ${days} days`); fetchTrials(); }
      else alert(`❌ ${data.error || "Failed"}`);
    } catch { alert("❌ Failed"); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (t: Trial) => {
    if (!confirm("Delete this trial? Cannot be undone.")) return;
    setActionLoading(`delete-${t.id}`);
    try {
      const res = await fetch(`${API_BASE}/admin/trials`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id }),
      });
      const data = await res.json();
      if (data.success) setTrials(prev => prev.filter(x => x.id !== t.id));
      else alert(`❌ ${data.error || "Failed"}`);
    } catch { alert("❌ Failed"); }
    finally { setActionLoading(null); }
  };

  const filtered = trials.filter(t => {
    if (filterStatus === "active" && t.status !== "active") return false;
    if (filterStatus === "expired" && !t.is_expired) return false;
    if (filterStatus === "converted" && !t.is_converted) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.hardware_id?.toLowerCase().includes(q) && !t.product_name?.toLowerCase().includes(q) && !t.customer_name?.toLowerCase().includes(q) && !t.customer_email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeCount = trials.filter(t => t.status === "active" && !t.is_expired).length;
  const expiredCount = trials.filter(t => t.is_expired).length;
  const convertedCount = trials.filter(t => t.is_converted).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        <span className="ml-3 text-gray-400">Loading trials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trials Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Manage trial licenses across all products</p>
        </div>
        <button onClick={fetchTrials} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center justify-between">
            <Activity className="h-5 w-5 text-blue-400" />
            <span className="text-2xl font-bold text-white">{trials.length}</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">Total Trials</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <div className="flex items-center justify-between">
            <Gift className="h-5 w-5 text-green-400" />
            <span className="text-2xl font-bold text-white">{activeCount}</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">Active</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <Clock className="h-5 w-5 text-amber-400" />
            <span className="text-2xl font-bold text-white">{expiredCount}</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">Expired</p>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-center justify-between">
            <CheckCircle className="h-5 w-5 text-purple-400" />
            <span className="text-2xl font-bold text-white">{convertedCount}</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">Converted</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchTrials} className="ml-auto text-sm text-blue-400 hover:text-blue-300">Retry</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by hardware ID, product, customer..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white text-sm focus:outline-none">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20 relative overflow-hidden">
          <svg className="absolute top-10 right-10 w-48 h-48 text-gray-800/20" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="1" strokeDasharray="6 4" />
            <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="100" cy="100" r="20" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
            <path d="M100 20L100 180M20 100L180 100" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          </svg>
          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 flex items-center justify-center">
              <Gift className="h-10 w-10 text-blue-400/40" />
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2 text-center">No Trials Found</h3>
            <p className="text-sm text-gray-600 max-w-md text-center leading-relaxed">
              {searchQuery || filterStatus !== "all"
                ? "No trials match your current search or filter. Try different keywords or clear the filters."
                : "No trial licenses have been created yet. Trials are started automatically when users activate a trial plan on your products."}
            </p>
            {!searchQuery && filterStatus === "all" && (
              <p className="text-xs text-gray-700 mt-4 text-center">
                To create a trial plan, go to <span className="text-blue-500 font-mono">Products → Plans</span> and enable <span className="text-blue-500">"Is Trial"</span> on any plan.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Days Left</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Hardware ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-white">{t.customer_name || "—"}</p>
                        {t.customer_email && <p className="text-[10px] text-gray-500">{t.customer_email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-300">{t.product_name || t.product_id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-300">{t.plan_name || "Trial"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {t.is_converted ? (
                      <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">Converted</span>
                    ) : t.is_expired ? (
                      <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Expired</span>
                    ) : (
                      <span className={`text-sm font-medium ${t.days_left <= 3 ? "text-red-400" : t.days_left <= 7 ? "text-amber-400" : "text-green-400"}`}>
                        {t.days_left}d
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {t.expiry_date ? new Date(t.expiry_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-[10px] text-gray-500 font-mono bg-gray-800 px-1.5 py-0.5 rounded">{t.hardware_id?.substring(0, 20)}...</code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {t.can_convert && (
                        <button onClick={() => handleConvert(t)} disabled={actionLoading === `convert-${t.id}`} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-all" title="Convert to Paid">
                          <ArrowRight size={14} />
                        </button>
                      )}
                      {!t.is_expired && !t.is_converted && (
                        <button onClick={() => handleExtend(t)} disabled={actionLoading === `extend-${t.id}`} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-all" title="Extend">
                          <Clock size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(t)} disabled={actionLoading === `delete-${t.id}`} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
        <span>{filtered.length} of {trials.length} trials</span>
        <span>{activeCount} active, {expiredCount} expired, {convertedCount} converted</span>
      </div>
    </div>
  );
}
