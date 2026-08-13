"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ShoppingCart,
  KeyRound,
  Repeat,
  FlaskConical,
  LifeBuoy,
  User,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Search,
  Loader2,
  Monitor,
  Calendar,
  Clock,
  Package,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Copy,
  Check as CheckIcon,
  HardDrive,
  Globe,
  Smartphone,
  XCircle,
  Zap,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

const API_BASE = "/internal/backend";

type UserType = "trial" | "paid" | "new" | null;
type ActivationTab = "buy" | "activate" | "renew" | "trial" | "support";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    inactive: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    expired: "bg-red-500/15 text-red-400 border-red-500/20",
    revoked: "bg-pink-500/15 text-pink-400 border-pink-500/20",
    trial: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    bound: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorMap[status] || "bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] border-[var(--border-color)]"}`}>
      {status}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
      {copied ? <CheckIcon size={12} /> : <Copy size={12} />}
    </button>
  );
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

interface HardwareRecord {
  hardware_id: string;
  device_name: string;
  ip_address: string;
  os_version: string;
  activated_at: string;
  last_seen: string;
  status: string;
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

interface SearchResult {
  customer: CustomerData | null;
  trial: TrialData | null;
  license: LicenseData | null;
  hardware: HardwareRecord[];
  plans: PlanData[];
  products: ProductData[];
}

interface UniversalActivationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  initialLicenseKey?: string;
  inline?: boolean;
}

export default function UniversalActivationCenter({ isOpen, onClose, initialLicenseKey, inline }: UniversalActivationCenterProps) {
  const [userType, setUserType] = useState<UserType>(null);
  const [activeTab, setActiveTab] = useState<ActivationTab>("activate");
  const [showIdentification, setShowIdentification] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialLicenseKey || "");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hardwareFound, setHardwareFound] = useState<boolean | null>(null);

  // Activation state
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [licenseKey, setLicenseKey] = useState(initialLicenseKey || "");
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

  // Reactivation state
  const [reactivationStep, setReactivationStep] = useState<"key-entry" | "fetching" | "review" | "submitting" | "submitted">("key-entry");
  const [reactivationData, setReactivationData] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editHardwareId, setEditHardwareId] = useState("");
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState("");

  // Key-entry for reactivation
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setShowIdentification(true);
      setUserType(null);
      setResult(null);
      setError(null);
      setActivationResult(null);
      setRenewResult(null);
    }
  }, [isOpen]);

  const identifyUser = (type: UserType) => {
    setUserType(type);
    setShowIdentification(false);
    switch (type) {
      case "trial":
        setActiveTab("trial");
        break;
      case "paid":
        setActiveTab("activate");
        break;
      case "new":
        setActiveTab("buy");
        break;
    }
  };

  const doSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) { setError("Enter a license key or email to search"); return; }

    setSearching(true);
    setError(null);
    setResult(null);
    setHardwareFound(null);
    setActivationResult(null);
    setRenewResult(null);

    try {
      const params = new URLSearchParams();
      if (q.includes("@")) params.set("email", q);
      else params.set("license_key", q);

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

      if (data.data.products?.length > 0) setSelectedProduct(data.data.products[0].product_id);
      if (data.data.plans?.length > 0) {
        const trialPlan = data.data.trial?.plan_name
          ? data.data.plans.find((p: PlanData) => p.name === data.data.trial.plan_name)
          : null;
        setSelectedPlan(String((trialPlan || data.data.plans[0]).id));
      }
      setHardwareFound(data.data.hardware?.length > 0);
      setLicenseKey(data.data.license?.license_key || q);
    } catch {
      setError("Failed to search. Check connection.");
    } finally {
      setSearching(false);
    }
  }, []);

  const handleActivate = useCallback(async () => {
    if (!result || !hardwareFound || activating) return;
    const hw = result.hardware[0];
    if (!licenseKey.trim()) { setActivationResult({ success: false, message: "License key is required" }); return; }

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
      if (data.success) setTimeout(() => doSearch(searchQuery), 1000);
    } catch {
      setActivationResult({ success: false, message: "Failed to activate license" });
    } finally {
      setActivating(false);
    }
  }, [result, hardwareFound, licenseKey, customerEmail, customerName, customerPhone, selectedPlan, doSearch, searchQuery, originalEmail]);

  const handleRenew = useCallback(async () => {
    const lk = licenseKey.trim() || result?.license?.license_key || "";
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
      if (data.success) setTimeout(() => doSearch(searchQuery), 1000);
    } catch {
      setRenewResult({ success: false, message: "Failed to renew license" });
    } finally {
      setRenewing(false);
    }
  }, [licenseKey, result, renewDays, doSearch, searchQuery]);

  const handleReactivationKeySubmit = async () => {
    const trimmed = licenseKey.trim().toUpperCase();
    if (!trimmed) { setKeyError("Please enter your license key"); return; }
    setKeyError("");
    setReactivationStep("fetching");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/licenses/reactivation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "License key not found");
        setReactivationStep("key-entry");
        return;
      }
      setReactivationData(data.data);
      setEditName(data.data.customer?.name || "");
      setEditEmail(data.data.customer?.email || "");
      setEditPhone(data.data.customer?.phone || "");
      setEditHardwareId(data.data.hardware?.hardware_id || "");
      setReactivationStep("review");
    } catch {
      setError("Unable to connect");
      setReactivationStep("key-entry");
    }
  };

  const handleReactivationSubmit = async () => {
    if (!reactivationData) return;
    setReactivationStep("submitting");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/licenses/reactivation/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: reactivationData.license_key,
          customerName: reactivationData.customer?.name || "",
          customerEmail: reactivationData.customer?.email || "",
          customerPhone: reactivationData.customer?.phone || "",
          hardwareId: reactivationData.hardware?.hardware_id || "",
          newCustomerName: editName !== reactivationData.customer?.name ? editName : undefined,
          newCustomerEmail: editEmail !== reactivationData.customer?.email ? editEmail : undefined,
          newCustomerPhone: editPhone !== reactivationData.customer?.phone ? editPhone : undefined,
          newHardwareId: editHardwareId !== reactivationData.hardware?.hardware_id ? editHardwareId : undefined,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to submit");
        setReactivationStep("review");
        return;
      }
      setRequestId(data.request_id || `REQ-${Date.now()}`);
      setReactivationStep("submitted");
    } catch {
      setError("Unable to connect");
      setReactivationStep("review");
    }
  };

  const resetAll = () => {
    setShowIdentification(true);
    setUserType(null);
    setResult(null);
    setError(null);
    setActivationResult(null);
    setRenewResult(null);
    setReactivationStep("key-entry");
    setReactivationData(null);
    setLicenseKey(initialLicenseKey || "");
    setSearchQuery(initialLicenseKey || "");
  };

  const tabs: { id: ActivationTab; label: string; icon: typeof Zap }[] = [
    { id: "buy", label: "Buy License", icon: ShoppingCart },
    { id: "activate", label: "Activate License", icon: KeyRound },
    { id: "renew", label: "Renew License", icon: Repeat },
    { id: "trial", label: "Trial", icon: FlaskConical },
    { id: "support", label: "Support", icon: LifeBuoy },
  ];

  const selectedHardware = result?.hardware?.[0] || null;
  const hasTrialOrLicense = !!(result?.trial || result?.license);
  const dataReady = !!result && hardwareFound === true && hasTrialOrLicense;

  const renderIdentification = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/10">
          <ShieldCheck size={32} className="text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-[var(--text-primary)]">Welcome to Activation Center</h3>
        <p className="text-sm text-[var(--text-muted)] mt-1">Please identify yourself to get started</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => identifyUser("trial")}
          className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all text-left group">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 inline-block mb-3 group-hover:scale-110 transition-transform">
            <FlaskConical size={20} />
          </div>
          <p className="font-semibold text-[var(--text-primary)]">Existing Trial User</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Already started a trial</p>
        </button>

        <button onClick={() => identifyUser("paid")}
          className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all text-left group">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 inline-block mb-3 group-hover:scale-110 transition-transform">
            <KeyRound size={20} />
          </div>
          <p className="font-semibold text-[var(--text-primary)]">Existing Paid User</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Have a license key</p>
        </button>

        <button onClick={() => identifyUser("new")}
          className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all text-left group">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 inline-block mb-3 group-hover:scale-110 transition-transform">
            <ShoppingCart size={20} />
          </div>
          <p className="font-semibold text-[var(--text-primary)]">New User</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">First time purchasing</p>
        </button>
      </div>
    </div>
  );

  const renderSearchSection = () => (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(searchQuery); }}
            placeholder="Search by email or license key..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all" />
        </div>
        <Button onClick={() => doSearch(searchQuery)} isLoading={searching} leftIcon={<Search size={16} />}>
          {searching ? "Searching..." : "Search"}
        </Button>
      </div>
    </div>
  );

  const renderBuyLicense = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Purchase a License</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          To purchase a new license, please contact our sales team. We will help you find the right plan for your needs.
        </p>
      </div>

      {result?.plans && result.plans.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Available Plans</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.plans.map((plan: PlanData) => (
              <div key={plan.id}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${String(plan.id) === selectedPlan ? "border-blue-500/50 bg-blue-500/10" : "border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:border-blue-500/30"}`}
                onClick={() => setSelectedPlan(String(plan.id))}>
                <p className="font-semibold text-[var(--text-primary)]">{plan.name}</p>
                {plan.price > 0 && <p className="text-lg font-bold text-blue-400">${plan.price}</p>}
                <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                  <p>{plan.max_devices} device(s) max</p>
                  <p>{plan.default_expiry_days} days</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderActivateLicense = () => (
    <div className="space-y-6">
      {renderSearchSection()}

      {searching && !result && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-12 text-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">Searching...</p>
        </div>
      )}

      {!result && !searching && !error && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-12 text-center">
          <KeyRound className="h-12 w-12 text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Search for customer or license</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Enter email or license key above</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {activationResult && (
        <div className={`rounded-2xl border p-4 ${activationResult.success ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
          <div className="flex items-center gap-3">
            {activationResult.success ? <CheckCircle className="h-5 w-5 text-green-400 shrink-0" /> : <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
            <p className={`text-sm ${activationResult.success ? "text-green-400" : "text-red-400"}`}>{activationResult.message}</p>
          </div>
        </div>
      )}

      {result && (
        <>
          {hardwareFound && hasTrialOrLicense && (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <p className="text-sm text-green-400 font-medium">Hardware verified. Ready to activate.</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="h-5 w-5 text-cyan-400" />
              <h3 className="font-semibold text-[var(--text-primary)]">Hardware</h3>
              {hardwareFound === true && <StatusBadge status="bound" />}
              {hardwareFound === false && <StatusBadge status="inactive" />}
            </div>
            {hardwareFound ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <InfoCard label="Hardware ID" value={selectedHardware?.hardware_id} icon={<Cpu size={16} />} color="cyan" />
                <InfoCard label="Device" value={selectedHardware?.device_name} icon={<Monitor size={16} />} color="cyan" />
                <InfoCard label="Platform" value={selectedHardware?.os_version} icon={<Globe size={16} />} color="cyan" />
                <InfoCard label="IP Address" value={selectedHardware?.ip_address} icon={<Smartphone size={16} />} color="cyan" />
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">No hardware found. Start a trial first.</p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-blue-400" />
              <h3 className="font-semibold text-[var(--text-primary)]">Customer</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FieldInput label="Name" value={customerName} onChange={setCustomerName} icon={<User size={14} />} disabled={!dataReady} />
              <FieldInput label="Email" value={customerEmail} onChange={setCustomerEmail} icon={<Mail size={14} />} disabled={!dataReady} />
              <FieldInput label="Phone" value={customerPhone} onChange={setCustomerPhone} icon={<Phone size={14} />} disabled={!dataReady} />
            </div>
          </div>

          {result.trial && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-[var(--text-primary)]">Trial</h3>
                <StatusBadge status={result.trial.status} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <InfoCard label="Started" value={formatDate(result.trial.started_at)} icon={<Calendar size={16} />} color="indigo" />
                <InfoCard label="Expires" value={formatDate(result.trial.expiry_date)} icon={<Calendar size={16} />} color="indigo" />
                <InfoCard label="Days Left" value={result.trial.days_remaining} icon={<Clock size={16} />} color={result.trial.days_remaining > 3 ? "indigo" : "red"} />
                <InfoCard label="Plan" value={result.trial.plan_name || result.trial.product_name} icon={<Package size={16} />} color="indigo" />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="h-5 w-5 text-amber-400" />
              <h3 className="font-semibold text-[var(--text-primary)]">Activate License</h3>
              {result.license && (
                <span className="ml-auto text-xs text-[var(--text-muted)]">
                  Devices: {result.license.device_count ?? 0} / {result.license.max_devices ?? "\u2014"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Product</label>
                <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} disabled={!dataReady}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50">
                  {result.products.map((prod: ProductData) => (
                    <option key={prod.product_id} value={prod.product_id}>{prod.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Plan</label>
                <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} disabled={!dataReady}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50">
                  {result.plans.map((plan: PlanData) => (
                    <option key={plan.id} value={plan.id}>{plan.name} {plan.price > 0 ? `($${plan.price})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">License Key</label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input type="text" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} placeholder="Enter key..." disabled={!dataReady}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50 font-mono uppercase" />
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={handleActivate} disabled={!dataReady || !licenseKey.trim()} isLoading={activating}
                  leftIcon={<ShieldCheck size={16} />} className="w-full">
                  {activating ? "Activating..." : "Activate"}
                </Button>
              </div>
            </div>
          </div>

          {result.plans.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Plans</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.plans.map((plan: PlanData) => (
                  <div key={plan.id} onClick={() => setSelectedPlan(String(plan.id))}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${String(plan.id) === selectedPlan ? "border-blue-500/50 bg-blue-500/10" : "border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:border-blue-500/30"}`}>
                    <p className="font-semibold text-[var(--text-primary)]">{plan.name}</p>
                    {plan.price > 0 && <p className="text-lg font-bold text-blue-400">${plan.price}</p>}
                    <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                      <p>{plan.max_devices} device(s) max</p>
                      <p>{plan.default_expiry_days} days</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderRenewLicense = () => (
    <div className="space-y-6">
      {renderSearchSection()}

      {result?.license ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="h-5 w-5 text-emerald-400" />
            <h3 className="font-semibold text-[var(--text-primary)]">Renew License</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <InfoCard label="Current Expiry" value={formatDate(result.license.expiry_date)} icon={<Calendar size={16} />} color="amber" />
            <InfoCard label="Days Remaining" value={result.license.days_remaining} icon={<Clock size={16} />} color={result.license.days_remaining > 7 ? "blue" : "red"} />
            <InfoCard label="Status" value={result.license.status} icon={<ShieldCheck size={16} />} color={result.license.status === "active" ? "green" : "red"} />
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Extra Days</label>
              <input type="number" value={renewDays} onChange={(e) => setRenewDays(Math.max(1, parseInt(e.target.value) || 30))}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all" />
            </div>
            <Button onClick={handleRenew} isLoading={renewing} leftIcon={<Repeat size={16} />}
              variant="primary" className="bg-gradient-to-r from-emerald-500 to-teal-600">
              {renewing ? "Renewing..." : "Renew License"}
            </Button>
          </div>
        </div>
      ) : result && !searching ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">No license found. Search for a customer first.</p>
        </div>
      ) : null}

      {renewResult && (
        <div className={`rounded-2xl border p-4 ${renewResult.success ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
          <div className="flex items-center gap-3">
            {renewResult.success ? <CheckCircle className="h-5 w-5 text-green-400 shrink-0" /> : <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
            <p className={`text-sm ${renewResult.success ? "text-green-400" : "text-red-400"}`}>{renewResult.message}</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderTrial = () => (
    <div className="space-y-6">
      {renderSearchSection()}

      {result?.trial ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold text-[var(--text-primary)]">Trial Information</h3>
            <StatusBadge status={result.trial.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <InfoCard label="Product" value={result.trial.product_name} icon={<Package size={16} />} color="purple" />
            <InfoCard label="Plan" value={result.trial.plan_name} icon={<Package size={16} />} color="purple" />
            <InfoCard label="Started" value={formatDate(result.trial.started_at)} icon={<Calendar size={16} />} color="purple" />
            <InfoCard label="Expires" value={formatDate(result.trial.expiry_date)} icon={<Calendar size={16} />} color="purple" />
          </div>
          {result.trial.days_remaining > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <Clock size={14} className="text-purple-400" />
              <span className="text-purple-400 font-medium">{result.trial.days_remaining} days remaining</span>
            </div>
          )}
          {result.trial.is_converted && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <p className="text-sm text-emerald-400">Converted to license: {result.trial.converted_to_license_key}</p>
              </div>
            </div>
          )}
        </div>
      ) : result && !searching ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-12 text-center">
          <FlaskConical className="h-12 w-12 text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">No trial found</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Search for a customer to view trial details</p>
        </div>
      ) : null}

      {!result && !searching && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">Start a Trial</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Contact support to begin a free trial of our products.</p>
        </div>
      )}
    </div>
  );

  const renderSupport = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <LifeBuoy className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Support & Reactivation</h3>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 mb-4">
          <p className="text-sm text-[var(--text-secondary)]">
            For device replacement, reactivation, or general support, use the options below.
          </p>
        </div>

        {/* Reactivation flow */}
        {reactivationStep === "key-entry" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">Submit a Reactivation Request</p>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">License Key</label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input type="text" value={licenseKey} onChange={(e) => { setLicenseKey(e.target.value.toUpperCase()); setKeyError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleReactivationKeySubmit(); }}
                  placeholder="Enter your license key"
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border ${keyError ? "border-red-500" : "border-[var(--border-color)]"} text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all font-mono`} />
              </div>
              {keyError && <p className="text-xs text-red-400 mt-1">{keyError}</p>}
            </div>
            <Button onClick={handleReactivationKeySubmit} className="w-full">
              Continue
            </Button>
          </div>
        )}

        {reactivationStep === "fetching" && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">Verifying license...</p>
          </div>
        )}

        {reactivationStep === "review" && reactivationData && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-400">License Found</p>
                <p className="text-xs text-[var(--text-muted)]">{reactivationData.product_name} &mdash; {reactivationData.plan}</p>
              </div>
            </div>

            <div className="space-y-3">
              <FieldInput label="Name" value={editName} onChange={setEditName} icon={<User size={14} />} />
              <FieldInput label="Email" value={editEmail} onChange={setEditEmail} icon={<Mail size={14} />} />
              <FieldInput label="Phone" value={editPhone} onChange={setEditPhone} icon={<Phone size={14} />} />
              <FieldInput label="Hardware ID" value={editHardwareId} onChange={setEditHardwareId} icon={<Monitor size={14} />} />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Reason (optional)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Upgraded hardware, lost access"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all resize-none" />
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setReactivationStep("key-entry")} className="flex-1">Back</Button>
              <Button onClick={handleReactivationSubmit} className="flex-[2]">Submit Request</Button>
            </div>
          </div>
        )}

        {reactivationStep === "submitting" && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">Submitting request...</p>
          </div>
        )}

        {reactivationStep === "submitted" && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size="28" color="#22c55e" />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Request Submitted</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Your reactivation request has been received.</p>
            {requestId && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Reference: <span className="font-mono font-semibold text-[var(--text-primary)]">{requestId}</span>
              </p>
            )}
            <Button variant="secondary" onClick={() => setReactivationStep("key-entry")} className="mt-4">Done</Button>
          </div>
        )}

        {/* Support contact */}
        <div className="mt-6">
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[var(--text-muted)]">Support Email</label>
              <CopyButton text="support@websmithdigital.com" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">support@websmithdigital.com</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => (
    showIdentification ? renderIdentification() : (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Activation Center</h3>
            <p className="text-sm text-[var(--text-muted)]">
              {userType === "trial" ? "Managing trial" : userType === "paid" ? "Managing paid license" : "New user"} &mdash; {activeTab} tab
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetAll}>
              Change Identity
            </Button>
          </div>
        </div>

        <div className="flex gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive ? "bg-[var(--bg-tertiary)]/30 text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/5"
                }`}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {activeTab === "buy" && renderBuyLicense()}
        {activeTab === "activate" && renderActivateLicense()}
        {activeTab === "renew" && renderRenewLicense()}
        {activeTab === "trial" && renderTrial()}
        {activeTab === "support" && renderSupport()}
      </div>
    )
  );

  return (
    <>
      {inline ? (
        <div className="max-w-5xl mx-auto space-y-6">
          {renderContent()}
        </div>
      ) : (
        <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="900px">
          {renderContent()}
        </Modal>
      )}
    </>
  );
}

function InfoCard({ label, value, icon, color = "blue" }: { label: string; value: string | number | null | undefined; icon: React.ReactNode; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    purple: "bg-purple-500/10 text-purple-400",
    cyan: "bg-cyan-500/10 text-cyan-400",
    red: "bg-red-500/10 text-red-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    violet: "bg-violet-500/10 text-violet-400",
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
      <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{value ?? "\u2014"}</p>
      </div>
    </div>
  );
}

function FieldInput({ icon, label, value, onChange, disabled }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">{icon}</div>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
      </div>
    </div>
  );
}