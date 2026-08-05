"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, Heart, X, Check, Clock, ChevronRight,
  Plus, Minus, Trash2, ArrowRight, Star, LayoutGrid, List,
  BookOpen, LifeBuoy, ExternalLink, Filter, ArrowLeft, ShieldCheck,
  Sparkles, Tag, Monitor, Layers, Package, Loader2, AlertCircle,
  ShoppingBag, RefreshCw, Scale, History as HistoryIcon,
  Receipt, BadgeCheck, CreditCard
} from "lucide-react";
import { getPublicProducts, StoreProduct, StoreProductPlan } from "./services/softwareStoreService";
import { getSoftwareStoreVisibility } from "@/core/services/publicSettingsService";

const STORAGE_CART_KEY = "software_store_cart";
const STORAGE_WISHLIST_KEY = "software_store_wishlist";
const STORAGE_COMPARE_KEY = "software_store_compare";
const STORAGE_HISTORY_EMAIL_KEY = "software_store_history_email";
const MAX_COMPARE = 4;

// Scoped premium dark theme — CSS variables are redefined only inside the
// software store subtree, so the rest of the site is untouched.
const STORE_DARK_STYLE = {
  "--bg-primary": "#070B14",
  "--bg-secondary": "#0B1220",
  "--bg-tertiary": "#111827",
  "--text-primary": "#F1F5F9",
  "--text-secondary": "#94A3B8",
  "--text-muted": "#64748B",
  "--border-color": "rgba(148, 163, 184, 0.16)",
  "--card-shadow": "0 20px 60px -15px rgba(0, 0, 0, 0.6)",
  colorScheme: "dark",
} as React.CSSProperties;

interface CartItem {
  product: StoreProduct;
  plan?: StoreProductPlan;
  quantity: number;
  addedAt: string;
}

interface WishlistItem {
  product: StoreProduct;
  plan?: StoreProductPlan;
  addedAt: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 24 }
  }
};

const slideInRight = {
  hidden: { x: "100%" },
  show: {
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 }
  },
  exit: {
    x: "100%",
    transition: { type: "spring" as const, stiffness: 300, damping: 30 }
  }
};

const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }
};

