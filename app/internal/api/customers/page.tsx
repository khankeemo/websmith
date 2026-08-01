// FILE: app/internal/api/customers/page.tsx
// PURPOSE: Customer Management Center - View and manage customers
// SCOPE: Customer list, search, revenue by customer, license count, device count
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors
// FIXED: Safe array operations - prevents "Reduce of empty array" error

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Mail,
  Key,
  Cpu,
  DollarSign,
  ChevronDown,
  ChevronUp,
  User,
  Building2,
  Clock,
  ArrowUpRight,
  Download,
  Filter,
  Calendar,
  Copy,
  Check,
  Eye,
  Plus,
  X,
} from "lucide-react";
import { isValidEmail } from "@/lib/validation";
import { FieldIndicator } from "@/components/internal-api/validation/FieldIndicator";

// ============================================================
// TYPES - Based on actual customers API response
// ============================================================

interface Customer {
  id: string;
  name: string;
  email: string;
  total_licenses: number;
  active_licenses: number;
  expired_licenses: number;
  revoked_licenses: number;
  license_keys: string[];
}

interface CustomersResponse {
  success: boolean;
  data: Customer[];
  count: number;
  error?: string;
}

// ============================================================
// SAFE ARRAY HELPERS - PREVENT "Reduce of empty array" ERROR
// ============================================================

function safeReduce<T, R>(
  arr: T[] | undefined,
  callback: (acc: R, item: T) => R,
  initialValue: R
): R {
  if (!arr || arr.length === 0) return initialValue;
  return arr.reduce(callback, initialValue);
}

function safeSum<T>(arr: T[] | undefined, getValue: (item: T) => number): number {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, item) => sum + getValue(item), 0);
}

function safeCount<T>(arr: T[] | undefined, predicate: (item: T) => boolean): number {
  if (!arr || arr.length === 0) return 0;
  return arr.filter(predicate).length;
}

// ============================================================
// STATISTICS CARD COMPONENT
// ============================================================

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "cyan" | "amber";
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const colorClasses = {
    blue: "border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)]",
    green: "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]",
    purple: "border-[var(--api-purple-500-20)] bg-[var(--api-purple-500-5)]",
    cyan: "border-[var(--api-cyan-500-20)] bg-[var(--api-cyan-500-5)]",
    amber: "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]",
  };

  const iconColors = {
    blue: "text-[var(--api-blue-400)] bg-[var(--api-blue-500-10)]",
    green: "text-[var(--api-green-400)] bg-[var(--api-green-500-10)]",
    purple: "text-[var(--api-purple-400)] bg-[var(--api-purple-500-10)]",
    cyan: "text-[var(--api-cyan-400)] bg-[var(--api-cyan-500-10)]",
    amber: "text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)]",
  };

  return (
    <div className={`rounded-2xl border ${colorClasses[color]} p-5 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-2.5 ${iconColors[color]}`}>
          {icon}
        </div>
        <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mt-2">{title}</p>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
    </div>
  );
}

// ============================================================
// CUSTOMER CARD COMPONENT
// ============================================================

interface CustomerCardProps {
  customer: Customer;
  onViewDetails?: (customer: Customer) => void;
}

