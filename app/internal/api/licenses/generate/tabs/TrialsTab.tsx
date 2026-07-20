// FILE: app/internal/api/licenses/generate/tabs/TrialsTab.tsx
// PURPOSE: Tab 5 - Trials with full details (product, plan, conversion info)
// SCOPE: View trial licenses with complete information
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Loader2,
  Gift,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  User,
  Mail,
  Phone,
  Cpu,
  HardDrive,
  Calendar,
  Globe,
  Database,
  Shield,
  AlertTriangle,
  Smartphone,
  Monitor,
  Server,
  Box,
  Info,
  Link2
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface Trial {
  id: number;
  hardware_id: string;
  status: string;
  started_at: string;
  expiry_date: string;
  days_left: number;
  product_id: string;
  product_name: string;
  plan_id: number;
  plan_name: string;
  trial_days_limit: number;
  max_devices: number;
  is_trial_plan: boolean;
  converted_at: string | null;
  converted_to_license_key: string | null;
  can_convert: boolean;
  is_expired: boolean;
  is_converted: boolean;
  user_id?: string;
  customer_name?: string;
  customer_email?: string;
  mobile_number?: string;
  ip_address?: string;
  cpu_id?: string;
  motherboard_id?: string;
  device_hash?: string;
  software_version?: string;
  os_info?: any;
  installation_timestamp?: string;
  trial_template_id?: number;
}

// ============================================================
// TRIALS TAB
// ============================================================

