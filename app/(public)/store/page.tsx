// FILE: app/(public)/store/page.tsx
// PURPOSE: Public storefront showing all products and their plans
// ACCESS: Public (no login required)
// URL: https://www.websmithdigital.com/store

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  is_active: boolean;
  plans?: Plan[];
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Fetch active public store products
      const productsRes = await fetch('/internal/backend/store/products');
      const productsData = await productsRes.json();

      if (!productsData.success) {
        throw new Error('Failed to fetch products');
      }

      setProducts(productsData.products || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching store data:', err);
      setError('Unable to load products. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg mb-4">
              <span className="text-4xl">🛒</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Software Store
            </h1>
            <p className="text-gray-500 mt-2">Loading amazing products...</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                  <div className="p-6">
                    <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-6"></div>
                    <div className="space-y-3">
                      <div className="h-16 bg-gray-100 rounded"></div>
                      <div className="h-16 bg-gray-100 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to Load Store</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchProducts}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Products Available</h2>
          <p className="text-gray-600">
            Check back soon for amazing software products!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg mb-4">
            <span className="text-4xl">🛒</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Software Store
          </h1>
          <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
            Choose the perfect plan for your needs. All plans include full access to features and updates.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pt-8 border-t border-gray-200">
          <p className="text-gray-400 text-sm">
            Need help? Contact our{' '}
            <Link href="/support" className="text-blue-600 hover:underline">
              support team
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Product Card Component
function ProductCard({ product }: { product: Product }) {
  const [hovered, setHovered] = useState(false);

  // Get icon based on product name (simple mapping for visual variety)
  const getProductIcon = () => {
    const name = product.name.toLowerCase();
    return '📦';
    if (name.includes('windows')) return '🪟';
    if (name.includes('saas')) return '☁️';
    if (name.includes('api')) return '🔌';
    return '💻';
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ${
        hovered ? 'transform -translateY-4 shadow-2xl' : ''
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Product Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="text-4xl mb-2">{getProductIcon()}</div>
        <h2 className="text-2xl font-bold">{product.name}</h2>
        <p className="text-blue-100 text-sm mt-1">{product.description || 'Premium software solution'}</p>
        <div className="mt-2">
          <span className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs">
            v{product.version}
          </span>
        </div>
      </div>

      {/* Plans List */}
      <div className="p-6 space-y-3">
        {product.plans?.map((plan) => (
          <PlanCard key={plan.id} plan={plan} productId={product.id} />
        ))}
      </div>
    </div>
  );
}

// Plan Card Component
function PlanCard({ plan, productId }: { plan: Plan; productId: string }) {
  const [isHovered, setIsHovered] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDuration = (days: number) => {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return years === 1 ? '1 year' : `${years} years`;
    }
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return months === 1 ? '1 month' : `${months} months`;
    }
    return `${days} days`;
  };

  return (
    <div
      className={`border rounded-xl p-4 transition-all duration-200 ${
        isHovered ? 'border-blue-400 bg-blue-50/30 shadow-md' : 'border-gray-200'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-800">{plan.name}</h3>
          {plan.description && (
            <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{formatPrice(plan.price)}</div>
          <div className="text-xs text-gray-500">one-time</div>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-gray-600 mb-3">
        <span className="flex items-center gap-1">
          <span>💻</span> {plan.max_devices} device{plan.max_devices !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <span>📅</span> {formatDuration(plan.duration_days)}
        </span>
      </div>

      {plan.features && plan.features.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {plan.features.slice(0, 2).map((feature, idx) => (
              <span key={idx} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                ✓ {feature}
              </span>
            ))}
            {plan.features.length > 2 && (
              <span className="text-xs text-gray-400">+{plan.features.length - 2} more</span>
            )}
          </div>
        </div>
      )}

      <Link
        href={`/internal/api/sales/purchase?productId=${productId}&planId=${plan.id}`}
        className={`block text-center py-2.5 px-4 rounded-lg font-medium transition-all ${
          isHovered
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Buy Now →
      </Link>
    </div>
  );
}
