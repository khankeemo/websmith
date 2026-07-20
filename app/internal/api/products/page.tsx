// FILE: app/internal/api/products/page.tsx
// PURPOSE: Admin product management - list, create, view active/archived products, restore archived products
// ACCESS: Internal admin only (requires authentication)
// URL: https://www.websmithdigital.com/internal/api/products
// ROLE: Official Product Management Interface - API Center V1
//
// OWNERSHIP: Create Product, Edit Product (via Settings), Archive Product, Restore Product
// DECISION: Official Product Management owner - API Center V1
// UPDATED: Complete UI overhaul with all product fields, auto-generated Product ID, and Create Plan workflow

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Types
interface Product {
  id: string;
  name: string;
  version: string;
  description: string;
  price: number;
  is_active: boolean;
  is_deleted: boolean;
  total_licenses: number;
  created_at: string;
  updated_at: string;
  company_name: string;
  product_type: string;
  latest_version: string;
  website: string;
  api_key: string;
}

type TabType = 'active' | 'archived';

// Product Form Data Interface
interface ProductFormData {
  name: string;
  shortDescription: string;
  description: string;
  logo: string;
  version: string;
  latestVersion: string;
  price: number;
  companyName: string;
  productType: string;
  platform: string;
  website: string;
  docsUrl: string;
  supportUrl: string;
  featured: boolean;
  isActive: boolean;
}

