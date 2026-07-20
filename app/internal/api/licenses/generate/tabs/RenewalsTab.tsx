// FILE: app/internal/api/licenses/generate/tabs/RenewalsTab.tsx
// PURPOSE: Tab 4 - Renewals
// SCOPE: View and renew licenses that are active or expired
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect } from "react";
import {
  Repeat,
  Search,
  Loader2,
  XCircle,
  Loader2 as Spinner,
} from "lucide-react";

// ============================================================
// RENEWALS TAB
// ============================================================

export function RenewalsTab() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [renewing, setRenewing] = useState<string | null>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<{ [key: string]: string }>({});
  const [customDays, setCustomDays] = useState<{ [key: string]: number | string }>({});

  const API_BASE = "/internal/backend";

  // ============================================================
  // FETCH LICENSES AND PLANS
  // ============================================================
  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        const response = await fetch(`${API_BASE}/licenses`);
        const data = await response.json();
        if (data.success) {
          const renewable = (data.data || []).filter(
            (l: any) => l.status === "active" || l.status === "expired"
          );
          setLicenses(renewable);

          // Fetch plans for each unique product
          const productIds = [...new Set(renewable.map((l: any) => l.product_id))];
          const allPlans: any[] = [];
          for (const productId of productIds) {
            try {
              const planRes = await fetch(`${API_BASE}/admin/products/${productId}/plans`);
              const planData = await planRes.json();
              if (planData.success) {
                allPlans.push(...planData.plans.map((p: any) => ({ ...p, product_id: productId })));
              }
            } catch (e) {
              console.error(`Failed to fetch plans for product ${productId}`, e);
            }
          }
          setAvailablePlans(allPlans);
        }
      } catch (err) {
        console.error("Failed to fetch licenses:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLicenses();
  }, []);

  // ============================================================
  // HANDLE RENEW
  // ============================================================
  const handleRenew = async (licenseKey: string, extraDays: number, newPlan?: string) => {
    setRenewing(licenseKey);
    try {
      const payload: any = {
        license_key: licenseKey,
        extra_days: extraDays,
      };

      if (newPlan && newPlan.trim() !== "") {
        payload.new_plan = newPlan;
      }

      const response = await fetch(`${API_BASE}/licenses/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ License ${licenseKey} renewed successfully!`);
        // Refresh list
        const updated = await fetch(`${API_BASE}/licenses`);
        const updatedData = await updated.json();
        if (updatedData.success) {
          const renewable = (updatedData.data || []).filter(
            (l: any) => l.status === "active" || l.status === "expired"
          );
          setLicenses(renewable);
        }
      } else {
        alert(`❌ Failed to renew: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      alert("❌ Failed to renew license");
    } finally {
      setRenewing(null);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================
  const getPlansForLicense = (license: any) => {
    return availablePlans.filter((p) => p.product_id === license.product_id && p.is_active);
  };

  const isExpiringSoon = (expiryDate: string) => {
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30;
  };

  const getRenewalOptions = () => [
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
    { label: "365 days", value: 365 },
  ];

  // ============================================================
  // FILTER LICENSES
  // ============================================================
  const filteredLicenses = licenses.filter((l) => {
    const query = searchQuery.toLowerCase();
    return (
      l.license_key?.toLowerCase().includes(query) ||
      l.customer_name?.toLowerCase().includes(query) ||
      l.customer_email?.toLowerCase().includes(query)
    );
  });

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-[var(--api-blue-400)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border-color)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{licenses.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Renewable Licenses</p>
        </div>
        <div className="rounded-xl border border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--api-amber-400)]">
            {licenses.filter((l) => isExpiringSoon(l.expiry_date)).length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Expiring Soon (30 days)</p>
        </div>
        <div className="rounded-xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--api-red-400)]">
            {licenses.filter((l) => l.status === "expired").length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Expired</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search licenses to renew..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      {/* License List */}
      {filteredLicenses.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Repeat className="h-8 w-8 opacity-20 mx-auto mb-2" />
          <p className="text-sm">No renewable licenses found</p>
          <p className="text-xs mt-1">Licenses appear here when they are active or expired</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {filteredLicenses.map((license) => {
            const daysLeft = license.days_left || 0;
            const isExpired = license.status === "expired";
            const isSoon = isExpiringSoon(license.expiry_date) && !isExpired;
            const licensePlans = getPlansForLicense(license);
            const currentPlan = selectedPlan[license.license_key] || license.plan || "";
            const customDaysValue = customDays[license.license_key] || "";

            return (
              <div
                key={license.license_key}
                className={`flex flex-col gap-2 p-3 rounded-xl border ${
                  isExpired
                    ? "border-red-500/30 bg-red-500/5"
                    : isSoon
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-[var(--border-color)] bg-[var(--bg-tertiary)]/5"
                } hover:border-[var(--api-blue-500-20)] transition-all`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--api-blue-500-10)]">
                    <Repeat className="h-4 w-4 text-[var(--api-blue-400)]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-sm text-[var(--text-primary)]">
                        {license.license_key}
                      </code>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          license.status === "active"
                            ? "text-[var(--api-green-400)] bg-[var(--api-green-500-10)] border-[var(--api-green-500-20)]"
                            : "text-[var(--api-red-400)] bg-[var(--api-red-500-10)] border-[var(--api-red-500-20)]"
                        }`}
                      >
                        {license.status}
                      </span>
                      {isSoon && !isExpired && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                          Expiring Soon
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)] flex-wrap">
                      <span>{license.customer_name || "Unknown"}</span>
                      <span>{license.customer_email}</span>
                      <span>Plan: {license.plan || "N/A"}</span>
                      <span>Expires: {new Date(license.expiry_date).toLocaleDateString()}</span>
                      {!isExpired && <span>{daysLeft} days left</span>}
                    </div>
                  </div>
                </div>

                {/* Renewal Controls */}
                <div className="flex flex-wrap items-center gap-2 pl-11">
                  {/* Plan Change Dropdown */}
                  {licensePlans.length > 0 && (
                    <select
                      value={currentPlan}
                      onChange={(e) => {
                        setSelectedPlan({
                          ...selectedPlan,
                          [license.license_key]: e.target.value,
                        });
                      }}
                      className="px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50"
                    >
                      <option value={license.plan || ""}>Current: {license.plan || "N/A"}</option>
                      {licensePlans
                        .filter((p) => p.name !== license.plan)
                        .map((plan) => (
                          <option key={plan.id} value={plan.name}>
                            Change to: {plan.name} ({plan.default_expiry_days} days, {plan.max_devices} devices)
                          </option>
                        ))}
                    </select>
                  )}

                  {/* Duration Selection */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const days = parseInt(e.target.value);
                        const planName = selectedPlan[license.license_key] || license.plan;
                        handleRenew(
                          license.license_key,
                          days,
                          planName && planName !== license.plan ? planName : undefined
                        );
                      }
                      e.target.value = "";
                    }}
                    disabled={renewing === license.license_key}
                    className="px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                  >
                    <option value="">Extend</option>
                    {getRenewalOptions().map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    <option value="custom">Custom...</option>
                  </select>

                  {/* Custom Days Input */}
                  <input
                    type="number"
                    placeholder="Days"
                    value={customDaysValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomDays({
                        ...customDays,
                        [license.license_key]: value === "" ? "" : parseInt(value) || 0,
                      });
                    }}
                    className="w-20 px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50"
                  />

                  {/* Renew Button */}
                  {typeof customDaysValue === "number" && customDaysValue > 0 && (
                    <button
                      onClick={() => {
                        const planName = selectedPlan[license.license_key] || license.plan;
                        const days = typeof customDaysValue === "number" ? customDaysValue : 30;
                        handleRenew(
                          license.license_key,
                          days,
                          planName && planName !== license.plan ? planName : undefined
                        );
                      }}
                      disabled={renewing === license.license_key}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                      Renew
                    </button>
                  )}

                  {renewing === license.license_key && (
                    <Loader2 className="h-4 w-4 text-[var(--api-blue-400)] animate-spin" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-[var(--text-muted)] text-center pt-2 border-t border-[var(--border-color)]">
        {filteredLicenses.length} renewable licenses · Select plan and duration to renew
      </div>
    </div>
  );
}