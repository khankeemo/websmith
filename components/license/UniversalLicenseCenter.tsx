"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Mail,
  Phone,
  KeyRound,
  Package,
  ShieldCheck,
  Calendar,
  Clock,
  Monitor,
  AlertCircle,
  Loader2,
  HardDrive,
  Cpu,
  Search,
  Smartphone,
} from "lucide-react";
import Button from "@/components/ui/Button";

const API_BASE = "/internal/backend";

interface LicenseStatusData {
  success: boolean;
  status: "licensed" | "trial" | "no_license";
  customer: {
    name: string;
    email: string;
    mobile: string;
  };
  license: {
    license_key: string;
    status: string;
    expiry_date: string;
    days_remaining: number;
  };
  plan: {
    name: string;
    device_limit: number;
  };
  product: {
    name: string;
    product_id?: string;
  };
  devices?: {
    current: number;
    maximum: number;
  };
  hardware?: {
    hardware_id: string;
    device_name?: string;
    is_activated?: boolean;
  };
}

interface UniversalLicenseCenterProps {
  hardwareId?: string;
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

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    "Licensed": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    "Trial Active": "bg-purple-500/15 text-purple-400 border-purple-500/20",
    "Trial Expired": "bg-amber-500/15 text-amber-400 border-amber-500/20",
    "No License": "bg-gray-500/15 text-gray-400 border-gray-500/20",
    "Expired": "bg-red-500/15 text-red-400 border-red-500/20",
    "Revoked": "bg-pink-500/15 text-pink-400 border-pink-500/20",
    "Suspended": "bg-orange-500/15 text-orange-400 border-orange-500/20",
    "Disabled": "bg-rose-500/15 text-rose-400 border-rose-500/20",
    "Inactive": "bg-amber-500/15 text-amber-400 border-amber-500/20",
    "Deleted": "bg-red-600/15 text-red-500 border-red-600/20",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorMap[status] || "bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] border-[var(--border-color)]"}`}>
      {status}
    </span>
  );
}

function FieldDisplay({ label, value, icon }: { label: string; value: string | number | null | undefined; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {value !== null && value !== undefined && String(value).trim() !== "" ? String(value) : "\u2014"}
        </p>
      </div>
    </div>
  );
}

export default function UniversalLicenseCenter({ hardwareId: propHardwareId }: UniversalLicenseCenterProps) {
  const [hardwareId, setHardwareId] = useState(propHardwareId || "");
  const [data, setData] = useState<LicenseStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchStatus = useCallback(async (hwId: string) => {
    const trimmed = hwId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/license/status?hardware_id=${encodeURIComponent(trimmed)}`);
      const json: LicenseStatusData = await res.json();

      if (!json.success) {
        setError("Failed to fetch license status");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Unable to connect. Check your connection.");
      setData(null);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    if (propHardwareId) {
      setHardwareId(propHardwareId);
      fetchStatus(propHardwareId);
    }
  }, [propHardwareId, fetchStatus]);

  const isNoLicense = data?.status === "no_license";
  const isTrial = data?.status === "trial";
  const isLicensed = data?.status === "licensed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/10">
          <ShieldCheck size={32} className="text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-[var(--text-primary)]">Universal License Center</h3>
        <p className="text-sm text-[var(--text-muted)] mt-1">License status information</p>
      </div>

      {/* Hardware ID Input */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Cpu size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={hardwareId}
              onChange={(e) => setHardwareId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") fetchStatus(hardwareId); }}
              placeholder="Enter Hardware ID..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all font-mono"
            />
          </div>
          <Button onClick={() => fetchStatus(hardwareId)} isLoading={loading} leftIcon={<Search size={16} />}>
            {loading ? "Checking..." : "Check Status"}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-12 text-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">Fetching license status...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Initial State - No fetch yet */}
      {!hasFetched && !loading && !error && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-12 text-center">
          <Monitor className="h-12 w-12 text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Enter a Hardware ID</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Enter a hardware ID above to check license status</p>
        </div>
      )}

      {/* Data Display - Shows for all statuses when data is available */}
      {hasFetched && !loading && data && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className={`h-5 w-5 ${isLicensed ? 'text-emerald-400' : isTrial ? 'text-purple-400' : 'text-gray-400'}`} />
            <h3 className="font-semibold text-[var(--text-primary)]">License Status</h3>
            <StatusBadge status={
              isLicensed ? 'Licensed' :
              isTrial ? (data.license.status || 'Trial Active') :
              data.license.status || 'No License'
            } />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FieldDisplay label="Customer Name" value={data.customer.name} icon={<User size={16} />} />
            <FieldDisplay label="Email" value={data.customer.email} icon={<Mail size={16} />} />
            <FieldDisplay label="Mobile" value={data.customer.mobile} icon={<Phone size={16} />} />
            <FieldDisplay label="License Key" value={data.license.license_key} icon={<KeyRound size={16} />} />
            <FieldDisplay label="Active Plan" value={data.plan.name} icon={<Package size={16} />} />
            <FieldDisplay label="License Status" value={data.license.status} icon={<ShieldCheck size={16} />} />
            <FieldDisplay label="Product Name" value={data.product.name} icon={<HardDrive size={16} />} />
            <FieldDisplay label="Expiry Date" value={data.license.expiry_date} icon={<Calendar size={16} />} />
            <FieldDisplay label="Days Remaining" value={data.license.days_remaining} icon={<Clock size={16} />} />
            {data.devices && (
              <FieldDisplay label="Device Count" value={`${data.devices.current} / ${data.devices.maximum}`} icon={<Monitor size={16} />} />
            )}
            {data.hardware && (
              <>
                <FieldDisplay label="Hardware ID" value={data.hardware.hardware_id} icon={<Cpu size={16} />} />
                {data.hardware.device_name && (
                  <FieldDisplay label="Device Name" value={data.hardware.device_name} icon={<Smartphone size={16} />} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Hardware Info */}
      {hasFetched && !loading && hardwareId && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Hardware ID</h3>
          </div>
          <p className="text-sm font-mono text-[var(--text-muted)] break-all">{hardwareId}</p>
        </div>
      )}
    </div>
  );
}
