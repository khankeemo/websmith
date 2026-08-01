// FILE: app/internal/api/sales/purchase/page.tsx
// PURPOSE: Internal license generation page - create licenses for customers
// ACCESS: Internal admin only
// URL: https://www.websmithdigital.com/internal/api/sales/purchase
// Supports direct links: ?productId=xxx&planId=yyy
// FIX: Added Suspense boundary for useSearchParams() to fix prerender error

'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { isValidEmail, mobileDigitsError } from '@/lib/validation';
import { FieldIndicator } from '@/components/internal-api/validation/FieldIndicator';


// Country data comes from the central internal endpoint
// (/internal/backend/country-codes → lib/data/country-codes.ts) which also
// serves the mobile digit rules used by the universal validator.

interface PurchaseCountry {
  code: string;
  country: string;
  name: string;
  dial: string;
  minDigits?: number | null;
  maxDigits?: number | null;
}

// Types
interface Plan {
  id: number;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  max_devices: number;
  features: string[];
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  is_active: boolean;
}

// Component that uses useSearchParams - wrapped in Suspense
function PurchaseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [licenseName, setLicenseName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [customerPhone, setCustomerPhone] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<PurchaseCountry[]>([]);
  const [expiryDays, setExpiryDays] = useState(365);
  const [maxDevices, setMaxDevices] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Close country dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get URL params
  const urlProductId = searchParams.get('productId');
  const urlPlanId = searchParams.get('planId');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await fetch('/internal/backend/country-codes');
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();
        const list: PurchaseCountry[] = (data.data || [])
          .map((c: any) => ({
            code: c.dial,
            country: c.code,
            name: c.name,
            dial: c.dial,
            minDigits: typeof c.min_digits === 'number' ? c.min_digits : c.minDigits ?? null,
            maxDigits: typeof c.max_digits === 'number' ? c.max_digits : c.maxDigits ?? null,
          }))
          .sort((a: PurchaseCountry, b: PurchaseCountry) => a.name.localeCompare(b.name));
        if (list.length > 0) setCountries(list);
      } catch {
        // country list unavailable - dropdown stays empty
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (urlProductId) {
      setSelectedProductId(urlProductId);
    }
  }, [urlProductId]);

  useEffect(() => {
    if (urlPlanId) {
      setSelectedPlanId(urlPlanId);
    }
  }, [urlPlanId]);

  useEffect(() => {
    if (selectedProductId) {
      fetchPlans(selectedProductId);
    } else {
      setPlans([]);
    }
  }, [selectedProductId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/internal/backend/admin/products');
      const data = await response.json();
      if (data.success) {
        setProducts(data.products.filter((p: Product) => p.is_active));
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async (productId: string) => {
    try {
      const response = await fetch(`/internal/backend/admin/products/${productId}/plans`);
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans.filter((p: Plan) => p.is_active));
      } else {
        setPlans([]);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setPlans([]);
    }
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedPlanId('');
    setError(null);
  };

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    const selectedPlan = plans.find(p => p.id.toString() === planId);
    if (selectedPlan) {
      setExpiryDays(selectedPlan.duration_days);
      setMaxDevices(selectedPlan.max_devices);
    }
    setError(null);
  };

  const validateForm = () => {
    if (!selectedProductId) {
      setError('Please select a product');
      return false;
    }
    if (!selectedPlanId) {
      setError('Please select a plan');
      return false;
    }
    if (!customerName.trim()) {
      setError('Customer name is required');
      return false;
    }
    if (!isValidEmail(customerEmail)) {
      setError('Valid customer email is required');
      return false;
    }
    if (expiryDays < 1 || expiryDays > 3650) {
      setError('Expiry days must be between 1 and 3650');
      return false;
    }
    if (maxDevices < 1 || maxDevices > 100) {
      setError('Max devices must be between 1 and 100');
      return false;
    }
    return true;
  };

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGeneratedLicense(null);
    
    const selectedPlan = plans.find(p => p.id.toString() === selectedPlanId);
    
    try {
      const response = await fetch('/internal/backend/admin/create-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerName,
          email: customerEmail,
          username: licenseName.trim() || '',
          phone: customerPhone.trim() ? `${countryCode}${customerPhone.replace(/\s/g, '')}` : '',
          product_id: selectedProductId,
          expiry_days: expiryDays,
          plan: selectedPlan?.name || 'Standard',
          max_devices: maxDevices,
          notes: notes
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGeneratedLicense(data.license_key);
        setSuccess(`License created successfully for ${customerName}`);
        // Reset form except product/plan
        setCustomerName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setLicenseName('');
        setNotes('');
        if (!urlProductId && !urlPlanId) {
          setSelectedProductId('');
          setSelectedPlanId('');
        }
      } else {
        setError(data.error || 'Failed to create license');
      }
    } catch (err) {
      console.error('Error creating license:', err);
      setError('Failed to create license. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyLicenseToClipboard = () => {
    if (generatedLicense) {
      navigator.clipboard.writeText(generatedLicense);
      setSuccess('License key copied to clipboard!');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const getSelectedPlanDetails = () => {
    const plan = plans.find(p => p.id.toString() === selectedPlanId);
    if (!plan) return null;
    return plan;
  };

  const selectedPlan = getSelectedPlanDetails();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-700 rounded w-64 mb-8"></div>
            <div className="bg-gray-800 rounded-xl p-6 space-y-4">
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-24 bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => router.push('/internal/api')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Generate License
            </h1>
          </div>
          <p className="text-gray-400">
            Create new licenses for customers. Licenses are sent via email and can be activated immediately.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-400">
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {/* Generated License Display */}
        {generatedLicense && (
          <div className="mb-6 p-5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-blue-400 mb-1">License Key Generated</p>
                <code className="text-xl font-mono text-white bg-gray-900 px-3 py-2 rounded-lg">
                  {generatedLicense}
                </code>
              </div>
              <button
                onClick={copyLicenseToClipboard}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}

        {/* Main Form */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Form */}
          <div className="md:col-span-2">
            <form onSubmit={handleGenerateLicense} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 space-y-5">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.description || 'No description'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Plan *
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={!selectedProductId}
                  required
                >
                  <option value="">Select a plan...</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price} - {plan.duration_days} days - {plan.max_devices} devices
                    </option>
                  ))}
                </select>
                {selectedProductId && plans.length === 0 && (
                  <p className="text-sm text-yellow-500 mt-1">
                    No active plans for this product. Add plans in product settings.
                  </p>
                )}
              </div>

              {/* Customer Info */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer Email *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="customer@example.com"
                    required
                  />
                  <FieldIndicator
                    state={
                      customerEmail.trim() === ''
                        ? 'empty'
                        : isValidEmail(customerEmail)
                          ? 'valid'
                          : 'invalid'
                    }
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Mobile Number <span className="text-gray-500">(optional)</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Used for SMS notifications. If provided, SMS will be sent automatically for enabled events.
                </p>
                <div className="flex gap-2">
                  <div ref={countryDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm hover:border-gray-500 transition-colors whitespace-nowrap min-w-[100px]"
                    >
                      <span className="text-gray-400">{countries.find(c => c.code === countryCode)?.country}</span>
                      <span>{countryCode}</span>
                      <svg className={`w-3 h-3 text-gray-500 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showCountryDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                        <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700">
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search country..."
                            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            autoFocus
                          />
                        </div>
                        {countries.filter(c =>
                          !countrySearch ||
                          c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                          c.code.includes(countrySearch) ||
                          c.country.toLowerCase().includes(countrySearch.toLowerCase())
                        ).map((c) => (
                          <button
                            key={c.country}
                            type="button"
                            onClick={() => { setCountryCode(c.code); setShowCountryDropdown(false); setCountrySearch(''); }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-700 transition-colors ${c.code === countryCode ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300'}`}
                          >
                            <span className="text-gray-500 w-8">{c.country}</span>
                            <span className="flex-1">{c.name}</span>
                            <span className="text-gray-500">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9\s]/g, ''))}
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="Enter mobile number"
                    />
                    <FieldIndicator
                      state={
                        customerPhone.trim() === ''
                          ? 'empty'
                          : mobileDigitsError(
                              countries.find(c => c.code === countryCode),
                              customerPhone
                            ) === ''
                            ? 'valid'
                            : 'invalid'
                      }
                    />
                  </div>
                </div>
                {customerPhone.trim() && mobileDigitsError(countries.find(c => c.code === countryCode), customerPhone) !== '' && (
                  <p className="text-xs text-yellow-500 mt-1">
                    Phone number may not match expected format for selected country
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer Username (License Key)
                </label>
                <input
                  type="text"
                  value={licenseName}
                  onChange={(e) => setLicenseName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="keemo"
                />
                <p className="text-xs text-gray-500 mt-1">Username for license. Auto-generated if empty.</p>
              </div>

              {/* License Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Expiry (days) *
                  </label>
                  <input
                    type="number"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min="1"
                    max="3650"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Default: 365 days (1 year)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Max Devices *
                  </label>
                  <input
                    type="number"
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min="1"
                    max="100"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of devices allowed</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Additional notes about this license..."
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={generating}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'Generating License...' : 'Generate License'}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar - Plan Details */}
          <div className="md:col-span-1">
            {selectedPlan ? (
              <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-5 sticky top-4">
                <h3 className="text-lg font-semibold text-white mb-3">Selected Plan</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Plan Name</p>
                    <p className="text-white font-medium">{selectedPlan.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Price</p>
                    <p className="text-2xl font-bold text-white">
                      ${selectedPlan.price}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-white">
                      {selectedPlan.duration_days >= 365 
                        ? `${Math.floor(selectedPlan.duration_days / 365)} year(s)` 
                        : `${selectedPlan.duration_days} days`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Max Devices</p>
                    <p className="text-white">{selectedPlan.max_devices} device(s)</p>
                  </div>
                  {selectedPlan.description && (
                    <div>
                      <p className="text-sm text-gray-400">Description</p>
                      <p className="text-white text-sm">{selectedPlan.description}</p>
                    </div>
                  )}
                  {selectedPlan.features && selectedPlan.features.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Features</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPlan.features.slice(0, 3).map((feature, idx) => (
                          <span key={idx} className="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded-full">
                            {feature}
                          </span>
                        ))}
                        {selectedPlan.features.length > 3 && (
                          <span className="text-xs text-gray-400">+{selectedPlan.features.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-5 text-center">
                <div className="text-4xl mb-3">💰</div>
                <p className="text-gray-400 text-sm">
                  Select a product and plan to see details here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function PurchasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-700 rounded w-64 mb-8"></div>
            <div className="bg-gray-800 rounded-xl p-6 space-y-4">
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-24 bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <PurchaseContent />
    </Suspense>
  );
}
