// FILE: app/internal/api/licenses/[licenseKey]/page.tsx
// PURPOSE: License Detail page - View and manage individual license
// ACTION: View full license details, renew, revoke, change email, reset hardware, update plan
// UPDATED: Added Plan Management feature
// FIXED: Replaced broken /internal/api/licenses links with /internal/api/analytics
// FIXED: All hardcoded colors replaced with CSS variables

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  KeyRound,
  User,
  Mail,
  Calendar,
  Cpu,
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  HardDrive,
  ArrowLeft,
  Copy,
  Loader2,
  FileText,
  Layers
} from "lucide-react";
import { licenseApi, License } from "@/lib/api/license-api";
import { isValidEmail } from "@/lib/validation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL + "/internal/backend" : "";

export default function LicenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const licenseKey = params.licenseKey as string;

  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Plan Management State
  const [selectedPlan, setSelectedPlan] = useState<string>("Standard");
  const [planUpdating, setPlanUpdating] = useState(false);

  useEffect(() => {
    if (licenseKey) {
      fetchLicense();
    }
  }, [licenseKey]);

  // Sync selectedPlan with license data
  useEffect(() => {
    if (license && license.plan) {
      setSelectedPlan(license.plan);
    }
  }, [license]);

  const fetchLicense = async () => {
    setLoading(true);
    try {
      const response = await licenseApi.getLicense(licenseKey);
      if (response.success && response.data) {
        setLicense(response.data);
        setError(null);
      } else {
        setError(response.error || "License not found");
      }
    } catch (err) {
      setError("Failed to load license details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Listen for activation-changed events to refresh license data
  useEffect(() => {
    if (!licenseKey) return;
    const handler = () => fetchLicense();
    window.addEventListener("activation-changed", handler);
    return () => window.removeEventListener("activation-changed", handler);
  }, [licenseKey]);

  const handleRenew = async () => {
    const days = prompt("Enter number of days to extend:", "365");
    if (!days) return;

    const extraDays = parseInt(days);
    if (isNaN(extraDays) || extraDays <= 0) {
      alert("Invalid number of days");
      return;
    }

    setActionLoading("renew");
    try {
      const response = await licenseApi.renewLicense(licenseKey, extraDays);
      if (response.success) {
        alert("License renewed successfully!");
        fetchLicense();
      } else {
        alert(response.error || "Failed to renew license");
      }
    } catch (err) {
      alert("API error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeEmail = async () => {
    const newEmail = prompt("Enter new email address:", license?.customer_email);
    if (!newEmail || !isValidEmail(newEmail)) {
      alert("Please enter a valid email address");
      return;
    }

    setActionLoading("email");
    try {
      const response = await licenseApi.changeLicenseEmail(licenseKey, newEmail);
      if (response.success) {
        alert("Email changed successfully!");
        fetchLicense();
      } else {
        alert(response.error || "Failed to change email");
      }
    } catch (err) {
      alert("API error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetHardware = async () => {
    if (!confirm(`Reset all hardware devices for license ${licenseKey}?`)) {
      return;
    }

    setActionLoading("hardware");
    try {
      const response = await licenseApi.resetHardware(licenseKey);
      if (response.success) {
        alert("Hardware devices reset successfully!");
        fetchLicense();
      } else {
        alert(response.error || "Failed to reset hardware");
      }
    } catch (err) {
      alert("API error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!confirm(`Are you sure you want to revoke license ${licenseKey}? This action cannot be undone.`)) {
      return;
    }

    setActionLoading("revoke");
    try {
      const response = await licenseApi.revokeLicense(licenseKey);
      if (response.success) {
        alert("License revoked successfully!");
        fetchLicense();
      } else {
        alert(response.error || "Failed to revoke license");
      }
    } catch (err) {
      alert("API error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete license ${licenseKey}? This cannot be undone.`)) {
      return;
    }

    setActionLoading("delete");
    try {
      const response = await licenseApi.deleteLicense(licenseKey);
      if (response.success) {
        alert("License deleted successfully!");
        router.push("/internal/api/analytics");
      } else {
        alert(response.error || "Failed to delete license");
      }
    } catch (err) {
      alert("API error");
    } finally {
      setActionLoading(null);
    }
  };

  // Plan Update Handler
  const handlePlanUpdate = async () => {
    if (!license) return;
    if (selectedPlan === license.plan) {
      alert("No change detected - plan is already set to " + selectedPlan);
      return;
    }
    
    setPlanUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/licenses/${licenseKey}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ Plan updated successfully from ${license.plan} to ${selectedPlan}`);
        fetchLicense(); // Refresh license data
      } else {
        alert(data.error || "Failed to update plan");
      }
    } catch (err) {
      console.error("Plan update error:", err);
      alert("Network error - failed to update plan");
    } finally {
      setPlanUpdating(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(licenseKey);
    alert("License key copied to clipboard!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-[var(--api-green-500-10)] text-[var(--api-green-400)] border border-[var(--api-green-500-20)]"><CheckCircle size={12} className="mr-1" /> Active</span>;
      case "expired":
        return <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)] border border-[var(--api-amber-500-20)]"><AlertCircle size={12} className="mr-1" /> Expired</span>;
      case "revoked":
        return <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-[var(--api-red-500-10)] text-[var(--api-red-400)] border border-[var(--api-red-500-20)]"><XCircle size={12} className="mr-1" /> Revoked</span>;
      default:
        return <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border border-[var(--border-color)]">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading license details...</span>
      </div>
    );
  }

  if (error || !license) {
    return (
      <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] backdrop-blur-xl p-8 text-center">
        <AlertCircle className="h-10 w-10 text-[var(--api-red-400)] mx-auto mb-3" />
        <p className="text-[var(--api-red-400)] font-medium">{error || "License not found"}</p>
        <button
          onClick={() => router.push("/internal/api/analytics")}
          className="mt-4 px-4 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 transition-all"
        >
          Back to Analytics
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/internal/api/analytics")}
          className="p-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">License Details</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            View and manage license information
          </p>
        </div>
      </div>

      {/* License Key Card */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">License Key</p>
            <p className="text-xl font-mono text-[var(--text-primary)] mt-1">{license.license_key}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyKey}
              className="p-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 transition-all"
              title="Copy License Key"
            >
              <Copy size={16} />
            </button>
            {getStatusBadge(license.status)}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Info */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 backdrop-blur-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Customer Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User size={16} className="text-[var(--text-muted)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)]">Name</p>
                <p className="text-[var(--text-primary)] font-medium">{license.customer_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-[var(--text-muted)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)]">Email</p>
                <p className="text-[var(--text-primary)]">{license.customer_email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* License Info */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 backdrop-blur-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">License Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Package size={16} className="text-[var(--text-muted)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)]">Product</p>
                <p className="text-[var(--text-primary)]">{license.product_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-[var(--text-muted)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)]">Expiry Date</p>
                <p className="text-[var(--text-primary)]">{new Date(license.expiry_date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Cpu size={16} className="text-[var(--text-muted)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)]">Devices</p>
                <p className="text-[var(--text-primary)]">{license.current_devices} / {license.max_devices}</p>
              </div>
            </div>
            {/* NEW: Plan Display */}
            <div className="flex items-center gap-3">
              <Layers size={16} className="text-[var(--text-muted)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)]">Current Plan</p>
                <p className="text-[var(--text-primary)] font-medium">{license.plan || "Standard"}</p>
              </div>
            </div>
            {license.notes && (
              <div className="flex items-start gap-3">
                <FileText size={16} className="text-[var(--text-muted)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Notes</p>
                  <p className="text-[var(--text-secondary)] text-sm">{license.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 backdrop-blur-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Actions</h3>
        
        {/* Plan Management Section - FIXED */}
        <div className="border-b border-[var(--border-color)] pb-4 mb-4">
          <h4 className="text-sm font-semibold text-[var(--api-blue-400)] mb-3 flex items-center gap-2">
            <Layers size={14} /> Plan Management
          </h4>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Select Plan</label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--api-blue-500-40)] focus:outline-none"
              >
                <option value="Standard">Standard</option>
                <option value="Professional">Professional</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            <button
              onClick={handlePlanUpdate}
              disabled={planUpdating || !license || selectedPlan === license.plan}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--api-blue-500-10)] border border-[var(--api-blue-500-30)] text-[var(--api-blue-400)] hover:bg-[var(--api-blue-500-20)] disabled:opacity-50 transition-all"
            >
              {planUpdating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Update Plan
            </button>
          </div>
          {license && selectedPlan !== license.plan && (
            <p className="text-xs text-[var(--api-amber-400)] mt-2">
              ⚠️ You are about to change the plan from <strong>{license.plan}</strong> to <strong>{selectedPlan}</strong>
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRenew}
            disabled={actionLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--api-green-500-10)] border border-[var(--api-green-500-20)] text-sm font-medium text-[var(--api-green-400)] hover:bg-[var(--api-green-500-20)] transition-all disabled:opacity-50"
          >
            {actionLoading === "renew" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Renew License
          </button>
          <button
            onClick={handleChangeEmail}
            disabled={actionLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--api-blue-500-10)] border border-[var(--api-blue-500-20)] text-sm font-medium text-[var(--api-blue-400)] hover:bg-[var(--api-blue-500-20)] transition-all disabled:opacity-50"
          >
            {actionLoading === "email" ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Change Email
          </button>
          <button
            onClick={handleResetHardware}
            disabled={actionLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--api-cyan-500-10)] border border-[var(--api-cyan-500-20)] text-sm font-medium text-[var(--api-cyan-400)] hover:bg-[var(--api-cyan-500-20)] transition-all disabled:opacity-50"
          >
            {actionLoading === "hardware" ? <Loader2 size={16} className="animate-spin" /> : <HardDrive size={16} />}
            Reset Hardware
          </button>
          <button
            onClick={handleRevoke}
            disabled={actionLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--api-amber-500-10)] border border-[var(--api-amber-500-20)] text-sm font-medium text-[var(--api-amber-400)] hover:bg-[var(--api-amber-500-20)] transition-all disabled:opacity-50"
          >
            {actionLoading === "revoke" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            Revoke License
          </button>
          <button
            onClick={handleDelete}
            disabled={actionLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--api-red-500-10)] border border-[var(--api-red-500-20)] text-sm font-medium text-[var(--api-red-400)] hover:bg-[var(--api-red-500-20)] transition-all disabled:opacity-50"
          >
            {actionLoading === "delete" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete License
          </button>
        </div>
      </div>
    </div>
  );
}