export function TrialsTab() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const API_BASE = "/internal/backend";

  // ============================================================
  // FETCH TRIALS
  // ============================================================
  useEffect(() => {
    const fetchTrials = async () => {
      try {
        setLoading(true);
        setApiError(null);
        
        const response = await fetch(`${API_BASE}/trials`);
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setTrials(data.trials || []);
          if (!data.trials || data.trials.length === 0) {
            setApiError(null);
          }
        } else {
          setTrials([]);
        }
      } catch (err) {
        console.error("Failed to fetch trials:", err);
        setApiError(err instanceof Error ? err.message : "Unknown error");
        setTrials([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrials();
  }, []);

  // ============================================================
  // ACTIONS
  // ============================================================
  const handleExtendTrial = async (trialId: number, hardwareId: string) => {
    const days = prompt('Enter additional days to extend:', '7');
    if (!days || isNaN(parseInt(days)) || parseInt(days) < 1) return;
    setActionLoading(`extend-${trialId}`);
    try {
      const res = await fetch(`${API_BASE}/trials/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardware_id: hardwareId, extend_days: parseInt(days) }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Trial extended by ${days} days`);
      } else {
        alert(`❌ ${data.error || 'Failed to extend trial'}`);
      }
    } catch {
      alert('❌ Failed to extend trial');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTrial = async (trialId: number) => {
    if (!confirm('Delete this trial record? This cannot be undone.')) return;
    setActionLoading(`delete-${trialId}`);
    try {
      const res = await fetch(`${API_BASE}/admin/trials`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trialId }),
      });
      const data = await res.json();
      if (data.success) {
        setTrials(prev => prev.filter(t => t.id !== trialId));
      } else {
        alert(`❌ ${data.error || 'Failed to delete trial'}`);
      }
    } catch {
      alert('❌ Failed to delete trial');
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-[var(--api-green-400)] bg-[var(--api-green-500-10)] border-[var(--api-green-500-20)]";
      case "converted":
        return "text-[var(--api-blue-400)] bg-[var(--api-blue-500-10)] border-[var(--api-blue-500-20)]";
      case "expired":
        return "text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)] border-[var(--api-amber-500-20)]";
      default:
        return "text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border-color)]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Activity className="h-3 w-3" />;
      case "converted":
        return <CheckCircle className="h-3 w-3" />;
      case "expired":
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const hasFingerprint = (trial: Trial) => {
    return !!(trial.cpu_id || trial.motherboard_id || trial.device_hash);
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-2">
        <Loader2 className="h-6 w-6 text-[var(--api-blue-400)] animate-spin" />
        <p className="text-sm text-[var(--text-muted)]">Loading trials...</p>
      </div>
    );
  }

  const activeCount = trials.filter((t) => t.status === "active" && t.days_left > 0).length;
  const convertedCount = trials.filter((t) => t.status === "converted").length;
  const expiredCount = trials.filter((t) => t.status === "expired" || (t.status === "active" && t.days_left === 0)).length;

  const filteredTrials = trials.filter(t => {
    const q = searchQuery.toLowerCase();
    if (q && !t.hardware_id.toLowerCase().includes(q) && !(t.product_name || '').toLowerCase().includes(q) && !(t.customer_name || '').toLowerCase().includes(q) && !(t.customer_email || '').toLowerCase().includes(q)) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {apiError && (
        <div className="rounded-xl border border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)] p-3 text-sm text-[var(--api-amber-400)] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>Error: {apiError}</span>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search trials by hardware ID, product, customer..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="converted">Converted</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border-color)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--text-primary)]">{trials.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Total</p>
        </div>
        <div className="rounded-xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--api-green-400)]">{activeCount}</p>
          <p className="text-xs text-[var(--text-muted)]">Active</p>
        </div>
        <div className="rounded-xl border border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--api-blue-400)]">{convertedCount}</p>
          <p className="text-xs text-[var(--text-muted)]">Converted</p>
        </div>
        <div className="rounded-xl border border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--api-amber-400)]">{expiredCount}</p>
          <p className="text-xs text-[var(--text-muted)]">Expired</p>
        </div>
      </div>

      {/* Empty State */}
      {filteredTrials.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-[var(--bg-tertiary)]/20 mb-4">
            <Gift className="h-16 w-16 text-[var(--text-muted)] opacity-20" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            {searchQuery || filterStatus !== 'all' ? 'No matching trials' : 'No trials yet'}
          </h3>
          <p className="text-sm text-[var(--text-muted)] max-w-sm">
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your search or filter to find what you\'re looking for.'
              : 'Trial licenses will appear here when customers start using your products.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filteredTrials.slice(0, 50).map((trial) => {
            const isExpanded = expandedId === trial.id;
            const hasFP = hasFingerprint(trial);
            const canConvert = trial.status === 'active' && trial.days_left > 0;
            
            return (
              <div
                key={trial.id}
                className={`rounded-xl border transition-all ${
                  trial.status === "active" && trial.days_left > 0
                    ? "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] hover:border-[var(--api-green-400)]"
                    : trial.status === "converted"
                    ? "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)]"
                    : "border-[var(--border-color)] bg-[var(--bg-tertiary)]/5"
                }`}
              >
                {/* Main Row */}
                <div className="p-3 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--api-blue-500-10)] shrink-0">
                    <Activity className="h-4 w-4 text-[var(--api-blue-400)]" />
                  </div>

                  {/* Product & Customer */}
                  <div className="flex-1 min-w-0 grid grid-cols-5 gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Product</p>
                      <p className="text-[var(--text-primary)] font-medium truncate">{trial.product_name || '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Customer</p>
                      <p className="text-[var(--text-primary)] truncate">{trial.customer_name || trial.customer_email || '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Days Left</p>
                      <p className={`font-medium ${trial.days_left > 0 && trial.days_left <= 7 ? 'text-amber-400' : trial.days_left > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trial.days_left > 0 ? `${trial.days_left}d` : 'Expired'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Expires</p>
                      <p className="text-[var(--text-primary)]">{formatDate(trial.expiry_date)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Devices</p>
                      <p className="text-[var(--text-primary)]">{trial.max_devices || 1}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${getStatusColor(trial.status)}`}>
                    {getStatusIcon(trial.status)}
                    {trial.status}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {canConvert && (
                      <button
                        onClick={() => window.location.href = `/internal/api/licenses/generate?trial=${trial.hardware_id}&product=${trial.product_id}`}
                        className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all"
                      >
                        Convert
                      </button>
                    )}
                    {trial.status === 'active' && (
                      <button
                        onClick={() => handleExtendTrial(trial.id, trial.hardware_id)}
                        disabled={actionLoading === `extend-${trial.id}`}
                        className="px-2.5 py-1.5 rounded-lg border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/10 transition-colors"
                      >
                        {actionLoading === `extend-${trial.id}` ? '...' : 'Extend'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTrial(trial.id)}
                      disabled={actionLoading === `delete-${trial.id}`}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      {actionLoading === `delete-${trial.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" /> : <XCircle className="h-3.5 w-3.5 text-[var(--text-muted)] hover:text-red-400" />}
                    </button>
                    <button
                      onClick={() => toggleExpand(trial.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                    >
                      {isExpanded ? <ArrowRight className="h-3.5 w-3.5 rotate-90 text-[var(--text-muted)]" /> : <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                    </button>
                  </div>
                </div>

                {/* Converted Info */}
                {trial.status === 'converted' && trial.converted_to_license_key && (
                  <div className="px-3 pb-3 flex items-center gap-2 text-xs ml-11">
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="text-green-400">Converted to:</span>
                    <code className="font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)]/30 px-1.5 py-0.5 rounded">{trial.converted_to_license_key}</code>
                  </div>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-2 border-t border-[var(--border-color)] ml-11 space-y-2 text-xs">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="font-medium text-[var(--text-secondary)] mb-1">Hardware</p>
                        {trial.cpu_id && <p className="text-[var(--text-muted)]">CPU: {trial.cpu_id}</p>}
                        {trial.motherboard_id && <p className="text-[var(--text-muted)]">MB: {trial.motherboard_id}</p>}
                        {trial.device_hash && <p className="text-[var(--text-muted)]">Hash: <code className="bg-[var(--bg-tertiary)] px-1 rounded">{trial.device_hash.substring(0, 16)}...</code></p>}
                        {trial.os_info && <p className="text-[var(--text-muted)]">OS: {typeof trial.os_info === 'object' ? `${trial.os_info.name || ''} ${trial.os_info.version || ''}` : trial.os_info}</p>}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-secondary)] mb-1">Contact</p>
                        {trial.customer_email && <p className="text-[var(--text-muted)]">Email: {trial.customer_email}</p>}
                        {trial.mobile_number && <p className="text-[var(--text-muted)]">Phone: {trial.mobile_number}</p>}
                        {trial.ip_address && <p className="text-[var(--text-muted)]">IP: {trial.ip_address}</p>}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-secondary)] mb-1">Timeline</p>
                        <p className="text-[var(--text-muted)]">Started: {formatDateTime(trial.started_at)}</p>
                        <p className="text-[var(--text-muted)]">Expires: {formatDateTime(trial.expiry_date)}</p>
                        {trial.installation_timestamp && <p className="text-[var(--text-muted)]">Installed: {formatDateTime(trial.installation_timestamp)}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredTrials.length > 50 && (
            <div className="text-center text-xs text-[var(--text-muted)] py-2">
              Showing 50 of {filteredTrials.length} trials
            </div>
          )}
        </div>
      )}
    </div>
  );
}