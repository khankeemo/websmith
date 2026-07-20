'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Key, Boxes, BookOpen } from 'lucide-react';
import { StoreProduct, PlanInfo, getGradient, PLATFORM_ICONS } from './types';

interface ProductModalProps {
  product: StoreProduct | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'sdk' | 'api'>('overview');

  useEffect(() => {
    if (!product) return;
    fetch(`/internal/backend/admin/products/${product.id}/plans`)
      .then(r => r.json())
      .then(d => { if (d.plans) setPlans(d.plans); })
      .catch(() => {});
  }, [product]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!product) return null;

  const activePlans = plans.filter(p => p.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl mx-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div className={`h-48 bg-gradient-to-br ${getGradient(product.product_type)} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMjAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
          <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-lg border border-white/20">
                {product.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-white">
                <h2 className="text-2xl font-bold drop-shadow-sm">{product.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  {product.company_name && <span className="text-sm text-white/70">{product.company_name}</span>}
                  <span className="text-white/30">·</span>
                  <span className="text-sm text-white/70">{product.product_type}</span>
                  {product.is_active && (
                    <>
                      <span className="text-white/30">·</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">Active</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-white/50 text-xs">v{product.version}</span>
              {product.latest_version && product.latest_version !== product.version && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/30 text-amber-200 border border-amber-400/30">
                  Update: v{product.latest_version}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex border-b border-[var(--border-color)] px-8">
          {(['overview', 'plans', 'sdk', 'api'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all capitalize ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'overview' && '📋'} {tab === 'plans' && '💳'} {tab === 'sdk' && '📦'} {tab === 'api' && '🔌'}
              <span className="ml-1.5">{tab}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 p-8">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Description</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {product.description || 'No description provided.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Version', value: `v${product.version || '1.0.0'}` },
                    { label: 'Latest', value: `v${product.latest_version || product.version || '1.0.0'}` },
                    { label: 'Plans', value: `${activePlans.length} active` },
                    { label: 'ID', value: product.id },
                  ].map(stat => (
                    <div key={stat.label} className="p-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{stat.label}</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>
                {product.website && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Links</h3>
                    <a href={product.website} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                      {product.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'plans' && (
              <div className="space-y-4">
                {activePlans.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">💳</div>
                    <p className="text-sm text-[var(--text-secondary)]">No plans configured for this product.</p>
                  </div>
                ) : (
                  activePlans.map(plan => (
                    <div key={plan.id} className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)] hover:border-indigo-500/30 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-sm text-[var(--text-primary)]">{plan.name}</h4>
                          {plan.description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{plan.description}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-[var(--text-primary)]">${plan.price.toFixed(2)}</span>
                          {plan.duration_days > 0 && (
                            <span className="text-xs text-[var(--text-secondary)] ml-1">
                              / {plan.duration_days >= 365 ? `${plan.duration_days / 365}yr` : `${plan.duration_days}d`}
                            </span>
                          )}
                        </div>
                      </div>
                      {plan.features && plan.features.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {plan.features.map((f, i) => (
                            <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                        <span>Max {plan.max_devices} device{plan.max_devices !== 1 ? 's' : ''}</span>
                        {plan.is_trial_plan && (
                          <>
                            <span className="text-[var(--text-secondary)]/30">·</span>
                            <span className="text-purple-400">Free Trial</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'sdk' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-2">SDK Support</h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">
                    Generate client SDKs for all supported runtimes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PLATFORM_ICONS).map(([name, icon]) => (
                      <span key={name} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
                        <span>{icon}</span>
                        <span className="capitalize">{name}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <Link
                  href={`/internal/api/developers/integrations`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/20"
                >
                  📦 Generate SDK
                </Link>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-cyan-500/10 border border-cyan-500/20">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-2">API Access</h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">
                    Manage API keys and access the Universal License API.
                  </p>
                  <Link
                    href={`/internal/api/public-api/keys`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-600/20"
                  >
                    🔑 Manage API Keys
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
            <div className="sticky top-8 p-6 space-y-4">
              <div>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">Product ID</p>
                <p className="text-sm font-mono text-[var(--text-primary)] break-all">{product.id}</p>
              </div>

              <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <Boxes className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{activePlans.length} plan{activePlans.length !== 1 ? 's' : ''}</span>
                </div>
                {product.company_name && (
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                    <span>{product.company_name}</span>
                  </div>
                )}
                {product.product_type && (
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                    <span>{product.product_type}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-color)]">
                <Link
                  href={`/internal/api/products/${product.id}/settings`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Settings className="w-4 h-4" />
                  Product Settings
                </Link>
                <Link
                  href={`/internal/api/licenses/generate?product=${product.id}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Key className="w-4 h-4" />
                  Generate License
                </Link>
                {product.website && (
                  <a href={product.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl text-sm font-medium hover:bg-[var(--bg-tertiary)]/80 transition-all">
                    <BookOpen className="w-4 h-4" />
                    Documentation
                  </a>
                )}
              </div>

              <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
                <Link
                  href={`/internal/api/developers/integrations`}
                  className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  📦 Generate SDK
                </Link>
                <Link
                  href={`/internal/api/public-api/keys`}
                  className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  🔑 Generate API Key
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
