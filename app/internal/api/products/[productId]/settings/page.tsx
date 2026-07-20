// FILE: app/internal/api/products/[productId]/settings/page.tsx
// PURPOSE: Product Settings page - Manage product details and pricing plans

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Save, 
  AlertCircle, 
  CheckCircle, 
  Edit2, 
  Trash2, 
  Plus,
  X,
  Package,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  Layers,
  Gift,
  Clock
} from 'lucide-react';

const API_BASE_URL = '/internal/backend/admin';

interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  latest_version: string;
  price: number;
  is_active: boolean;
  is_deleted?: boolean;
  company_name: string;
  product_type: string;
  website: string;
  api_key: string;
  created_at?: string;
  updated_at?: string;
}

interface Plan {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  max_devices: number;
  display_order: number;
  features: string[];
  is_active: boolean;
  is_trial_plan: boolean;
  trial_days_limit: number | null;
  created_at?: string;
}

interface PlanFormData {
  name: string;
  description: string;
  price: number;
  duration_days: number;
  max_devices: number;
  display_order: number;
  features: string;
  is_active: boolean;
  is_trial_plan: boolean;
  trial_days_limit: number;
}

interface PlanTemplate {
  name: string;
}

const PLAN_TEMPLATES: PlanTemplate[] = [
  { name: 'Trial' },
  { name: 'Starter' },
  { name: 'Basic' },
  { name: 'Standard' },
  { name: 'Professional' },
  { name: 'Business' },
  { name: 'Enterprise' },
  { name: 'Premium' },
  { name: 'Ultimate' },
  { name: 'Lifetime' },
  { name: 'Custom' },
];

