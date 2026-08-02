/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/api/developers/integrations/page.tsx
 * Purpose: SDK Generation Page - Clean architecture implementation
 * Author: Websmith
 *
 * WORKFLOW:
 * 1. Select Product
 * 2. Automatically load Product API Keys
 * 3. Select Existing API Key OR Enter Existing API Key
 * 4. Select SDK Runtime (dynamic naming)
 * 5. Live Package Preview
 * 6. Generate SDK (Async Queue)
 * 7. Show Progress Dialog (polling owned by dialog)
 * 8. Auto-download SDK when ready
 * ---------------------------------------------------------
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Download,
  CheckCircle,
  RefreshCw,
  FileArchive,
  Clock,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Terminal,
  Code,
  Building2,
  Mail,
  Globe,
  Award,
  Hash,
  HardDrive,
  Calendar,
  Shield,
  Info,
  Eye,
  EyeOff,
  ExternalLink,
  Key,
  Copy,
  Check,
  Link2,
  XCircle,
  Plus,
  Loader2,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { SDKGenerationDialog } from '@/components/internal-api/sdk/SDKGenerationDialog';
import UniversalEmailDialog from '@/components/internal-api/UniversalEmailDialog';

// ============================================================
// TYPES
// ============================================================

interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  company_name: string;
  support_email: string;
  support_url: string;
  trial_enabled: boolean;
  trial_days: number;
  is_active: boolean;
}

interface ApiKey {
  id: string;
  product_id: string;
  product_name?: string;
  api_key: string;
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
  last_used_at: string | null;
}

interface Runtime {
  name: string;
  label: string;
  status: 'available' | 'coming_soon' | 'deprecated';
  icon?: string;
}

interface PackageDetails {
  downloadUrl: string | null;
  checksum: string | null;
  size: number | null;
  version: string | null;
  expiresIn: number;
  generatedAt: string | null;
  runtime: string | null;
  filename: string | null;
}

// ============================================================
// RUNTIMES CONFIGURATION
// ============================================================