function CustomerCard({ customer, onViewDetails }: CustomerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const getStatusColor = (count: number, total: number) => {
    if (total === 0) return "text-[var(--text-muted)]";
    const ratio = count / total;
    if (ratio > 0.7) return "text-[var(--api-green-400)]";
    if (ratio > 0.3) return "text-[var(--api-amber-400)]";
    return "text-[var(--api-red-400)]";
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 transition-all duration-200 hover:shadow-lg overflow-hidden hover:border-[var(--api-blue-500-20)]`}>
      {/* Header */}
      <div 
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-2.5 rounded-xl bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)]">
          <User className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-[var(--text-primary)]">
              {customer.name || "Unnamed Customer"}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              customer.active_licenses > 0 
                ? "border-[var(--api-green-500-20)] bg-[var(--api-green-500-10)] text-[var(--api-green-400)]" 
                : "border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)]"
            }`}>
              {customer.active_licenses > 0 ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1">
              <Mail size={12} className="text-[var(--text-muted)]" />
              {customer.email}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {customer.total_licenses} licenses
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(customer);
              }}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
              title="View Details"
            >
              <Eye size={16} className="text-[var(--text-muted)] hover:text-[var(--api-blue-400)]" />
            </button>
          )}
          <button className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)]/20">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{customer.total_licenses}</p>
              <p className="text-xs text-[var(--text-muted)]">Total Licenses</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)]/20">
              <p className={`text-2xl font-bold ${getStatusColor(customer.active_licenses, customer.total_licenses)}`}>
                {customer.active_licenses}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Active</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)]/20">
              <p className="text-2xl font-bold text-[var(--api-amber-400)]">{customer.expired_licenses}</p>
              <p className="text-xs text-[var(--text-muted)]">Expired</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)]/20">
              <p className="text-2xl font-bold text-[var(--api-red-400)]">{customer.revoked_licenses}</p>
              <p className="text-xs text-[var(--text-muted)]">Revoked</p>
            </div>
          </div>

          {/* License Keys */}
          {customer.license_keys.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
              <p className="text-xs text-[var(--text-muted)] mb-2">License Keys</p>
              <div className="flex flex-wrap gap-2">
                {customer.license_keys.slice(0, 5).map((key) => (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)] text-xs"
                  >
                    <span className="font-mono text-[var(--text-secondary)]">{key}</span>
                    <button
                      onClick={() => copyToClipboard(key)}
                      className="p-0.5 hover:text-[var(--api-blue-400)] transition-colors"
                    >
                      {copied ? <Check size={10} className="text-[var(--api-green-400)]" /> : <Copy size={10} className="text-[var(--text-muted)]" />}
                    </button>
                  </div>
                ))}
                {customer.license_keys.length > 5 && (
                  <span className="text-xs text-[var(--text-muted)] px-2 py-1">
                    +{customer.license_keys.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN CUSTOMERS PAGE
// ============================================================

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
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
  });

  const API_BASE = "/internal/backend";

  const fetchCustomers = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/customers`);
      const data: CustomersResponse = await response.json();

      if (data.success) {
        setCustomers(data.data || []);
        setLastUpdated(new Date());
      } else {
        setError(data.error || "Failed to load customers");
      }
    } catch (err) {
      console.error("Customers fetch error:", err);
      setError("Failed to load customer data. Please refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.license_keys.some((key) => key.toLowerCase().includes(query))
    );
  });

  // Statistics - SAFE using safeSum and safeCount
  const totalCustomers = customers.length;
  const totalLicenses = safeSum(customers, (c) => c.total_licenses);
  const totalActive = safeSum(customers, (c) => c.active_licenses);
  const customersWithLicenses = safeCount(customers, (c) => c.total_licenses > 0);

  const handleViewDetails = (customer: Customer) => {
    router.push(`/internal/api/customers/${encodeURIComponent(customer.email)}`);
  };

  const exportCustomers = () => {
    const csv = [
      ["Name", "Email", "Total Licenses", "Active", "Expired", "Revoked", "License Keys"],
      ...filteredCustomers.map(c => [
        c.name || "",
        c.email,
        c.total_licenses,
        c.active_licenses,
        c.expired_licenses,
        c.revoked_licenses,
        c.license_keys.join("; "),
      ]),
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(createForm.email)) {
      setError("A valid email address is required");
      return;
    }
    setCreating(true);
    setError(null);

    try {
const response = await fetch(`${API_BASE}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: createForm.email,
            name: createForm.name || undefined,
            phone: createForm.phone || undefined,
            mobile: createForm.mobile || undefined,
            alternative_mobile: createForm.alternative_mobile || undefined,
            company: createForm.company || undefined,
            country: createForm.country || undefined,
            address_line1: createForm.address_line1 || undefined,
            address_line2: createForm.address_line2 || undefined,
            city: createForm.city || undefined,
            state: createForm.state || undefined,
            postal_code: createForm.postal_code || undefined,
            notes: createForm.notes || undefined,
          }),
        });
      const data = await response.json();

      if (data.success) {
        setShowCreateModal(false);
        setCreateForm({ email: "", name: "", phone: "", mobile: "", alternative_mobile: "", company: "", country: "", address_line1: "", address_line2: "", city: "", state: "", postal_code: "", notes: "" });
        fetchCustomers();
      } else {
        setError(data.error || "Failed to create customer");
      }
    } catch (err) {
      console.error("Create customer error:", err);
      setError("Failed to create customer. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)] mt-3">Loading customers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Customer Management</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            View and manage all customers and their license usage
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--api-blue-500)] text-white text-sm hover:bg-[var(--api-blue-600)] transition-all"
          >
            <Plus size={14} />
            Add Customer
          </button>
          <button
            onClick={exportCustomers}
            disabled={filteredCustomers.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={fetchCustomers}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)]" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
            <button
              onClick={fetchCustomers}
              className="ml-auto text-sm text-[var(--api-blue-400)] hover:text-blue-300"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={totalCustomers}
          icon={<Users className="h-5 w-5" />}
          color="blue"
          subtitle={`${customersWithLicenses} with licenses`}
        />
        <StatCard
          title="Total Licenses"
          value={totalLicenses}
          icon={<Key className="h-5 w-5" />}
          color="purple"
          subtitle={`${totalActive} active`}
        />
        <StatCard
          title="Avg Licenses/Customer"
          value={totalCustomers > 0 ? Math.round(totalLicenses / totalCustomers) : 0}
          icon={<Building2 className="h-5 w-5" />}
          color="cyan"
        />
        <StatCard
          title="Active Rate"
          value={totalLicenses > 0 ? Math.round((totalActive / totalLicenses) * 100) : 0}
          icon={<ArrowUpRight className="h-5 w-5" />}
          color="green"
          subtitle={`${totalActive} of ${totalLicenses} active`}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search customers by name, email, or license key..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Users className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm font-medium">No customers found</p>
            <p className="text-xs mt-1">
              {searchQuery ? "Try adjusting your search" : "No customers have been registered yet"}
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onViewDetails={handleViewDetails}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${customers.length > 0 ? "bg-green-400 animate-pulse" : "bg-amber-400"}`} />
          <span>Customer API: {customers.length > 0 ? "Online" : "Active"}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{filteredCustomers.length} of {customers.length} customers shown</span>
          {lastUpdated && (
            <span>Last updated: {lastUpdated.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Add Customer</h3>
              <button
                onClick={() => { setShowCreateModal(false); setError(null); }}
                className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]/20 transition-colors"
              >
                <X size={18} className="text-[var(--text-muted)]" />
              </button>
            </div>

            <form onSubmit={createCustomer} className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Email *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="customer@example.com"
                  />
                  <FieldIndicator
                    state={
                      createForm.email.trim() === ""
                        ? "empty"
                        : isValidEmail(createForm.email)
                          ? "valid"
                          : "invalid"
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                  placeholder="Full name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Phone</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Company</label>
                  <input
                    type="text"
                    value={createForm.company}
                    onChange={(e) => setCreateForm(f => ({ ...f, company: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Company name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Country</label>
                <input
                  type="text"
                  value={createForm.country}
                  onChange={(e) => setCreateForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                  placeholder="Country"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Mobile</label>
                  <input
                    type="text"
                    value={createForm.mobile}
                    onChange={(e) => setCreateForm(f => ({ ...f, mobile: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Mobile number"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Alternative Mobile</label>
                  <input
                    type="text"
                    value={createForm.alternative_mobile}
                    onChange={(e) => setCreateForm(f => ({ ...f, alternative_mobile: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Alternative mobile"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={createForm.address_line1}
                    onChange={(e) => setCreateForm(f => ({ ...f, address_line1: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={createForm.address_line2}
                    onChange={(e) => setCreateForm(f => ({ ...f, address_line2: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Apartment, suite, etc."
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">City</label>
                  <input
                    type="text"
                    value={createForm.city}
                    onChange={(e) => setCreateForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">State</label>
                  <input
                    type="text"
                    value={createForm.state}
                    onChange={(e) => setCreateForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="State/Province"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={createForm.postal_code}
                    onChange={(e) => setCreateForm(f => ({ ...f, postal_code: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                    placeholder="Postal/ZIP code"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all text-sm resize-none"
                  placeholder="Additional notes"
                />
              </div>
              <div className="flex items-center gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setError(null); }}
                  disabled={creating}
                  className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/20 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--api-blue-500)] text-white text-sm hover:bg-[var(--api-blue-600)] transition-all disabled:opacity-50"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? "Creating..." : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}