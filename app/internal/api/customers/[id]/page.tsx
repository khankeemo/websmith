// FILE: app/internal/api/customers/[id]/page.tsx
// PURPOSE: Customer Detail Page - Read-only view
// SCOPE: Customer profile, license summary, hardware summary, revenue summary
// RULE: No editing - view only
// RULE: Links to License Detail, Product Detail, Hardware Detail
// FIX: All hardcoded colors replaced with CSS variables

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  KeyRound,
  Cpu,
  DollarSign,
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Activity,
  HardDrive,
  FileText,
  Pencil,
  Save,
  Trash2,
  Building2,
  Globe,
  X,
  LogOut,
  Repeat,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface LicenseSummary {
  license_key: string;
  product_name: string;
  plan_name: string;
  status: string;
  issue_date: string;
  expiry_date: string;
}

interface HardwareSummary {
  hardware_id: string;
  device_name: string;
  license_key: string;
  last_seen: string;
  status: string;
}

interface RenewalItem {
  id: number;
  license_key: string;
  old_plan: string;
  new_plan: string;
  old_expiry_date: string;
  new_expiry_date: string;
  extra_days: number;
  renewed_by: string;
  renewed_at: string;
  notes: string;
}

interface EmailHistoryItem {
  id: number;
  event_type: string;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  created_at: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  phone: string | null;
  mobile: string | null;
  alternative_mobile: string | null;
  company: string | null;
  country: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  status: string | null;
  total_licenses: number;
  active_licenses: number;
  expired_licenses: number;
  revoked_licenses: number;
  total_revenue: number;
  first_purchase: string | null;
  last_activity: string | null;
  licenses: LicenseSummary[];
  hardware: HardwareSummary[];
  renewals: RenewalItem[];
  emailHistory: EmailHistoryItem[];
}