export default function ProductSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '',
    latest_version: '',
    price: 0,
    is_active: true,
    company_name: '',
    product_type: '',
    website: ''
  });
  
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planFormData, setPlanFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    price: 0,
    duration_days: 0,
    max_devices: 0,
    display_order: 0,
    features: '',
    is_active: true,
    is_trial_plan: false,
    trial_days_limit: 0
  });
  const [featureList, setFeatureList] = useState<string[]>([]);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showProductDeleteConfirm, setShowProductDeleteConfirm] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem("api_center_token");
    if (!token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchProduct = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch product');
      const data = await response.json();
      if (data.success && data.product) {
        setProduct(data.product);
        setFormData({
          name: data.product.name,
          description: data.product.description || '',
          version: data.product.version || '1.0.0',
          latest_version: data.product.latest_version || data.product.version,
          price: data.product.price,
          is_active: data.product.is_active,
          company_name: data.product.company_name || '',
          product_type: data.product.product_type || '',
          website: data.product.website || ''
        });
      }
    } catch (err) {
      setError('Failed to load product');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${productId}/plans`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans || []);
      } else {
        setPlans([]);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
      setPlans([]);
    }
  };

  const handleSaveProduct = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          version: formData.version,
          latest_version: formData.latest_version,
          price: formData.price,
          is_active: formData.is_active,
          company_name: formData.company_name,
          product_type: formData.product_type,
          website: formData.website
        })
      });
      
      if (!response.ok) throw new Error('Failed to update product');
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Product updated successfully');
        setEditMode(false);
        fetchProduct();
      } else {
        throw new Error(data.error || 'Update failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleSavePlan = async () => {
    setSaving(true);
    setError(null);
    setApiError(null);
    
    try {
      console.log('🚀 Starting plan save...');
      
      if (!planFormData.name.trim()) {
        throw new Error('Plan name is required');
      }
      
      const trimmedName = planFormData.name.trim();
      const duplicatePlan = plans.find(
        p => p.name.toLowerCase() === trimmedName.toLowerCase() &&
        (!editingPlan || p.id !== editingPlan.id)
      );
      if (duplicatePlan) {
        setValidationErrors([`Plan "${trimmedName}" already exists for this product.`]);
        throw new Error(`Plan "${trimmedName}" already exists for this product.`);
      }
      
      const isTrialPlan = planFormData.is_trial_plan;
      
      if (planFormData.price < 0) {
        throw new Error('Price cannot be negative');
      }
      
      if (planFormData.duration_days < 0) {
        throw new Error('License duration cannot be negative');
      }
      
      if (planFormData.max_devices < 0) {
        throw new Error('Max devices cannot be negative');
      }
      
      let finalPrice = planFormData.price;
      let finalTrialDays = null;
      
      if (isTrialPlan) {
        finalPrice = 0;
        if (planFormData.trial_days_limit < 0) {
          throw new Error('Trial days cannot be negative');
        }
        finalTrialDays = planFormData.trial_days_limit;
      }
      
      const featuresArray = planFormData.features
        .split('\n')
        .filter(f => f.trim().length > 0);
      
      const payload = {
        name: planFormData.name,
        description: planFormData.description || null,
        price: finalPrice,
        duration_days: planFormData.duration_days,
        max_devices: planFormData.max_devices,
        display_order: planFormData.display_order,
        features: featuresArray,
        is_active: planFormData.is_active,
        is_trial_plan: isTrialPlan,
        trial_days_limit: finalTrialDays
      };
      
      console.log('📤 Sending payload:', JSON.stringify(payload, null, 2));
      
      let url = `${API_BASE_URL}/products/${productId}/plans`;
      let method = 'POST';
      
      if (editingPlan) {
        url = `${API_BASE_URL}/products/${productId}/plans/${editingPlan.id}`;
        method = 'PUT';
      }
      
      const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      
      const responseText = await response.text();
      console.log('📄 Response:', response.status, responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server returned: ${responseText || 'Empty response'}`);
      }
      
      if (!response.ok) {
        const errorMsg = data.error || data.message || `HTTP ${response.status}`;
        setApiError(errorMsg);
        throw new Error(errorMsg);
      }
      
      if (data.success) {
        setSuccess(editingPlan ? 'Plan updated successfully' : 'Plan created successfully');
        setShowPlanModal(false);
        setEditingPlan(null);
        setPlanFormData(emptyPlanForm());
        await fetchPlans();
        setApiError(null);
      } else {
        throw new Error(data.error || 'Save failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save plan';
      console.error('❌ Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setDeletingPlanId(planId);
    setShowDeleteConfirm(null);
    try {
      const response = await fetch(`${API_BASE_URL}/products/${productId}/plans/${planId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to delete plan');
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Plan deleted successfully');
        fetchPlans();
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    } finally {
      setDeletingPlanId(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const emptyPlanForm = (): PlanFormData => ({
    name: '',
    description: '',
    price: 0,
    duration_days: 0,
    max_devices: 0,
    display_order: 0,
    features: '',
    is_active: true,
    is_trial_plan: false,
    trial_days_limit: 0
  });

  const openPlanModal = (plan?: Plan, template?: PlanTemplate) => {
    if (plan) {
      setEditingPlan(plan);
      const features = Array.isArray(plan.features) ? plan.features : [];
      setFeatureList(features);
      setPlanFormData({
        name: plan.name,
        description: plan.description || '',
        price: plan.price,
        duration_days: plan.duration_days,
        max_devices: plan.max_devices || 0,
        display_order: plan.display_order || 0,
        features: features.join('\n'),
        is_active: plan.is_active,
        is_trial_plan: plan.is_trial_plan || plan.price === 0,
        trial_days_limit: plan.trial_days_limit || 0
      });
    } else if (template && template.name !== 'Custom') {
      setEditingPlan(null);
      setFeatureList([]);
      const form = emptyPlanForm();
      form.name = template.name;
      setPlanFormData(form);
    } else {
      setEditingPlan(null);
      setFeatureList([]);
      setPlanFormData(emptyPlanForm());
    }
    setValidationErrors([]);
    setApiError(null);
    setError(null);
    setShowPlanModal(true);
  };

  const selectPlanTemplate = (template?: PlanTemplate) => {
    setShowTemplateDropdown(false);
    openPlanModal(undefined, template);
  };

  useEffect(() => {
    fetchProduct();
    fetchPlans();
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Product Not Found</h2>
          <p className="text-[var(--text-secondary)] mb-6">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/internal/api/products')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Product Settings</h1>
          <p className="text-[var(--text-secondary)] mt-1">Manage product details and pricing plans</p>
        </div>

        {/* Success Toast */}
        {success && (
          <div className="fixed top-4 right-4 z-50 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3 animate-in slide-in-from-top-2 max-w-md">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-green-700 dark:text-green-300">{success}</span>
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="fixed top-4 right-4 z-50 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3 animate-in slide-in-from-top-2 max-w-md">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Information Card */}
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-sm border border-[var(--border-color)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[var(--text-secondary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Product Information</h2>
              </div>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="p-6 space-y-4">
              {editMode ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Product Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Version</label>
                      <input
                        type="text"
                        value={formData.version}
                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                        className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Latest Version</label>
                      <input
                        type="text"
                        value={formData.latest_version}
                        onChange={(e) => setFormData({ ...formData, latest_version: e.target.value })}
                        className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Price (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Company Name</label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Product Type</label>
                      <input
                        type="text"
                        value={formData.product_type}
                        onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                        className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Status</label>
                    <button
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      className="flex items-center gap-2 px-3 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)]/50"
                    >
                      {formData.is_active ? (
                        <>
                          <ToggleRight className="w-5 h-5 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">Active</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                          <span className="text-[var(--text-secondary)]">Inactive</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveProduct}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        if (product) {
                          setFormData({
                            name: product.name,
                            description: product.description || '',
                            version: product.version,
                            latest_version: product.latest_version,
                            price: product.price,
                            is_active: product.is_active,
                            company_name: product.company_name || '',
                            product_type: product.product_type || '',
                            website: product.website || ''
                          });
                        }
                      }}
                      className="px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)]/50"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[var(--text-secondary)]">Product ID</span>
                    <code className="text-sm bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--text-primary)]">{product.id}</code>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-[var(--border-color)]">
                    <span className="text-[var(--text-secondary)]">Product Name</span>
                    <span className="font-medium text-[var(--text-primary)]">{product.name}</span>
                  </div>
                  {product.description && (
                    <div className="flex justify-between items-center py-2 border-t border-[var(--border-color)]">
                      <span className="text-[var(--text-secondary)]">Description</span>
                      <span className="text-[var(--text-primary)]">{product.description}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 py-2 border-t border-[var(--border-color)]">
                    <div>
                      <span className="text-[var(--text-secondary)] text-sm">Version</span>
                      <p className="font-medium text-[var(--text-primary)]">{product.version}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)] text-sm">Latest Version</span>
                      <p className="font-medium text-[var(--text-primary)]">{product.latest_version}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-[var(--border-color)]">
                    <span className="text-[var(--text-secondary)]">Price</span>
                    <span className="font-medium text-[var(--text-primary)]">${product.price.toFixed(2)} USD</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-2 border-t border-[var(--border-color)]">
                    <div>
                      <span className="text-[var(--text-secondary)] text-sm">Company</span>
                      <p className="font-medium text-[var(--text-primary)]">{product.company_name || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)] text-sm">Product Type</span>
                      <p className="font-medium text-[var(--text-primary)]">{product.product_type || '—'}</p>
                    </div>
                  </div>
                  {product.website && (
                    <div className="flex justify-between items-center py-2 border-t border-[var(--border-color)]">
                      <span className="text-[var(--text-secondary)]">Website</span>
                      <a href={product.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{product.website}</a>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-t border-[var(--border-color)]">
                    <span className="text-[var(--text-secondary)]">Status</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      product.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-[var(--border-color)]">
                    <span className="text-[var(--text-secondary)]">API Key</span>
                    <code className="text-xs bg-[var(--bg-tertiary)] px-2 py-1 rounded font-mono text-[var(--text-primary)]">
                      {product.api_key ? `${product.api_key.substring(0, 20)}...` : 'No API key generated'}
                    </code>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Pricing Overview Card */}
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-sm border border-[var(--border-color)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[var(--text-secondary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pricing Overview</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <div className="text-3xl font-bold text-[var(--text-primary)]">${product.price.toFixed(2)}</div>
                <div className="text-[var(--text-secondary)] mt-1">Base Price</div>
                <div className="mt-4 text-sm text-[var(--text-secondary)]">Additional plans can be configured below</div>
              </div>
            </div>
          </div>
        </div>

        {/* Plan Management Section */}
        <div className="mt-6 bg-[var(--bg-secondary)] rounded-lg shadow-sm border border-[var(--border-color)] overflow-hidden">
          {plans.length > 0 && !plans.some(p => p.is_active) && (
            <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                At least one active plan is required for SDK generation. Activate a plan below.
              </p>
            </div>
          )}
          {plans.length === 0 && (
            <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                No plans configured. Add at least one active plan to enable SDK generation.
              </p>
            </div>
          )}
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--text-secondary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pricing Plans</h2>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Plan
              </button>
              {showTemplateDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTemplateDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl z-20">
                    <div className="px-3 py-2 border-b border-[var(--border-color)]">
                      <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Create Plan From Template</p>
                    </div>
                    <div className="py-1 max-h-64 overflow-y-auto">
                      {PLAN_TEMPLATES.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => selectPlanTemplate(t)}
                          className="w-full text-left px-3 py-2 hover:bg-[var(--bg-tertiary)]/50 text-sm text-[var(--text-primary)] transition-colors"
                        >
                          <span className="font-medium">{t.name}</span>
                        </button>
                      ))}
                      <div className="border-t border-[var(--border-color)] my-1" />
                      <button
                        onClick={() => selectPlanTemplate()}
                        className="w-full text-left px-3 py-2 hover:bg-[var(--bg-tertiary)]/50 text-sm text-[var(--text-primary)] transition-colors"
                      >
                        <span className="font-medium">Custom</span>
                        <span className="text-[var(--text-secondary)] ml-2">Empty form</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {!plans || plans.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">No plans configured. Click "Add Plan" to create one.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isTrial = plan.is_trial_plan || plan.price === 0;
                  return (
                    <div
                      key={plan.id}
                      className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                        isTrial ? 'border-green-500/50 bg-green-50/30 dark:bg-green-900/10' : 'border-[var(--border-color)]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-[var(--text-primary)]">{plan.name}</h3>
                            {isTrial && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Gift className="w-3 h-3" /> Trial
                              </span>
                            )}
                            {isTrial && plan.trial_days_limit && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <Clock className="w-3 h-3" /> {plan.trial_days_limit} days
                              </span>
                            )}
                          </div>
                          {plan.description && <p className="text-sm text-[var(--text-secondary)] mt-1">{plan.description}</p>}
                          <div className="text-2xl font-bold text-[var(--text-primary)] mt-2">
                            {isTrial ? <span className="text-green-600 dark:text-green-400">FREE</span> : `$${plan.price.toFixed(2)}`}
                            <span className="text-sm font-normal text-[var(--text-secondary)]"> /{plan.duration_days} days</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openPlanModal(plan)} className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(plan.id)}
                            disabled={deletingPlanId === plan.id}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          plan.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {plan.features && plan.features.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Features:</div>
                          <ul className="space-y-1">
                            {plan.features.slice(0, 3).map((feature, idx) => (
                              <li key={idx} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                            {plan.features.length > 3 && (
                              <li className="text-sm text-[var(--text-secondary)]">+{plan.features.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center sticky top-0 bg-[var(--bg-secondary)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingPlan ? 'Edit Plan' : 'Create Plan'}
              </h3>
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setEditingPlan(null);
                  setApiError(null);
                  setValidationErrors([]);
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {apiError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{apiError}</p>
                </div>
              )}
              
              {validationErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  {validationErrors.map((err, i) => (
                    <p key={i} className="text-sm text-red-600 dark:text-red-400">{err}</p>
                  ))}
                </div>
              )}

              {!editingPlan && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Plan Template</label>
                  <select
                    value=""
                    onChange={(e) => {
                      const t = PLAN_TEMPLATES.find(pt => pt.name === e.target.value);
                      if (t) selectPlanTemplate(t);
                    }}
                    className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  >
                    <option value="" disabled>Select a template...</option>
                    {PLAN_TEMPLATES.map((t) => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">General</p>
                <div className="border-t border-[var(--border-color)] pt-3 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Plan Name *</label>
                    <input
                      type="text"
                      value={planFormData.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlanFormData({ ...planFormData, name: val });
                        const dup = plans.find(
                          p => p.name.toLowerCase() === val.trim().toLowerCase() &&
                          (!editingPlan || p.id !== editingPlan.id)
                        );
                        setValidationErrors(dup ? [`Plan "${val.trim()}" already exists for this product.`] : []);
                      }}
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      placeholder="e.g., Professional, Enterprise, Trial"
                    />
                    {planFormData.name && plans.some(
                      p => p.name.toLowerCase() === planFormData.name.trim().toLowerCase() &&
                      (!editingPlan || p.id !== editingPlan.id)
                    ) && (
                      <p className="text-xs text-red-500 mt-1">This plan name already exists</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
                    <textarea
                      value={planFormData.description}
                      onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      placeholder="Describe this licensing plan"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Licensing</p>
                <div className="border-t border-[var(--border-color)] pt-3 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planFormData.is_trial_plan}
                      onChange={(e) => {
                        const isTrial = e.target.checked;
                        setPlanFormData({ 
                          ...planFormData, 
                          is_trial_plan: isTrial,
                          price: isTrial ? 0 : planFormData.price,
                          trial_days_limit: isTrial ? (planFormData.trial_days_limit || 0) : 0,
                        });
                      }}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-[var(--text-primary)]">Trial Plan</span>
                  </label>

                  {planFormData.is_trial_plan ? (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Trial Duration (days)</label>
                      <input
                        type="number"
                        min="0"
                        value={planFormData.trial_days_limit}
                        onChange={(e) => setPlanFormData({ ...planFormData, trial_days_limit: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                        placeholder="0"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={planFormData.price}
                          onChange={(e) => setPlanFormData({ ...planFormData, price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">License Duration (days)</label>
                        <input
                          type="number"
                          min="0"
                          value={planFormData.duration_days}
                          onChange={(e) => setPlanFormData({ ...planFormData, duration_days: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                          placeholder="0"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Activation</p>
                <div className="border-t border-[var(--border-color)] pt-3 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Max Devices</label>
                    <input
                      type="number"
                      min="0"
                      value={planFormData.max_devices}
                      onChange={(e) => setPlanFormData({ ...planFormData, max_devices: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      placeholder="Enter maximum activated devices"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Display Order</label>
                    <input
                      type="number"
                      min="0"
                      value={planFormData.display_order ?? 0}
                      onChange={(e) => setPlanFormData({ ...planFormData, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Features</p>
                <div className="border-t border-[var(--border-color)] pt-3 space-y-3">
                  {featureList.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const list = [...featureList];
                          if (index > 0) {
                            [list[index - 1], list[index]] = [list[index], list[index - 1]];
                            setFeatureList(list);
                            setPlanFormData({ ...planFormData, features: list.join('\n') });
                          }
                        }}
                        disabled={index === 0}
                        className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const list = [...featureList];
                          if (index < list.length - 1) {
                            [list[index], list[index + 1]] = [list[index + 1], list[index]];
                            setFeatureList(list);
                            setPlanFormData({ ...planFormData, features: list.join('\n') });
                          }
                        }}
                        disabled={index === featureList.length - 1}
                        className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => {
                          const list = [...featureList];
                          list[index] = e.target.value;
                          setFeatureList(list);
                          setPlanFormData({ ...planFormData, features: list.join('\n') });
                        }}
                        className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                        placeholder="Enter feature description"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = featureList.filter((_, i) => i !== index);
                          setFeatureList(list);
                          setPlanFormData({ ...planFormData, features: list.join('\n') });
                        }}
                        className="p-1 text-red-400 hover:text-red-300"
                        title="Remove feature"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...featureList, ''];
                      setFeatureList(list);
                      setPlanFormData({ ...planFormData, features: list.join('\n') });
                    }}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Feature
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Status</p>
                <div className="border-t border-[var(--border-color)] pt-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planFormData.is_active}
                      onChange={(e) => setPlanFormData({ ...planFormData, is_active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-[var(--text-primary)]">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[var(--border-color)]">
                <button
                  onClick={handleSavePlan}
                  disabled={saving || !planFormData.name.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    saving || !planFormData.name.trim()
                      ? 'bg-gray-400 cursor-not-allowed opacity-50 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {saving ? 'Saving...' : (editingPlan ? 'Update Plan' : 'Create Plan')}
                </button>
                <button
                  onClick={() => {
                    setShowPlanModal(false);
                    setEditingPlan(null);
                    setApiError(null);
                    setValidationErrors([]);
                  }}
                  className="px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)]/50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="border-2 border-red-500/30 rounded-xl p-6 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Once you permanently delete this product, all associated data (plans, API keys, licenses, activations, and audit logs) will be permanently removed. This action cannot be undone.
        </p>
        <div className="flex items-center gap-3">
          {product?.is_deleted ? (
            <>
              <span className="text-sm text-red-400 font-medium">Product is archived — ready for permanent deletion</span>
              <button
                onClick={() => setShowProductDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete Permanently
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-amber-400">Archive this product first to enable permanent deletion</span>
              <button
                onClick={async () => {
                  if (!confirm('Archive this product? This will deactivate it.')) return;
                  try {
                    const res = await fetch(`${API_BASE_URL}/products/${productId}`, {
                      method: 'DELETE',
                      headers: getAuthHeaders()
                    });
                    const data = await res.json();
                    if (data.success) {
                      setSuccess(data.message);
                      fetchProduct();
                    } else {
                      setApiError(data.error);
                    }
                  } catch {
                    setApiError('Failed to archive product');
                  }
                }}
                className="px-4 py-2 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors text-sm font-medium"
              >
                Archive Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete Product Confirmation Modal */}
      {showProductDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Permanently Delete Product?</h3>
            </div>
            <p className="text-[var(--text-secondary)] mb-2">
              This will permanently delete <strong className="text-[var(--text-primary)]">{product?.name}</strong> and all associated plans, API keys, licenses, activations, and audit logs.
            </p>
            <p className="text-red-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="mb-4">
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                Type <span className="font-mono text-red-400 font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-red-500 bg-[var(--bg-primary)] text-[var(--text-primary)]"
                placeholder="Type DELETE to confirm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowProductDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
                  setDeletingProduct(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/products/${productId}?permanent=true`, {
                      method: 'DELETE',
                      headers: getAuthHeaders()
                    });
                    const data = await res.json();
                    if (data.success) {
                      setShowProductDeleteConfirm(false);
                      setDeleteConfirmText('');
                      router.push('/internal/api/products');
                    } else {
                      setApiError(data.error);
                      setShowProductDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }
                  } catch {
                    setApiError('Failed to delete product');
                    setShowProductDeleteConfirm(false);
                    setDeleteConfirmText('');
                  } finally {
                    setDeletingProduct(false);
                  }
                }}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingProduct}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  deleteConfirmText.trim().toUpperCase() === 'DELETE' && !deletingProduct
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {deletingProduct ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Delete Plan?</h3>
            </div>
            <p className="text-[var(--text-secondary)] mb-6">Are you sure you want to delete this plan? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlan(showDeleteConfirm)}
                disabled={deletingPlanId === showDeleteConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingPlanId === showDeleteConfirm ? 'Deleting...' : 'Delete Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}