// Generate Product ID from name
function generateProductId(name: string): string {
  if (!name) return '';
  return 'prod_' + name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Platform options
const PLATFORM_OPTIONS = [
  'Windows',
  'macOS',
  'Linux',
  'Android',
  'iOS',
  'Web',
  'Cross Platform'
];

// Product Type options
const PRODUCT_TYPE_OPTIONS = [
  'Software',
  'SaaS',
  'API',
  'Desktop App',
  'Web App',
  'Mobile App',
  'Plugin',
  'Extension'
];

export default function AdminProductsPage() {
  const router = useRouter();
  const [activeProducts, setActiveProducts] = useState<Product[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string>('');
  const [createdProductName, setCreatedProductName] = useState<string>('');
  
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    shortDescription: '',
    description: '',
    logo: '',
    version: '1.0.0',
    latestVersion: '1.0.0',
    price: 0,
    companyName: '',
    productType: '',
    platform: '',
    website: '',
    docsUrl: '',
    supportUrl: '',
    featured: false,
    isActive: true
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAllProducts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAllProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchAllProducts = async () => {
    await Promise.all([
      fetchActiveProducts(),
      fetchArchivedProducts()
    ]);
    setLoading(false);
  };

  const fetchActiveProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const response = await fetch(`/internal/backend/admin/products?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setActiveProducts(data.products);
      }
    } catch (err) {
      console.error('Error fetching active products:', err);
    }
  };

  const fetchArchivedProducts = async () => {
    try {
      const params = new URLSearchParams();
      params.set('archived', 'true');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const response = await fetch(`/internal/backend/admin/products?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setArchivedProducts(data.products);
      }
    } catch (err) {
      console.error('Error fetching archived products:', err);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Validate required fields
    if (!formData.name || formData.name.trim() === '') {
      setError('Product Name is required');
      setSubmitting(false);
      return;
    }
    if (!formData.shortDescription || formData.shortDescription.trim() === '') {
      setError('Short Description is required');
      setSubmitting(false);
      return;
    }
    if (formData.shortDescription.length < 10) {
      setError('Short Description must be at least 10 characters');
      setSubmitting(false);
      return;
    }

    // Prepare payload for backend
    const payload = {
      name: formData.name.trim(),
      description: formData.shortDescription.trim(),
      version: formData.version || '1.0.0',
      price: formData.price || 0,
      is_active: formData.isActive,
      company_name: formData.companyName || '',
      product_type: formData.productType || '',
      website: formData.website || '',
      // Additional fields will be stored later
    };

    try {
      const response = await fetch('/internal/backend/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        const productId = data.product.id;
        const productName = data.product.name;
        
        setCreatedProductId(productId);
        setCreatedProductName(productName);
        setShowCreateModal(false);
        setShowSuccessScreen(true);
        resetForm();
        await fetchAllProducts();
        setSuccessMessage('Product created successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Failed to create product');
      }
    } catch (err) {
      console.error('Error creating product:', err);
      setError('Unable to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreProduct = async (productId: string, productName: string) => {
    try {
      const response = await fetch(`/internal/backend/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore: true })
      });

      const data = await response.json();

      if (data.success) {
        await fetchAllProducts();
        if (data.restored === false) {
          setSuccessMessage(`Product "${productName}" is already active`);
        } else {
          setSuccessMessage(`Product "${productName}" restored successfully`);
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Failed to restore product');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Error restoring product:', err);
      setError('Unable to restore product');
      setTimeout(() => setError(null), 3000);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      shortDescription: '',
      description: '',
      logo: '',
      version: '1.0.0',
      latestVersion: '1.0.0',
      price: 0,
      companyName: '',
      productType: '',
      platform: '',
      website: '',
      docsUrl: '',
      supportUrl: '',
      featured: false,
      isActive: true
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const currentProducts = activeTab === 'active' ? activeProducts : archivedProducts;

  // Handle "Create Plan" navigation
  const handleCreatePlan = () => {
    if (createdProductId) {
      router.push(`/internal/api/products/${createdProductId}/settings`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-[var(--bg-tertiary)] rounded w-64 mb-8"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[var(--bg-secondary)] rounded-xl p-6">
                  <div className="h-6 bg-[var(--bg-tertiary)] rounded w-48 mb-3"></div>
                  <div className="h-4 bg-[var(--bg-tertiary)] rounded w-96"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* PRODUCT MANAGEMENT BANNER */}
        <div className="mb-6 p-4 bg-[var(--api-blue-500-10)] border border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="text-xl">📦</div>
            <div>
              <h2 className="text-[var(--api-blue-400)] font-semibold text-base">Product Management</h2>
              <p className="text-[var(--text-secondary)] text-sm mt-0.5">
                Archive and restore products while preserving licenses, revenue history and audit logs.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-2">
              Products
            </h1>
            <p className="text-[var(--text-secondary)]">
              Manage your software products and their configurations
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] rounded-xl font-medium hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Create Product
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-[var(--api-green-500-10)] border border-green-500/50 rounded-xl text-[var(--api-green-400)]">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--api-red-500-10)] border border-red-500/50 rounded-xl text-[var(--api-red-400)]">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name, ID, or company..."
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--border-color)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs - Active / Archived */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border-color)]">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'active'
                ? 'text-[var(--api-blue-400)] border-b-2 border-blue-400 bg-[var(--bg-secondary)]/50'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Active Products
            <span className="ml-2 text-xs bg-[var(--bg-tertiary)]/30 px-2 py-0.5 rounded-full">
              {activeProducts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'archived'
                ? 'text-[var(--api-blue-400)] border-b-2 border-blue-400 bg-[var(--bg-secondary)]/50'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Archived Products
            <span className="ml-2 text-xs bg-[var(--bg-tertiary)]/30 px-2 py-0.5 rounded-full">
              {archivedProducts.length}
            </span>
          </button>
        </div>

        {/* Products Grid */}
        {currentProducts.length === 0 ? (
          <div className="text-center py-16 bg-[var(--bg-secondary)]/30 rounded-2xl border border-[var(--border-color)]">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              {activeTab === 'active' ? 'No Active Products' : 'No Archived Products'}
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              {activeTab === 'active' 
                ? 'Create your first product to get started'
                : 'Archived products will appear here'}
            </p>
            {activeTab === 'active' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Create Product
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {currentProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isArchivedTab={activeTab === 'archived'}
                onRefresh={fetchAllProducts}
                onRestore={handleRestoreProduct}
                onError={setError}
                formatDate={formatDate}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Product Modal */}
      {showCreateModal && (
        <CreateProductModal
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreateProduct}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
            setError(null);
          }}
          submitting={submitting}
          error={error}
          generateProductId={generateProductId}
          platformOptions={PLATFORM_OPTIONS}
          productTypeOptions={PRODUCT_TYPE_OPTIONS}
        />
      )}

      {/* Success Screen */}
      {showSuccessScreen && (
        <SuccessScreen
          productName={createdProductName}
          productId={createdProductId}
          onBack={() => {
            setShowSuccessScreen(false);
            setCreatedProductId('');
            setCreatedProductName('');
          }}
          onCreatePlan={handleCreatePlan}
        />
      )}
    </div>
  );
}

// ============================================================
// Product Card Component
// ============================================================
function ProductCard({
  product,
  isArchivedTab,
  onRefresh,
  onRestore,
  onError,
  formatDate,
  formatPrice
}: {
  product: Product;
  isArchivedTab: boolean;
  onRefresh: () => void;
  onRestore: (id: string, name: string) => void;
  onError: (msg: string) => void;
  formatDate: (date: string) => string;
  formatPrice: (price: number) => string;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPermanentConfirm, setShowPermanentConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingPermanent, setDeletingPermanent] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/internal/backend/admin/products/${product.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        setShowDeleteConfirm(false);
      } else {
        onError(data.error || 'Failed to archive product');
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      onError('Unable to archive product');
    } finally {
      setDeleting(false);
    }
  };

  const handlePermanentDelete = async () => {
    setDeletingPermanent(true);
    try {
      const response = await fetch(`/internal/backend/admin/products/${product.id}?permanent=true`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        setShowPermanentConfirm(false);
      } else {
        onError(data.error || 'Failed to permanently delete product');
      }
    } catch (err) {
      console.error('Error permanently deleting product:', err);
      onError('Unable to permanently delete product');
    } finally {
      setDeletingPermanent(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    await onRestore(product.id, product.name);
    setRestoring(false);
    setShowRestoreConfirm(false);
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? 'bg-[var(--api-green-500-20)] text-[var(--api-green-400)] border-green-500/30'
      : 'bg-[var(--api-red-500-20)] text-[var(--api-red-400)] border-red-500/30';
  };

  const getProductIcon = () => {
    const name = product.name.toLowerCase();
    if (name.includes('windows')) return '🪟';
    if (name.includes('saas')) return '☁️';
    if (name.includes('api')) return '🔌';
    return '💻';
  };

  return (
    <>
      <div className="bg-[var(--bg-secondary)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-xl p-6 hover:border-[var(--border-color)] transition-all duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="text-4xl">{getProductIcon()}</div>
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {product.name}
                </h2>
                {!isArchivedTab && (
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(product.is_active)}`}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
                {isArchivedTab && (
                  <span className="px-2 py-0.5 rounded-full text-xs border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    Archived
                  </span>
                )}
                <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded-full text-xs text-[var(--text-secondary)]">
                  v{product.version}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] text-sm mb-3 max-w-2xl">
                {product.description || 'No description provided'}
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                <span>🆔 {product.id}</span>
                <span>💰 {formatPrice(product.price)}</span>
                <span>🔑 {product.total_licenses} licenses</span>
                <span>📅 Created {formatDate(product.created_at)}</span>
                {product.company_name && <span>🏢 {product.company_name}</span>}
                {product.product_type && <span>📂 {product.product_type}</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!isArchivedTab ? (
              <>
                <Link
                  href={`/internal/api/products/${product.id}/settings`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
                >
                  Settings
                </Link>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-[var(--api-red-400)] rounded-lg text-sm font-medium transition-colors border border-red-500/30"
                >
                  Archive
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  disabled={restoring}
                  className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-[var(--api-green-400)] rounded-lg text-sm font-medium transition-colors border border-green-500/30 disabled:opacity-50"
                >
                  {restoring ? 'Restoring...' : 'Restore'}
                </button>
                <button
                  onClick={() => setShowPermanentConfirm(true)}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-[var(--api-red-400)] rounded-lg text-sm font-medium transition-colors border border-red-500/30"
                >
                  Delete Permanently
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[var(--bg-primary)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-6 border border-[var(--border-color)]">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Archive Product?</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              Are you sure you want to archive "{product.name}"? This product will be hidden from the store but existing licenses will remain valid.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-[var(--text-primary)] rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-[var(--bg-primary)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-6 border border-[var(--border-color)]">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Restore Product?</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              Are you sure you want to restore "{product.name}"? This product will reappear in the active products list and become visible in the store.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-[var(--text-primary)] rounded-lg transition-colors disabled:opacity-50"
              >
                {restoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {showPermanentConfirm && (
        <div className="fixed inset-0 bg-[var(--bg-primary)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-red-950/30 border border-red-500/50 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-red-400 mb-2">Permanently Delete Product?</h3>
            <p className="text-[var(--text-secondary)] mb-4">
              This will permanently delete <strong className="text-[var(--text-primary)]">{product.name}</strong> and all associated plans, API keys, licenses, activations, and audit logs. <strong className="text-red-400">This action cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPermanentConfirm(false)}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={deletingPermanent}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-[var(--text-primary)] rounded-lg transition-colors disabled:opacity-50"
              >
                {deletingPermanent ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Create Product Modal Component
// ============================================================
function CreateProductModal({
  formData,
  setFormData,
  onSubmit,
  onClose,
  submitting,
  error,
  generateProductId,
  platformOptions,
  productTypeOptions
}: {
  formData: ProductFormData;
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
  generateProductId: (name: string) => string;
  platformOptions: string[];
  productTypeOptions: string[];
}) {
  const generatedProductId = generateProductId(formData.name);

  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border-color)]">
        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4 z-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Create New Product</h2>
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

          {/* Product Name & Auto-generated ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="e.g., My Product"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Generated Product ID
              </label>
              <div className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] font-mono text-sm">
                {generatedProductId || 'Enter product name...'}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Auto-generated from product name. Cannot be edited.
              </p>
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Short Description *
            </label>
            <input
              type="text"
              required
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              placeholder="Advanced macOS license management software."
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Used for store cards and listings. Minimum 10 characters.
            </p>
          </div>

          {/* Full Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              placeholder="Full product description..."
            />
          </div>

          {/* Product Logo */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Product Logo URL
            </label>
            <input
              type="url"
              value={formData.logo}
              onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              placeholder="https://example.com/logo.png"
            />
          </div>

          {/* Version & Latest Version */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Version
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="1.0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Latest Version
              </label>
              <input
                type="text"
                value={formData.latestVersion}
                onChange={(e) => setFormData({ ...formData, latestVersion: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="1.2.0"
              />
            </div>
          </div>

          {/* Price & Company Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Price (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="Your company"
              />
            </div>
          </div>

          {/* Product Type & Platform */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Product Type
              </label>
              <select
                value={formData.productType}
                onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              >
                <option value="">Select type...</option>
                {productTypeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Platform
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              >
                <option value="">Select platform...</option>
                {platformOptions.map((platform) => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              placeholder="https://example.com"
            />
          </div>

          {/* Documentation URL & Support URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Documentation URL
              </label>
              <input
                type="url"
                value={formData.docsUrl}
                onChange={(e) => setFormData({ ...formData, docsUrl: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="https://docs.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Support URL
              </label>
              <input
                type="url"
                value={formData.supportUrl}
                onChange={(e) => setFormData({ ...formData, supportUrl: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                placeholder="https://support.example.com"
              />
            </div>
          </div>

          {/* Featured & Active */}
          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-[var(--text-secondary)]">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-[var(--text-secondary)]">Active (visible in store)</span>
            </label>
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
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-[var(--text-primary)] rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Success Screen Component
// ============================================================
function SuccessScreen({
  productName,
  productId,
  onBack,
  onCreatePlan
}: {
  productName: string;
  productId: string;
  onBack: () => void;
  onCreatePlan: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-8 border border-[var(--border-color)] text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Product Created Successfully
        </h2>
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-6">
          <p className="text-sm text-[var(--text-secondary)]">Product</p>
          <p className="font-semibold text-[var(--text-primary)]">{productName}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">Product ID</p>
          <code className="text-sm font-mono text-[var(--api-blue-400)]">{productId}</code>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          What would you like to do next?
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCreatePlan}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-[var(--text-primary)] rounded-lg font-medium transition-all"
          >
            Create Plan
          </button>
          <button
            onClick={onBack}
            className="flex-1 px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] rounded-lg font-medium transition-colors"
          >
            Back to Products
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-4">
          Future: License format will be {productName.toLowerCase().replace(/[^a-z0-9]/g, '')}_username_XXX
        </p>
      </div>
    </div>
  );
}