// ============================================================
// STATUS BADGE COMPONENT - FIXED
// ============================================================

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; icon: React.ReactNode }> = {
    active: {
      color: "bg-[var(--api-green-500-10)] text-[var(--api-green-400)] border-[var(--api-green-500-20)]",
      icon: <CheckCircle className="w-3 h-3" />,
    },
    expired: {
      color: "bg-[var(--api-red-500-10)] text-[var(--api-red-400)] border-[var(--api-red-500-20)]",
      icon: <XCircle className="w-3 h-3" />,
    },
    revoked: {
      color: "bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)] border-[var(--api-amber-500-20)]",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    inactive: {
      color: "bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border-[var(--border-color)]",
      icon: <Clock className="w-3 h-3" />,
    },
  };

  const config = configs[status] || configs.inactive;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ============================================================
// METRIC CARD COMPONENT - FIXED
// ============================================================

function MetricCard({
  label,
  value,
  icon,
  color = "blue",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "blue" | "green" | "purple" | "amber";
}) {
  const colors = {
    blue: "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)] text-[var(--api-blue-400)]",
    green: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] text-[var(--api-green-400)]",
    purple: "border-[var(--api-purple-500-20)] bg-[var(--api-purple-500-5)] text-[var(--api-purple-400)]",
    amber: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)] text-[var(--api-amber-400)]",
  };

  return (
    <div className={`rounded-xl border ${colors[color]} p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[var(--text-secondary)] text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[color:inherit]">{icon}</span>
        <span className="text-xl font-bold text-[var(--text-primary)]">{value}</span>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    mobile: "",
    alternative_mobile: "",
    company: "",
    country: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    notes: "",
    status: "active",
  });

  useEffect(() => {
    if (customerId) {
      fetchCustomer();
    }
  }, [customerId]);

  const fetchCustomer = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/internal/backend/customers/${encodeURIComponent(customerId)}`);
      const data = await response.json();

      if (data.success && data.customer) {
        setCustomer(data.customer);
      } else {
        setError(data.error || "Customer not found");
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError("Failed to load customer details");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name || "",
      phone: customer.phone || "",
      mobile: customer.mobile || "",
      alternative_mobile: customer.alternative_mobile || "",
      company: customer.company || "",
      country: customer.country || "",
      address_line1: customer.address_line1 || "",
      address_line2: customer.address_line2 || "",
      city: customer.city || "",
      state: customer.state || "",
      postal_code: customer.postal_code || "",
      notes: customer.notes || "",
      status: customer.status || "active",
    });
    setEditing(true);
    setError(null);
    setSuccess(null);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const saveCustomer = async () => {
    if (!customer) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, string> = {};
      if (editForm.name !== (customer.name || "")) body.name = editForm.name;
      if (editForm.phone !== (customer.phone || "")) body.phone = editForm.phone;
      if (editForm.mobile !== (customer.mobile || "")) body.mobile = editForm.mobile;
      if (editForm.alternative_mobile !== (customer.alternative_mobile || "")) body.alternative_mobile = editForm.alternative_mobile;
      if (editForm.company !== (customer.company || "")) body.company = editForm.company;
      if (editForm.country !== (customer.country || "")) body.country = editForm.country;
      if (editForm.address_line1 !== (customer.address_line1 || "")) body.address_line1 = editForm.address_line1;
      if (editForm.address_line2 !== (customer.address_line2 || "")) body.address_line2 = editForm.address_line2;
      if (editForm.city !== (customer.city || "")) body.city = editForm.city;
      if (editForm.state !== (customer.state || "")) body.state = editForm.state;
      if (editForm.postal_code !== (customer.postal_code || "")) body.postal_code = editForm.postal_code;
      if (editForm.notes !== (customer.notes || "")) body.notes = editForm.notes;
      if (editForm.status !== (customer.status || "active")) body.status = editForm.status;

      if (Object.keys(body).length === 0) {
        setEditing(false);
        setSaving(false);
        return;
      }

      const response = await fetch(`/internal/backend/customers/${encodeURIComponent(customerId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (data.success) {
        setCustomer(data.customer);
        setEditing(false);
        setSuccess("Customer updated successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to update customer");
      }
    } catch (err) {
      console.error("Error saving customer:", err);
      setError("Failed to save customer changes");
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async () => {
    if (!customer) return;
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/internal/backend/customers/${encodeURIComponent(customerId)}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        router.push("/internal/api/customers");
      } else {
        setError(data.error || "Failed to delete customer");
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error("Error deleting customer:", err);
      setError("Failed to delete customer");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading customer details...</span>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-8 text-center">
        <AlertCircle className="h-10 w-10 text-[var(--api-red-400)] mx-auto mb-3" />
        <p className="text-[var(--api-red-400)] font-medium">{error || "Customer not found"}</p>
        <button
          onClick={() => router.push("/internal/api/customers")}
          className="mt-4 px-4 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 transition-all"
        >
          Back to Customers
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/internal/api/customers")}
            className="p-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Customer Details</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              View and manage customer information
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/20 transition-all disabled:opacity-50"
              >
                <X size={14} />
                Cancel
              </button>
              <button
                onClick={saveCustomer}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--api-green-500)] text-white text-sm hover:bg-[var(--api-green-600)] transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEditing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/20 transition-all"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--api-red-500-20)] text-sm text-[var(--api-red-400)] hover:bg-[var(--api-red-500-10)] transition-all"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="rounded-2xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-[var(--api-green-400)]" />
            <p className="text-[var(--api-green-400)] text-sm">{success}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)]" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Customer Profile Card */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--api-blue-500)] to-[var(--api-purple-500)] flex items-center justify-center text-3xl font-bold text-white">
              {customer.avatar ? (
                <img src={customer.avatar} alt={customer.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                customer.name.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          {editing ? (
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                  placeholder="Customer name"
                />
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Email</label>
                  <div className="px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/10 border border-[var(--border-color)] text-[var(--text-secondary)] text-sm">{customer.email}</div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Mobile</label>
                  <input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm(f => ({ ...f, mobile: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Mobile number"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Alternative Mobile</label>
                  <input
                    type="text"
                    value={editForm.alternative_mobile}
                    onChange={(e) => setEditForm(f => ({ ...f, alternative_mobile: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Alternative mobile"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={editForm.address_line1}
                    onChange={(e) => setEditForm(f => ({ ...f, address_line1: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={editForm.address_line2}
                    onChange={(e) => setEditForm(f => ({ ...f, address_line2: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Apartment, suite, etc."
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="State/Province"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={editForm.postal_code}
                    onChange={(e) => setEditForm(f => ({ ...f, postal_code: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Postal/ZIP code"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm resize-none"
                  placeholder="Additional notes about this customer"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{customer.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  customer.status !== "inactive"
                    ? "bg-[var(--api-green-500-10)] text-[var(--api-green-400)] border-[var(--api-green-500-20)]"
                    : "bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border-[var(--border-color)]"
                }`}>
                  {customer.status !== "inactive" ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center gap-1">
                  <Mail size={14} />
                  <span>{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={14} />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.company && (
                  <div className="flex items-center gap-1">
                    <Building2 size={14} />
                    <span>{customer.company}</span>
                  </div>
                )}
                {customer.country && (
                  <div className="flex items-center gap-1">
                    <Globe size={14} />
                    <span>{customer.country}</span>
                  </div>
                )}
                {customer.mobile && (
                  <div className="flex items-center gap-1">
                    <Phone size={14} />
                    <span>{customer.mobile}</span>
                  </div>
                )}
                {customer.alternative_mobile && (
                  <div className="flex items-center gap-1">
                    <Phone size={14} />
                    <span>{customer.alternative_mobile}</span>
                  </div>
                )}
                {customer.address_line1 && (
                  <div className="flex items-center gap-1">
                    <Building2 size={14} />
                    <span>{customer.address_line1}{customer.address_line2 ? `, ${customer.address_line2}` : ''}</span>
                  </div>
                )}
                {(customer.city || customer.state || customer.postal_code) && (
                  <div className="flex items-center gap-1">
                    <Globe size={14} />
                    <span>{[customer.city, customer.state, customer.postal_code].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span>First purchase: {formatDate(customer.first_purchase)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity size={14} />
                  <span>Last activity: {formatDate(customer.last_activity)}</span>
                </div>
              </div>
              {customer.notes && (
                <div className="mt-3 p-3 rounded-xl bg-[var(--bg-tertiary)]/10 border border-[var(--border-color)]">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
                    <FileText size={12} />
                    Notes
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Licenses"
          value={customer.total_licenses}
          icon={<KeyRound size={16} />}
          color="blue"
        />
        <MetricCard
          label="Active Licenses"
          value={customer.active_licenses}
          icon={<CheckCircle size={16} />}
          color="green"
        />
        <MetricCard
          label="Expired / Revoked"
          value={customer.expired_licenses + customer.revoked_licenses}
          icon={<XCircle size={16} />}
          color="amber"
        />
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(customer.total_revenue)}
          icon={<DollarSign size={16} />}
          color="purple"
        />
      </div>

      {/* Licenses Section */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[var(--api-blue-400)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Licenses</h3>
            <span className="text-sm text-[var(--text-secondary)]">({customer.licenses.length})</span>
          </div>
        </div>

        {customer.licenses.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <KeyRound className="h-8 w-8 mx-auto mb-2 text-[var(--text-muted)]" />
            <p>No licenses found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customer.licenses.map((license) => (
              <Link
                key={license.license_key}
                href={`/internal/api/licenses/${license.license_key}`}
                className="block p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:bg-[var(--bg-tertiary)]/20 transition-all duration-200 group"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-[var(--text-primary)]">
                        {license.license_key}
                      </span>
                      <StatusBadge status={license.status} />
                    </div>
                    <div className="flex flex-wrap gap-4 mt-1 text-sm text-[var(--text-secondary)]">
                      <span>Product: {license.product_name}</span>
                      <span>Plan: {license.plan_name}</span>
                      <span>Issued: {formatDate(license.issue_date)}</span>
                      <span>Expires: {formatDate(license.expiry_date)}</span>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-[var(--text-muted)] group-hover:text-[var(--api-blue-400)] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Hardware Section */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[var(--api-cyan-400)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Hardware Devices</h3>
            <span className="text-sm text-[var(--text-secondary)]">({customer.hardware.length})</span>
          </div>
          <Link
            href="/internal/api/hardware"
            className="text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors flex items-center gap-1"
          >
            View All <ExternalLink size={12} />
          </Link>
        </div>

        {customer.hardware.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <HardDrive className="h-8 w-8 mx-auto mb-2 text-[var(--text-muted)]" />
            <p>No hardware devices found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customer.hardware.map((device) => (
              <div
                key={device.hardware_id}
                className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-[var(--text-primary)]">
                        {device.hardware_id}
                      </span>
                      <StatusBadge status={device.status} />
                    </div>
                    <div className="flex flex-wrap gap-4 mt-1 text-sm text-[var(--text-secondary)]">
                      <span>Device: {device.device_name}</span>
                      <span>License: {device.license_key}</span>
                      <span>Last seen: {formatDate(device.last_seen)}</span>
                    </div>
                  </div>
                  <Link
                    href={`/internal/api/hardware`}
                    className="text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors flex items-center gap-1"
                  >
                    View <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Renewals Section */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-[var(--api-blue-400)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Renewals</h3>
            <span className="text-sm text-[var(--text-secondary)]">({customer.renewals.length})</span>
          </div>
        </div>

        {customer.renewals.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <Repeat className="h-8 w-8 mx-auto mb-2 text-[var(--text-muted)]" />
            <p>No renewals found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">License Key</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Plan</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Expiry</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Extra Days</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {customer.renewals.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)]/5 transition-colors">
                    <td className="py-2 px-3 text-[var(--text-primary)]">{formatDate(r.renewed_at)}</td>
                    <td className="py-2 px-3">
                      <code className="text-xs font-mono bg-[var(--bg-tertiary)]/20 px-1.5 py-0.5 rounded text-[var(--text-secondary)]">
                        {r.license_key}
                      </code>
                    </td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{r.old_plan || 'N/A'} → {r.new_plan || 'N/A'}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">
                      {r.old_expiry_date ? formatDate(r.old_expiry_date) : 'N/A'} → {r.new_expiry_date ? formatDate(r.new_expiry_date) : 'N/A'}
                    </td>
                    <td className="py-2 px-3 text-[var(--text-primary)]">{r.extra_days ?? 'N/A'}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)] max-w-[200px] truncate">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email History Section */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[var(--api-purple-400)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Email History</h3>
            <span className="text-sm text-[var(--text-secondary)]">({customer.emailHistory.length})</span>
          </div>
        </div>

        {customer.emailHistory.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <Mail className="h-8 w-8 mx-auto mb-2 text-[var(--text-muted)]" />
            <p>No emails sent</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Template</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Subject</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.emailHistory.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)]/5 transition-colors">
                    <td className="py-2 px-3 text-[var(--text-primary)]">{formatDate(e.created_at)}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{e.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)] max-w-[300px] truncate">{e.subject || '—'}</td>
                    <td className="py-2 px-3">
                      <StatusBadge status={e.status === 'sent' ? 'active' : e.status === 'failed' ? 'revoked' : 'inactive'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-[var(--api-red-500-10)] flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-[var(--api-red-400)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Delete Customer</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-1">
                Are you sure you want to delete this customer?
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-6">
                This action cannot be undone. The customer record will be permanently removed.
              </p>
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/20 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteCustomer}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--api-red-500)] text-white text-sm hover:bg-[var(--api-red-600)] transition-all disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {deleting ? "Deleting..." : "Delete Customer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}