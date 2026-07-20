"use client";

import { useState, useCallback } from "react";
import {
  Cpu,
  Monitor,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  KeyRound,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Search,
  ShieldCheck,
  XCircle,
  HardDrive,
  Smartphone,
  Globe,
  Package,
  Copy,
  Check as CheckIcon,
  Repeat,
  LifeBuoy,
  Zap,
} from "lucide-react";

interface CustomerData {
  id: number;
  email: string;
  name: string;
  phone: string;
  mobile: string;
  company: string;
  country: string;
  status: string;
  hardware_id: string;
  product_id: string;
  plan_id: string;
}

interface TrialData {
  started_at: string;
  expiry_date: string;
  days_remaining: number;
  status: string;
  is_expired: boolean;
  is_converted: boolean;
  converted_to_license_key: string | null;
  product_id: string;
  product_name: string;
  plan_name: string;
  max_devices: number;
}

interface LicenseData {
  license_key: string;
  customer_name: string;
  customer_email: string;
  plan: string;
  plan_id: number;
  status: string;
  expiry_date: string;
  days_remaining: number;
  max_devices: number;
  device_count: number;
  is_activated: boolean;
  is_trial: boolean;
  product_id: string;
}

interface HardwareRecord {
  hardware_id: string;
  device_name: string;
  ip_address: string;
  os_version: string;
  activated_at: string;
  last_seen: string;
  status: string;
}

interface PlanData {
  id: number;
  name: string;
  description: string;
  max_devices: number;
  default_expiry_days: number;
  price: number;
  is_active: boolean;
  features: any;
  display_order: number;
}

interface ProductData {
  product_id: string;
  name: string;
  is_active: boolean;
}

interface SearchResult {
  customer: CustomerData | null;
  trial: TrialData | null;
  license: LicenseData | null;
  hardware: HardwareRecord[];
  plans: PlanData[];
  products: ProductData[];
}

