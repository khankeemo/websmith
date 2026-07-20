'use client';

import { useState } from 'react';
import { Settings, Archive } from 'lucide-react';
import { StoreProduct, ProductStats, PlanInfo, getGradient, PLATFORM_ICONS } from './types';

interface ProductCardProps {
  product: StoreProduct;
  stats: ProductStats | undefined;
  plans: PlanInfo[];
  onOpen: (product: StoreProduct) => void;
}

export function ProductCard({ product: p, stats: s, plans, onOpen }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const activePlans = plans.filter(pl => pl.is_active);

  return (
    <div
      onClick={() => onOpen(p)}
      className="group relative bg-[var(--bg-secondary)]/40 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl overflow-hidden 
        hover:border-indigo-500/40 hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] 
        transition-all duration-500 cursor-pointer"
    >
      <div className={`h-32 bg-gradient-to-br ${getGradient(p.product_type)} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMjAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)]/60 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg shadow-lg border border-white/20">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-white">
              <h3 className="font-bold text-sm leading-tight drop-shadow-sm">{p.name}</h3>
              {p.company_name && (
                <p className="text-[10px] text-white/70">{p.company_name}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {p.is_active ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 backdrop-blur-sm">
                ● Active
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-red-500/30 text-red-200 border border-red-400/30 backdrop-blur-sm">
                ● Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            v{p.version || '1.0.0'}
          </span>
          {p.product_type && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
              {p.product_type}
            </span>
          )}
          {p.latest_version && p.latest_version !== p.version && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Update: v{p.latest_version}
            </span>
          )}
        </div>

        {p.description && (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">
            {p.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {activePlans.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {activePlans.length} Plan{activePlans.length !== 1 ? 's' : ''}
            </span>
          )}
          {s?.trial_plans && s.trial_plans > 0 ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">
              🎯 Trial
            </span>
          ) : null}
          {s?.sdk_support ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              📦 SDK
            </span>
          ) : null}
          {s?.api_support ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
              🔌 API
            </span>
          ) : null}
          {p.website && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/20">
              📄 Docs
            </span>
          )}
          {s?.has_release_notes ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20">
              📋 Release Notes
            </span>
          ) : null}
        </div>

        {activePlans.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">
              {activePlans.length} plan{activePlans.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[var(--text-secondary)]/50">·</span>
            <span>Up to {Math.max(...activePlans.map(pl => pl.max_devices))} devices</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
          <span className="text-xs text-[var(--text-secondary)]">
            {p.product_type || 'Product'}
          </span>
          <div className="flex items-center gap-1.5">
            <a
              href={`/internal/api/products/${p.id}/settings`}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
              title="Product Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(p); }}
              className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all duration-300 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40"
            >
              Manage
            </button>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.15)' }}
      />
    </div>
  );
}
