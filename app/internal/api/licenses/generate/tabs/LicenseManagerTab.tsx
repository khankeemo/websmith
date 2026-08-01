// FILE: app/internal/api/licenses/generate/tabs/LicenseManagerTab.tsx
// PURPOSE: Tab 2 - License Manager
// SCOPE: List, search, filter, edit, delete, restore, and view history of licenses
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect } from "react";
import {
  KeyRound,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  FileText,
  Trash2,
  Ban,
  RotateCcw,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  CheckCircle,
  X,
  Mail,
} from "lucide-react";
import { isValidEmail } from "@/lib/validation";
import UniversalEmailDialog from "@/components/internal-api/UniversalEmailDialog";

// ============================================================
// LICENSE MANAGER TAB
// ============================================================

export function LicenseManagerTab() {
  // ============================================================
  // STATE
  // ============================================================
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("");
  const [filterPlan, setFilterPlan] = useState<string>("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(20);

  // Available filters
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [availablePlans, setAvailablePlans] = useState<string[]>([]);

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Bulk Actions
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<string>('');
  const [bulkEmailValue, setBulkEmailValue] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // UI States
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [licenseToDelete, setLicenseToDelete] = useState<string | null>(null);
  const [licenseHistory, setLicenseHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailContext, setEmailContext] = useState<{ email: string; licenseKey: string; productName?: string; productId?: string } | null>(null);

  // Deactivate & Revoke
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [licenseToDeactivate, setLicenseToDeactivate] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [licenseToRevoke, setLicenseToRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeConfirmText, setRevokeConfirmText] = useState("");

  // Edit Form State
  const [editForm, setEditForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_username: "",
    plan: "",
    status: "",
    expiry_date: "",
    max_devices: 1,
    duration_days: 365,
    notes: "",
  });
  const [availablePlansForEdit, setAvailablePlansForEdit] = useState<any[]>([]);

  const API_BASE = "/internal/backend";

  // ============================================================
  // FETCH LICENSES
  // ============================================================
  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterProduct) params.append("product", filterProduct);
      if (filterPlan) params.append("plan", filterPlan);
      if (includeDeleted) params.append("include_deleted", "true");
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      if (sortBy) params.append("sort_by", sortBy);
      if (sortOrder) params.append("sort_order", sortOrder);
      params.append("limit", pageSize.toString());
      params.append("offset", (currentPage * pageSize).toString());

      const response = await fetch(`${API_BASE}/licenses?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setLicenses(data.data || []);
        setTotalCount(data.pagination?.total || 0);
        setHasMore(data.pagination?.has_more || false);

        if (data.filters) {
          setAvailableProducts(data.filters.available_products || []);
          setAvailablePlans(data.filters.available_plans || []);
        }
      } else {
        setLicenses([]);
      }
    } catch (err) {
      console.error("Error fetching licenses:", err);
      setLicenses([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FETCH ON CHANGE
  // ============================================================
  useEffect(() => {
    fetchLicenses();
  }, [
    searchQuery,
    filterStatus,
    filterProduct,
    filterPlan,
    includeDeleted,
    dateFrom,
    dateTo,
    currentPage,
    sortBy,
    sortOrder,
  ]);

  // ============================================================
  // HANDLE RESTORE
  // ============================================================
  const handleRestore = async (licenseKey: string) => {
    if (!confirm(`Are you sure you want to restore license "${licenseKey}"?`)) return;

    setRestoring(licenseKey);
    try {
      const response = await fetch(`${API_BASE}/licenses/${licenseKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ License ${licenseKey} restored successfully!`);
        fetchLicenses();
      } else {
        alert(`❌ Failed to restore: ${data.error}`);
      }
    } catch (err) {
      console.error("Restore error:", err);
      alert("❌ Failed to restore license");
    } finally {
      setRestoring(null);
    }
  };

  // ============================================================
  // HANDLE DELETE
  // ============================================================
  const handleDeleteConfirm = async () => {
    if (!licenseToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/licenses/${licenseToDelete}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ License ${licenseToDelete} deleted successfully!`);
        setShowDeleteConfirm(false);
        setLicenseToDelete(null);
        fetchLicenses();
      } else {
        alert(`❌ Failed to delete: ${data.error}`);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("❌ Failed to delete license");
    } finally {
      setDeleting(false);
    }
  };

  // ============================================================
  // HANDLE DEACTIVATE
  // ============================================================
  const handleDeactivateConfirm = async () => {
    if (!licenseToDeactivate || deactivateConfirmText.trim().toUpperCase() !== 'DEACTIVATE') return;
    setDeactivating(true);
    try {
      const response = await fetch(`${API_BASE}/licenses/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: licenseToDeactivate }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ License ${licenseToDeactivate} deactivated successfully!`);
        setShowDeactivateConfirm(false);
        setLicenseToDeactivate(null);
        setDeactivateConfirmText("");
        fetchLicenses();
      } else {
        alert(`❌ Failed to deactivate: ${data.error}`);
      }
    } catch (err) {
      console.error("Deactivate error:", err);
      alert("❌ Failed to deactivate license");
    } finally {
      setDeactivating(false);
    }
  };

  // ============================================================
  // HANDLE REVOKE
  // ============================================================
  const handleRevokeConfirm = async () => {
    if (!licenseToRevoke || revokeConfirmText.trim().toUpperCase() !== 'REVOKE') return;
    setRevoking(true);
    try {
      const response = await fetch(`${API_BASE}/admin/licenses/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: licenseToRevoke }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ License ${licenseToRevoke} revoked permanently!`);
        setShowRevokeConfirm(false);
        setLicenseToRevoke(null);
        setRevokeConfirmText("");
        fetchLicenses();
      } else {
        alert(`❌ Failed to revoke: ${data.error}`);
      }
    } catch (err) {
      console.error("Revoke error:", err);
      alert("❌ Failed to revoke license");
    } finally {
      setRevoking(false);
    }
  };

  // ============================================================
  // HANDLE EDIT - OPEN
  // ============================================================
  const handleEditOpen = async (license: any) => {
    setSelectedLicense(license);
    setEditForm({
      customer_name: license.customer_name || "",
      customer_email: license.customer_email || "",
      customer_username: license.customer_username || "",
      plan: license.plan || "",
      status: license.status || "active",
      expiry_date: license.expiry_date ? license.expiry_date.split("T")[0] : "",
      max_devices: license.max_devices || 1,
      duration_days: license.duration_days || 365,
      notes: license.notes || "",
    });

    if (license.product_id) {
      try {
        const response = await fetch(
          `${API_BASE}/admin/products/${license.product_id}/plans`
        );
        const data = await response.json();
        if (data.success) {
          setAvailablePlansForEdit(data.plans || []);
        }
      } catch (err) {
        console.error("Failed to fetch plans:", err);
      }
    }

    setShowEditModal(true);
  };

  // ============================================================
  // HANDLE EDIT - SAVE
  // ============================================================
  const handleEditSave = async () => {
    if (!selectedLicense) return;

    setEditing(true);
    try {
      const payload: any = {};

      if (editForm.customer_name !== selectedLicense.customer_name)
        payload.customer_name = editForm.customer_name;
      if (editForm.customer_email !== selectedLicense.customer_email)
        payload.customer_email = editForm.customer_email;
      if (editForm.customer_username !== selectedLicense.customer_username)
        payload.customer_username = editForm.customer_username;
      if (editForm.plan !== selectedLicense.plan) payload.plan = editForm.plan;
      if (editForm.status !== selectedLicense.status)
        payload.status = editForm.status;
      if (
        editForm.expiry_date !==
        (selectedLicense.expiry_date?.split("T")[0] || "")
      )
        payload.expiry_date = editForm.expiry_date;
      if (editForm.max_devices !== selectedLicense.max_devices)
        payload.max_devices = editForm.max_devices;
      if (editForm.duration_days !== selectedLicense.duration_days)
        payload.duration_days = editForm.duration_days;
      if (editForm.notes !== selectedLicense.notes) payload.notes = editForm.notes;

      if (Object.keys(payload).length === 0) {
        alert("No changes to save");
        setShowEditModal(false);
        setEditing(false);
        return;
      }

      const response = await fetch(`${API_BASE}/licenses/${selectedLicense.license_key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ License updated successfully!`);
        setShowEditModal(false);
        fetchLicenses();
      } else {
        alert(`❌ Failed to update: ${data.error}`);
      }
    } catch (err) {
      console.error("Update error:", err);
      alert("❌ Failed to update license");
    } finally {
      setEditing(false);
    }
  };

  // ============================================================
  // HANDLE VIEW HISTORY
  // ============================================================
  const handleViewHistory = async (licenseKey: string) => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const response = await fetch(
        `${API_BASE}/licenses/${licenseKey}/history?limit=100`
      );
      const data = await response.json();
      if (data.success) {
        setLicenseHistory(data.data?.history || []);
      } else {
        setLicenseHistory([]);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setLicenseHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================
  const getStatusColor = (status: string, deletedAt: string | null) => {
    if (deletedAt)
      return "text-[var(--api-red-400)] bg-[var(--api-red-500-10)] border-[var(--api-red-500-20)]";
    switch (status) {
      case "active":
        return "text-[var(--api-green-400)] bg-[var(--api-green-500-10)] border-[var(--api-green-500-20)]";
      case "inactive":
        return "text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border-color)]";
      case "expired":
        return "text-[var(--api-amber-400)] bg-[var(--api-amber-500-10)] border-[var(--api-amber-500-20)]";
      case "revoked":
        return "text-[var(--api-red-400)] bg-[var(--api-red-500-10)] border-[var(--api-red-500-20)]";
      case "suspended":
        return "text-[var(--api-red-400)] bg-[var(--api-red-500-10)] border-[var(--api-red-500-20)]";
      default:
        return "text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border-color)]";
    }
  };

  // ============================================================
  // BULK ACTION HANDLER
  // ============================================================
  const handleBulkAction = async () => {
    if (selectedKeys.size === 0) return;
    setBulkProcessing(true);
    try {
      const body: any = {
        action: bulkActionType,
        license_keys: Array.from(selectedKeys),
      };
      if (bulkActionType === 'change_email') {
        body.email = bulkEmailValue;
      }

      const response = await fetch(`${API_BASE}/admin/licenses/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ ${data.action}: ${data.updated} updated, ${data.skipped} skipped${data.errors ? ', ' + data.errors.length + ' errors' : ''}`);
        setSelectedKeys(new Set());
        setShowBulkModal(false);
        fetchLicenses();
      } else {
        alert(`❌ Failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Bulk action error:', err);
      alert('❌ Failed to process bulk action');
    } finally {
      setBulkProcessing(false);
    }
  };

  // ============================================================
  // SELECTION HELPERS
  // ============================================================
  const toggleSelect = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === licenses.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(licenses.filter(l => !l.deleted_at || bulkActionType !== 'restore').map(l => l.license_key)));
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by key, name, email, username..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 text-sm transition-all"
          />
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setCurrentPage(0);
          }}
          className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
          <option value="suspended">Suspended</option>
        </select>

        {/* Product Filter */}
        <select
          value={filterProduct}
          onChange={(e) => {
            setFilterProduct(e.target.value);
            setCurrentPage(0);
          }}
          className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50"
        >
          <option value="">All Products</option>
          {availableProducts.map((p) => (
            <option key={p.product_id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Plan Filter */}
        <select
          value={filterPlan}
          onChange={(e) => {
            setFilterPlan(e.target.value);
            setCurrentPage(0);
          }}
          className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50"
        >
          <option value="">All Plans</option>
          {availablePlans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Show Deleted Toggle */}
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setIncludeDeleted(e.target.checked);
              setCurrentPage(0);
            }}
            className="w-4 h-4 rounded border-[var(--border-color)] text-blue-500 focus:ring-blue-500"
          />
          Show Deleted
        </label>

        {/* Date From */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setCurrentPage(0);
          }}
          className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50"
        />

        {/* Date To */}
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setCurrentPage(0);
          }}
          className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50"
        />

        {/* Sort Controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--text-muted)] mr-1">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-blue-500/50"
          >
            <option value="created_at">Created</option>
            <option value="expiry_date">Expiry</option>
            <option value="license_key">Key</option>
            <option value="customer_name">Name</option>
            <option value="customer_email">Email</option>
            <option value="status">Status</option>
            <option value="plan">Plan</option>
            <option value="updated_at">Updated</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sortOrder === 'asc' ? (
              <ArrowUp size={16} className="text-[var(--api-blue-400)]" />
            ) : (
              <ArrowDown size={16} className="text-[var(--api-blue-400)]" />
            )}
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={() => fetchLicenses()}
          className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} className="text-[var(--text-muted)] hover:text-[var(--api-blue-400)]" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-[var(--border-color)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--text-primary)]">{totalCount}</p>
          <p className="text-xs text-[var(--text-muted)]">Total</p>
        </div>
        <div className="rounded-xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--api-green-400)]">
            {licenses.filter((l) => l.status === "active" && !l.deleted_at).length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Active</p>
        </div>
        <div className="rounded-xl border border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--api-amber-400)]">
            {licenses.filter((l) => l.status === "expired" && !l.deleted_at).length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Expired</p>
        </div>
        <div className="rounded-xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--api-red-400)]">
            {licenses.filter((l) => l.deleted_at).length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Deleted</p>
        </div>
        {selectedKeys.size > 0 && (
          <div className="rounded-xl border border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-10)] p-3 text-center">
            <p className="text-xl font-bold text-[var(--api-blue-400)]">{selectedKeys.size}</p>
            <p className="text-xs text-[var(--text-muted)]">Selected</p>
          </div>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--api-blue-500-30)] bg-[var(--api-blue-500-10)]">
          <button
            onClick={() => { setSelectedKeys(new Set()); }}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
            title="Clear selection"
          >
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
          <span className="text-sm text-[var(--text-primary)] font-medium mr-2">
            {selectedKeys.size} selected
          </span>
          <div className="h-5 w-px bg-[var(--border-color)]" />
          <button
            onClick={() => { setBulkActionType('revoke'); setShowBulkModal(true); }}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors"
          >
            Revoke
          </button>
          <button
            onClick={() => { setBulkActionType('delete'); setShowBulkModal(true); }}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => { setBulkActionType('restore'); setShowBulkModal(true); }}
            className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
          >
            Restore
          </button>
          <button
            onClick={() => { setBulkActionType('activate'); setShowBulkModal(true); }}
            className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors"
          >
            Activate
          </button>
          <button
            onClick={() => { setBulkActionType('change_email'); setShowBulkModal(true); setBulkEmailValue(''); }}
            className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
          >
            Change Email
          </button>
        </div>
      )}

      {/* License List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[var(--api-blue-400)] animate-spin" />
          <span className="ml-3 text-[var(--text-secondary)]">Loading licenses...</span>
        </div>
      ) : licenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
          <KeyRound className="h-12 w-12 opacity-20 mb-3" />
          <p className="text-sm font-medium">No licenses found</p>
          <p className="text-xs mt-1">Try adjusting your search filters</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {/* Select All Row */}
          {licenses.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-1.5">
              <button onClick={toggleSelectAll} className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                {selectedKeys.size === licenses.length ? (
                  <CheckSquare size={16} className="text-[var(--api-blue-400)]" />
                ) : (
                  <Square size={16} className="text-[var(--text-muted)]" />
                )}
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                {selectedKeys.size === licenses.length ? 'Deselect all' : `Select all ${licenses.length}`}
              </span>
            </div>
          )}
          {licenses.map((license) => {
            const isDeleted = !!license.deleted_at;
            const isExpired = license.status === "expired";
            const daysLeft = license.days_left || 0;
            const isSoon = daysLeft > 0 && daysLeft <= 30 && !isExpired && !isDeleted;
            const isSelected = selectedKeys.has(license.license_key);

            return (
              <div
                key={license.license_key}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "border-[var(--api-blue-500-40)] bg-[var(--api-blue-500-10)]"
                    : isDeleted
                    ? "border-red-500/30 bg-red-500/5 opacity-70"
                    : isExpired
                    ? "border-amber-500/30 bg-amber-500/5"
                    : isSoon
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 hover:border-[var(--api-blue-500-20)]"
                }`}
              >
                {/* Checkbox */}
                <button onClick={() => toggleSelect(license.license_key)} className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]/30 transition-colors shrink-0">
                  {isSelected ? (
                    <CheckSquare size={16} className="text-[var(--api-blue-400)]" />
                  ) : (
                    <Square size={16} className="text-[var(--text-muted)]" />
                  )}
                </button>

                {/* Icon */}
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isDeleted ? "bg-red-500/10" : "bg-[var(--api-blue-500-10)]"
                  }`}
                >
                  {isDeleted ? (
                    <Ban className="h-4 w-4 text-[var(--api-red-400)]" />
                  ) : (
                    <KeyRound className="h-4 w-4 text-[var(--api-blue-400)]" />
                  )}
                </div>

                {/* License Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-sm text-[var(--text-primary)]">
                      {license.license_key}
                    </code>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(
                        license.status,
                        license.deleted_at
                      )}`}
                    >
                      {isDeleted ? "Deleted" : license.status}
                    </span>
                    {isSoon && !isDeleted && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        {daysLeft} days left
                      </span>
                    )}
                    {license.product_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 text-[var(--text-secondary)]">
                        {license.product_name}
                      </span>
                    )}
                    {license.plan && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)]">
                        {license.plan}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)] flex-wrap">
                    <span>{license.customer_name || "Unknown"}</span>
                    <span>{license.customer_email}</span>
                    {license.customer_username && (
                      <span>@{license.customer_username}</span>
                    )}
                    <span>
                      Expires:{" "}
                      {license.expiry_date
                        ? new Date(license.expiry_date).toLocaleDateString()
                        : "N/A"}
                    </span>
                    {license.deleted_at && (
                      <span className="text-[var(--api-red-400)]">
                        Deleted: {new Date(license.deleted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isDeleted ? (
                    <button
                      onClick={() => handleRestore(license.license_key)}
                      disabled={restoring === license.license_key}
                      className="p-2 rounded-lg hover:bg-green-500/10 transition-colors group"
                      title="Restore License"
                    >
                      {restoring === license.license_key ? (
                        <Loader2 className="h-4 w-4 text-[var(--api-green-400)] animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 text-[var(--api-green-400)] group-hover:scale-110 transition-transform" />
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditOpen(license)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors group"
                        title="Edit License"
                      >
                        <Eye className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--api-blue-400)] transition-colors" />
                      </button>
                      <button
                        onClick={() => handleViewHistory(license.license_key)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors group"
                        title="View History"
                      >
                        <FileText className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--api-blue-400)] transition-colors" />
                      </button>
                      <button
                        onClick={() => {
                          setEmailContext({
                            email: license.customer_email || "",
                            licenseKey: license.license_key,
                            productName: license.product_name || undefined,
                            productId: license.product_id ? String(license.product_id) : undefined,
                          });
                          setEmailDialogOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors group"
                        title="Send Email"
                      >
                        <Mail className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--api-blue-400)] transition-colors" />
                      </button>
                      {license.status === 'active' && (
                        <>
                          <button
                            onClick={() => {
                              setLicenseToDeactivate(license.license_key);
                              setShowDeactivateConfirm(true);
                            }}
                            className="p-2 rounded-lg hover:bg-amber-500/10 transition-colors group"
                            title="Deactivate License"
                          >
                            <Ban className="h-4 w-4 text-[var(--text-muted)] group-hover:text-amber-400 transition-colors" />
                          </button>
                          <button
                            onClick={() => {
                              setLicenseToRevoke(license.license_key);
                              setShowRevokeConfirm(true);
                            }}
                            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors group"
                            title="Revoke License"
                          >
                            <XCircle className="h-4 w-4 text-[var(--text-muted)] group-hover:text-red-400 transition-colors" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setLicenseToDelete(license.license_key);
                          setShowDeleteConfirm(true);
                        }}
                        className="p-2 rounded-lg hover:bg-red-500/10 transition-colors group"
                        title="Delete License"
                      >
                        <Trash2 className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--api-red-400)] transition-colors" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-muted)]">
            Showing {currentPage * pageSize + 1} -{" "}
            {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!hasMore}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          EDIT MODAL
          ============================================================ */}
      {showEditModal && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => { if (e.key === 'Escape') { setShowEditModal(false); } }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Edit License: {selectedLicense.license_key}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
              >
                <XCircle className="h-5 w-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={editForm.customer_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, customer_name: e.target.value })
                  }
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !editing) { e.preventDefault(); handleEditSave(); } }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Customer Email
                </label>
                <input
                  type="email"
                  value={editForm.customer_email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, customer_email: e.target.value })
                  }
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !editing) { e.preventDefault(); handleEditSave(); } }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Customer Username
                </label>
                <input
                  type="text"
                  value={editForm.customer_username}
                  onChange={(e) =>
                    setEditForm({ ...editForm, customer_username: e.target.value })
                  }
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !editing) { e.preventDefault(); handleEditSave(); } }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Plan
                </label>
                <select
                  value={editForm.plan}
                  onChange={(e) =>
                    setEditForm({ ...editForm, plan: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                >
                  <option value="">Select Plan</option>
                  {availablePlansForEdit.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.max_devices} devices, {p.default_expiry_days}{" "}
                      days)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={editForm.expiry_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, expiry_date: e.target.value })
                  }
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !editing) { e.preventDefault(); handleEditSave(); } }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Max Devices
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editForm.max_devices}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      max_devices: parseInt(e.target.value) || 1,
                    })
                  }
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !editing) { e.preventDefault(); handleEditSave(); } }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Duration Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="7300"
                  value={editForm.duration_days}
                  onChange={(e) => {
                    const days = parseInt(e.target.value) || 365;
                    const baseDateStr = selectedLicense?.activated_at ?? selectedLicense?.created_at;
                    let newExpiry = '';
                    if (baseDateStr) {
                      const baseDate = new Date(baseDateStr);
                      if (!isNaN(baseDate.getTime())) {
                        const expiryDate = new Date(baseDate);
                        expiryDate.setDate(expiryDate.getDate() + days);
                        newExpiry = expiryDate.toISOString().split('T')[0];
                      }
                    }
                    setEditForm({
                      ...editForm,
                      duration_days: days,
                      expiry_date: newExpiry,
                    });
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !editing) { e.preventDefault(); handleEditSave(); } }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  onKeyDown={(e) => { if ((e.key === 'Enter' && e.ctrlKey) && !editing) { e.preventDefault(); handleEditSave(); } }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editing}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {editing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          HISTORY MODAL
          ============================================================ */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => { if (e.key === 'Escape') { setShowHistoryModal(false); } }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                License History
              </h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
              >
                <XCircle className="h-5 w-5 text-[var(--text-muted)]" />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 text-[var(--api-blue-400)] animate-spin" />
              </div>
            ) : licenseHistory.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <p className="text-sm">No history found for this license</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {licenseHistory.map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5"
                  >
                    <div className="p-1.5 rounded-lg bg-[var(--bg-tertiary)]/30">
                      <FileText className="h-3 w-3 text-[var(--text-muted)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)]">
                          {event.event_type || "Unknown"}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {event.timestamp
                            ? new Date(event.timestamp).toLocaleString()
                            : "N/A"}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        {event.message || "No details"}
                      </p>
                      {event.ip_address && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          IP: {event.ip_address}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          BULK ACTION CONFIRMATION MODAL
          ============================================================ */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => { if (e.key === 'Escape') { setShowBulkModal(false); } }}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-[var(--text-primary)]">
              {bulkActionType === 'delete' ? (
                <Trash2 className="h-6 w-6 text-red-400" />
              ) : bulkActionType === 'revoke' ? (
                <Ban className="h-6 w-6 text-amber-400" />
              ) : bulkActionType === 'restore' ? (
                <RotateCcw className="h-6 w-6 text-green-400" />
              ) : bulkActionType === 'activate' ? (
                <CheckCircle className="h-6 w-6 text-blue-400" />
              ) : (
                <Mail className="h-6 w-6 text-purple-400" />
              )}
              <h2 className="text-lg font-semibold">
                {bulkActionType === 'delete' ? 'Delete' : bulkActionType === 'revoke' ? 'Revoke' : bulkActionType === 'restore' ? 'Restore' : bulkActionType === 'activate' ? 'Activate' : 'Change Email'} {selectedKeys.size} License{selectedKeys.size !== 1 ? 's' : ''}
              </h2>
            </div>

            <p className="text-[var(--text-secondary)] mb-4">
              {bulkActionType === 'delete'
                ? `Are you sure you want to delete ${selectedKeys.size} license(s)? This can be undone by restoring.`
                : bulkActionType === 'revoke'
                ? `Are you sure you want to revoke ${selectedKeys.size} license(s)? This action cannot be undone.`
                : bulkActionType === 'restore'
                ? `Are you sure you want to restore ${selectedKeys.size} license(s)?`
                : bulkActionType === 'activate'
                ? `Are you sure you want to activate ${selectedKeys.size} license(s)?`
                : `Set email for ${selectedKeys.size} license(s):`}
            </p>

            {bulkActionType === 'change_email' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">New Email</label>
                <input
                  type="email"
                  value={bulkEmailValue}
                  onChange={(e) => setBulkEmailValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !bulkProcessing && bulkEmailValue && isValidEmail(bulkEmailValue)) { handleBulkAction(); } }}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAction}
                disabled={bulkProcessing || (bulkActionType === 'change_email' && (!bulkEmailValue || !isValidEmail(bulkEmailValue)))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                  bulkActionType === 'delete' || bulkActionType === 'revoke'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : bulkActionType === 'restore'
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : bulkActionType === 'activate'
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                {bulkProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Processing...</>
                ) : (
                  `Confirm ${bulkActionType === 'change_email' ? 'Change Email' : bulkActionType.charAt(0).toUpperCase() + bulkActionType.slice(1)}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          DEACTIVATE CONFIRMATION MODAL
          ============================================================ */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => { if (e.key === 'Escape') { setShowDeactivateConfirm(false); setLicenseToDeactivate(null); setDeactivateConfirmText(""); } }}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <Ban className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Deactivate License
              </h2>
            </div>

            <p className="text-[var(--text-secondary)] mb-2">
              Use for laptop replacement or device migration.
            </p>

            <p className="text-[var(--text-secondary)] mb-4">
              This will remove activation from{" "}
              <strong className="text-[var(--text-primary)]">
                {licenseToDeactivate}
              </strong>
              .
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Type <strong className="text-amber-400">DEACTIVATE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deactivateConfirmText}
                onChange={(e) => setDeactivateConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !deactivating && deactivateConfirmText.trim().toUpperCase() === 'DEACTIVATE') { handleDeactivateConfirm(); } }}
                placeholder="DEACTIVATE"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 text-sm font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowDeactivateConfirm(false); setLicenseToDeactivate(null); setDeactivateConfirmText(""); }}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateConfirm}
                disabled={deactivating || deactivateConfirmText.trim().toUpperCase() !== 'DEACTIVATE'}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-all disabled:opacity-50"
              >
                {deactivating ? (
                  <><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Deactivating...</>
                ) : (
                  "Confirm Deactivate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          REVOKE CONFIRMATION MODAL
          ============================================================ */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => { if (e.key === 'Escape') { setShowRevokeConfirm(false); setLicenseToRevoke(null); setRevokeConfirmText(""); } }}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <XCircle className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Revoke License
              </h2>
            </div>

            <p className="text-[var(--text-secondary)] mb-2">
              Use only for refunds, chargebacks, fraud, piracy, stolen keys, or abuse.
            </p>

            <p className="text-[var(--text-secondary)] mb-2 text-sm">
              This action permanently invalidates the license. This cannot be undone.
            </p>

            <p className="text-[var(--text-secondary)] mb-4">
              Are you sure you want to revoke{" "}
              <strong className="text-[var(--text-primary)]">
                {licenseToRevoke}
              </strong>
              ?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Type <strong className="text-red-400">REVOKE</strong> to confirm:
              </label>
              <input
                type="text"
                value={revokeConfirmText}
                onChange={(e) => setRevokeConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !revoking && revokeConfirmText.trim().toUpperCase() === 'REVOKE') { handleRevokeConfirm(); } }}
                placeholder="REVOKE"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-red-500/50 text-sm font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowRevokeConfirm(false); setLicenseToRevoke(null); setRevokeConfirmText(""); }}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeConfirm}
                disabled={revoking || revokeConfirmText.trim().toUpperCase() !== 'REVOKE'}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {revoking ? (
                  <><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Revoking...</>
                ) : (
                  "Confirm Revoke"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          DELETE CONFIRMATION MODAL
          ============================================================ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => { if (e.key === 'Escape') { setShowDeleteConfirm(false); } }}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Confirm Delete
              </h2>
            </div>

            <p className="text-[var(--text-secondary)] mb-6">
              Are you sure you want to delete license{" "}
              <strong className="text-[var(--text-primary)]">
                {licenseToDelete}
              </strong>
              ?
              <br />
              <span className="text-xs text-[var(--text-muted)]">
                This action can be undone by restoring the license.
              </span>
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete License"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Email Dialog — email customer with license + SDK attachment */}
      <UniversalEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        defaultEmail={emailContext?.email || ""}
        defaultLicenseKey={emailContext?.licenseKey || undefined}
        defaultProductId={emailContext?.productId}
        defaultProductName={emailContext?.productName}
        defaultAction="send"
      />
    </div>
  );
}