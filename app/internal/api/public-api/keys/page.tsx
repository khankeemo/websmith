// FILE: app/internal/api/public-api/keys/page.tsx
// PURPOSE: Admin UI for managing Public API Keys
// Access: Admin only

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Shield,
  ExternalLink,
  Code,
  Terminal,
  Lock,
  Hash,
  Package,
} from "lucide-react";

interface ApiKey {
  id: string;
  product_id: string;
  product_name?: string;
  api_key: string;
  secret_hash: string | null;
  status: "active" | "inactive" | "expired" | "revoked";
  permissions: string[];
  rate_limit: number;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

interface Product {
  product_id: string;
  name: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [showSecurityGuide, setShowSecurityGuide] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [generatedKey, setGeneratedKey] = useState<{ api_key: string; secret: string; product_name?: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    product_id: "",
    permissions: ["license:read", "license:write", "trial:read", "device:write"],
    rate_limit: 1000,
    expires_at: "",
    notes: "",
  });

  // ============================================================
  // HELPERS
  // ============================================================

  const getKeyPrefix = (apiKey: string): string => {
    const match = apiKey.match(/^pk_([a-z0-9]{4})_/);
    return match ? match[1] : "????";
  };

  const getProductName = (key: ApiKey): string => {
    return key.product_name || key.product_id || "Unknown Product";
  };