function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CART_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const persist = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
    localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(newItems));
  }, []);

  const addItem = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id && (!plan || i.plan?.id === plan.id));
      if (existing) {
        const updated = prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
        localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
        return updated;
      }
      const updated = [...prev, { product, plan, quantity: 1, addedAt: new Date().toISOString() }];
      localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeItem = useCallback((productId: string, planId?: number) => {
    setItems(prev => {
      const updated = prev.filter(i => !(i.product.id === productId && (!planId || i.plan?.id === planId)));
      localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, planId: number | undefined, delta: number) => {
    setItems(prev => {
      const updated = prev.map(i => {
        if (i.product.id === productId && (!planId || i.plan?.id === planId)) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      });
      localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_CART_KEY);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + (i.plan?.price || i.product.price || 0) * i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice };
}

function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_WISHLIST_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const addItem = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    setItems(prev => {
      const exists = prev.some(i => i.product.id === product.id && (!plan || i.plan?.id === plan.id));
      if (exists) return prev;
      const updated = [...prev, { product, plan, addedAt: new Date().toISOString() }];
      localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeItem = useCallback((productId: string, planId?: number) => {
    setItems(prev => {
      const updated = prev.filter(i => !(i.product.id === productId && (!planId || i.plan?.id === planId)));
      localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isInWishlist = useCallback((productId: string, planId?: number) => {
    return items.some(i => i.product.id === productId && (!planId || i.plan?.id === planId));
  }, [items]);

  return { items, addItem, removeItem, isInWishlist };
}

function useCompare() {
  const [items, setItems] = useState<StoreProduct[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_COMPARE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const toggle = useCallback((product: StoreProduct) => {
    setItems(prev => {
      const exists = prev.some(p => p.id === product.id);
      const next = exists ? prev.filter(p => p.id !== product.id) : [...prev, product].slice(-MAX_COMPARE);
      localStorage.setItem(STORAGE_COMPARE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems(prev => {
      const next = prev.filter(p => p.id !== productId);
      localStorage.setItem(STORAGE_COMPARE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_COMPARE_KEY);
  }, []);

  const isInCompare = useCallback((productId: string) => {
    return items.some(p => p.id === productId);
  }, [items]);

  return { items, toggle, remove, clear, isInCompare };
}

const GST_RATE = 0.18;

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

const formatDuration = (days: number) => {
  if (days >= 365) {
    const y = Math.floor(days / 365);
    return y === 1 ? "1 year" : `${y} years`;
  }
  if (days >= 30) {
    const m = Math.floor(days / 30);
    return m === 1 ? "1 month" : `${m} months`;
  }
  return `${days} days`;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return null; }
};

const staggerItem = (i: number) => ({
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, type: "spring" as const, stiffness: 260, damping: 24 }
  }
});

function Shimmer() {
  return (
    <motion.div
      className="absolute inset-0"
      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), rgba(99,102,241,0.08), transparent)" }}
      animate={{ x: ["-100%", "100%"] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl animate-pulse shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="relative h-40 bg-white/[0.04] overflow-hidden">
        <Shimmer />
      </div>
      <div className="relative p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
            <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-white/[0.06]" />
        <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-white/[0.06]" />
          <div className="h-5 w-14 rounded-full bg-white/[0.06]" />
        </div>
        <div className="h-10 rounded-xl bg-white/[0.06]" />
      </div>
    </div>
  );
}

function CartPanel({ cart, onClose, onRemoveFromCart, onUpdateQty, onClearCart, onCheckout, showGst, onToggleGst }: {
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="fixed inset-0 bg-[#02040A]/70 backdrop-blur-sm" />
      <motion.div role="dialog" aria-modal="true" aria-label="Shopping cart"
        className="relative w-full max-w-lg bg-[var(--bg-secondary)]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-y-auto border-l border-white/10"
        onClick={e => e.stopPropagation()}
        variants={slideInRight} initial="hidden" animate="show" exit="exit">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/10 bg-[var(--bg-secondary)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center border border-indigo-400/20">
              <ShoppingCart className="w-4 h-4 text-indigo-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Cart ({cart.totalItems})</h2>
          </div>
          <motion.button onClick={onClose} aria-label="Close cart"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <X className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center mb-5 border border-white/10">
                <ShoppingBag className="w-8 h-8 text-slate-600" />
              </div>
            </motion.div>
            <p className="text-slate-300 font-semibold text-lg">Your cart is empty</p>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs">Browse our software catalog and add items you'd like to purchase</p>
          </div>
        ) : (
          <motion.div className="p-5 space-y-3"
            variants={containerVariants} initial="hidden" animate="show">
            {cart.items.map((item, idx) => (
              <motion.div key={`${item.product.id}-${item.plan?.id || 0}-${idx}`}
                variants={staggerItem(idx)}
                className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-indigo-400/30 hover:bg-white/[0.05] transition-all">
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-400 font-medium border border-white/10 shrink-0">v{item.product.version}</span>
                    )}
                  </div>
                  {item.plan && <p className="text-xs text-slate-400">{item.plan.name}</p>}
                  <p className="text-[11px] text-slate-500 mt-0.5">{formatPrice(item.plan?.price || item.product.price || 0)} each</p>
                  <div className="flex items-center gap-2 mt-2">
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateQty(item.product.id, item.plan?.id, -1)}
                      aria-label={`Decrease quantity of ${item.product.name}`}
                      className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors hover:border-indigo-400/40">
                      <Minus className="w-3 h-3 text-slate-400" />
                    </motion.button>
                    <span className="text-sm font-bold text-white w-6 text-center">{item.quantity}</span>
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateQty(item.product.id, item.plan?.id, 1)}
                      aria-label={`Increase quantity of ${item.product.name}`}
                      className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors hover:border-indigo-400/40">
                      <Plus className="w-3 h-3 text-slate-400" />
                    </motion.button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-white">
                    {formatPrice((item.plan?.price || item.product.price || 0) * item.quantity)}
                  </p>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => onRemoveFromCart(item.product.id, item.plan?.id)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
                    aria-label={`Remove ${item.product.name} from cart`}>
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
                  <span className="text-slate-400">
                    GST ({Math.round(GST_RATE * 100)}%)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {showGst ? `+${formatPrice(cart.totalPrice * GST_RATE)}` : '-'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showGst}
                      aria-label="Toggle GST"
                      onClick={onToggleGst}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${showGst ? "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" : "bg-white/15"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transform transition-transform ${showGst ? "translate-x-4" : "translate-x-0"}`} />
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
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={onCheckout}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-[0_10px_32px_-8px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all duration-300">
                <ArrowRight className="w-4 h-4" />
                Proceed to Checkout
              </motion.button>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={onClearCart}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-400/30 text-rose-300 text-xs font-medium hover:bg-rose-500/10 transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 text-xs font-medium hover:bg-white/5 transition-all">
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

function WishlistPanel({ wishlist, cart, onClose, onAddToCart, onRemoveFromWishlist }: {
  wishlist: ReturnType<typeof useWishlist>;
  cart: ReturnType<typeof useCart>;
  onClose: () => void;
  onAddToCart: (product: StoreProduct, plan?: StoreProductPlan) => void;
  onRemoveFromWishlist: (productId: string, planId?: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="fixed inset-0 bg-[#02040A]/70 backdrop-blur-sm" />
      <motion.div role="dialog" aria-modal="true" aria-label="Wishlist"
        className="relative w-full max-w-lg bg-[var(--bg-secondary)]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-y-auto border-l border-white/10"
        onClick={e => e.stopPropagation()}
        variants={slideInRight} initial="hidden" animate="show" exit="exit">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/10 bg-[var(--bg-secondary)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/25 to-pink-500/25 flex items-center justify-center border border-rose-400/20">
              <Heart className="w-4 h-4 text-rose-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Wishlist ({wishlist.items.length})</h2>
          </div>
          <motion.button onClick={onClose} aria-label="Close wishlist"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <X className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        {wishlist.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500/10 to-pink-500/10 flex items-center justify-center mb-5 border border-white/10">
                <Heart className="w-8 h-8 text-slate-600" />
              </div>
            </motion.div>
            <p className="text-slate-300 font-semibold text-lg">Your wishlist is empty</p>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs">Save products you're interested in and come back to them later</p>
          </div>
        ) : (
          <motion.div className="p-5 space-y-3"
            variants={containerVariants} initial="hidden" animate="show">
            {wishlist.items.map((item, idx) => (
              <motion.div key={`wl-${item.product.id}-${item.plan?.id || 0}-${idx}`}
                variants={staggerItem(idx)}
                className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-rose-400/30 hover:bg-white/[0.05] transition-all">
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-400 font-medium border border-white/10 shrink-0">v{item.product.version}</span>
                    )}
                  </div>
                  {item.plan && <p className="text-xs text-slate-400">{item.plan.name}</p>}
                  {item.plan && (
                    <p className="text-xs font-semibold text-white mt-0.5">{formatPrice(item.plan.price)}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => { onAddToCart(item.product, item.plan); onRemoveFromWishlist(item.product.id, item.plan?.id); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-[0_6px_20px_-6px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all">
                    <ShoppingCart className="w-3 h-3" /> Move to Cart
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => onRemoveFromWishlist(item.product.id, item.plan?.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/30 text-rose-300 text-xs font-medium hover:bg-rose-500/10 transition-all">
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

function ProductDetailModal({ product, plans, cart, wishlist, onClose, onAddToCart, onAddToWishlist, onRemoveFromWishlist, onProceedToCheckout, inCompare, onToggleCompare }: {
  product: StoreProduct;
  plans: StoreProductPlan[];
  cart: ReturnType<typeof useCart>;
  wishlist: ReturnType<typeof useWishlist>;
  onClose: () => void;
  onAddToCart: (product: StoreProduct, plan?: StoreProductPlan) => void;
  onAddToWishlist: (product: StoreProduct, plan?: StoreProductPlan) => void;
  onRemoveFromWishlist: (productId: string, planId?: number) => void;
  onProceedToCheckout: (product: StoreProduct, plan?: StoreProductPlan) => void;
  inCompare: boolean;
  onToggleCompare: (product: StoreProduct) => void;
}) {
  const activePlans = plans.filter(p => p.is_active);
  const hasTrial = activePlans.some(p => p.is_trial_plan);
  const cheapestPrice = activePlans.length > 0 ? Math.min(...activePlans.map(p => p.price)) : 0;
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);

  const selectedPlan = selectedPlanIndex !== null ? activePlans[selectedPlanIndex] : undefined;
  const inWishlist = wishlist.isInWishlist(product.id, selectedPlan?.id);
  const inCart = cart.items.some(i => i.product.id === product.id);
  const featuresList = selectedPlan?.features || [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-3 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      onClick={onClose}>
      <div className="fixed inset-0 bg-[#02040A]/80 backdrop-blur-md" />
      <motion.div role="dialog" aria-modal="true" aria-label={product.name}
        className="relative w-full max-w-6xl my-auto bg-[#0B1220]/90 backdrop-blur-2xl rounded-[28px] border border-white/10 overflow-hidden shadow-[0_0_0_1px_rgba(99,102,241,0.08),0_60px_140px_-30px_rgba(0,0,0,0.9)]"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 24 }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 28 }}>

        {/* top actions — Back to Store closes the popup */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <button onClick={onClose}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#070B14]/70 backdrop-blur-md border border-white/10 text-slate-200 text-xs font-semibold hover:border-indigo-400/40 hover:text-white hover:bg-[#070B14]/90 active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Store
          </button>
          <button onClick={onClose} aria-label="Close product details"
            className="pointer-events-auto w-9 h-9 rounded-full bg-[#070B14]/70 backdrop-blur-md border border-white/10 text-slate-300 flex items-center justify-center hover:border-indigo-400/40 hover:text-white hover:rotate-90 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* hero */}
        <div className="relative h-64 md:h-72 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,0.45),transparent_55%),radial-gradient(ellipse_at_80%_20%,rgba(139,92,246,0.3),transparent_50%),radial-gradient(ellipse_at_60%_100%,rgba(34,211,238,0.15),transparent_55%)]" />
          <div className="absolute inset-0 opacity-40"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/70 to-transparent" />
          <div className="absolute top-[72px] left-6 md:left-8 right-6 flex items-start gap-5 z-10">
            <motion.div className="relative w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-[#0B1220]/80 backdrop-blur-md flex items-center justify-center text-4xl border border-white/15 shadow-[0_20px_60px_-15px_rgba(99,102,241,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] shrink-0"
              initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring" as const, stiffness: 260, damping: 20, delay: 0.1 }}>
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-cyan-400/20" />
              <span className="relative font-bold text-white">
                {product.logo_url ? (
                  <img src={product.logo_url} alt={product.name} className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-contain" />
                ) : (
                  product.name.charAt(0).toUpperCase()
                )}
              </span>
            </motion.div>
            <div className="min-w-0 pt-1 text-white">
              <motion.h2 className="text-2xl md:text-4xl font-extrabold drop-shadow-lg truncate"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                {product.name}
              </motion.h2>
              <motion.div className="flex flex-wrap items-center gap-2 mt-2 text-sm"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {product.company_name && <span className="text-slate-300">{product.company_name}</span>}
                <span className="text-slate-500">·</span>
                <span className="text-slate-300">v{product.version || '1.0.0'}</span>
                {product.product_type && (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 text-[10px] font-semibold border border-white/15">{product.product_type}</span>
                )}
                {product.platform && (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/15 text-cyan-200 text-[10px] font-semibold border border-cyan-400/25">{product.platform}</span>
                )}
                {product.featured && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-200 text-[10px] font-bold border border-amber-400/25">
                    <Star className="w-2.5 h-2.5 fill-current" /> Featured
                  </span>
                )}
                {hasTrial && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-200 text-[10px] font-semibold border border-emerald-400/25">Free Trial</span>
                )}
              </motion.div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 p-6 md:p-8 space-y-8 min-w-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-2">
                <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                Overview
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{product.description || 'No description available.'}</p>
              {product.short_description && (
                <p className="text-sm text-slate-400 mt-3 italic border-l-2 border-indigo-400/40 pl-4">{product.short_description}</p>
              )}
            </motion.div>

            {activePlans.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                  <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                  Pricing Plans
                </h3>
                <div className="grid gap-3" role="radiogroup" aria-label="Pricing plans">
                  {activePlans.map((plan, index) => {
                    const selected = selectedPlanIndex === index;
                    return (
                      <motion.div
                        key={plan.id}
                        onClick={() => setSelectedPlanIndex(index)}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPlanIndex(index); } }}
                        whileHover={{ scale: 1.012, y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        className={`relative flex items-center justify-between gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                          selected
                            ? 'border-indigo-400/60 bg-indigo-500/[0.08] shadow-[0_0_0_1px_rgba(129,140,248,0.35),0_0_40px_-8px_rgba(99,102,241,0.5)]'
                            : 'border-white/10 bg-white/[0.03] hover:border-indigo-400/30 hover:bg-white/[0.05]'
                        }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${
                              selected ? 'border-indigo-400 bg-indigo-500/25' : 'border-white/15'
                            }`}>
                              {selected && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 400, damping: 16 }}>
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </motion.div>
                              )}
                            </div>
                            <h4 className="font-bold text-sm text-white">{plan.name}</h4>
                            {plan.is_trial_plan && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">Trial</span>
                            )}
                          </div>
                          {plan.description && <p className="text-xs text-slate-400 mb-2 ml-8">{plan.description}</p>}
                          <div className="flex items-center gap-3 text-xs text-slate-400 ml-8">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(plan.duration_days)}</span>
                            <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />{plan.max_devices} device{plan.max_devices !== 1 ? 's' : ''}</span>
                          </div>
                          {plan.features && plan.features.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                              {plan.features.slice(0, 4).map((f, i) => (
                                <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                  <Check className="w-2.5 h-2.5" />{f}
                                </span>
                              ))}
                              {plan.features.length > 4 && (
                                <span className="text-[10px] text-slate-500">+{plan.features.length - 4} more</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-extrabold text-white">{plan.price === 0 ? 'Free' : formatPrice(plan.price)}</div>
                          {plan.price > 0 && plan.duration_days > 0 && (
                            <div className="text-[11px] text-slate-500">per {formatDuration(plan.duration_days)}</div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {(product.docs_url || product.support_url || product.website) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-3">
                  <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                  Resources
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.docs_url && (
                    <a href={product.docs_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-300 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all">
                      <BookOpen className="w-4 h-4" /> Documentation
                    </a>
                  )}
                  {product.support_url && (
                    <a href={product.support_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-300 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all">
                      <LifeBuoy className="w-4 h-4" /> Support
                    </a>
                  )}
                  {product.website && (
                    <a href={product.website} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-300 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all">
                      <ExternalLink className="w-4 h-4" /> Website
                    </a>
                  )}
                </div>
              </motion.div>
            )}

            {featuresList.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-3">
                  <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                  Features
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {featuresList.map((f, i) => (
                    <motion.div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm text-slate-300"
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
                      <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                      {f}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* floating action panel */}
          <div className="lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-white/[0.02]">
            <div className="sticky top-8 p-6 space-y-4">
              {selectedPlan ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{selectedPlan.name}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-extrabold text-white">{selectedPlan.price === 0 ? 'Free' : formatPrice(selectedPlan.price)}</p>
                    {selectedPlan.price > 0 && selectedPlan.duration_days > 0 && (
                      <span className="text-sm text-slate-400">/ {formatDuration(selectedPlan.duration_days)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
                    <Monitor className="w-3.5 h-3.5" /> {selectedPlan.max_devices} device{selectedPlan.max_devices !== 1 ? 's' : ''}
                  </div>
                </motion.div>
              ) : cheapestPrice > 0 ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Starting from</p>
                  <p className="text-4xl font-extrabold text-white">{formatPrice(cheapestPrice)}</p>
                </motion.div>
              ) : (
                <p className="text-xs text-slate-500">Select a plan above to see pricing</p>
              )}

              <div className="flex flex-col gap-2.5 pt-2 border-t border-white/10">
                <motion.button whileTap={{ scale: 0.98 }}
                  onClick={() => { onAddToCart(product, selectedPlan); }}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-[0_12px_36px_-10px_rgba(99,102,241,0.7)] hover:brightness-110 active:brightness-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60">
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </motion.button>

                <motion.button whileTap={{ scale: 0.98 }}
                  onClick={() => { onProceedToCheckout(product, selectedPlan); }}
                  className={`flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                    inCart
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_12px_36px_-10px_rgba(52,211,153,0.6)] hover:brightness-110"
                      : "border border-white/15 bg-white/[0.04] text-slate-200 hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-white"
                  }`}>
                  <ArrowRight className="w-4 h-4" />
                  Proceed to Checkout
                </motion.button>
                {inCart && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className="text-[11px] text-emerald-300 text-center">
                    <Check className="w-3 h-3 inline mr-1" />Added to cart — ready to checkout
                  </motion.p>
                )}

                {inWishlist ? (
                  <motion.button whileTap={{ scale: 0.98 }}
                    onClick={() => { onRemoveFromWishlist(product.id, selectedPlan?.id); }}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-2xl border border-rose-400/30 text-rose-300 text-sm font-bold hover:bg-rose-500/10 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50">
                    <Heart className="w-4 h-4 fill-current" />
                    Remove from Wishlist
                  </motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.98 }}
                    onClick={() => { onAddToWishlist(product, selectedPlan); }}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 text-sm font-bold hover:border-rose-400/40 hover:text-rose-300 hover:bg-rose-500/5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50">
                    <Heart className="w-4 h-4" />
                    Add to Wishlist
                  </motion.button>
                )}
                <motion.button whileTap={{ scale: 0.98 }}
                  onClick={() => onToggleCompare(product)}
                  className={`flex items-center justify-center gap-2 w-full px-5 py-3 rounded-2xl border text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                    inCompare
                      ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-300 shadow-[0_0_24px_-8px_rgba(99,102,241,0.5)]"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] hover:border-indigo-400/40 hover:text-indigo-300"
                  }`}>
                  <Scale className="w-3.5 h-3.5" />
                  {inCompare ? "Remove from Compare" : "Add to Compare"}
                </motion.button>
              </div>

              {activePlans.length > 0 && (
                <div className="space-y-2 text-xs text-slate-400 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" />{activePlans.length} plan{activePlans.length !== 1 ? 's' : ''} available</div>
                  <div className="flex items-center gap-2"><Monitor className="w-3.5 h-3.5 text-emerald-400" />Up to {Math.max(...activePlans.map(p => p.max_devices))} devices</div>
                  {hasTrial && <div className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-emerald-400" />Free trial available</div>}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Instant license delivery&nbsp;·&nbsp;Secure checkout
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompareModal({ products, onClose, onRemove }: {
  products: StoreProduct[];
  onClose: () => void;
  onRemove: (productId: string) => void;
}) {
  const activePlans = (p: StoreProduct) => p.plans?.filter(pl => pl.is_active) || [];
  const cheapest = (p: StoreProduct) => {
    const plans = activePlans(p);
    return plans.length > 0 ? Math.min(...plans.map(pl => pl.price)) : null;
  };
  const allFeatures = Array.from(new Set(
    products.flatMap(p => activePlans(p).flatMap(pl => pl.features || []))
  ));
  const hasFeature = (p: StoreProduct, f: string) => activePlans(p).some(pl => (pl.features || []).includes(f));

  const row = (label: string, value: (p: StoreProduct) => React.ReactNode) => (
    <tr className="border-b border-white/10">
      <td className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap w-32 align-top">{label}</td>
      {products.map(p => (
        <td key={p.id} className="px-4 py-3 text-xs text-white align-top min-w-[160px]">{value(p)}</td>
      ))}
    </tr>
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="fixed inset-0 bg-[#02040A]/80 backdrop-blur-md" />
      <motion.div role="dialog" aria-modal="true" aria-label="Compare products"
        className="relative w-full max-w-6xl bg-[var(--bg-secondary)]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 28 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center border border-indigo-400/20">
              <Scale className="w-4 h-4 text-indigo-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Compare Products ({products.length})</h2>
          </div>
          <motion.button onClick={onClose} aria-label="Close compare"
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-4 text-left text-[10px] uppercase tracking-wider text-slate-500 w-32" />
                {products.map(p => (
                  <th key={p.id} className="px-4 py-4 text-left min-w-[180px] align-top">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center text-lg shrink-0 border border-white/10">
                          {p.logo_url ? <img src={p.logo_url} alt={p.name} className="w-7 h-7 rounded-lg object-contain" /> : <span className="font-bold text-white">{p.name.charAt(0)}</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate max-w-[130px]">{p.name}</p>
                          {p.company_name && <p className="text-[11px] text-slate-500 truncate max-w-[130px]">{p.company_name}</p>}
                        </div>
                      </div>
                      <button onClick={() => onRemove(p.id)} className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0" title="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {row("Category", p => p.product_type || <span className="text-[var(--text-muted)]">-</span>)}
              {row("Platform", p => p.platform || <span className="text-[var(--text-muted)]">-</span>)}
              {row("Version", p => p.version || <span className="text-[var(--text-muted)]">-</span>)}
              {row("Description", p => (
                <span className="line-clamp-4 text-[var(--text-secondary)]">{p.short_description || p.description || '-'}</span>
              ))}
              {row("Starting Price", p => {
                const c = cheapest(p);
                return c === null ? <span className="text-[var(--text-muted)]">-</span> : c === 0
                  ? <span className="font-bold text-emerald-400">Free</span>
                  : <span className="font-bold text-[var(--text-primary)]">{formatPrice(c)}</span>;
              })}
              {row("Plans", p => {
                const plans = activePlans(p);
                if (plans.length === 0) return <span className="text-[var(--text-muted)]">-</span>;
                return (
                  <span className="space-y-1 block">
                    {plans.map(pl => (
                      <span key={pl.id} className="flex flex-col">
                        <span className="text-[var(--text-primary)]">{pl.name}{pl.is_trial_plan && <span className="ml-1 text-[10px] text-emerald-400">(Trial)</span>}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {pl.price === 0 ? 'Free' : formatPrice(pl.price)}
                          {pl.price > 0 && pl.duration_days > 0 ? ` / ${formatDuration(pl.duration_days)}` : ''} · {pl.max_devices} device{pl.max_devices !== 1 ? 's' : ''}
                        </span>
                      </span>
                    ))}
                  </span>
                );
              })}
              {row("Free Trial", p => activePlans(p).some(pl => pl.is_trial_plan)
                ? <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Yes</span>
                : <span className="text-[var(--text-muted)]">No</span>)}
              {allFeatures.length > 0 && row("Features", p => (
                <span className="space-y-1 block">
                  {allFeatures.map(f => (
                    <span key={f} className={`flex items-center gap-1.5 text-[11px] ${hasFeature(p, f) ? 'text-emerald-400' : 'text-[var(--text-muted)] opacity-50'}`}>
                      {hasFeature(p, f) ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{f}</span>
                    </span>
                  ))}
                </span>
              ))}
              {row("Resources", p => (
                <span className="flex flex-col gap-1">
                  {p.docs_url && <a href={p.docs_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1"><BookOpen className="w-3 h-3" /> Docs</a>}
                  {p.support_url && <a href={p.support_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1"><LifeBuoy className="w-3 h-3" /> Support</a>}
                  {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Website</a>}
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

interface PurchaseOrder {
  id: number;
  order_number: string;
  customer_email: string;
  customer_name: string | null;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  payment_gateway: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  items: any[];
  payments: any[];
  licenses: any[];
}

function PurchaseHistoryPanel({ onClose, onToast }: {
  onClose: () => void;
  onToast: (message: string, type?: "success" | "error") => void;
}) {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_HISTORY_EMAIL_KEY);
    if (saved) setEmail(saved);
    try {
      const lastOrder = sessionStorage.getItem("software_store_order");
      if (lastOrder) {
        const parsed = JSON.parse(lastOrder);
        if (parsed?.customer_email) setEmail(parsed.customer_email);
      }
    } catch {}
  }, []);

  const lookup = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setError(null);
    setLookedUp(false);
    try {
      const res = await fetch(`/api/v1/checkout/orders?email=${encodeURIComponent(e)}`);
      const json = await res.json();
      if (json.success) {
        setOrders(json.orders);
        setLookedUp(true);
        localStorage.setItem(STORAGE_HISTORY_EMAIL_KEY, e);
        if (json.orders.length === 0) onToast("No purchases found for this email", "error");
      } else {
        setError(json.error || "Failed to load purchase history");
      }
    } catch {
      setError("Failed to load purchase history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
      paid: { label: 'Paid', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
      completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
      failed: { label: 'Failed', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
      cancelled: { label: 'Cancelled', cls: 'bg-white/5 text-slate-400 border-white/10' },
    };
    const s = map[status] || { label: status, cls: 'bg-white/5 text-slate-400 border-white/10' };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>{s.label}</span>;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="fixed inset-0 bg-[#02040A]/70 backdrop-blur-sm" />
      <motion.div role="dialog" aria-modal="true" aria-label="Purchase history"
        className="relative w-full max-w-2xl bg-[var(--bg-secondary)]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-y-auto border-l border-white/10"
        onClick={e => e.stopPropagation()}
        variants={slideInRight} initial="hidden" animate="show" exit="exit">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/10 bg-[var(--bg-secondary)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/25 flex items-center justify-center border border-emerald-400/20">
              <HistoryIcon className="w-4 h-4 text-emerald-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Purchase History</h2>
          </div>
          <motion.button onClick={onClose} aria-label="Close purchase history"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <X className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-slate-400 mb-3">Enter the email you used at checkout to see your orders, payments and license keys.</p>
            <div className="flex gap-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookup()}
                placeholder="you@example.com"
                aria-label="Email used at checkout"
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all" />
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={lookup} disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} Lookup
              </motion.button>
            </div>
            {error && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
          </div>

          {orders && orders.length > 0 && (
            <div className="space-y-3">
              {orders.map(order => {
                const paid = order.status === "paid" || order.status === "completed" || order.paid_at;
                return (
                  <motion.div key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-indigo-400/30 transition-all">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                      <div>
                        <p className="font-bold text-sm text-white">#{order.order_number}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(order.created_at)} · {order.payment_gateway || 'checkout'}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        {statusBadge(order.status)}
                        <p className="font-bold text-white">
                          {formatPrice(order.total)} <span className="text-[10px] text-slate-500 font-normal">{order.currency}</span>
                        </p>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {order.items.length > 0 && (
                        <div className="space-y-1.5">
                          {order.items.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-2 text-xs">
                              <ShoppingBag className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="text-white truncate flex-1">{item.plan_name || item.product_id} × {item.quantity}</span>
                              <span className="text-slate-400">{formatPrice(Number(item.total_price) || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {order.payments.length > 0 && (
                        <div className="space-y-1.5">
                          {order.payments.map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-[11px]">
                              <CreditCard className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="text-slate-400">Payment {p.payment_number} · {p.gateway}</span>
                              <span className={`ml-auto ${p.status === 'paid' || p.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>{p.status}</span>
                              {p.paid_at && <span className="text-slate-500">{formatDate(p.paid_at)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {order.licenses.length > 0 && (
                        <div className="space-y-1.5">
                          {order.licenses.map((l: any) => (
                            <div key={l.license_key} className="flex items-center gap-2 text-[11px] rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-2.5 py-1.5">
                              <BadgeCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              <code className="text-emerald-300 font-mono truncate flex-1">{l.license_key}</code>
                              <span className="text-slate-500">{l.plan_name || ''}{l.status ? ` · ${l.status}` : ''}</span>
                              {l.expiry_date && <span className="text-slate-500">until {formatDate(l.expiry_date)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {!paid && order.payments.length === 0 && order.licenses.length === 0 && (
                        <p className="text-[11px] text-slate-500">No payment captured for this order.</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {orders && orders.length === 0 && lookedUp && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center mb-4 border border-white/10">
                <Receipt className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-slate-300 font-semibold">No purchases found</p>
              <p className="text-sm text-slate-500 mt-1">We couldn't find any orders for this email address.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StarRating() {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className="w-3.5 h-3.5 text-white/15" />
      ))}
    </div>
  );
}

function ProductCard({ product, cheapestPrice, planCount, hasTrial, inCart, onOpen, onAddToCart }: {
  product: StoreProduct;
  cheapestPrice: number | null;
  planCount: number;
  hasTrial: boolean;
  inCart: boolean;
  onOpen: () => void;
  onAddToCart: () => void;
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.02, y: -8 }}
      transition={{ type: "spring" as const, stiffness: 260, damping: 22 }}
      onClick={onOpen}
      className="group relative h-full flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden cursor-pointer
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-20px_rgba(0,0,0,0.7)]
        hover:border-indigo-400/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(129,140,248,0.18),0_30px_80px_-20px_rgba(99,102,241,0.45)]
        focus-within:ring-2 focus-within:ring-indigo-400/50 transition-all duration-300"
      role="button" tabIndex={0}
      aria-label={`View details of ${product.name}`}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      {/* hover glow orb */}
      <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-indigo-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* icon header */}
      <div className="relative h-40 shrink-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.28),rgba(139,92,246,0.12)_45%,transparent_75%)]" />
        <div className="absolute inset-0 opacity-35"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-transparent to-transparent" />

        {/* status badges */}
        <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5">
          {product.featured && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 text-[10px] font-bold border border-amber-400/25 backdrop-blur-sm">
              <Star className="w-3 h-3 fill-current" /> Featured
            </span>
          )}
          {hasTrial && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-300 text-[10px] font-bold border border-emerald-400/25 backdrop-blur-sm">
              <Sparkles className="w-3 h-3" /> Trial
            </span>
          )}
        </div>

        {/* floating icon */}
        <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
          <motion.div
            className="relative w-16 h-16 rounded-2xl bg-[#0B1220]/85 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-[0_8px_30px_-6px_rgba(99,102,241,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] shrink-0"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-cyan-400/20 opacity-80" />
            <span className="relative text-2xl font-bold text-white">
              {product.logo_url ? (
                <img src={product.logo_url} alt={product.name} className="w-10 h-10 rounded-xl object-contain" />
              ) : (
                product.name.charAt(0).toUpperCase()
              )}
            </span>
          </motion.div>
          <div className="min-w-0 flex-1 pb-0.5">
            <h3 className="font-bold text-base text-white truncate group-hover:text-indigo-200 transition-colors duration-300">{product.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {product.company_name && <p className="text-[11px] text-slate-400 truncate">{product.company_name}</p>}
              {product.version && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300 font-medium border border-white/10 shrink-0">v{product.version}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-5 pt-4 space-y-3">
        <p className="text-xs leading-relaxed text-slate-400 line-clamp-2">
          {product.short_description || product.description || 'No description available.'}
        </p>

        {/* chips */}
        <div className="flex flex-wrap gap-1.5">
          {product.product_type && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <Tag className="w-2.5 h-2.5" />{product.product_type}
            </span>
          )}
          {product.platform && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              <Monitor className="w-2.5 h-2.5" />{product.platform}
            </span>
          )}
          {(product.tags || []).slice(0, 2).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 border border-white/10">{t}</span>
          ))}
        </div>

        {/* rating + updated */}
        <div className="flex items-center justify-between">
          <StarRating />
          <span className="text-[10px] text-slate-500">
            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
            {formatDate((product as any).updated_at) || formatDate((product as any).created_at) || "Recently"}
          </span>
        </div>

        {/* pricing */}
        {planCount > 0 && cheapestPrice !== null && (
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Layers className="w-3 h-3" /> {planCount} plan{planCount !== 1 ? 's' : ''}
            </span>
            <span className="text-lg font-extrabold text-white">
              {cheapestPrice === 0 ? 'Free' : `${formatPrice(cheapestPrice)}+`}
            </span>
          </div>
        )}

        {/* actions */}
        <div className="mt-auto pt-2 space-y-2">
          {hasTrial && (
            <button onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-300 text-xs font-semibold hover:bg-emerald-500/15 hover:border-emerald-400/40 hover:shadow-[0_0_28px_-8px_rgba(52,211,153,0.5)] active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50">
              <Sparkles className="w-3 h-3" /> Free Trial
            </button>
          )}
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
              aria-label={`Add ${product.name} to cart`}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                inCart
                  ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 hover:shadow-[0_0_24px_-6px_rgba(52,211,153,0.5)]"
                  : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_8px_28px_-8px_rgba(99,102,241,0.6)] hover:brightness-110 hover:shadow-[0_10px_36px_-8px_rgba(99,102,241,0.8)]"
              }`}>
              {inCart ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              {inCart ? "In Cart" : "Add to Cart"}
            </motion.button>
            <button onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="group/btn flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 text-xs font-semibold hover:border-indigo-400/40 hover:bg-white/[0.08] hover:text-white active:scale-[0.97] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50">
              View Details
              <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SoftwareStorePage() {
  const router = useRouter();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadAttemptRef = useRef(0);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [selectedPlans, setSelectedPlans] = useState<StoreProductPlan[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showGst, setShowGst] = useState(false);
  const [addedToCartFeedback, setAddedToCartFeedback] = useState<string | null>(null);

  const cart = useCart();
  const wishlist = useWishlist();
  const compare = useCompare();
  const [showCompare, setShowCompare] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleToggleCompare = useCallback((product: StoreProduct) => {
    const inCompare = compare.isInCompare(product.id);
    if (!inCompare && compare.items.length >= MAX_COMPARE) {
      showToast(`You can compare up to ${MAX_COMPARE} products`, "error");
      return;
    }
    compare.toggle(product);
    showToast(inCompare ? `${product.name} removed from compare` : `${product.name} added to compare`);
  }, [compare, showToast]);

  useEffect(() => {
    let mounted = true;
    let retrying = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const isVisible = await getSoftwareStoreVisibility();
        if (!mounted) return;
        if (!isVisible) { router.replace("/"); return; }
        const productData = await getPublicProducts();
        if (mounted) {
          setProducts(productData.filter(p => p.is_active));
        }
      } catch (e) {
        if (!mounted) return;
        if (loadAttemptRef.current < 1) {
          loadAttemptRef.current += 1;
          retrying = true;
          load();
          return;
        }
        setError("Failed to load products. Please try again.");
      } finally {
        if (mounted && !retrying) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [router]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.product_type) set.add(p.product_type); });
    return Array.from(set).sort();
  }, [products]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.platform) set.add(p.platform); });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = products.filter(p => {
      const matchesSearch = !q || [p.name, p.short_description || p.description, p.company_name].filter(Boolean).join(" ").toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || p.product_type === categoryFilter;
      const matchesPlatform = !platformFilter || p.platform === platformFilter;
      return matchesSearch && matchesCategory && matchesPlatform;
    });

    switch (sortBy) {
      case "price-asc": result.sort((a, b) => { const aP = a.plans?.length ? Math.min(...a.plans.filter(p => p.is_active).map(p => p.price)) : Infinity; const bP = b.plans?.length ? Math.min(...b.plans.filter(p => p.is_active).map(p => b.price)) : Infinity; return aP - bP; }); break;
      case "price-desc": result.sort((a, b) => { const aP = a.plans?.length ? Math.min(...a.plans.filter(p => p.is_active).map(p => p.price)) : 0; const bP = b.plans?.length ? Math.min(...b.plans.filter(p => p.is_active).map(p => b.price)) : 0; return bP - aP; }); break;
      case "name": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: result.sort((a, b) => (b.display_order ?? 999) - (a.display_order ?? 999)); break;
    }
    return result;
  }, [products, query, categoryFilter, platformFilter, sortBy]);

  const openDetail = (product: StoreProduct) => {
    setSelectedPlans(product.plans?.filter(p => p.is_active) || []);
    setSelectedProduct(product);
  };

  const handleCheckout = useCallback(() => {
    // Cart is already persisted to localStorage by the cart hook.
    if (cart.items.length === 0) {
      showToast("Your cart is empty");
      return;
    }
    router.push("/software-store/checkout");
  }, [cart.items.length, router, showToast]);

  // Proceed to Checkout never bypasses the cart: the selected product is
  // added first if it isn't there yet, then the universal checkout opens.
  const handleProceedToCheckout = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    if (!cart.items.some(i => i.product.id === product.id)) {
      cart.addItem(product, plan);
    }
    router.push("/software-store/checkout");
  }, [cart, router]);

  const handleAddToCart = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    cart.addItem(product, plan);
    showToast(`${product.name} added to cart`);
  }, [cart, showToast]);

  const handleAddToWishlist = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    wishlist.addItem(product, plan);
    showToast(`${product.name} added to wishlist`);
  }, [wishlist, showToast]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const productData = await getPublicProducts();
        setProducts(productData.filter(p => p.is_active));
      } catch (e) {
        setError("Failed to load products. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]" style={STORE_DARK_STYLE}>
      <AnimatePresence>
        {toast && (
          <motion.div className="fixed top-4 right-4 z-[100]"
            initial={{ opacity: 0, y: -20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }} transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}>
            <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-2xl border ${
              toast.type === "success"
                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200 shadow-emerald-500/10"
                : "bg-red-500/15 border-red-400/30 text-red-200 shadow-red-500/10"
            }`}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/10">
                {toast.type === "success" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              </div>
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Nav */}
      <div className="sticky top-0 z-40 bg-[#070B14]/85 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <motion.div
              className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-500 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)]"
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/40 to-cyan-400/30 opacity-70" />
              <Package className="w-4 h-4 text-white relative" />
            </motion.div>
            <span className="text-sm font-bold text-white hidden sm:block tracking-tight">Software Store</span>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search software..."
              aria-label="Search software"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all backdrop-blur-sm" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <motion.button onClick={() => setShowHistory(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-emerald-300 hover:bg-white/[0.07] hover:border-emerald-400/40 transition-all"
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              aria-label="Purchase History"
              title="Purchase History">
              <HistoryIcon className="w-4 h-4" />
            </motion.button>
            <motion.button onClick={() => setShowWishlist(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-rose-300 hover:bg-white/[0.07] hover:border-rose-400/40 transition-all"
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              aria-label={`Wishlist (${wishlist.items.length} items)`}>
              <Heart className="w-4 h-4" />
              {wishlist.items.length > 0 && (
                <motion.span key={`wish-${wishlist.items.length}`}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring" as const, stiffness: 500, damping: 16 }}
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_12px_rgba(244,63,94,0.6)]">
                  {wishlist.items.length}
                </motion.span>
              )}
            </motion.button>
            <motion.button onClick={() => setShowCart(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all"
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              aria-label={`Cart (${cart.totalItems} items)`}>
              <ShoppingCart className="w-4 h-4" />
              {cart.totalItems > 0 && (
                <motion.span key={`cart-${cart.totalItems}`}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring" as const, stiffness: 500, damping: 16 }}
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-amber-950 text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_12px_rgba(251,191,36,0.7)]">
                  {cart.totalItems}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(99,102,241,0.35),transparent_60%),radial-gradient(ellipse_at_85%_10%,rgba(34,211,238,0.12),transparent_50%),radial-gradient(ellipse_at_5%_45%,rgba(139,92,246,0.16),transparent_55%)]" />
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
        <motion.div className="absolute -top-24 left-[22%] w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"
          animate={{ y: [0, 22, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute top-6 right-[20%] w-56 h-56 rounded-full bg-violet-600/15 blur-3xl pointer-events-none"
          animate={{ y: [0, -18, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-20 text-center">
          <motion.span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-indigo-400/25 bg-indigo-500/10 text-indigo-300 text-xs font-semibold backdrop-blur-sm"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring" as const, stiffness: 260, damping: 22 }}>
            <Sparkles className="w-3.5 h-3.5" /> Premium Software Marketplace
          </motion.span>
          <motion.h1 className="text-4xl md:text-6xl font-extrabold text-white mt-4 tracking-tight"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24, delay: 0.05 }}>
            Software <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">Store</span>
          </motion.h1>
          <motion.p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mt-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12, duration: 0.4 }}>
            Discover production-ready software solutions for your business
          </motion.p>
          <motion.div className="mt-7 max-w-md mx-auto relative"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search software..."
              aria-label="Search software"
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 text-white placeholder-slate-500 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all" />
          </motion.div>
          {!loading && products.length > 0 && (
            <motion.p className="text-xs text-slate-500 mt-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              {products.length} products available · instant license delivery · secure checkout
            </motion.p>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-[57px] z-30 bg-[#070B14]/85 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
              <Filter className="w-3.5 h-3.5 text-indigo-300" />
              {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            </span>

            <div className="flex-1" />

            {categories.length > 0 && (
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className="px-3 py-2 rounded-xl border border-white/10 bg-[#0B1220]/90 text-sm text-slate-200 outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {platforms.length > 0 && (
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                aria-label="Filter by platform"
                className="px-3 py-2 rounded-xl border border-white/10 bg-[#0B1220]/90 text-sm text-slate-200 outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all">
                <option value="">All Platforms</option>
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}

            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              aria-label="Sort products"
              className="px-3 py-2 rounded-xl border border-white/10 bg-[#0B1220]/90 text-sm text-slate-200 outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all">
              <option value="newest">Sort: Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
            </select>

            <div className="flex items-center border border-white/10 rounded-xl overflow-hidden bg-white/[0.03]">
              <motion.button onClick={() => setViewMode("grid")}
                whileTap={{ scale: 0.9 }}
                aria-label="Grid view"
                className={`p-2 transition-all ${viewMode === "grid" ? "bg-indigo-500/25 text-indigo-300" : "text-slate-400 hover:text-white"}`}>
                <LayoutGrid className="w-4 h-4" />
              </motion.button>
              <div className="w-px h-4 bg-white/10" />
              <motion.button onClick={() => setViewMode("list")}
                whileTap={{ scale: 0.9 }}
                aria-label="List view"
                className={`p-2 transition-all ${viewMode === "list" ? "bg-indigo-500/25 text-indigo-300" : "text-slate-400 hover:text-white"}`}>
                <List className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <SkeletonCard />
              </motion.div>
            ))}
          </div>
        ) : error ? (
          <motion.div className="flex flex-col items-center justify-center py-24 text-center"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/10 to-rose-500/10 flex items-center justify-center mb-5 border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Something went wrong</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs">{error}</p>
            <motion.button onClick={handleRetry} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-purple-500 transition-all">
              <RefreshCw className="w-4 h-4" /> Try Again
            </motion.button>
          </motion.div>
        ) : filteredProducts.length === 0 ? (
          <motion.div className="flex flex-col items-center justify-center py-24 text-center"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-6 border border-[var(--border-color)]">
              <Search className="w-10 h-10 text-[var(--border-color)]" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No products found</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs">We couldn't find any products matching your criteria. Try adjusting your search or filters.</p>
            <motion.button onClick={() => { setQuery(""); setCategoryFilter(""); setPlatformFilter(""); }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-purple-500 transition-all">
              <RefreshCw className="w-4 h-4" /> Clear All Filters
            </motion.button>
          </motion.div>
        ) : viewMode === "grid" ? (
          <motion.div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch"
            variants={containerVariants} initial="hidden" animate="show">
            {filteredProducts.map(product => {
              const hasTrial = product.has_trial || product.plans?.some(p => p.is_trial_plan);
              const cheapestPrice = product.plans && product.plans.length > 0
                ? Math.min(...product.plans.filter(p => p.is_active).map(p => p.price)) : null;
              const planCount = product.plans?.filter(p => p.is_active).length || 0;
              const inCart = cart.items.some(i => i.product.id === product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  cheapestPrice={cheapestPrice}
                  planCount={planCount}
                  hasTrial={hasTrial}
                  inCart={inCart}
                  onOpen={() => openDetail(product)}
                  onAddToCart={() => {
                    const firstPlan = product.plans?.find(p => p.is_active);
                    handleAddToCart(product, firstPlan);
                  }}
                />
              );
            })}
          </motion.div>
        ) : (
          /* List View */
          <motion.div className="space-y-4"
            variants={containerVariants} initial="hidden" animate="show">
            {filteredProducts.map((product, idx) => {
              const hasTrial = product.has_trial || product.plans?.some(p => p.is_trial_plan);
              const cheapestPrice = product.plans && product.plans.length > 0
                ? Math.min(...product.plans.filter(p => p.is_active).map(p => p.price)) : null;
              const planCount = product.plans?.filter(p => p.is_active).length || 0;
              const inCart = cart.items.some(i => i.product.id === product.id);
              return (
                <motion.div key={product.id}
                  variants={staggerItem(idx)}
                  whileHover={{ x: 4 }}
                  onClick={() => openDetail(product)}
                  role="button" tabIndex={0}
                  aria-label={`View details of ${product.name}`}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(product); } }}
                  className="group relative flex items-center gap-5 p-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl cursor-pointer hover:border-indigo-400/30 hover:shadow-[0_0_0_1px_rgba(129,140,248,0.15),0_16px_50px_-16px_rgba(99,102,241,0.35)] transition-all duration-300">
                  {product.featured && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 text-[10px] font-bold border border-amber-400/25 backdrop-blur-sm">
                      <Star className="w-2.5 h-2.5 fill-current" /> Featured
                    </div>
                  )}

                  <div className="relative w-16 h-16 rounded-2xl bg-[#0B1220]/85 backdrop-blur-md flex items-center justify-center text-2xl border border-white/10 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.4)] shrink-0">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-cyan-400/15" />
                    <span className="relative font-bold text-white">
                      {product.logo_url ? (
                        <img src={product.logo_url} alt={product.name} className="w-11 h-11 rounded-xl object-contain" />
                      ) : (
                        product.name.charAt(0).toUpperCase()
                      )}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="font-bold text-base text-white truncate">{product.name}</h3>
                      {product.version && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-medium border border-white/10 shrink-0">v{product.version}</span>
                      )}
                      {hasTrial && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25 font-medium shrink-0">Free Trial</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {product.company_name && <span>{product.company_name}</span>}
                      {product.platform && <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />{product.platform}</span>}
                      {product.product_type && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{product.product_type}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-1">
                      {product.short_description || product.description || 'No description available.'}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <StarRating />
                      <span className="text-[10px] text-slate-500">
                        <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                        {formatDate((product as any).updated_at) || formatDate((product as any).created_at) || "Recently"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-2.5">
                    <div>
                      {cheapestPrice !== null && (
                        <div className="text-2xl font-extrabold text-white">
                          {cheapestPrice === 0 ? 'Free' : `${formatPrice(cheapestPrice)}`}
                        </div>
                      )}
                      {planCount > 0 && (
                        <div className="text-[10px] text-slate-500">{planCount} plan{planCount !== 1 ? 's' : ''}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find(p => p.is_active); handleAddToCart(product, firstPlan); }}
                        aria-label={`Add ${product.name} to cart`}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                          inCart
                            ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25"
                            : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] hover:brightness-110"
                        }`}>
                        {inCart ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                        {inCart ? "In Cart" : "Add to Cart"}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.stopPropagation(); openDetail(product); }}
                        className="group/btn flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 text-xs font-semibold hover:border-indigo-400/40 hover:text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50">
                        Details
                        <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal
            key="product-modal"
            product={selectedProduct}
            plans={selectedPlans}
            cart={cart}
            wishlist={wishlist}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={handleAddToCart}
            onAddToWishlist={handleAddToWishlist}
            onRemoveFromWishlist={(productId, planId) => wishlist.removeItem(productId, planId)}
            onProceedToCheckout={handleProceedToCheckout}
            inCompare={compare.isInCompare(selectedProduct.id)}
            onToggleCompare={handleToggleCompare}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCart && (
          <CartPanel
            key="cart-panel"
            cart={cart}
            onClose={() => setShowCart(false)}
            onRemoveFromCart={(productId, planId) => cart.removeItem(productId, planId)}
            onUpdateQty={(productId, planId, delta) => cart.updateQuantity(productId, planId, delta)}
            onClearCart={() => cart.clearCart()}
            onCheckout={handleCheckout}
            showGst={showGst}
            onToggleGst={() => setShowGst(v => !v)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWishlist && (
          <WishlistPanel
            key="wishlist-panel"
            wishlist={wishlist}
            cart={cart}
            onClose={() => setShowWishlist(false)}
            onAddToCart={(product, plan) => { cart.addItem(product, plan); showToast(`${product.name} moved to cart`); }}
            onRemoveFromWishlist={(productId, planId) => wishlist.removeItem(productId, planId)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <PurchaseHistoryPanel key="history-panel" onClose={() => setShowHistory(false)} onToast={showToast} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCompare && compare.items.length >= 2 && (
          <CompareModal
            key="compare-modal"
            products={compare.items}
            onClose={() => setShowCompare(false)}
            onRemove={id => { compare.remove(id); if (compare.items.length - 1 < 2) setShowCompare(false); }}
          />
        )}
      </AnimatePresence>

      {/* Compare tray — fixed bottom bar */}
      <AnimatePresence>
        {compare.items.length > 0 && (
          <motion.div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 26 }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#0B1220]/95 backdrop-blur-2xl border border-indigo-400/30 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 pl-1.5 pr-1">
                <Scale className="w-3.5 h-3.5" /> {compare.items.length}/{MAX_COMPARE}
              </span>
              {compare.items.map(p => (
                <div key={p.id} className="relative group">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 flex items-center justify-center text-sm border border-white/10 cursor-pointer"
                    title={p.name}>
                    {p.logo_url ? <img src={p.logo_url} alt={p.name} className="w-6 h-6 rounded-lg object-contain" /> : <span className="font-bold text-white">{p.name.charAt(0)}</span>}
                  </div>
                  <button onClick={() => compare.remove(p.id)}
                    aria-label={`Remove ${p.name} from compare`}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(244,63,94,0.6)]">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => compare.items.length >= 2 && setShowCompare(true)}
                disabled={compare.items.length < 2}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed ml-1">
                Compare {compare.items.length >= 2 ? `(${compare.items.length})` : '(min 2)'}
              </motion.button>
              <button onClick={compare.clear} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Clear compare">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
