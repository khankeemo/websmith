'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { StoreProduct, ProductStats, PlanInfo } from '@/components/internal-api/store/types';
import { ProductCard } from '@/components/internal-api/store/ProductCard';
import { ProductModal } from '@/components/internal-api/store/ProductModal';
import { StoreSkeleton } from '@/components/internal-api/store/LoadingSkeleton';

const staggerVariants = (i: number) => ({
  animation: `fadeSlideUp 0.5s ease-out ${i * 0.07}s both`,
});

export default function ProductManagementPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [plansMap, setPlansMap] = useState<Record<string, PlanInfo[]>>({});
  const [apiKeysMap, setApiKeysMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem('api_center_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/internal/backend/admin/products', { headers });
      const data = await res.json();
      if (!data.success || !data.products) { setLoading(false); return; }

      const prods: StoreProduct[] = data.products;
      setProducts(prods);

      const pMap: Record<string, PlanInfo[]> = {};
      const kMap: Record<string, number> = {};

      await Promise.all(prods.map(async (p) => {
        try {
          const [pr, kr] = await Promise.all([
            fetch(`/internal/backend/admin/products/${p.id}/plans`, { headers }),
            fetch(`/internal/backend/admin/api-keys?product_id=${p.id}`, { headers }),
          ]);
          const pd = await pr.json();
          const kd = await kr.json();
          pMap[p.id] = pd.plans || [];
          kMap[p.id] = (kd.keys || []).filter((k: any) => k.status === 'active').length;
        } catch { /* ignore */ }
      }));

      setPlansMap(pMap);
      setApiKeysMap(kMap);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const allTypes = useMemo(() => [...new Set(products.map(p => p.product_type).filter(Boolean))], [products]);

  const filtered = useMemo(() => products.filter(p => {
    if (statusFilter === 'active' && !p.is_active) return false;
    if (statusFilter === 'inactive' && p.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q) && !(p.company_name || '').toLowerCase().includes(q)) return false;
    }
    if (typeFilter && p.product_type !== typeFilter) return false;
    return true;
  }), [products, search, typeFilter, statusFilter]);

  const getStats = (p: StoreProduct): ProductStats => {
    const plans = plansMap[p.id] || [];
    const activePlans = plans.filter(pl => pl.is_active);
    return {
      total_plans: plans.length,
      active_plans: activePlans.length,
      trial_plans: plans.filter(pl => pl.is_trial_plan && pl.is_active).length,
      sdk_support: true,
      api_support: (apiKeysMap[p.id] || 0) > 0,
      api_keys: apiKeysMap[p.id] || 0,
      has_release_notes: !!p.latest_version && p.latest_version !== p.version,
    };
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Product Management
              </span>
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">Administrator product catalog — manage, configure, and publish products</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/internal/api/products" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20">
              + Add Product
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6 p-2 rounded-2xl bg-[var(--bg-secondary)]/20 backdrop-blur-sm border border-[var(--border-color)]">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products by name, ID, or company..."
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--border-color)] rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 border border-[var(--border-color)] rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="">All Types</option>
            {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2.5 border border-[var(--border-color)] rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {loading ? (
          <StoreSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-[var(--bg-secondary)]/30 rounded-2xl border border-[var(--border-color)]">
            <div className="text-6xl mb-4 opacity-30">📦</div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No Products Found</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              {search || typeFilter || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first product to get started'}
            </p>
            {!search && !typeFilter && statusFilter === 'all' && (
              <Link href="/internal/api/products"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Create Product
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <div key={p.id} style={staggerVariants(i)}>
                <ProductCard
                  product={p}
                  stats={getStats(p)}
                  plans={plansMap[p.id] || []}
                  onOpen={setSelectedProduct}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center text-[10px] text-[var(--text-secondary)]/50">
          Showing {filtered.length} of {products.length} products
        </div>
      </div>

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
