// FILE: app/software-store/components/store-panels.tsx
// PURPOSE: Reusable Software Store overlay panels — Cart, Wishlist, Compare
//          modal, Compare tray and the toast notification. Shared by the
//          storefront page and the product details page so there is exactly
//          one implementation of each feature.

"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Heart, X, Check, Plus, Minus, Trash2, ArrowRight,
  ShoppingBag, BookOpen, LifeBuoy, ExternalLink, Scale, Receipt,
  AlertCircle,
} from "lucide-react";
import {
  formatPrice, formatDuration, slideInRight, containerVariants,
  staggerItem, GST_RATE, useCart, useWishlist, MAX_COMPARE,
} from "../store-state";
import { StoreProduct, StoreProductPlan } from "../services/softwareStoreService";

export type ToastType = { message: string; type: "success" | "error" } | null;

export function StoreToast({ toast }: { toast: ToastType }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className="fixed top-4 right-4 z-[100]"
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20, x: 20 }}
          transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
        >
          <div
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-2xl border ${
              toast.type === "success"
                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200 shadow-emerald-500/10"
                : "bg-red-500/15 border-red-400/30 text-red-200 shadow-red-500/10"
            }`}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/10">
              {toast.type === "success" ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
            </div>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CartPanel({
  cart, onClose, onRemoveFromCart, onUpdateQty, onClearCart, onCheckout, showGst, onToggleGst,
}: {
  cart: ReturnType<typeof useCart>;
  onClose: () => void;
  onRemoveFromCart: (productId: string, planId?: number) => void;
  onUpdateQty: (productId: string, planId: number | undefined, delta: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  showGst: boolean;
  onToggleGst: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="fixed inset-0 bg-[#02040A]/70 backdrop-blur-sm" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="relative w-full max-w-lg bg-[var(--bg-secondary)]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-y-auto border-l border-white/10"
        onClick={(e) => e.stopPropagation()}
        variants={slideInRight}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/10 bg-[var(--bg-secondary)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center border border-indigo-400/20">
              <ShoppingCart className="w-4 h-4 text-indigo-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Cart ({cart.totalItems})</h2>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close cart"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center mb-5 border border-white/10">
                <ShoppingBag className="w-8 h-8 text-slate-600" />
              </div>
            </motion.div>
            <p className="text-slate-300 font-semibold text-lg">Your cart is empty</p>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs">
              Browse our software catalog and add items you'd like to purchase
            </p>
          </div>
        ) : (
          <motion.div className="p-5 space-y-3" variants={containerVariants} initial="hidden" animate="show">
            {cart.items.map((item, idx) => (
              <motion.div
                key={`${item.product.id}-${item.plan?.id || 0}-${idx}`}
                variants={staggerItem(idx)}
                className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-indigo-400/30 hover:bg-white/[0.05] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center text-lg shrink-0 border border-white/10">
                  {item.product.logo_url ? (
                    <img src={item.product.logo_url} alt={item.product.name} className="w-8 h-8 rounded-lg object-contain" />
                  ) : (
                    <span className="font-bold text-white">{item.product.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white truncate">{item.product.name}</h4>
                    {item.product.version && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-400 font-medium border border-white/10 shrink-0">
                        v{item.product.version}
                      </span>
                    )}
                  </div>
                  {item.plan && <p className="text-xs text-slate-400">{item.plan.name}</p>}
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatPrice(item.plan?.price || item.product.price || 0)} each
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateQty(item.product.id, item.plan?.id, -1)}
                      aria-label={`Decrease quantity of ${item.product.name}`}
                      className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors hover:border-indigo-400/40"
                    >
                      <Minus className="w-3 h-3 text-slate-400" />
                    </motion.button>
                    <span className="text-sm font-bold text-white w-6 text-center">{item.quantity}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateQty(item.product.id, item.plan?.id, 1)}
                      aria-label={`Increase quantity of ${item.product.name}`}
                      className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors hover:border-indigo-400/40"
                    >
                      <Plus className="w-3 h-3 text-slate-400" />
                    </motion.button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-white">
                    {formatPrice((item.plan?.price || item.product.price || 0) * item.quantity)}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onRemoveFromCart(item.product.id, item.plan?.id)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
                    aria-label={`Remove ${item.product.name} from cart`}
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </motion.button>
                </div>
              </motion.div>
            ))}

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-indigo-500/15 to-violet-500/10">
                <Receipt className="w-4 h-4 text-indigo-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Order Summary</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Subtotal</span>
                  <span className="font-semibold text-white">{formatPrice(cart.totalPrice)}</span>
                </div>
                <label className="flex items-center justify-between text-sm cursor-pointer select-none">
                  <span className="text-slate-400">GST ({Math.round(GST_RATE * 100)}%)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {showGst ? `+${formatPrice(cart.totalPrice * GST_RATE)}` : "-"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showGst}
                      aria-label="Toggle GST"
                      onClick={onToggleGst}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                        showGst ? "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" : "bg-white/15"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                          showGst ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </label>
                <div className="flex justify-between items-center pt-3 border-t border-white/10">
                  <span className="text-sm font-bold text-white">Total</span>
                  <span className="text-lg font-extrabold bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
                    {formatPrice(cart.totalPrice + (showGst ? cart.totalPrice * GST_RATE : 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCheckout}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-[0_10px_32px_-8px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all duration-300"
              >
                <ArrowRight className="w-4 h-4" />
                Proceed to Checkout
              </motion.button>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClearCart}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-400/30 text-rose-300 text-xs font-medium hover:bg-rose-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 text-xs font-medium hover:bg-white/5 transition-all"
                >
                  Continue Shopping
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function WishlistPanel({
  wishlist, cart, onClose, onAddToCart, onRemoveFromWishlist,
}: {
  wishlist: ReturnType<typeof useWishlist>;
  cart: ReturnType<typeof useCart>;
  onClose: () => void;
  onAddToCart: (product: StoreProduct, plan?: StoreProductPlan) => void;
  onRemoveFromWishlist: (productId: string, planId?: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="fixed inset-0 bg-[#02040A]/70 backdrop-blur-sm" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Wishlist"
        className="relative w-full max-w-lg bg-[var(--bg-secondary)]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-y-auto border-l border-white/10"
        onClick={(e) => e.stopPropagation()}
        variants={slideInRight}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/10 bg-[var(--bg-secondary)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/25 to-pink-500/25 flex items-center justify-center border border-rose-400/20">
              <Heart className="w-4 h-4 text-rose-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Wishlist ({wishlist.items.length})</h2>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close wishlist"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        {wishlist.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500/10 to-pink-500/10 flex items-center justify-center mb-5 border border-white/10">
                <Heart className="w-8 h-8 text-slate-600" />
              </div>
            </motion.div>
            <p className="text-slate-300 font-semibold text-lg">Your wishlist is empty</p>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs">
              Save products you're interested in and come back to them later
            </p>
          </div>
        ) : (
          <motion.div className="p-5 space-y-3" variants={containerVariants} initial="hidden" animate="show">
            {wishlist.items.map((item, idx) => (
              <motion.div
                key={`wl-${item.product.id}-${item.plan?.id || 0}-${idx}`}
                variants={staggerItem(idx)}
                className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-rose-400/30 hover:bg-white/[0.05] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/25 to-pink-500/25 flex items-center justify-center text-lg shrink-0 border border-white/10">
                  {item.product.logo_url ? (
                    <img src={item.product.logo_url} alt={item.product.name} className="w-8 h-8 rounded-lg object-contain" />
                  ) : (
                    <span className="font-bold text-white">{item.product.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white truncate">{item.product.name}</h4>
                    {item.product.version && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-400 font-medium border border-white/10 shrink-0">
                        v{item.product.version}
                      </span>
                    )}
                  </div>
                  {item.plan && <p className="text-xs text-slate-400">{item.plan.name}</p>}
                  {item.plan && <p className="text-xs font-semibold text-white mt-0.5">{formatPrice(item.plan.price)}</p>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onAddToCart(item.product, item.plan);
                      onRemoveFromWishlist(item.product.id, item.plan?.id);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-[0_6px_20px_-6px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all"
                  >
                    <ShoppingCart className="w-3 h-3" /> Move to Cart
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onRemoveFromWishlist(item.product.id, item.plan?.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/30 text-rose-300 text-xs font-medium hover:bg-rose-500/10 transition-all"
                  >
                    <X className="w-3 h-3" /> Remove
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function CompareModal({
  products, onClose, onRemove,
}: {
  products: StoreProduct[];
  onClose: () => void;
  onRemove: (productId: string) => void;
}) {
  const activePlans = (p: StoreProduct) => p.plans?.filter((pl) => pl.is_active) || [];
  const cheapest = (p: StoreProduct) => {
    const plans = activePlans(p);
    return plans.length > 0 ? Math.min(...plans.map((pl) => pl.price)) : null;
  };
  const allFeatures = Array.from(
    new Set(products.flatMap((p) => activePlans(p).flatMap((pl) => pl.features || [])))
  );
  const hasFeature = (p: StoreProduct, f: string) => activePlans(p).some((pl) => (pl.features || []).includes(f));

  const row = (label: string, value: (p: StoreProduct) => React.ReactNode) => (
    <tr className="border-b border-white/10">
      <td className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap w-32 align-top">
        {label}
      </td>
      {products.map((p) => (
        <td key={p.id} className="px-4 py-3 text-xs text-white align-top min-w-[160px]">
          {value(p)}
        </td>
      ))}
    </tr>
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="fixed inset-0 bg-[#02040A]/80 backdrop-blur-md" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Compare products"
        className="relative w-full max-w-6xl bg-[var(--bg-secondary)]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 28 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center border border-indigo-400/20">
              <Scale className="w-4 h-4 text-indigo-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Compare Products ({products.length})</h2>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close compare"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-4 text-left text-[10px] uppercase tracking-wider text-slate-500 w-32" />
                {products.map((p) => (
                  <th key={p.id} className="px-4 py-4 text-left min-w-[180px] align-top">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center text-lg shrink-0 border border-white/10">
                          {p.logo_url ? (
                            <img src={p.logo_url} alt={p.name} className="w-7 h-7 rounded-lg object-contain" />
                          ) : (
                            <span className="font-bold text-white">{p.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate max-w-[130px]">{p.name}</p>
                          {p.company_name && (
                            <p className="text-[11px] text-slate-500 truncate max-w-[130px]">{p.company_name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(p.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {row("Category", (p) => p.product_type || <span className="text-[var(--text-muted)]">-</span>)}
              {row("Platform", (p) => p.platform || <span className="text-[var(--text-muted)]">-</span>)}
              {row("Version", (p) => p.version || <span className="text-[var(--text-muted)]">-</span>)}
              {row("Description", (p) => (
                <span className="line-clamp-4 text-[var(--text-secondary)]">
                  {p.short_description || p.description || "-"}
                </span>
              ))}
              {row("Starting Price", (p) => {
                const c = cheapest(p);
                return c === null ? (
                  <span className="text-[var(--text-muted)]">-</span>
                ) : c === 0 ? (
                  <span className="font-bold text-emerald-400">Free</span>
                ) : (
                  <span className="font-bold text-[var(--text-primary)]">{formatPrice(c)}</span>
                );
              })}
              {row("Plans", (p) => {
                const plans = activePlans(p);
                if (plans.length === 0) return <span className="text-[var(--text-muted)]">-</span>;
                return (
                  <span className="space-y-1 block">
                    {plans.map((pl) => (
                      <span key={pl.id} className="flex flex-col">
                        <span className="text-[var(--text-primary)]">
                          {pl.name}
                          {pl.is_trial_plan && <span className="ml-1 text-[10px] text-emerald-400">(Trial)</span>}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {pl.price === 0 ? "Free" : formatPrice(pl.price)}
                          {pl.price > 0 && pl.duration_days > 0 ? ` / ${formatDuration(pl.duration_days)}` : ""} ·{" "}
                          {pl.max_devices} device{pl.max_devices !== 1 ? "s" : ""}
                        </span>
                      </span>
                    ))}
                  </span>
                );
              })}
              {row("Free Trial", (p) =>
                activePlans(p).some((pl) => pl.is_trial_plan) ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Yes
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">No</span>
                )
              )}
              {allFeatures.length > 0 &&
                row("Features", (p) => (
                  <span className="space-y-1 block">
                    {allFeatures.map((f) => (
                      <span
                        key={f}
                        className={`flex items-center gap-1.5 text-[11px] ${
                          hasFeature(p, f) ? "text-emerald-400" : "text-[var(--text-muted)] opacity-50"
                        }`}
                      >
                        {hasFeature(p, f) ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{f}</span>
                      </span>
                    ))}
                  </span>
                ))}
              {row("Resources", (p) => (
                <span className="flex flex-col gap-1">
                  {p.docs_url && (
                    <a href={p.docs_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Docs
                    </a>
                  )}
                  {p.support_url && (
                    <a href={p.support_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                      <LifeBuoy className="w-3 h-3" /> Support
                    </a>
                  )}
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Website
                    </a>
                  )}
                  {!p.docs_url && !p.support_url && !p.website && <span className="text-[var(--text-muted)]">-</span>}
                </span>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CompareTray({
  items, onRemove, onClear, onOpen,
}: {
  items: StoreProduct[];
  onRemove: (productId: string) => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring" as const, stiffness: 300, damping: 26 }}
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#0B1220]/95 backdrop-blur-2xl border border-indigo-400/30 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 pl-1.5 pr-1">
              <Scale className="w-3.5 h-3.5" /> {items.length}/{MAX_COMPARE}
            </span>
            {items.map((p) => (
              <div key={p.id} className="relative group">
                <div
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center text-sm border border-white/10 cursor-pointer"
                  title={p.name}
                >
                  {p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} className="w-6 h-6 rounded-lg object-contain" />
                  ) : (
                    <span className="font-bold text-white">{p.name.charAt(0)}</span>
                  )}
                </div>
                <button
                  onClick={() => onRemove(p.id)}
                  aria-label={`Remove ${p.name} from compare`}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(244,63,94,0.6)]"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpen}
              disabled={items.length < 2}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed ml-1"
            >
              Compare {items.length >= 2 ? `(${items.length})` : "(min 2)"}
            </motion.button>
            <button
              onClick={onClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Clear compare"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


