"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Search,
  Loader2,
  ShieldCheck,
  KeyRound,
  User,
  Mail,
  Phone,
  Building2,
  Globe,
  Package,
  Cpu,
  HardDrive,
  Monitor,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Repeat,
  History,
  MessageSquare,
  FileText,
  Smartphone,
  Activity,
  Zap,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Ban,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Button from "@/components/ui/Button";

const API_BASE = "/internal/backend";

interface PlanData {
  id: number; name: string; description: string; max_devices: number;
  default_expiry_days: number; price: number; is_active: boolean; features: any; display_order: number;
}

interface ProductData { product_id: string; name: string; is_active: boolean; }

interface HardwareRecord {
  hardware_id: string; device_name: string; ip_address: string; os_version: string;
  activated_at: string; last_seen: string; status: string;
}

interface LicenseData {
  license_key: string; customer_name: string; customer_email: string;
  plan: string; plan_id: number; status: string; expiry_date: string;
  days_remaining: number; max_devices: number; device_count: number;
  is_activated: boolean; is_trial: boolean; product_id: string;
}

interface CustomerData {
  id: number; email: string; name: string; phone: string; mobile: string;
  company: string; country: string; status: string; hardware_id: string;
  product_id?: string; plan_id?: number;
}

interface TrialData {
  started_at: string; expiry_date: string; days_remaining: number;
  status: string; is_expired: boolean; is_converted: boolean;
  converted_to_license_key: string | null; product_id: string;
  product_name: string; plan_name: string; max_devices: number;
}

interface SearchResult {
  customer: CustomerData | null;
  trial: TrialData | null;
  license: LicenseData | null;
  hardware: HardwareRecord[];
  plans: PlanData[];
  products: ProductData[];
}

interface TimelineEvent {
  id: number; type: string; message: string; timestamp: string;
  ip_address: string; hardware_id: string; color: string; label: string;
}