  const formatApiKey = (apiKey: string): string => {
    const prefix = getKeyPrefix(apiKey);
    if (apiKey.length <= 12) return apiKey;
    return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
  };

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchKeys = async () => {
    try {
      const token = localStorage.getItem("api_center_token");
      
      if (!token) {
        setError("No authentication token found. Please login again.");
        setLoading(false);
        return;
      }
      
      const response = await fetch("/internal/backend/admin/api-keys", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (data.success) {
        const mappedKeys = (data.keys || []).map((key: any) => ({
          ...key,
          permissions: key.permissions || ["license:read"],
          rate_limit: key.rate_limit || 1000,
          product_name: key.product_name || key.product_id || "Unknown Product",
          secret_hash: key.secret_hash || null,
        }));
        setKeys(mappedKeys);
      } else {
        setError(data.error || "Failed to fetch API keys");
      }
    } catch (err) {
      setError("Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem("api_center_token");
      
      if (!token) {
        return;
      }
      
      const response = await fetch("/internal/backend/admin/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (data.success && data.products) {
        const mappedProducts = data.products.map((p: any) => ({
          product_id: p.id || p.product_id,
          name: p.name,
        }));
        setProducts(mappedProducts);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchProducts();
  }, []);

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  const getDefaultExpiry = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const getDefaultNotes = (productName: string) => {
    return productName ? `API KEYS FOR ${productName.toUpperCase()}` : "API KEYS FOR ";
  };

  const handleProductChange = (productId: string) => {
    const selectedProduct = products.find(p => p.product_id === productId);
    const productName = selectedProduct?.name || "";
    
    setFormData({
      ...formData,
      product_id: productId,
      notes: getDefaultNotes(productName),
    });
  };

  // ============================================================
  // API KEY ACTIONS
  // ============================================================

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem("api_center_token");
      
      if (!token) {
        setError("No authentication token found. Please login again.");
        setLoading(false);
        return;
      }
      
      const response = await fetch("/internal/backend/admin/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const productName = products.find(p => p.product_id === formData.product_id)?.name || "Product";
        
        setGeneratedKey({
          api_key: data.api_key,
          secret: data.secret,
          product_name: productName,
        });
        setShowCreateModal(false);
        fetchKeys();
        setFormData({
          product_id: "",
          permissions: ["license:read", "license:write", "trial:read", "device:write"],
          rate_limit: 1000,
          expires_at: "",
          notes: "",
        });
      } else {
        if (data.existing_key) {
          setError(`${data.error}. Existing key: ${data.existing_key}`);
        } else {
          setError(data.error || "Failed to create API key");
        }
      }
    } catch (err) {
      console.error("Error creating API key:", err);
      setError("Failed to create API key");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm("⚠️ Are you sure you want to revoke this API key?\n\nThis action CANNOT be undone. Any application using this key will lose access immediately.")) return;
    
    try {
      const token = localStorage.getItem("api_center_token");
      
      if (!token) {
        setError("No authentication token found. Please login again.");
        return;
      }
      
      const response = await fetch(`/internal/backend/admin/api-keys/${id}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchKeys();
      } else {
        setError(data.error || "Failed to revoke API key");
      }
    } catch (err) {
      setError("Failed to revoke API key");
    }
  };

  const handleRotateSecret = async (id: string) => {
    if (!confirm("⚠️ Are you sure you want to rotate the secret?\n\nThis will invalidate the current secret. All applications must be updated with the new secret.")) return;
    
    try {
      const token = localStorage.getItem("api_center_token");
      
      if (!token) {
        setError("No authentication token found. Please login again.");
        return;
      }
      
      const response = await fetch(`/internal/backend/admin/api-keys/${id}/rotate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGeneratedKey({
          api_key: data.api_key,
          secret: data.new_secret,
        });
        fetchKeys();
      } else {
        setError(data.error || "Failed to rotate secret");
      }
    } catch (err) {
      setError("Failed to rotate secret");
    }
  };

  // ============================================================
  // UI HELPERS
  // ============================================================

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 3000);
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecret(showSecret === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={10} />
            Active
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
            <Clock size={10} />
            Inactive
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">
            <XCircle size={10} />
            Expired
          </span>
        );
      case "revoked":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-gray-400 border border-gray-500/20">
            <XCircle size={10} />
            Revoked
          </span>
        );
      default:
        return null;
    }
  };

  const getPermissionLabel = (permission: string) => {
    const labels: Record<string, string> = {
      "license:read": "License Read",
      "license:write": "License Write",
      "trial:read": "Trial Read",
      "trial:write": "Trial Write",
      "device:write": "Device Write",
      "product:read": "Product Read",
    };
    return labels[permission] || permission;
  };

  const filteredKeys = keys.filter((key) => {
    const matchesSearch =
      key.api_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (key.product_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") {
      return matchesSearch;
    }
    
    return matchesSearch && key.status === statusFilter;
  });

  const getKeyCountByProduct = (productId: string): number => {
    return keys.filter(k => k.product_id === productId && k.status === 'active').length;
  };

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-blue-400 animate-spin" />
          <span className="text-sm text-[var(--text-secondary)]">Loading API keys...</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Key size={24} className="text-blue-400" />
            API Keys
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage API keys for external software integration
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-[var(--text-secondary)]">
              Total: <span className="font-medium text-[var(--text-primary)]">{keys.length}</span>
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              Active: <span className="font-medium text-emerald-400">{keys.filter(k => k.status === 'active').length}</span>
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              Products: <span className="font-medium text-[var(--text-primary)]">{products.length}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSecurityGuide(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <Shield size={14} />
            Security Guide
          </button>
          <button
            onClick={() => {
              setFormData({
                ...formData,
                product_id: "",
                expires_at: getDefaultExpiry(),
                notes: "",
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Generate New Key
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-300">
            ×
          </button>
        </div>
      )}

      {/* Generated Key Notification */}
      {generatedKey && (
        <div className="mb-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-400">
                API Key Generated for {generatedKey.product_name || "Product"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Copy these credentials and share them securely with your developer.
              </p>
              
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Hash size={10} />
                  Prefix: {getKeyPrefix(generatedKey.api_key)}
                </span>
              </div>

              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">API Key:</span>
                  <code className="text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-primary)] font-mono break-all">
                    {generatedKey.api_key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(generatedKey.api_key, "api_key")}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0"
                    title="Copy API Key"
                  >
                    {copied === "api_key" ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} className="text-[var(--text-secondary)]" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Secret:</span>
                  <code className="text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-amber-400 font-mono break-all">
                    {generatedKey.secret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(generatedKey.secret, "secret")}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0"
                    title="Copy Secret"
                  >
                    {copied === "secret" ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} className="text-[var(--text-secondary)]" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-amber-400/80 flex items-center gap-1">
                <AlertCircle size={12} />
                ⚠️ Copy the secret now. It will not be shown again.
              </p>
            </div>
            <button
              onClick={() => setGeneratedKey(null)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by API key or product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
        >
          <option value="active">Active</option>
          <option value="all">All Status</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Keys Table */}
      {filteredKeys.length === 0 ? (
        <div className="text-center py-12 border border-[var(--border-color)] rounded-xl bg-[var(--bg-tertiary)]/30">
          <Key size={48} className="mx-auto text-[var(--text-secondary)]/30 mb-3" />
          <p className="text-[var(--text-secondary)]">
            {statusFilter === "active" ? "No active API keys found" : "No API keys found"}
          </p>
          <button
            onClick={() => {
              setFormData({
                ...formData,
                product_id: "",
                expires_at: getDefaultExpiry(),
                notes: "",
              });
              setShowCreateModal(true);
            }}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Generate your first API key
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  API Key
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Product
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Permissions
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Rate Limit
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Last Used
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.map((key) => {
                const prefix = getKeyPrefix(key.api_key);
                return (
                  <tr key={key.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                          {prefix}
                        </span>
                        <code className="text-xs font-mono text-[var(--text-primary)]">
                          {formatApiKey(key.api_key)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.api_key, `key_${key.id}`)}
                          className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                          title="Copy API Key"
                        >
                          {copied === `key_${key.id}` ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} className="text-[var(--text-secondary)]" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleSecretVisibility(key.id)}
                          className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                          title={showSecret === key.id ? "Hide Secret" : "Show Secret"}
                        >
                          {showSecret === key.id ? (
                            <EyeOff size={12} className="text-[var(--text-secondary)]" />
                          ) : (
                            <Eye size={12} className="text-[var(--text-secondary)]" />
                          )}
                        </button>
                      </div>
                      {showSecret === key.id && (
                        <div className="mt-1 text-xs font-mono text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/20">
                          Secret: {key.secret_hash ? key.secret_hash.slice(0, 12) + "... (hashed)" : "No secret available"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Package size={12} className="text-[var(--text-secondary)]/50" />
                        <span className="text-[var(--text-primary)]">{getProductName(key)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(key.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          >
                            {getPermissionLabel(perm)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-secondary)]">{key.rate_limit}/min</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-secondary)] text-xs">
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString()
                          : "Never"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRotateSecret(key.id)}
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-amber-400"
                          title="Rotate Secret"
                          disabled={key.status !== "active"}
                        >
                          <RefreshCw size={14} className={key.status !== "active" ? "opacity-40" : ""} />
                        </button>
                        <button
                          onClick={() => handleRevokeKey(key.id)}
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-red-400"
                          title="Revoke Key"
                          disabled={key.status === "revoked"}
                        >
                          <Trash2 size={14} className={key.status === "revoked" ? "opacity-40" : ""} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================
          SECURITY GUIDE MODAL - FIXED JSX INTERPOLATION
          ============================================================ */}
      {showSecurityGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl mx-auto p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Shield size={20} className="text-blue-400" />
                API Key Security Guide
              </h2>
              <button
                onClick={() => setShowSecurityGuide(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-6 text-sm">
              {/* What are API Keys? */}
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <Key size={16} className="text-blue-400" />
                  What are API Keys?
                </h3>
                <p className="text-[var(--text-secondary)]">
                  API Keys are credentials that allow external applications to authenticate with the License API.
                  Each key is scoped to a specific product and has configurable permissions and rate limits.
                </p>
              </div>

              {/* Key Naming Convention */}
              <div className="p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <Hash size={16} className="text-indigo-400" />
                  Key Naming Convention
                </h3>
                <div className="space-y-2 text-[var(--text-secondary)]">
                  <p>
                    <strong>Format:</strong>{" "}
                    <code className="text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
                      pk_&#123;prefix&#125;_&#123;random&#125;
                    </code>
                  </p>
                  <p><strong>Prefix:</strong> First 2 + Last 2 letters of product name</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-2 rounded bg-[var(--bg-tertiary)]/50">
                      <span className="text-xs text-[var(--text-secondary)]">MyProduct</span>
                      <code className="block text-xs font-mono text-indigo-400">pk_mypr_XXXXXXXX</code>
                    </div>
                    <div className="p-2 rounded bg-[var(--bg-tertiary)]/50">
                      <span className="text-xs text-[var(--text-secondary)]">AnotherApp</span>
                      <code className="block text-xs font-mono text-indigo-400">pk_anpp_XXXXXXXX</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Features */}
              <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <Lock size={16} className="text-emerald-400" />
                  Security Features
                </h3>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span><strong>HMAC Signatures:</strong> All requests must be signed using the secret</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span><strong>Rate Limiting:</strong> Configurable request limits per minute</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span><strong>Nonce Replay Protection:</strong> Each request requires a unique nonce</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span><strong>Timestamp Validation:</strong> Requests must be within 5 minutes of server time</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span><strong>Product Isolation:</strong> Keys only work for their assigned product</span>
                  </li>
                </ul>
              </div>

              {/* Safety Rules */}
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-400" />
                  ⚠️ Safety Rules
                </h3>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">❌</span>
                    <span><strong>NEVER</strong> store secret in plain text</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">❌</span>
                    <span><strong>NEVER</strong> log secret</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">❌</span>
                    <span><strong>NEVER</strong> expose secret in frontend code</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✅</span>
                    <span><strong>ALWAYS</strong> show secret only once at generation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✅</span>
                    <span><strong>ALWAYS</strong> use HTTPS in production</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✅</span>
                    <span><strong>ALWAYS</strong> rotate secrets if compromised</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowSecurityGuide(false)}
              className="mt-4 w-full px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          CREATE MODAL
          ============================================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Plus size={18} className="text-blue-400" />
                Generate New API Key
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Product *
                </label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => {
                    const keyCount = getKeyCountByProduct(product.product_id);
                    return (
                      <option key={product.product_id} value={product.product_id}>
                        {product.name} {keyCount > 0 ? `🔑 ${keyCount} key${keyCount > 1 ? 's' : ''}` : '⚠️ No key'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Permissions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "license:read", label: "License Read" },
                    { value: "license:write", label: "License Write" },
                    { value: "trial:read", label: "Trial Read" },
                    { value: "trial:write", label: "Trial Write" },
                    { value: "device:write", label: "Device Write" },
                    { value: "product:read", label: "Product Read" },
                  ].map((perm) => (
                    <label key={perm.value} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              permissions: [...formData.permissions, perm.value],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              permissions: formData.permissions.filter((p) => p !== perm.value),
                            });
                          }
                        }}
                        className="rounded border-[var(--border-color)] bg-[var(--bg-tertiary)] text-blue-500 focus:ring-blue-500/50"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Rate Limit (requests per minute)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={formData.rate_limit}
                  onChange={(e) => setFormData({ ...formData, rate_limit: parseInt(e.target.value) || 1000 })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Expiry Date <span className="text-[var(--text-secondary)]/60">(default: 1 week)</span>
                </label>
                <input
                  type="date"
                  value={formData.expires_at || getDefaultExpiry()}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Notes <span className="text-[var(--text-secondary)]/60">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="API KEYS FOR PRODUCT_NAME"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}