const RUNTIMES: Runtime[] = [
  { name: 'python', label: 'Python', status: 'available', icon: '🐍' },
  { name: 'node', label: 'Node.js', status: 'available', icon: '🟢' },
  { name: 'bun', label: 'Bun', status: 'available', icon: '🥟' },
  { name: 'deno', label: 'Deno', status: 'available', icon: '🦕' },
  { name: 'php', label: 'PHP', status: 'available', icon: '🐘' },
  { name: 'java', label: 'Java', status: 'available', icon: '☕' },
  { name: 'dotnet', label: '.NET', status: 'available', icon: '🔷' },
  { name: 'go', label: 'Go', status: 'available', icon: '🐹' },
  { name: 'rust', label: 'Rust', status: 'available', icon: '🦀' },
  { name: 'cpp', label: 'C++', status: 'available', icon: '⚡' },
  { name: 'c', label: 'C', status: 'available', icon: '🔧' },
  { name: 'javascript', label: 'JavaScript', status: 'available', icon: '📜' },
  { name: 'typescript', label: 'TypeScript', status: 'available', icon: '📘' },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function IntegrationsPage() {
  const router = useRouter();
  
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [allKeys, setAllKeys] = useState<ApiKey[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [manualApiKey, setManualApiKey] = useState<string>('');
  const [useManualKey, setUseManualKey] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [selectedRuntime, setSelectedRuntime] = useState<string>('python');
  const [runtimeDropdownOpen, setRuntimeDropdownOpen] = useState(false);

  // --- SDK Settings ---
  const [templates, setTemplates] = useState<{ id: number; name: string; duration_days: number; is_system_default: boolean }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [trialDuration, setTrialDuration] = useState(7);
  const [emailVerification, setEmailVerification] = useState(true);
  const [deviceLimit, setDeviceLimit] = useState(1);
  const [offlineGraceDays, setOfflineGraceDays] = useState(0);
  const [supportEmail, setSupportEmail] = useState('support@websmithdigital.com');
  const [allowConversion, setAllowConversion] = useState(true);
  const [countryList, setCountryList] = useState<{ code: string; name: string; dial: string; flag: string }[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const [packageDetails, setPackageDetails] = useState<PackageDetails>({
    downloadUrl: null,
    checksum: null,
    size: null,
    version: null,
    expiresIn: 3600,
    generatedAt: null,
    runtime: null,
    filename: null,
  });
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyValidation, setKeyValidation] = useState<{ valid: boolean; productName?: string } | null>(null);

  const [copiedChecksum, setCopiedChecksum] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // --- Refs ---
  const isInitialLoad = useRef(true);
  const manualKeyTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- Derived State ---
  const selectedProductData = useMemo(
    () => products.find((p) => p.id === selectedProduct),
    [products, selectedProduct]
  );

  const selectedRuntimeData = useMemo(
    () => RUNTIMES.find((r) => r.name === selectedRuntime),
    [selectedRuntime]
  );

  const isGenerateDisabled = useMemo(() => {
    if (!selectedProduct) return true;
    if (generating) return true;
    if (useManualKey && !manualApiKey?.trim()) return true;
    if (!useManualKey && !selectedApiKey) return true;
    return false;
  }, [selectedProduct, generating, useManualKey, manualApiKey, selectedApiKey]);

  // --- Helpers ---
  const getToken = () => localStorage.getItem('api_center_token');

  const getKeyPrefix = (apiKey: string): string => {
    const match = apiKey.match(/^pk_([a-z0-9]{4})_/);
    return match ? match[1] : '????';
  };

  const maskApiKey = (key: string): string => {
    if (!key) return '';
    if (key.length <= 12) return key;
    const prefix = getKeyPrefix(key);
    const masked = key.slice(0, 12) + '••••••••';
    return masked;
  };

  const formatDate = (date: string): string => {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date;
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatExpiry = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    return `${Math.floor(seconds / 3600)} hours`;
  };

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const resetGenerationState = () => {
    setPackageDetails({
      downloadUrl: null,
      checksum: null,
      size: null,
      version: null,
      expiresIn: 3600,
      generatedAt: null,
      runtime: null,
      filename: null,
    });
    setGenerateSuccess(false);
    setError(null);
    setKeyError(null);
    setKeyValidation(null);
    setJobId(null);
  };

  const resetKeyState = () => {
    setSelectedApiKey('');
    setManualApiKey('');
    setUseManualKey(false);
    setKeyError(null);
    setKeyValidation(null);
  };

  // Generate package preview filename
  const getPackagePreview = (): string | null => {
    if (!selectedProductData) return null;
    const productName = selectedProductData.name.replace(/\s+/g, '-');
    const runtimeName = selectedRuntimeData?.name || 'python';
    const version = packageDetails.version || selectedProductData.version || '1.0.0';
    return `${productName}-${runtimeName.charAt(0).toUpperCase() + runtimeName.slice(1)}-SDK-v${version}.zip`;
  };

  // --- SDK Runtime Settings ---
  const loadRuntimeSettings = async (productId: string) => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/internal/backend/sdk-runtime-settings?productId=${encodeURIComponent(productId)}`, { headers });
      const data = await res.json();
      if (data.success && data.data) {
        setTrialEnabled(data.data.trial_enabled !== false);
        setAllowConversion(data.data.allow_conversion !== false);
        setEmailVerification(data.data.email_verification !== false);
        setTrialDuration(data.data.trial_duration_days || 7);
        setDeviceLimit(data.data.device_limit != null ? data.data.device_limit : 1);
        setOfflineGraceDays(data.data.offline_grace_days || 0);
        setSupportEmail(data.data.support_email || 'support@websmithdigital.com');
      }
    } catch (err) {
      console.error('Failed to load runtime settings:', err);
    }
  };

  const saveRuntimeSettings = async () => {
    try {
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/internal/backend/sdk-runtime-settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          product_id: selectedProduct,
          trial_enabled: trialEnabled,
          allow_conversion: allowConversion,
          email_verification: emailVerification,
          trial_duration_days: trialDuration,
          device_limit: deviceLimit,
          offline_grace_days: offlineGraceDays,
          support_email: supportEmail,
        }),
      });
    } catch (err) {
      console.error('Failed to save runtime settings:', err);
    }
  };

  // --- Data Fetching ---
  const loadProducts = async () => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch('/internal/backend/admin/products', { headers });
      const data = await response.json();
      if (data.success && data.products?.length > 0) {
        setProducts(data.products);
        if (isInitialLoad.current) {
          setSelectedProduct(data.products[0].id);
          isInitialLoad.current = false;
        }
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllKeys = async () => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch('/internal/backend/admin/api-keys', { headers });
      const data = await response.json();
      if (data.success && Array.isArray(data.keys)) {
        setAllKeys(data.keys);
        return data.keys;
      }
      return [];
    } catch (err) {
      console.error('Failed to load all keys:', err);
      return [];
    }
  };

  const loadApiKeys = async () => {
    setLoadingKeys(true);
    setKeyError(null);
    setKeyValidation(null);
    
    try {
      const keys = await loadAllKeys();
      
      if (!keys || keys.length === 0) {
        setApiKeys([]);
        setSelectedApiKey('');
        return;
      }

      const activeKeys = keys.filter(
        (key: ApiKey) =>
          key.product_id === selectedProduct &&
          key.status === 'active'
      );

      setApiKeys(activeKeys);

      if (activeKeys.length > 0) {
        setSelectedApiKey(activeKeys[0].id);
      } else {
        setSelectedApiKey('');
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setApiKeys([]);
      setSelectedApiKey('');
    } finally {
      setLoadingKeys(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    loadProducts();
    fetch('/internal/backend/admin/trials/trial-templates?include_inactive=true')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setTemplates(data.data || []);
          const universal = (data.data || []).find((t: any) => t.is_system_default);
          if (universal) setSelectedTemplate(universal.id);
        }
      })
      .catch(() => {});
    fetch('/api/v1/countries', {
      headers: { 'X-API-Key': localStorage.getItem('api_center_token') || '' }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setCountryList(data.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      resetGenerationState();
      resetKeyState();
      loadApiKeys();
      loadRuntimeSettings(selectedProduct);
    }
  }, [selectedProduct]);

  // Auto-validate manual key entry
  useEffect(() => {
    if (manualKeyTimeout.current) {
      clearTimeout(manualKeyTimeout.current);
    }

    if (useManualKey && manualApiKey && manualApiKey.length > 20) {
      manualKeyTimeout.current = setTimeout(() => {
        validateManualKey(manualApiKey);
      }, 500);
    } else {
      setKeyValidation(null);
    }

    return () => {
      if (manualKeyTimeout.current) {
        clearTimeout(manualKeyTimeout.current);
      }
    };
  }, [manualApiKey, useManualKey]);

  // --- Validation ---
  const validateManualKey = async (key: string) => {
    setValidatingKey(true);
    setKeyError(null);

    try {
      const keys = await loadAllKeys();
      const foundKey = keys.find((k: ApiKey) => k.api_key === key);

      if (!foundKey) {
        setKeyValidation({ valid: false });
        setKeyError('API Key not found. Please enter an existing key.');
        return;
      }

      if (foundKey.status !== 'active') {
        setKeyValidation({ valid: false });
        setKeyError(`API Key is ${foundKey.status}. Please use an active key.`);
        return;
      }

      if (foundKey.product_id !== selectedProduct) {
        const productName = products.find(p => p.id === foundKey.product_id)?.name || foundKey.product_id;
        setKeyValidation({ 
          valid: false, 
          productName: productName 
        });
        setKeyError(`This key belongs to "${productName}". Please select that product.`);
        return;
      }

      setKeyValidation({ valid: true, productName: selectedProductData?.name });
      setKeyError(null);

    } catch (err) {
      setKeyValidation({ valid: false });
      setKeyError('Failed to validate API key. Please try again.');
    } finally {
      setValidatingKey(false);
    }
  };

  // --- Generate SDK (with Queue Support) ---
  const handleGenerate = async () => {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    let apiKeyToUse = '';

    if (useManualKey) {
      if (!manualApiKey?.trim()) {
        setError('Please enter an existing API Key');
        return;
      }
      apiKeyToUse = manualApiKey.trim();
      
      const keys = await loadAllKeys();
      const foundKey = keys.find((k: ApiKey) => k.api_key === apiKeyToUse);
      
      if (!foundKey) {
        setKeyError('API Key not found. Please enter an existing key.');
        return;
      }
      
      if (foundKey.product_id !== selectedProduct) {
        const productName = products.find(p => p.id === foundKey.product_id)?.name || foundKey.product_id;
        setKeyError(`This key belongs to "${productName}". Please select that product.`);
        return;
      }
      
      if (foundKey.status !== 'active') {
        setKeyError(`API Key is ${foundKey.status}. Please use an active key.`);
        return;
      }
      
      setKeyError(null);
    } else {
      if (!selectedApiKey) {
        setError('Please select an API Key');
        return;
      }
      const selectedKey = apiKeys.find((k) => k.id === selectedApiKey);
      if (!selectedKey) {
        setError('Invalid API Key selected');
        return;
      }
      if (selectedKey.product_id !== selectedProduct) {
        setError('Selected API Key does not belong to this product');
        return;
      }
      apiKeyToUse = selectedKey.api_key;
    }

    setGenerating(true);
    resetGenerationState();
    setError(null);
    setKeyError(null);

    // Save current SDK runtime settings to Neon before generation
    saveRuntimeSettings();

    try {
      const response = await fetch('/api/internal/publisher/publish-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKeyToUse,
        },
        body: JSON.stringify({
          productId: selectedProduct,
          runtime: selectedRuntime,
          template_id: selectedTemplate,
          trial_enabled: trialEnabled,
          trial_duration: trialDuration,
          email_verification: emailVerification,
          device_limit: deviceLimit,
          offline_grace_days: offlineGraceDays,
          support_email: supportEmail,
          allow_conversion: allowConversion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes('Invalid or expired API key') || data.error?.includes('API key')) {
          setKeyError('The API Key is invalid or expired. Please select another API Key.');
        } else if (data.error?.includes('product')) {
          setError('The API Key does not belong to the selected product.');
        } else {
          setError(data.error || 'Failed to generate package');
        }
        setGenerating(false);
        return;
      }

      // ✅ Check if we got a job_id (async queue response)
      if (data.job_id) {
        setJobId(data.job_id);
        setGenerateSuccess(false);
        
        // Open the progress dialog - polling is owned by the dialog
        setDialogOpen(true);
        setGenerating(false);
        return;
      }

      // ✅ Fallback: Direct package response (for non-queue mode)
      if (data.package) {
        const pkg = data.package;
        setPackageDetails({
          downloadUrl: pkg.download_url,
          checksum: pkg.checksum || null,
          size: pkg.size || null,
          version: pkg.version || null,
          expiresIn: pkg.expires_in || 3600,
          generatedAt: pkg.generated_at || new Date().toISOString(),
          runtime: pkg.runtime || selectedRuntime,
          filename: pkg.filename || null,
        });
        setGenerateSuccess(true);
        setError(null);
        setGenerating(false);
        return;
      }

      // ❌ Unexpected response
      setError('Unexpected response from server');
      setGenerating(false);

    } catch (err) {
      console.error('Package generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate package');
      setGenerating(false);
    }
  };

  // --- Dialog Handlers ---
  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleDialogComplete = (downloadUrl: string, filename: string, productName?: string) => {
    setPackageDetails({
      downloadUrl,
      filename,
      checksum: null,
      size: null,
      version: selectedProductData?.version || null,
      expiresIn: 3600,
      generatedAt: new Date().toISOString(),
      runtime: selectedRuntime,
    });
    setGenerateSuccess(true);
    setDialogOpen(false);
    // AWS-01 Phase 1: Generate SDK → UniversalEmailDialog directly (no intermediate Email Center)
    setEmailDialogOpen(true);
  };

  const handleDialogFailed = (error: string) => {
    setError(error);
    setDialogOpen(true); // Keep open to show error
  };

  const handleDialogRetry = () => {
    // Retry logic - handled by the hook
  };

  const handleDialogCancel = () => {
    setDialogOpen(false);
    setGenerating(false);
  };

  // --- Render Helpers ---
  const renderRuntimeDropdown = () => (
    <div className="relative">
      <button
        onClick={() => setRuntimeDropdownOpen(!runtimeDropdownOpen)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm hover:border-indigo-400 transition-all duration-200 flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{selectedRuntimeData?.icon}</span>
          <span>{selectedRuntimeData?.label} SDK</span>
          <span className="text-[10px] text-emerald-400">✓ Available</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] transition-transform duration-200 ${runtimeDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {runtimeDropdownOpen && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-lg">
          {RUNTIMES.map((runtime) => {
            const isAvailable = runtime.status === 'available';
            return (
              <button
                key={runtime.name}
                onClick={() => {
                  if (isAvailable) {
                    setSelectedRuntime(runtime.name);
                    setRuntimeDropdownOpen(false);
                  }
                }}
                disabled={!isAvailable}
                className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${
                  runtime.name === selectedRuntime ? 'bg-[var(--bg-tertiary)]' : ''
                } ${!isAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{runtime.icon}</span>
                  <span className="text-[var(--text-primary)]">{runtime.label} SDK</span>
                </span>
                {isAvailable ? (
                  <span className="text-[10px] text-emerald-400">✓</span>
                ) : (
                  <span className="text-[10px] text-[var(--text-secondary)]/50">Available Soon</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderProductInfo = () => (
    <Card className="p-4 h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
          <Package className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[var(--text-primary)] text-sm truncate">
            {selectedProductData?.name || 'Select a product'}
          </h4>
          {selectedProductData && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-secondary)]">
                v{selectedProductData.version || '1.0.0'}
              </span>
              {selectedProductData.is_active && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  Active
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedProductData ? (
        <div className="space-y-1 text-xs">
          {selectedProductData.description && (
            <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
              {selectedProductData.description}
            </p>
          )}

          <div className="pt-2 border-t border-[var(--border-color)] space-y-1">
            {selectedProductData.company_name && (
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Building2 className="w-3 h-3" />
                <span>{selectedProductData.company_name}</span>
              </div>
            )}
            {selectedProductData.support_email && (
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Mail className="w-3 h-3" />
                <span className="truncate text-[10px]">{selectedProductData.support_email}</span>
              </div>
            )}
            {selectedProductData.support_url && (
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Globe className="w-3 h-3" />
                <a
                  href={selectedProductData.support_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline truncate text-[10px]"
                >
                  {selectedProductData.support_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {selectedProductData.trial_enabled && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <Award className="w-3 h-3" />
                <span className="text-[10px]">Trial: {selectedProductData.trial_days} days</span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[var(--border-color)] grid grid-cols-2 gap-1 text-[10px]">
            <div className="text-[var(--text-secondary)]">
              <span className="text-[var(--text-secondary)]/60">API Keys</span>
              <span className="block font-medium text-[var(--text-primary)]">{apiKeys.length} active</span>
            </div>
            <div className="text-[var(--text-secondary)]">
              <span className="text-[var(--text-secondary)]/60">Package Preview</span>
              <span className="block font-medium text-[var(--text-primary)] truncate text-[10px]">
                {getPackagePreview() || '—'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-center">
          <div>
            <Info className="w-6 h-6 text-[var(--text-secondary)]/30 mx-auto mb-1.5" />
            <p className="text-sm text-[var(--text-secondary)]">Select a product</p>
            <p className="text-xs text-[var(--text-secondary)]/60">to view its information</p>
          </div>
        </div>
      )}
    </Card>
  );

  const renderPackageDetails = () => {
    if (!generateSuccess || !packageDetails.downloadUrl) return null;

    const { downloadUrl, checksum, size, version, expiresIn, generatedAt, runtime, filename } = packageDetails;

    const displayFilename = filename || getPackagePreview();

    return (
      <Card className="p-4 mt-4 border-green-500/30 bg-green-50 dark:bg-green-950/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-green-700 dark:text-green-300 text-sm">
              {selectedProductData?.name} SDK Generated
            </h4>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {displayFilename && (
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)] col-span-2">
                  <FileArchive className="w-3 h-3" />
                  <span className="font-mono text-[10px] truncate">{displayFilename}</span>
                </div>
              )}
              {selectedProductData && (
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Package className="w-3 h-3" />
                  <span>{selectedProductData.name}</span>
                </div>
              )}
              {runtime && (
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Terminal className="w-3 h-3" />
                  <span>{runtime.charAt(0).toUpperCase() + runtime.slice(1)} SDK</span>
                </div>
              )}
              {version && (
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Hash className="w-3 h-3" />
                  <span>v{version}</span>
                </div>
              )}
              {size && (
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <HardDrive className="w-3 h-3" />
                  <span>{formatSize(size)}</span>
                </div>
              )}
              {generatedAt && (
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(generatedAt)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Clock className="w-3 h-3" />
                <span>Expires in {formatExpiry(expiresIn)}</span>
              </div>
              {checksum && (
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)] col-span-2">
                  <Shield className="w-3 h-3 shrink-0" />
                  <span className="font-mono text-[10px] truncate">{checksum}</span>
                  <button
                    onClick={() => copyToClipboard(checksum, setCopiedChecksum)}
                    className="p-0.5 hover:text-[var(--text-primary)] transition-colors"
                    title="Copy checksum"
                  >
                    {copiedChecksum ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs font-medium"
                download={displayFilename || undefined}
              >
                <Download className="w-3.5 h-3.5" />
                Download {selectedRuntimeData?.label || 'SDK'}
              </a>
              <button
                onClick={() => copyToClipboard(downloadUrl, setCopiedUrl)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="Copy download URL"
              >
                {copiedUrl ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Link2 className="w-3 h-3" />
                )}
                {copiedUrl ? 'Copied' : 'Copy URL'}
              </button>
              <button
                onClick={() => setEmailDialogOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-medium"
                title="Send the generated SDK package via email"
              >
                <Mail className="w-3.5 h-3.5" />
                Send SDK Email
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Code className="w-6 h-6 text-indigo-500" />
            Generate SDK
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Generate SDK packages for your products
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-3">
          <Card className="p-5">
            <div className="space-y-4">
              {/* Quick Start */}
              <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)]/30 rounded-lg px-4 py-2">
                <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Quick Start</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">1</span>
                    Product
                  </span>
                  <span className="text-[var(--text-secondary)]/30">→</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">2</span>
                    API Key
                  </span>
                  <span className="text-[var(--text-secondary)]/30">→</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">3</span>
                    SDK
                  </span>
                  <span className="text-[var(--text-secondary)]/30">→</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">4</span>
                    Template
                  </span>
                  <span className="text-[var(--text-secondary)]/30">→</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">5</span>
                    Generate
                  </span>
                </div>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                  Product
                </label>
                <div className="relative">
                  <select
                    value={selectedProduct}
                    onChange={(e) => {
                      setSelectedProduct(e.target.value);
                      setKeyValidation(null);
                      setKeyError(null);
                    }}
                    className="w-full px-3 py-2 pr-8 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 appearance-none cursor-pointer hover:border-indigo-400"
                  >
                    <option value="">Choose a product...</option>
                    {products.map((product) => {
                      const hasKey = allKeys.some(k => k.product_id === product.id && k.status === 'active');
                      return (
                        <option key={product.id} value={product.id}>
                          {product.name} {product.version && `(v${product.version})`}
                          {hasKey ? ' 🔑' : ' ⚠️'}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
                </div>
                {selectedProductData && (
                  <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {apiKeys.length} active key{apiKeys.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* API Key Section */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    API Key
                  </label>
                  <a
                    href="/internal/api/public-api/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Manage Keys
                  </a>
                </div>

                {/* Option 1: Existing Key */}
                <div className="mb-1.5">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="radio"
                      checked={!useManualKey}
                      onChange={() => {
                        setUseManualKey(false);
                        setKeyError(null);
                        setError(null);
                        setKeyValidation(null);
                        setManualApiKey('');
                      }}
                      className="w-3.5 h-3.5 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <span className="font-medium text-xs">Existing API Key</span>
                    <span className="text-[10px] text-[var(--text-secondary)]/60">(Recommended)</span>
                  </label>
                </div>

                {!useManualKey && (
                  <div className="relative ml-5">
                    <select
                      value={selectedApiKey}
                      onChange={(e) => {
                        setSelectedApiKey(e.target.value);
                        setKeyError(null);
                        setError(null);
                        setKeyValidation(null);
                      }}
                      disabled={loadingKeys || apiKeys.length === 0}
                      className="w-full px-3 py-1.5 pr-8 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 appearance-none cursor-pointer hover:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingKeys ? (
                        <option value="">Loading keys...</option>
                      ) : apiKeys.length === 0 ? (
                        <option value="">No keys for this product</option>
                      ) : (
                        apiKeys.map((key) => {
                          const prefix = getKeyPrefix(key.api_key);
                          return (
                            <option key={key.id} value={key.id}>
                              {maskApiKey(key.api_key)} • {key.status} 🔑 {prefix}
                            </option>
                          );
                        })
                      )}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
                    
                    {apiKeys.length === 0 && !loadingKeys && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          No active API keys for {selectedProductData?.name}
                        </p>
                        <button
                          onClick={() => {
                            router.push(`/internal/api/public-api/keys`);
                          }}
                          className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Generate Key
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Separator */}
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-[var(--border-color)]" />
                  <span className="text-[10px] text-[var(--text-secondary)]/50 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-[var(--border-color)]" />
                </div>

                {/* Option 2: Manual Entry */}
                <div className="mb-1.5">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="radio"
                      checked={useManualKey}
                      onChange={() => {
                        setUseManualKey(true);
                        setKeyError(null);
                        setError(null);
                        setKeyValidation(null);
                        setSelectedApiKey('');
                      }}
                      className="w-3.5 h-3.5 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <span className="font-medium text-xs">Enter Existing API Key</span>
                  </label>
                </div>

                {useManualKey && (
                  <div className="relative ml-5">
                    <input
                      type={showManualKey ? 'text' : 'password'}
                      value={manualApiKey}
                      onChange={(e) => {
                        setManualApiKey(e.target.value);
                        setKeyError(null);
                        setError(null);
                      }}
                      placeholder="Enter an existing API Key"
                      className={`w-full px-3 py-1.5 pr-16 rounded-lg bg-[var(--bg-tertiary)] border-2 text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 hover:border-indigo-500 ${
                        keyValidation?.valid === true
                          ? 'border-emerald-500/60 focus:border-emerald-500'
                          : keyValidation?.valid === false
                          ? 'border-red-500/60 focus:border-red-500'
                          : 'border-indigo-500/40 focus:border-indigo-500'
                      }`}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {validatingKey && (
                        <Loader2 className="w-4 h-4 text-[var(--text-secondary)] animate-spin" />
                      )}
                      {keyValidation?.valid === true && (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      )}
                      {keyValidation?.valid === false && (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <button
                        type="button"
                        onClick={() => setShowManualKey(!showManualKey)}
                        className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {showManualKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Key validation message */}
                {keyValidation?.valid === true && (
                  <div className="mt-1.5 ml-5 p-1.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3" />
                      Valid key for {keyValidation.productName || selectedProductData?.name}
                    </p>
                  </div>
                )}

                {keyValidation?.valid === false && keyError && (
                  <div className="mt-1.5 ml-5 p-1.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      {keyError}
                    </p>
                  </div>
                )}

                {useManualKey && (
                  <p className="mt-1 ml-5 text-[10px] text-[var(--text-secondary)]">
                    Keys are validated against the selected product before generation.
                  </p>
                )}
              </div>

              {/* Runtime Selector */}
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                  SDK Runtime
                </label>
                {renderRuntimeDropdown()}
              </div>

              {/* SDK Settings */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
                <h4 className="col-span-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  SDK Settings
                </h4>

                {/* Trial Enabled */}
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={trialEnabled}
                    onChange={e => setTrialEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border-color)] text-indigo-500 focus:ring-indigo-500/50"
                  />
                  <span>Trial Enabled</span>
                </label>

                {/* Allow Conversion */}
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={allowConversion}
                    onChange={e => setAllowConversion(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border-color)] text-indigo-500 focus:ring-indigo-500/50"
                  />
                  <span>Allow Conversion</span>
                </label>

                {/* Email Verification */}
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={emailVerification}
                    onChange={e => setEmailVerification(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border-color)] text-indigo-500 focus:ring-indigo-500/50"
                  />
                  <span>Email Verification</span>
                </label>

                {/* Trial Duration */}
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                    Trial Duration
                  </label>
                  <select
                    value={trialDuration}
                    onChange={e => setTrialDuration(parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n} day{n !== 1 ? 's' : ''}</option>
                    ))}
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>365 Days</option>
                  </select>
                </div>

                {/* Device Limit */}
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                    Device Limit
                  </label>
                  <select
                    value={deviceLimit}
                    onChange={e => {
                      const val = e.target.value;
                      setDeviceLimit(val === 'unlimited' ? -1 : parseInt(val));
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n} device{n !== 1 ? 's' : ''}</option>
                    ))}
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>

                {/* Offline Grace Period */}
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                    Offline Grace (days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={offlineGraceDays}
                    onChange={e => setOfflineGraceDays(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>

                {/* Support Email */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={e => setSupportEmail(e.target.value)}
                    placeholder="support@websmithdigital.com"
                    className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && !keyError && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    {error}
                  </p>
                </div>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerateDisabled || validatingKey}
                className="w-full py-2 text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                size="md"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Generate {selectedRuntimeData?.label} SDK
                  </>
                )}
              </Button>

              {/* Security Notice */}
              <div className="text-[10px] text-[var(--text-secondary)]/60 text-center border-t border-[var(--border-color)] pt-2">
                <Shield className="w-3 h-3 inline mr-1" />
                API keys are isolated by product
              </div>
            </div>
          </Card>

          {/* Package Details */}
          {renderPackageDetails()}
        </div>

        {/* Right Column: Product Info */}
        <div className="lg:col-span-2">{renderProductInfo()}</div>
      </div>

      {/* SDK Generation Dialog */}
      <SDKGenerationDialog
        open={dialogOpen}
        jobId={jobId}
        onClose={handleDialogClose}
        onRetry={handleDialogRetry}
        onCancel={handleDialogCancel}
        onComplete={handleDialogComplete}
        onFailed={handleDialogFailed}
      />

      {/* Send Email Dialog */}
      <UniversalEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => {
          setEmailDialogOpen(false);
        }}
        defaultEmail=""
        defaultLicenseKey=""
        defaultProductName={selectedProductData?.name || ""}
        defaultProductId={selectedProduct}
        // AWS-01 Phase 1 Final: SDK page is an admin tool — Email Options menu
        // shows only admin actions (Send Email + Email History). User self-service
        // actions (Buy License, Activate, Renew, etc.) stay in their own modules.
        allowedActions={["send", "history"]}
      />
    </div>
  );
}