interface TimelineData {
  events: TimelineEvent[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status, variant }: { status: string; variant?: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    inactive: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    expired: "bg-red-500/15 text-red-400 border-red-500/20",
    revoked: "bg-pink-500/15 text-pink-400 border-pink-500/20",
    suspended: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    trial: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    paid: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    converted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    online: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    offline: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorMap[status?.toLowerCase()] || "bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] border-[var(--border-color)]"}`}>
      {status}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
      {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
    </button>
  );
}

function MaskedText({ text, showChars = 4 }: { text: string; showChars?: number }) {
  const [show, setShow] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs">
        {show ? text : `${text.slice(0, showChars)}${"\u2022".repeat(Math.min(text.length - showChars, 16))}`}
      </span>
      <button onClick={() => setShow(!show)} className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      <CopyButton text={text} />
    </span>
  );
}

const SEARCH_FIELDS = [
  { value: "license_key", label: "License Key", icon: KeyRound },
  { value: "customer_name", label: "Customer Name", icon: User },
  { value: "email", label: "Email", icon: Mail },
  { value: "mobile", label: "Mobile", icon: Phone },
  { value: "hardware_id", label: "Hardware ID", icon: HardDrive },
  { value: "device_name", label: "Device Name", icon: Monitor },
  { value: "activation_id", label: "Activation ID", icon: Zap },
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
  { value: "trial", label: "Trial" },
  { value: "paid", label: "Paid" },
];

function AdminActivationSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-[var(--bg-tertiary)]/30 rounded-xl w-1/3" />
      <div className="h-4 bg-[var(--bg-tertiary)]/30 rounded-xl w-2/3" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 bg-[var(--bg-tertiary)]/30 rounded-xl" />
        <div className="h-24 bg-[var(--bg-tertiary)]/30 rounded-xl" />
        <div className="h-24 bg-[var(--bg-tertiary)]/30 rounded-xl" />
      </div>
    </div>
  );
}

function TimelineDot({ color }: { color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500 border-blue-500/30",
    purple: "bg-purple-500 border-purple-500/30",
    emerald: "bg-emerald-500 border-emerald-500/30",
    red: "bg-red-500 border-red-500/30",
    pink: "bg-pink-500 border-pink-500/30",
    amber: "bg-amber-500 border-amber-500/30",
    orange: "bg-orange-500 border-orange-500/30",
    yellow: "bg-yellow-500 border-yellow-500/30",
    gray: "bg-gray-500 border-gray-500/30",
  };
  return (
    <div className={`w-3 h-3 rounded-full border-2 ${colorMap[color] || colorMap.gray} shrink-0 mt-1.5`} />
  );
}

export default function AdministratorActivationCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState("license_key");
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showLicenseKey, setShowLicenseKey] = useState(false);
  const [previousDevices, setPreviousDevices] = useState<HardwareRecord[]>([]);

  const doSearch = useCallback(async (query: string, field: string) => {
    const q = query.trim();
    if (!q) { setError("Enter a search term"); return; }

    setSearching(true);
    setError(null);
    setResult(null);
    setTimeline([]);
    setPreviousDevices([]);
    setActionResult(null);

    try {
      const params = new URLSearchParams();
      params.set(field, q);

      const res = await fetch(`${API_BASE}/activation/search?${params}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Search failed");
        return;
      }

      setResult(data.data);

      if (data.data.hardware?.length > 1) {
        setPreviousDevices(data.data.hardware.slice(1));
      }

      const lk = data.data.license?.license_key;
      if (lk) {
        setTimelineLoading(true);
        fetch(`${API_BASE}/activation/timeline?license_key=${encodeURIComponent(lk)}&limit=20`)
          .then(r => r.json())
          .then(td => {
            if (td.success) setTimeline(td.data.events || []);
          })
          .catch(() => {})
          .finally(() => setTimelineLoading(false));
      }
    } catch {
      setError("Failed to search. Check connection.");
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearch = () => doSearch(searchQuery, searchField);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleRefresh = useCallback(() => {
    if (result?.license?.license_key) {
      doSearch(result.license.license_key, "license_key");
    } else if (result?.customer?.email) {
      doSearch(result.customer.email, "email");
    }
  }, [result, doSearch]);

  const handleDeactivateDevice = useCallback(async () => {
    if (!result?.hardware?.[0] || !result?.license?.license_key) return;
    setActionLoading("deactivate");
    setActionResult(null);
    try {
      const token = localStorage.getItem("api_center_token");
      const res = await fetch(`${API_BASE}/activation/device-deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          hardware_id: result.hardware[0].hardware_id,
          license_key: result.license.license_key,
        }),
      });
      const data = await res.json();
      setActionResult({ success: data.success, message: data.message || data.error || "Operation completed" });
      if (data.success) handleRefresh();
    } catch {
      setActionResult({ success: false, message: "Failed to deactivate device" });
    } finally {
      setActionLoading(null);
    }
  }, [result, handleRefresh]);

  const handleRefreshStatus = useCallback(async () => {
    if (!result?.license?.license_key) return;
    setActionLoading("refresh");
    setActionResult(null);
    try {
      const res = await fetch(`${API_BASE}/licenses/validate?license_key=${encodeURIComponent(result.license.license_key)}&hardware_id=${result.hardware?.[0]?.hardware_id || ''}`);
      const data = await res.json();
      setActionResult({
        success: data.valid || data.success,
        message: data.valid ? "License is valid and active" : (data.error || "License validation failed"),
      });
    } catch {
      setActionResult({ success: false, message: "Failed to refresh status" });
    } finally {
      setActionLoading(null);
    }
  }, [result]);

  const getValidationError = (): { icon: typeof AlertCircle; color: string; title: string; detail: string } | null => {
    if (!error) return null;
    const e = error.toLowerCase();
    if (e.includes("not found") || e.includes("not exist")) {
      return { icon: XCircle, color: "text-red-400", title: "Not Found", detail: error };
    }
    if (e.includes("inactive")) {
      return { icon: AlertTriangle, color: "text-amber-400", title: "License Inactive", detail: error };
    }
    if (e.includes("expired")) {
      return { icon: Clock, color: "text-red-400", title: "License Expired", detail: error };
    }
    if (e.includes("revoked")) {
      return { icon: Ban, color: "text-pink-400", title: "License Revoked", detail: error };
    }
    if (e.includes("limit") || e.includes("max devices")) {
      return { icon: AlertTriangle, color: "text-orange-400", title: "Activation Limit Reached", detail: error };
    }
    return { icon: AlertCircle, color: "text-red-400", title: "Error", detail: error };
  };

  const validationError = getValidationError();
  const filteredPlans = result?.plans?.filter(p => planFilter === "all" || String(p.id) === planFilter) || [];
  const filteredProducts = result?.products?.filter(p => productFilter === "all" || p.product_id === productFilter) || [];

  const SelectedFieldIcon = SEARCH_FIELDS.find(f => f.value === searchField)?.icon || Search;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Administrator Activation Center</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Search, validate, and manage license activations
          </p>
        </div>
        {result && (
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-blue-500/30 transition-all">
            <RefreshCw size={14} className={searching ? "animate-spin" : ""} />
            Refresh
          </button>
        )}
      </div>

      {/* Universal Search */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowFieldDropdown(!showFieldDropdown)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-primary)] hover:border-blue-500/30 transition-all">
              <SelectedFieldIcon size={14} className="text-blue-400" />
              <span>{SEARCH_FIELDS.find(f => f.value === searchField)?.label}</span>
              <ChevronDown size={12} className="text-[var(--text-muted)]" />
            </button>
            {showFieldDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-xl z-50 overflow-hidden">
{SEARCH_FIELDS.map(f => {
  const Icon = f.icon;
  return (
    <button key={f.value} onClick={() => {
      if (f.value !== searchField) {
        setSearchField(f.value);
        setSearchQuery("");
        setResult(null);
        setError(null);
        setTimeline([]);
        setPreviousDevices([]);
        setActionResult(null);
      }
      setShowFieldDropdown(false);
    }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all hover:bg-[var(--bg-tertiary)]/20 ${searchField === f.value ? "text-blue-400 bg-blue-500/10" : "text-[var(--text-secondary)]"}`}>
      <Icon size={14} />
      {f.label}
    </button>
  );
})}
              </div>
            )}
          </div>
          <div className="relative flex-1">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Search by ${SEARCH_FIELDS.find(f => f.value === searchField)?.label.toLowerCase()}...`}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm" />
          </div>
          <Button onClick={handleSearch} isLoading={searching} leftIcon={<Search size={16} />}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
              statusFilter === f.value
                ? "bg-blue-500/20 text-[var(--api-blue-400)] border-blue-500/30"
                : "text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/20"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className={`rounded-2xl border p-4 ${actionResult.success ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
          <div className="flex items-center gap-3">
            {actionResult.success
              ? <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              : <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            }
            <p className={`text-sm ${actionResult.success ? "text-emerald-400" : "text-red-400"}`}>
              {actionResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {validationError && !result && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${validationError.color} bg-current/10`}>
              <validationError.icon size={24} className={validationError.color} />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{validationError.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{validationError.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Loading */}
      {searching && <AdminActivationSkeleton />}

      {/* No Results Yet */}
      {!result && !searching && !error && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/10">
            <ShieldCheck size={32} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Search the Activation Center</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
            Enter a license key, customer name, email, mobile number, hardware ID, device name, or activation ID to retrieve a complete activation profile.
          </p>
        </div>
      )}

      {/* Search Results */}
      {result && !searching && (
        <div className="space-y-6">
          {/* Customer Summary Panel */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20">
              <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <User size={16} className="text-blue-400" />
                Customer Summary
              </h2>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Customer Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Customer</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <User size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Name</p>
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{result.customer?.name || result.license?.customer_name || "\u2014"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Email</p>
                      <p className="text-sm text-[var(--text-primary)] truncate">{result.customer?.email || result.license?.customer_email || "\u2014"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Mobile</p>
                      <p className="text-sm text-[var(--text-primary)]">{result.customer?.mobile || result.customer?.phone || "\u2014"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Company</p>
                      <p className="text-sm text-[var(--text-primary)]">{result.customer?.company || "\u2014"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Country</p>
                      <p className="text-sm text-[var(--text-primary)]">{result.customer?.country || "\u2014"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product & License Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Product &amp; License</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <Package size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Product</p>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {result.products?.find(p => p.product_id === (result.license?.product_id || result.customer?.product_id))?.name || "\u2014"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <KeyRound size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Plan</p>
                      <p className="text-sm text-[var(--text-primary)]">{result.license?.plan || result.trial?.plan_name || "\u2014"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Activity size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Type</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {result.license?.is_trial ? <StatusBadge status="trial" /> : result.license ? <StatusBadge status="paid" /> : result.trial ? <StatusBadge status="trial" /> : "\u2014"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Monitor size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Max Devices</p>
                      <p className="text-sm text-[var(--text-primary)]">{result.license?.max_devices || result.trial?.max_devices || "\u2014"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <KeyRound size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">License Key</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {result.license?.license_key ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-mono text-xs">
                              {showLicenseKey
                                ? result.license.license_key
                                : `${result.license.license_key.slice(0, 8)}${"\u2022".repeat(12)}${result.license.license_key.slice(-4)}`
                              }
                            </span>
                            <button onClick={() => setShowLicenseKey(!showLicenseKey)}
                              className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                              {showLicenseKey ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <CopyButton text={result.license.license_key} />
                          </span>
                        ) : "\u2014"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={result.license?.status || "inactive"} />
                  </div>
                </div>
              </div>

              {/* Activation & Dates Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Activation &amp; Dates</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <Calendar size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Created Date</p>
                      <p className="text-sm text-[var(--text-primary)]">{formatDate(result.license?.expiry_date ? "N/A" : null)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Expiry Date</p>
                      <p className="text-sm text-[var(--text-primary)]">{formatDate(result.license?.expiry_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Remaining Days</p>
                      <p className={`text-sm font-semibold ${(result.license?.days_remaining || 0) <= 7 ? "text-red-400" : "text-emerald-400"}`}>
                        {result.license?.days_remaining !== undefined ? `${result.license.days_remaining} days` : "\u2014"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Activation Status</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {result.hardware?.[0] ? <StatusBadge status={result.hardware[0].status || "active"} /> : "\u2014"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar size={14} className="text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">Last Seen</p>
                      <p className="text-sm text-[var(--text-primary)]">{formatDateTime(result.hardware?.[0]?.last_seen)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hardware Section */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20">
              <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <HardDrive size={16} className="text-blue-400" />
                Device Information
                <span className="ml-auto text-xs text-[var(--text-muted)] font-normal">
                  {result.hardware?.length || 0} device(s) &middot; {Math.max(0, (result.license?.max_devices || 1) - (result.license?.device_count || 0))} slot(s) remaining
                </span>
              </h2>
            </div>

            <div className="p-6">
              {/* Current Device */}
              {result.hardware?.[0] && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle size={12} />
                    Current Device
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Hardware ID</p>
                      <p className="text-sm font-mono text-[var(--text-primary)]">{result.hardware[0].hardware_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Device Name</p>
                      <p className="text-sm text-[var(--text-primary)]">{result.hardware[0].device_name || "\u2014"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Operating System</p>
                      <p className="text-sm text-[var(--text-primary)]">{result.hardware[0].os_version || "\u2014"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">IP Address</p>
                      <p className="text-sm font-mono text-[var(--text-primary)]">{result.hardware[0].ip_address || "\u2014"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Activated</p>
                      <p className="text-sm text-[var(--text-primary)]">{formatDateTime(result.hardware[0].activated_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Last Seen</p>
                      <p className="text-sm text-[var(--text-primary)]">{formatDateTime(result.hardware[0].last_seen)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Status</p>
                      <StatusBadge status={result.hardware[0].status || "active"} />
                    </div>
                  </div>
                </div>
              )}

              {/* Previous Devices */}
              {previousDevices.length > 0 && (
                <div className="mt-6 space-y-3">
                  <button onClick={() => setTimelineExpanded(!timelineExpanded)}
                    className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--text-primary)] transition-all">
                    {timelineExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Previous Devices ({previousDevices.length})
                  </button>
                  {timelineExpanded && (
                    <div className="space-y-2">
                      {previousDevices.map((hw, i) => (
                        <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]/10 border border-[var(--border-color)]">
                          <div>
                            <p className="text-xs text-[var(--text-muted)]">Hardware ID</p>
                            <p className="text-xs font-mono text-[var(--text-primary)]">{hw.hardware_id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-muted)]">Device</p>
                            <p className="text-xs text-[var(--text-primary)]">{hw.device_name || "\u2014"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-muted)]">OS</p>
                            <p className="text-xs text-[var(--text-primary)]">{hw.os_version || "\u2014"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-muted)]">Last Seen</p>
                            <p className="text-xs text-[var(--text-primary)]">{formatDateTime(hw.last_seen)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-muted)]">Status</p>
                            <StatusBadge status={hw.status || "inactive"} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Summary Stats */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]/10 border border-[var(--border-color)] text-center">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{result.license?.device_count || 0}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Total Activations</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]/10 border border-[var(--border-color)] text-center">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{previousDevices.length}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Previous Devices</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]/10 border border-[var(--border-color)] text-center">
                  <p className="text-2xl font-bold text-emerald-400">{Math.max(0, (result.license?.max_devices || 0) - (result.license?.device_count || 0))}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Remaining Slots</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activation Timeline */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20">
              <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <History size={16} className="text-blue-400" />
                Activation Timeline
                {timelineLoading && <Loader2 size={14} className="text-blue-400 animate-spin ml-1" />}
              </h2>
            </div>
            <div className="p-6">
              {timelineLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-3 h-3 rounded-full bg-[var(--bg-tertiary)]/30 mt-1" />
                      <div className="flex-1 space-y-1">
                        <div className="h-4 bg-[var(--bg-tertiary)]/30 rounded w-1/4" />
                        <div className="h-3 bg-[var(--bg-tertiary)]/30 rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : timeline.length > 0 ? (
                <div className="space-y-0">
                  {timeline.map((event, i) => (
                    <div key={event.id} className="flex gap-3 pb-4 relative">
                      {i < timeline.length - 1 && (
                        <div className="absolute left-1.5 top-4 bottom-0 w-px bg-[var(--border-color)]" />
                      )}
                      <TimelineDot color={event.color} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">{event.label}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{formatDateTime(event.timestamp)}</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{event.message}</p>
                        {event.ip_address && (
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">IP: {event.ip_address}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                  {result.license?.license_key ? "No timeline events found for this license." : "No license selected."}
                </p>
              )}
            </div>
          </div>

          {/* Admin Actions */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20">
              <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-400" />
                Administrator Actions
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* View Activation */}
                <button
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group"
                  onClick={() => window.open(`/internal/api/licenses/generate?tab=2&search=${result.license?.license_key || ''}`, '_blank')}>
                  <ExternalLink size={20} className="text-[var(--text-muted)] group-hover:text-blue-400 transition-colors" />
                  <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">View License</span>
                </button>

                {/* Refresh Status */}
                <button disabled={actionLoading === "refresh"}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group disabled:opacity-50"
                  onClick={handleRefreshStatus}>
                  <RefreshCw size={20} className={`text-[var(--text-muted)] group-hover:text-blue-400 transition-colors ${actionLoading === "refresh" ? "animate-spin" : ""}`} />
                  <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Refresh Status</span>
                </button>

                {/* Deactivate Device */}
                <button disabled={actionLoading === "deactivate" || !result.hardware?.[0]}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-red-500/10 hover:border-red-500/30 transition-all group disabled:opacity-50"
                  onClick={handleDeactivateDevice}>
                  <Trash2 size={20} className={`text-[var(--text-muted)] group-hover:text-red-400 transition-colors ${actionLoading === "deactivate" ? "animate-pulse" : ""}`} />
                  <span className="text-xs text-[var(--text-secondary)] group-hover:text-red-400">{actionLoading === "deactivate" ? "Deactivating..." : "Deactivate Device"}</span>
                </button>

                {/* View Audit Logs */}
                <button
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all group"
                  onClick={() => window.open(`/internal/api/audit?search=${result.license?.license_key || ''}`, '_blank')}>
                  <FileText size={20} className="text-[var(--text-muted)] group-hover:text-amber-400 transition-colors" />
                  <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Audit Logs</span>
                </button>

                {/* View Communication History */}
                <button
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all group"
                  onClick={() => window.open(`/internal/api/requests?search=${result.license?.customer_email || result.customer?.email || ''}`, '_blank')}>
                  <MessageSquare size={20} className="text-[var(--text-muted)] group-hover:text-purple-400 transition-colors" />
                  <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Communications</span>
                </button>

                {/* View Customer */}
                <button
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group"
                  onClick={() => window.open(`/internal/api/customers?search=${result.customer?.email || result.license?.customer_email || ''}`, '_blank')}>
                  <User size={20} className="text-[var(--text-muted)] group-hover:text-emerald-400 transition-colors" />
                  <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">View Customer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