const API_BASE = "/internal/backend";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    inactive: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    expired: "bg-red-500/15 text-red-400 border-red-500/20",
    revoked: "bg-pink-500/15 text-pink-400 border-pink-500/20",
    suspended: "bg-red-500/15 text-red-400 border-red-500/20",
    converted: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    trial: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    bound: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  };

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorMap[status] || "bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] border-[var(--border-color)]"}`}>
      {status}
    </span>
  );
}

function InfoCard({ label, value, icon, color = "blue" }: { label: string; value: string | number | null | undefined; icon: React.ReactNode; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)]",
    green: "bg-[var(--api-green-500-10)] text-[var(--api-green-400)]",
    amber: "bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)]",
    purple: "bg-[var(--api-purple-500-10)] text-[var(--api-purple-400)]",
    cyan: "bg-[var(--api-cyan-500-10)] text-[var(--api-cyan-400)]",
    red: "bg-[var(--api-red-500-10)] text-[var(--api-red-400)]",
    indigo: "bg-[var(--api-indigo-500-10)] text-[var(--api-indigo-400)]",
    violet: "bg-violet-500/10 text-violet-400",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 shadow-sm">
      <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
    >
      {copied ? <CheckIcon size={12} /> : <Copy size={12} />}
    </button>
  );
}

export default function ActivationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hardwareFound, setHardwareFound] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("activation");

  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");

  const [activating, setActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{ success: boolean; message: string } | null>(null);

  // Renewal state
  const [renewing, setRenewing] = useState(false);
  const [renewDays, setRenewDays] = useState(30);
  const [renewResult, setRenewResult] = useState<{ success: boolean; message: string } | null>(null);

  const doSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    setResult(null);
    setHardwareFound(null);
    setActivationResult(null);
    setRenewResult(null);
    setLicenseKey("");
    setSelectedPlan("");
    setSelectedProduct("");

    try {
      const params = new URLSearchParams();
      if (q.includes("@")) {
        params.set("email", q);
      } else {
        params.set("license_key", q);
      }

      const res = await fetch(`${API_BASE}/activation/search?${params}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Search failed");
        return;
      }

      setResult(data.data);

      const foundEmail = data.data.customer?.email || data.data.license?.customer_email || "";
      setOriginalEmail(foundEmail);
      if (data.data.customer) {
        setCustomerName(data.data.customer.name || "");
        setCustomerEmail(data.data.customer.email || "");
        setCustomerPhone(data.data.customer.mobile || data.data.customer.phone || "");
      } else if (data.data.license) {
        setCustomerName(data.data.license.customer_name || "");
        setCustomerEmail(data.data.license.customer_email || "");
      }

      if (data.data.products && data.data.products.length > 0) {
        const zemProduct = data.data.products.find((p: ProductData) =>
          p.name.toUpperCase() === 'ZEM MAC OS'
        );
        const preferredProduct = zemProduct || data.data.products[0];
        setSelectedProduct(preferredProduct.product_id);
      }

      if (data.data.plans && data.data.plans.length > 0) {
        const starterPlan = data.data.plans.find((p: PlanData) =>
          p.name.toUpperCase() === 'STARTER'
        );
        const trialPlan = data.data.trial?.plan_name
          ? data.data.plans.find((p: PlanData) => p.name === data.data.trial.plan_name)
          : null;
        const preferredPlan = starterPlan || trialPlan || data.data.plans[0];
        setSelectedPlan(preferredPlan ? String(preferredPlan.id) : String(data.data.plans[0].id));
      }

      setHardwareFound(data.data.hardware?.length > 0);
    } catch {
      setError("Failed to search. Check connection.");
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearch = useCallback(() => doSearch(searchQuery), [searchQuery, doSearch]);

  const handleRefresh = useCallback(() => {
    const q = licenseKey.trim() || (result?.license?.license_key ?? searchQuery.trim());
    if (!q || q.includes('@')) {
      setError('Enter a license key to refresh.');
      return;
    }
    doSearch(q);
  }, [licenseKey, result, searchQuery, doSearch]);

  const handleActivate = useCallback(async () => {
    if (!result || !hardwareFound || activating) return;

    const hw = result.hardware[0];
    if (!licenseKey.trim()) {
      setActivationResult({ success: false, message: "License key is required" });
      return;
    }

    setActivating(true);
    setActivationResult(null);

    try {
      const token = localStorage.getItem("api_center_token");
      const res = await fetch(`${API_BASE}/activation/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          license_key: licenseKey.trim(),
          customer_email: customerEmail,
          hardware_id: hw.hardware_id,
          device_name: hw.device_name || "Admin Activated",
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          original_email: originalEmail,
          plan_name: result.plans.find((p: PlanData) => String(p.id) === selectedPlan)?.name || "",
        }),
      });

      const data = await res.json();
      setActivationResult({ success: data.success, message: data.message || data.error || "Activation completed" });

      if (data.success) {
        window.dispatchEvent(new CustomEvent('activation-changed', { detail: { license_key: licenseKey.trim() } }));
        setTimeout(() => doSearch(searchQuery), 1000);
      }
    } catch {
      setActivationResult({ success: false, message: "Failed to activate license" });
    } finally {
      setActivating(false);
    }
  }, [result, hardwareFound, licenseKey, customerEmail, customerName, customerPhone, selectedPlan, doSearch, searchQuery, originalEmail]);

  const handleRenew = useCallback(async () => {
    const lk = licenseKey.trim() || result?.license?.license_key || '';
    if (!lk) { setRenewResult({ success: false, message: "No license key available" }); return; }

    setRenewing(true);
    setRenewResult(null);

    try {
      const token = localStorage.getItem("api_center_token");
      const res = await fetch(`${API_BASE}/licenses/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ license_key: lk, extra_days: renewDays }),
      });

      const data = await res.json();
      setRenewResult({ success: data.success, message: data.message || data.error || "Renewal completed" });
      if (data.success) {
        window.dispatchEvent(new CustomEvent('activation-changed', { detail: { license_key: lk } }));
        setTimeout(() => doSearch(searchQuery), 1000);
      }
    } catch {
      setRenewResult({ success: false, message: "Failed to renew license" });
    } finally {
      setRenewing(false);
    }
  }, [licenseKey, result, renewDays, doSearch, searchQuery]);

  const selectedHardware = result?.hardware?.[0] || null;
  const selectedHardwareId = selectedHardware?.hardware_id || '';

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const hasTrialOrLicense = !!(result?.trial || result?.license);
  const productLoaded = !!(result?.products && result.products.length > 0);
  const planLoaded = !!(result?.plans && result.plans.length > 0);
  const initialized = !!result;
  const dataReady = initialized && hardwareFound === true && hasTrialOrLicense && productLoaded && planLoaded;
  const controlsDisabled = activating || searching || !dataReady;
  const refreshDisabled = activating || searching;

  const initMessage = searching ? 'Loading license information...'
    : result && !hasTrialOrLicense ? 'No trial or license found for this customer.'
    : result && !productLoaded ? 'No products available.'
    : result && !planLoaded ? 'No plans available for this product.'
    : !hardwareFound && result ? 'Hardware not detected. Controls disabled.'
    : null;

  const tabs = [
    { id: "activation", label: "Activation", icon: Zap },
    { id: "renewal", label: "Renewal", icon: Repeat },
    { id: "device", label: "Device Status", icon: Monitor },
    { id: "support", label: "Support", icon: LifeBuoy },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Activation Center</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Activate, renew, and manage licenses
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-4 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by customer email or license key..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)] shrink-0" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Result messages */}
      {activationResult && (
        <div className={`rounded-2xl border p-4 ${activationResult.success ? "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]" : "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]"}`}>
          <div className="flex items-center gap-3">
            {activationResult.success ? <CheckCircle className="h-5 w-5 text-[var(--api-green-400)] shrink-0" /> : <XCircle className="h-5 w-5 text-[var(--api-red-400)] shrink-0" />}
            <p className={`text-sm ${activationResult.success ? "text-[var(--api-green-400)]" : "text-[var(--api-red-400)]"}`}>{activationResult.message}</p>
          </div>
        </div>
      )}
      {renewResult && (
        <div className={`rounded-2xl border p-4 ${renewResult.success ? "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]" : "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]"}`}>
          <div className="flex items-center gap-3">
            {renewResult.success ? <CheckCircle className="h-5 w-5 text-[var(--api-green-400)] shrink-0" /> : <XCircle className="h-5 w-5 text-[var(--api-red-400)] shrink-0" />}
            <p className={`text-sm ${renewResult.success ? "text-[var(--api-green-400)]" : "text-[var(--api-red-400)]"}`}>{renewResult.message}</p>
          </div>
        </div>
      )}
      {/* Loading overlay */}
      {result && initMessage && (
        <div className="rounded-2xl border border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)] p-3">
          <div className="flex items-center gap-2">
            {searching ? <Loader2 className="h-4 w-4 text-[var(--api-amber-400)] animate-spin" /> : <AlertCircle className="h-4 w-4 text-[var(--api-amber-400)]" />}
            <p className="text-sm text-[var(--text-secondary)]">{initMessage}</p>
          </div>
        </div>
      )}

      {/* Hardware detection in progress */}
      {searching && !result && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 text-center">
          <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin mx-auto mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">Fetching license information...</p>
        </div>
      )}

      {/* Empty state */}
      {!result && !searching && !error && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-12 text-center">
          <KeyRound className="h-12 w-12 text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Search for a customer</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Enter a customer email or license key to begin
          </p>
        </div>
      )}

      {/* Main content with tabs */}
      {result && (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-1.5 backdrop-blur-sm shadow-sm overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  disabled={!initialized && tab.id !== "activation"}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-[var(--bg-tertiary)]/30 text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/5"
                  } disabled:opacity-50`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ============ TAB 1: ACTIVATION ============ */}
          {activeTab === "activation" && (
            <div className="space-y-6">
              {/* Hardware Verified Banner */}
              {hardwareFound && !initMessage && (
                <div className="rounded-2xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-[var(--api-green-400)]" />
                    <p className="text-sm text-[var(--api-green-400)] font-medium">Hardware verified. Activation available.</p>
                  </div>
                </div>
              )}

              {/* Hardware Section */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <HardDrive className="h-5 w-5 text-[var(--api-cyan-400)]" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Hardware</h3>
                  {hardwareFound === false && <StatusBadge status="inactive" />}
                  {hardwareFound === true && <StatusBadge status="bound" />}
                </div>
                {hardwareFound === false ? (
                  <div className="text-center py-4">
                    <AlertCircle className="h-8 w-8 text-[var(--api-amber-400)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-secondary)]">No hardware found. Customer must start a trial first.</p>
                    <button onClick={handleRefresh} className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-all mx-auto">
                      <RefreshCw size={12} /> Retry
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <InfoCard label="Hardware ID" value={selectedHardware?.hardware_id} icon={<Cpu size={16} />} color="cyan" />
                    <InfoCard label="Device" value={selectedHardware?.device_name} icon={<Monitor size={16} />} color="cyan" />
                    <InfoCard label="Platform" value={selectedHardware?.os_version} icon={<Globe size={16} />} color="cyan" />
                    <InfoCard label="IP Address" value={selectedHardware?.ip_address} icon={<Smartphone size={16} />} color="cyan" />
                  </div>
                )}
              </div>

              {/* Customer Section */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-[var(--api-blue-400)]" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Customer</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Customer Name</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><User size={14} /></div>
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={controlsDisabled}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><Mail size={14} /></div>
                      <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} disabled={controlsDisabled}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Mobile Number</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><Phone size={14} /></div>
                      <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} disabled={controlsDisabled}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Trial Section */}
              {result.trial && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-5 w-5 text-[var(--api-indigo-400)]" />
                    <h3 className="font-semibold text-[var(--text-primary)]">Trial</h3>
                    <StatusBadge status={result.trial.status} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <InfoCard label="Started" value={formatDate(result.trial.started_at)} icon={<Calendar size={16} />} color="indigo" />
                    <InfoCard label="Expires" value={formatDate(result.trial.expiry_date)} icon={<Calendar size={16} />} color="indigo" />
                    <InfoCard label="Days Left" value={result.trial.days_remaining} icon={<Clock size={16} />} color={result.trial.days_remaining > 3 ? "indigo" : "red"} />
                    <InfoCard label="Plan" value={result.trial.plan_name || result.trial.product_name || "—"} icon={<Package size={16} />} color="indigo" />
                  </div>
                </div>
              )}

              {/* Activation Form */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="h-5 w-5 text-[var(--api-amber-400)]" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Activate License</h3>
                  {result.license && (
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      Devices: {result.license.device_count ?? 0} / {result.license.max_devices ?? "—"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Product</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><Package size={14} /></div>
                      <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} disabled={controlsDisabled}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50">
                        {result.products.map((prod: ProductData) => (
                          <option key={prod.product_id} value={prod.product_id}>{prod.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Plan</label>
                    <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} disabled={controlsDisabled}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50">
                      {result.plans.map((plan: PlanData) => (
                        <option key={plan.id} value={plan.id}>{plan.name} {plan.price > 0 ? `($${plan.price})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">License Key</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><KeyRound size={14} /></div>
                      <input type="text" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} placeholder="Enter key..." disabled={controlsDisabled}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50 font-mono uppercase" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Status</label>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 h-[42px]">
                      {result.license?.is_activated ? (
                        <><CheckCircle size={16} className="text-[var(--api-green-400)]" /><span className="text-sm font-medium text-[var(--api-green-400)]">Activated</span></>
                      ) : (
                        <><Clock size={16} className="text-[var(--api-amber-400)]" /><span className="text-sm font-medium text-[var(--api-amber-400)]">Pending</span></>
                      )}
                    </div>
                  </div>
                </div>

                {result.license?.expiry_date && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Calendar size={12} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-muted)]">Expires: {formatDate(result.license.expiry_date)}</span>
                    {result.license.days_remaining > 0 && (
                      <span className="text-[var(--api-blue-400)] font-medium">{result.license.days_remaining}d left</span>
                    )}
                  </div>
                )}
              </div>

              {/* Plan Cards */}
              {result.plans.length > 0 && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm shadow-sm">
                  <h3 className="font-semibold text-[var(--text-primary)] mb-4">Plans</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.plans.map((plan: PlanData) => (
                      <div key={plan.id} onClick={() => setSelectedPlan(String(plan.id))}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${String(plan.id) === selectedPlan ? "border-blue-500/50 bg-blue-500/10 shadow-sm" : "border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:border-blue-500/30"}`}>
                        <p className="font-semibold text-[var(--text-primary)]">{plan.name}</p>
                        {plan.price > 0 && <p className="text-lg font-bold text-[var(--api-blue-400)]">${plan.price}</p>}
                        <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                          <p>{plan.max_devices} device(s) max</p>
                          <p>{plan.default_expiry_days} days</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button onClick={handleRefresh} disabled={refreshDisabled}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all disabled:opacity-50">
                  <RefreshCw size={14} /> Refresh
                </button>
                <button onClick={handleActivate} disabled={controlsDisabled || !licenseKey.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50">
                  {activating ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  {activating ? "Activating..." : "Activate License"}
                </button>
              </div>
            </div>
          )}

          {/* ============ TAB 2: RENEWAL ============ */}
          {activeTab === "renewal" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Repeat className="h-5 w-5 text-[var(--api-blue-400)]" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Renew License</h3>
                </div>

                {result.license ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <InfoCard label="Current Expiry" value={formatDate(result.license.expiry_date)} icon={<Calendar size={16} />} color="amber" />
                      <InfoCard label="Days Remaining" value={result.license.days_remaining} icon={<Clock size={16} />} color={result.license.days_remaining > 7 ? "blue" : "red"} />
                      <InfoCard label="Status" value={result.license.status} icon={<ShieldCheck size={16} />} color={result.license.status === "active" ? "green" : "red"} />
                    </div>

                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Extra Days</label>
                        <input type="number" value={renewDays} onChange={(e) => setRenewDays(Math.max(1, parseInt(e.target.value) || 30))} min={1} max={36500}
                          className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all" />
                      </div>
                      <button onClick={handleRenew} disabled={renewing || !result.license}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-50">
                        {renewing ? <Loader2 size={16} className="animate-spin" /> : <Repeat size={16} />}
                        {renewing ? "Renewing..." : "Renew License"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No license found for this customer.</p>
                )}
              </div>
            </div>
          )}

          {/* ============ TAB 3: DEVICE STATUS ============ */}
          {activeTab === "device" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Monitor className="h-5 w-5 text-[var(--api-cyan-400)]" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Bound Hardware</h3>
                  <span className="text-xs text-[var(--text-muted)] ml-auto">Display only</span>
                  {result.license && (
                    <span className="ml-auto text-xs text-[var(--text-muted)]">{result.hardware.length} / {result.license.max_devices ?? "—"} devices</span>
                  )}
                </div>

                {result.hardware.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No hardware bound to this license.</p>
                ) : (
                  <div className="space-y-2">
                    {result.hardware.map((hw: HardwareRecord, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-[var(--api-cyan-500-10)] text-[var(--api-cyan-400)]">
                            <Cpu size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)]">{hw.device_name || "Unknown Device"}</p>
                            <p className="text-xs text-[var(--text-muted)] font-mono truncate">{hw.hardware_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={hw.status || "bound"} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ TAB 4: SUPPORT ============ */}
          {activeTab === "support" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <LifeBuoy className="h-5 w-5 text-[var(--api-blue-400)]" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Support Info</h3>
                </div>

                <div className="rounded-xl border border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)] p-4 mb-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    For device replacement or transfer, contact support.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-muted)]">Support Email</label>
                      <CopyButton text="support@websmithdigital.com" />
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">support@websmithdigital.com</p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-muted)]">Customer ID</label>
                      {result.customer?.id && <CopyButton text={String(result.customer.id)} />}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{result.customer?.id || "—"}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-muted)]">Customer Email</label>
                      {result.customer?.email && <CopyButton text={result.customer.email} />}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{result.customer?.email || "—"}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-muted)]">Customer Name</label>
                      {result.customer?.name && <CopyButton text={result.customer.name} />}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{result.customer?.name || "—"}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-muted)]">Hardware ID</label>
                      {selectedHardware?.hardware_id && <CopyButton text={selectedHardware.hardware_id} />}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)] font-mono text-xs">{selectedHardware?.hardware_id || "—"}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-muted)]">License Key</label>
                      {result.license?.license_key && <CopyButton text={result.license.license_key} />}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)] font-mono text-xs">{result.license?.license_key || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
