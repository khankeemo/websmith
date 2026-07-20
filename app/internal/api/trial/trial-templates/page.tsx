// FILE: app/internal/api/trial/trial-templates/page.tsx
// PURPOSE: Universal Trial Template Management
// SCOPE: Create, Edit, Archive, and Manage Trial Templates
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors
// RULE: Universal - works for ANY product

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Edit2,
  Trash2,
  Eye,
  Copy,
  X,
  Calendar,
  Cpu,
  User,
  Mail,
  Phone,
  Globe,
  Link2,
  Zap,
  Shield,
  Clock,
  Check,
  Ban,
  Layers,
  FileText
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface TrialTemplate {
  id: number;
  name: string;
  description: string | null;
  duration_days: number;
  hardware_binding_enabled: boolean;
  max_hardware_changes: number;
  max_devices: number;
  collect_name: boolean;
  collect_email: boolean;
  collect_mobile: boolean;
  support_url: string | null;
  store_url: string | null;
  offline_cache_enabled: boolean;
  is_active: boolean;
  is_system_default: boolean;
  is_permanent: boolean;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

interface TemplateFormData {
  name: string;
  description: string;
  duration_days: number;
  hardware_binding_enabled: boolean;
  max_hardware_changes: number;
  max_devices: number;
  collect_name: boolean;
  collect_email: boolean;
  collect_mobile: boolean;
  support_url: string;
  store_url: string;
  offline_cache_enabled: boolean;
  is_active: boolean;
}

// ============================================================
// API BASE
// ============================================================

const API_BASE = "/internal/backend";

// ============================================================
// STAT CARD COMPONENT
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
// MAIN PAGE
// ============================================================

export default function TrialTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TrialTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TrialTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState<TemplateFormData>({
    name: "",
    description: "",
    duration_days: 14,
    hardware_binding_enabled: true,
    max_hardware_changes: 1,
    max_devices: 1,
    collect_name: true,
    collect_email: true,
    collect_mobile: false,
    support_url: "",
    store_url: "",
    offline_cache_enabled: true,
    is_active: true
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ============================================================
  // FETCH TEMPLATES
  // ============================================================

  const fetchTemplates = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/admin/trials/trial-templates`);
      const data = await response.json();

      if (data.success) {
        setTemplates(data.data || []);
        setLastUpdated(new Date());
      } else {
        setError(data.error || "Failed to load templates");
      }
    } catch (err) {
      console.error("Fetch templates error:", err);
      setError("Failed to load trial templates. Please refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`${API_BASE}/admin/trials/trial-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage("Trial template created successfully");
        setShowCreateModal(false);
        resetForm();
        fetchTemplates();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setFormError(data.error || "Failed to create template");
      }
    } catch (err) {
      console.error("Create template error:", err);
      setFormError("Failed to create template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    if (!editingTemplate) return;

    try {
      const response = await fetch(`${API_BASE}/admin/trials/trial-templates/${editingTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage("Trial template updated successfully");
        setShowEditModal(false);
        setEditingTemplate(null);
        resetForm();
        fetchTemplates();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setFormError(data.error || "Failed to update template");
      }
    } catch (err) {
      console.error("Update template error:", err);
      setFormError("Failed to update template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/trials/trial-templates/${id}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage("Trial template deleted successfully");
        setShowDeleteConfirm(null);
        fetchTemplates();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "Failed to delete template");
      }
    } catch (err) {
      console.error("Delete template error:", err);
      setError("Failed to delete template");
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/admin/trials/trial-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Template ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        fetchTemplates();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "Failed to update template status");
      }
    } catch (err) {
      console.error("Toggle status error:", err);
      setError("Failed to update template status");
    }
  };

  const handleClone = async (template: TrialTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || "",
      duration_days: template.duration_days,
      hardware_binding_enabled: template.hardware_binding_enabled,
      max_hardware_changes: template.max_hardware_changes,
      max_devices: template.max_devices,
      collect_name: template.collect_name,
      collect_email: template.collect_email,
      collect_mobile: template.collect_mobile,
      support_url: template.support_url || "",
      store_url: template.store_url || "",
      offline_cache_enabled: template.offline_cache_enabled,
      is_active: template.is_active
    });
    setShowCreateModal(true);
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      duration_days: 14,
      hardware_binding_enabled: true,
      max_hardware_changes: 1,
      max_devices: 1,
      collect_name: true,
      collect_email: true,
      collect_mobile: false,
      support_url: "",
      store_url: "",
      offline_cache_enabled: true,
      is_active: true
    });
    setFormError(null);
  };

  const openEditModal = (template: TrialTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      duration_days: template.duration_days,
      hardware_binding_enabled: template.hardware_binding_enabled,
      max_hardware_changes: template.max_hardware_changes,
      max_devices: template.max_devices,
      collect_name: template.collect_name,
      collect_email: template.collect_email,
      collect_mobile: template.collect_mobile,
      support_url: template.support_url || "",
      store_url: template.store_url || "",
      offline_cache_enabled: template.offline_cache_enabled,
      is_active: template.is_active
    });
    setShowEditModal(true);
  };

  // ============================================================
  // FILTER
  // ============================================================

  const filteredTemplates = templates.filter((template) => {
    const query = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(query) ||
      (template.description && template.description.toLowerCase().includes(query))
    );
  });

  // Stats
  const totalTemplates = templates.length;
  const activeTemplates = templates.filter(t => t.is_active).length;
  const inactiveTemplates = templates.filter(t => !t.is_active).length;

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)] mt-3">Loading trial templates...</span>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">License Templates</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Create and manage license and trial templates. Universal Trial is permanent and always available.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTemplates}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all"
          >
            <Plus size={16} />
            Create Template
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-2xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-[var(--api-green-400)]" />
            <p className="text-[var(--api-green-400)] text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)]" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
            <button onClick={fetchTemplates} className="ml-auto text-sm text-[var(--api-blue-400)] hover:text-blue-300">
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Templates"
          value={totalTemplates}
          icon={<Layers className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Active"
          value={activeTemplates}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          title="Inactive"
          value={inactiveTemplates}
          icon={<Ban className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="Avg Duration"
          value={templates.length > 0 ? Math.round(templates.reduce((sum, t) => sum + t.duration_days, 0) / templates.length) : 0}
          icon={<Calendar className="h-5 w-5" />}
          color="purple"
          subtitle="days"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search templates by name or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <FileText className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm font-medium">No trial templates found</p>
            <p className="text-xs mt-1">
              {searchQuery ? "Try adjusting your search" : "Create your first trial template"}
            </p>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => openEditModal(template)}
              onDelete={() => setShowDeleteConfirm(String(template.id))}
              onToggleStatus={() => handleToggleStatus(template.id, template.is_active)}
              onClone={() => handleClone(template)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${templates.length > 0 ? "bg-green-400 animate-pulse" : "bg-amber-400"}`} />
          <span>Trial Templates: {templates.length > 0 ? "Active" : "No templates"}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{filteredTemplates.length} of {templates.length} templates shown</span>
          {lastUpdated && (
            <span>Last updated: {lastUpdated.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* ============================================================
          CREATE MODAL
      ============================================================ */}
      {showCreateModal && (
        <TemplateModal
          title="Create Trial Template"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreate}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          submitting={submitting}
          error={formError}
        />
      )}

      {/* ============================================================
          EDIT MODAL
      ============================================================ */}
      {showEditModal && (
        <TemplateModal
          title="Edit Trial Template"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleUpdate}
          onClose={() => {
            setShowEditModal(false);
            setEditingTemplate(null);
            resetForm();
          }}
          submitting={submitting}
          error={formError}
          isEdit
        />
      )}

      {/* ============================================================
          DELETE CONFIRMATION
      ============================================================ */}
      {showDeleteConfirm && (
        <ConfirmationModal
          title="Delete Trial Template?"
          message="Are you sure you want to delete this trial template? This action cannot be undone. Products using this template will need to be reassigned."
          onConfirm={() => handleDelete(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
          confirmLabel="Delete Template"
          confirmColor="red"
        />
      )}
    </div>
  );
}

// ============================================================
// TEMPLATE CARD COMPONENT
// ============================================================

interface TemplateCardProps {
  template: TrialTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onClone: () => void;
}

function TemplateCard({ template, onEdit, onDelete, onToggleStatus, onClone }: TemplateCardProps) {
  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? 'bg-[var(--api-green-500-10)] text-[var(--api-green-400)] border-[var(--api-green-500-20)]'
      : 'bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)] border-[var(--api-amber-500-20)]';
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-5 transition-all duration-200 hover:shadow-lg hover:border-[var(--api-blue-500-20)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--text-primary)]">{template.name}</h3>
            {template.is_permanent && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">Permanent</span>
            )}
            {template.is_system_default && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-semibold">System Default</span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{template.description}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(template.is_active)}`}>
          {template.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Calendar size={14} />
          <span>{template.duration_days} days trial</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Cpu size={14} />
          <span>Max Devices: {template.max_devices}</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Cpu size={14} />
          <span>Hardware Binding: {template.hardware_binding_enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Shield size={14} />
          <span>Max Hardware Changes: {template.max_hardware_changes}</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <User size={14} />
          <span>Collect: {[
            template.collect_name && "Name",
            template.collect_email && "Email",
            template.collect_mobile && "Mobile"
          ].filter(Boolean).join(", ") || "None"}</span>
        </div>
        {template.store_url && (
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Globe size={14} />
            <a href={template.store_url} target="_blank" rel="noopener noreferrer" className="text-[var(--api-blue-400)] hover:underline truncate">
              Store URL
            </a>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border-color)]">
        <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 hover:text-[var(--text-primary)] transition-all">
          <Edit2 size={14} /> Edit
        </button>
        <button onClick={onClone} className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-all" title="Clone">
          <Copy size={14} />
        </button>
        {!template.is_permanent && (
          <button onClick={onToggleStatus} className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-all">
            {template.is_active ? <Ban size={14} /> : <Check size={14} />}
          </button>
        )}
        {!template.is_permanent && (
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-[var(--api-red-400)] hover:bg-red-500/20 transition-all">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE MODAL COMPONENT
// ============================================================

interface TemplateModalProps {
  title: string;
  formData: TemplateFormData;
  setFormData: (data: TemplateFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
  isEdit?: boolean;
}

function TemplateModal({
  title,
  formData,
  setFormData,
  onSubmit,
  onClose,
  submitting,
  error,
  isEdit = false
}: TemplateModalProps) {
  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border-color)]">
        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4 z-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-[var(--api-red-500-10)] border border-red-500/50 rounded-lg text-[var(--api-red-400)] text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="e.g., Standard 14-Day Trial"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Duration Days *
              </label>
              <input
                type="number"
                required
                min={1}
                max={365}
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 14 })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="14"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              placeholder="Description of this trial template..."
            />
          </div>

          {/* Hardware Settings */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <Cpu size={16} className="text-[var(--api-blue-400)]" />
              Hardware Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hardware_binding_enabled}
                  onChange={(e) => setFormData({ ...formData, hardware_binding_enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[var(--text-secondary)]">Hardware Binding</span>
              </label>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Max Devices
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.max_devices}
                  onChange={(e) => setFormData({ ...formData, max_devices: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Max Hardware Changes
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={formData.max_hardware_changes}
                  onChange={(e) => setFormData({ ...formData, max_hardware_changes: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Collection Settings */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <User size={16} className="text-[var(--api-green-400)]" />
              Customer Information Collection
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.collect_name}
                  onChange={(e) => setFormData({ ...formData, collect_name: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[var(--text-secondary)]">Collect Name</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.collect_email}
                  onChange={(e) => setFormData({ ...formData, collect_email: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[var(--text-secondary)]">Collect Email</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.collect_mobile}
                  onChange={(e) => setFormData({ ...formData, collect_mobile: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[var(--text-secondary)]">Collect Mobile</span>
              </label>
            </div>
          </div>

          {/* URLs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Store URL
              </label>
              <input
                type="url"
                value={formData.store_url}
                onChange={(e) => setFormData({ ...formData, store_url: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="https://store.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Support URL
              </label>
              <input
                type="url"
                value={formData.support_url}
                onChange={(e) => setFormData({ ...formData, support_url: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="https://support.example.com"
              />
            </div>
          </div>

          {/* Additional Settings */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <Zap size={16} className="text-[var(--api-amber-400)]" />
              Additional Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.offline_cache_enabled}
                  onChange={(e) => setFormData({ ...formData, offline_cache_enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[var(--text-secondary)]">Offline Cache Enabled</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[var(--text-secondary)]">Active (available for use)</span>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.name}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-[var(--text-primary)] rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : (isEdit ? 'Update Template' : 'Create Template')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// CONFIRMATION MODAL COMPONENT
// ============================================================

interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmColor?: string;
}

function ConfirmationModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  confirmColor = "red"
}: ConfirmationModalProps) {
  const colorClasses = {
    red: "bg-red-600 hover:bg-red-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    green: "bg-green-600 hover:bg-green-700",
  };

  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-6 border border-[var(--border-color)]">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-6 w-6 text-[var(--api-red-400)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${colorClasses[confirmColor as keyof typeof colorClasses] || colorClasses.red}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}