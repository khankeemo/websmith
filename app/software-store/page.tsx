"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, Heart, X, Check, Clock, ChevronRight,
  Plus, Minus, Trash2, ArrowRight, Star, LayoutGrid, List,
  BookOpen, LifeBuoy, ExternalLink, Filter, SlidersHorizontal,
  Sparkles, Tag, Monitor, Layers, Package, Loader2, AlertCircle,
  ShoppingBag, RefreshCw, Globe
} from "lucide-react";
import { getPublicProducts, StoreProduct, StoreProductPlan } from "./services/softwareStoreService";
import { getSoftwareStoreVisibility } from "@/core/services/publicSettingsService";

const STORAGE_CART_KEY = "software_store_cart";
const STORAGE_WISHLIST_KEY = "software_store_wishlist";

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

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-color)] animate-pulse">
      <div className="h-36 bg-[var(--border-color)]" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--border-color)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-[var(--border-color)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--border-color)]" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-[var(--border-color)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--border-color)]" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-[var(--border-color)]" />
          <div className="h-5 w-14 rounded-full bg-[var(--border-color)]" />
        </div>
        <div className="h-10 rounded-xl bg-[var(--border-color)]" />
      </div>
    </div>
  );
}

function CartPanel({ cart, wishlist, onClose, onRemoveFromCart, onUpdateQty, onClearCart, onCheckout, onBuyNow, showGst, onToggleGst }: {
  cart: ReturnType<typeof useCart>;
  wishlist: ReturnType<typeof useWishlist>;
  onClose: () => void;
  onRemoveFromCart: (productId: string, planId?: number) => void;
  onUpdateQty: (productId: string, planId: number | undefined, delta: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onBuyNow: (item: CartItem) => void;
  showGst: boolean;
  onToggleGst: () => void;
}) {
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div className="relative w-full max-w-lg bg-[var(--bg-primary)] shadow-2xl shadow-black/50 overflow-y-auto border-l border-[var(--border-color)]"
        onClick={e => e.stopPropagation()}
        variants={slideInRight} initial="hidden" animate="show" exit="exit">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Cart ({cart.totalItems})</h2>
          </div>
          <motion.button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] transition-colors"
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </motion.button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-5 border border-[var(--border-color)]">
                <ShoppingBag className="w-8 h-8 text-[var(--border-color)]" />
              </div>
            </motion.div>
            <p className="text-[var(--text-secondary)] font-semibold text-lg">Your cart is empty</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-xs">Browse our software catalog and add items you'd like to purchase</p>
          </div>
        ) : (
          <motion.div className="p-5 space-y-3"
            variants={containerVariants} initial="hidden" animate="show">
            {cart.items.map((item, idx) => (
              <motion.div key={`${item.product.id}-${item.plan?.id || 0}-${idx}`}
                variants={staggerItem(idx)}
                className="flex gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 hover:border-indigo-500/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-lg shrink-0 border border-white/10">
                  {item.product.logo_url ? (
                    <img src={item.product.logo_url} alt={item.product.name} className="w-8 h-8 rounded-lg object-contain" />
                  ) : (
                    item.product.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">{item.product.name}</h4>
                  {item.plan && <p className="text-xs text-[var(--text-secondary)]">{item.plan.name}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateQty(item.product.id, item.plan?.id, -1)}
                      className="w-7 h-7 rounded-full border border-[var(--border-color)] flex items-center justify-center hover:bg-[var(--bg-secondary)] transition-colors hover:border-indigo-500/40">
                      <Minus className="w-3 h-3 text-[var(--text-secondary)]" />
                    </motion.button>
                    <span className="text-sm font-bold text-[var(--text-primary)] w-6 text-center">{item.quantity}</span>
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateQty(item.product.id, item.plan?.id, 1)}
                      className="w-7 h-7 rounded-full border border-[var(--border-color)] flex items-center justify-center hover:bg-[var(--bg-secondary)] transition-colors hover:border-indigo-500/40">
                      <Plus className="w-3 h-3 text-[var(--text-secondary)]" />
                    </motion.button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-[var(--text-primary)]">
                    ${((item.plan?.price || item.product.price || 0) * item.quantity).toFixed(0)}
                  </p>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => onRemoveFromCart(item.product.id, item.plan?.id)}
                    className="text-xs text-red-400 hover:text-red-300 mt-1.5 transition-colors">
                    Remove
                  </motion.button>
                </div>
              </motion.div>
            ))}

            <div className="border-t border-[var(--border-color)] pt-4 mt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--text-secondary)]">Subtotal</span>
                <span className="font-bold text-lg text-[var(--text-primary)]">${cart.totalPrice.toFixed(0)}</span>
              </div>
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <span className="text-[var(--text-secondary)]">
                  GST ({Math.round(GST_RATE * 100)}%)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-primary)] font-bold">
                    {showGst ? `+$${(cart.totalPrice * GST_RATE).toFixed(0)}` : '-'}
                  </span>
                  <input
                    type="checkbox"
                    checked={showGst}
                    onChange={onToggleGst}
                    className="w-4 h-4 rounded border-[var(--border-color)] text-indigo-500 focus:ring-indigo-500/50"
                  />
                </div>
              </label>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-[var(--border-color)]">
                <span className="text-[var(--text-primary)]">Total</span>
                <span className="text-[var(--text-primary)]">${(cart.totalPrice + (showGst ? cart.totalPrice * GST_RATE : 0)).toFixed(0)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { const first = cart.items[0]; if (first) onBuyNow(first); }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25">
                <ArrowRight className="w-4 h-4" />
                Proceed to Checkout
              </motion.button>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={onClearCart}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/5 transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-secondary)] transition-all">
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
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div className="relative w-full max-w-lg bg-[var(--bg-primary)] shadow-2xl shadow-black/50 overflow-y-auto border-l border-[var(--border-color)]"
        onClick={e => e.stopPropagation()}
        variants={slideInRight} initial="hidden" animate="show" exit="exit">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-400" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Wishlist ({wishlist.items.length})</h2>
          </div>
          <motion.button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] transition-colors"
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </motion.button>
        </div>

        {wishlist.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500/10 to-pink-500/10 flex items-center justify-center mb-5 border border-[var(--border-color)]">
                <Heart className="w-8 h-8 text-[var(--border-color)]" />
              </div>
            </motion.div>
            <p className="text-[var(--text-secondary)] font-semibold text-lg">Your wishlist is empty</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-xs">Save products you're interested in and come back to them later</p>
          </div>
        ) : (
          <motion.div className="p-5 space-y-3"
            variants={containerVariants} initial="hidden" animate="show">
            {wishlist.items.map((item, idx) => (
              <motion.div key={`wl-${item.product.id}-${item.plan?.id || 0}-${idx}`}
                variants={staggerItem(idx)}
                className="flex gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 hover:border-rose-500/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center text-lg shrink-0 border border-white/10">
                  {item.product.logo_url ? (
                    <img src={item.product.logo_url} alt={item.product.name} className="w-8 h-8 rounded-lg object-contain" />
                  ) : (
                    item.product.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">{item.product.name}</h4>
                  {item.plan && <p className="text-xs text-[var(--text-secondary)]">{item.plan.name}</p>}
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {item.plan ? `$${item.plan.price.toFixed(0)}` : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => { onAddToCart(item.product, item.plan); onRemoveFromWishlist(item.product.id, item.plan?.id); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-purple-500 transition-all">
                    <ShoppingCart className="w-3 h-3" /> Move to Cart
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => onRemoveFromWishlist(item.product.id, item.plan?.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/5 transition-all">
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

function ProductDetailModal({ product, plans, cart, wishlist, onClose, onAddToCart, onAddToWishlist, onRemoveFromWishlist, onBuyNow }: {
  product: StoreProduct;
  plans: StoreProductPlan[];
  cart: ReturnType<typeof useCart>;
  wishlist: ReturnType<typeof useWishlist>;
  onClose: () => void;
  onAddToCart: (product: StoreProduct, plan?: StoreProductPlan) => void;
  onAddToWishlist: (product: StoreProduct, plan?: StoreProductPlan) => void;
  onRemoveFromWishlist: (productId: string, planId?: number) => void;
  onBuyNow: (product: StoreProduct, plan?: StoreProductPlan) => void;
}) {
  const activePlans = plans.filter(p => p.is_active);
  const hasTrial = activePlans.some(p => p.is_trial_plan);
  const cheapestPrice = activePlans.length > 0 ? Math.min(...activePlans.map(p => p.price)) : 0;
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);

  const selectedPlan = selectedPlanIndex !== null ? activePlans[selectedPlanIndex] : undefined;
  const inWishlist = wishlist.isInWishlist(product.id, selectedPlan?.id);

  const featuresList = selectedPlan?.features || [];

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />
      <motion.div className="relative w-full max-w-5xl mx-4 bg-[var(--bg-primary)] rounded-3xl shadow-2xl shadow-black/30 overflow-hidden"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 28 }}>
        <motion.button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-all border border-white/10"
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <X className="w-4 h-4" />
        </motion.button>

        <div className="relative h-56 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 overflow-hidden">
          <div className="absolute inset-0 opacity-30"
            style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
          <div className="absolute bottom-6 left-8 flex items-center gap-5">
            <motion.div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl shadow-xl border border-white/30"
              initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" as const, stiffness: 260, damping: 20, delay: 0.1 }}>
              {product.logo_url ? (
                <img src={product.logo_url} alt={product.name} className="w-14 h-14 rounded-xl object-contain" />
              ) : (
                product.name.charAt(0).toUpperCase()
              )}
            </motion.div>
            <div className="text-white">
              <motion.h2 className="text-3xl font-bold drop-shadow-sm"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>{product.name}</motion.h2>
              <motion.div className="flex items-center gap-3 mt-1.5"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {product.company_name && <span className="text-sm text-white/80">{product.company_name}</span>}
                <span className="text-white/40">·</span>
                <span className="text-sm text-white/80">v{product.version || '1.0.0'}</span>
                {hasTrial && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-400/25 text-emerald-200 border border-emerald-400/30 font-medium">Free Trial</span>
                  </>
                )}
              </motion.div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 p-8 space-y-8">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Overview</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{product.description || 'No description available.'}</p>
              {product.short_description && (
                <p className="text-sm text-[var(--text-secondary)] mt-3 italic">{product.short_description}</p>
              )}
            </motion.div>

            {activePlans.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Pricing Plans</h3>
                <div className="grid gap-3">
                  {activePlans.map((plan, index) => (
                    <motion.div
                      key={plan.id}
                      onClick={() => setSelectedPlanIndex(index)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${
                        selectedPlanIndex === index
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-secondary)]/30 hover:border-indigo-500/40 hover:shadow-sm'
                      }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selectedPlanIndex === index ? 'border-indigo-500' : 'border-[var(--border-color)]'
                          }`}>
                            {selectedPlanIndex === index && (
                              <motion.div className="w-2.5 h-2.5 rounded-full bg-indigo-500"
                                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 400, damping: 15 }} />
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-[var(--text-primary)]">{plan.name}</h4>
                          {plan.is_trial_plan && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">Trial</span>
                          )}
                        </div>
                        {plan.description && <p className="text-xs text-[var(--text-secondary)] mb-2 ml-7">{plan.description}</p>}
                        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] ml-7">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(plan.duration_days)}</span>
                          <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />{plan.max_devices} device{plan.max_devices !== 1 ? 's' : ''}</span>
                        </div>
                        {plan.features && plan.features.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                            {plan.features.slice(0, 4).map((f, i) => (
                              <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <Check className="w-2.5 h-2.5" />{f}
                              </span>
                            ))}
                            {plan.features.length > 4 && (
                              <span className="text-[10px] text-[var(--text-secondary)]">+{plan.features.length - 4} more</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">{plan.price === 0 ? 'Free' : formatPrice(plan.price)}</div>
                        {plan.price > 0 && plan.duration_days > 0 && (
                          <div className="text-[11px] text-[var(--text-secondary)]">per {formatDuration(plan.duration_days)}</div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {(product.docs_url || product.support_url || product.website) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">Resources</h3>
                <div className="flex flex-wrap gap-2">
                  {product.docs_url && (
                    <a href={product.docs_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-indigo-400 hover:border-indigo-500/30 transition-all">
                      <BookOpen className="w-4 h-4" /> Documentation
                    </a>
                  )}
                  {product.support_url && (
                    <a href={product.support_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-indigo-400 hover:border-indigo-500/30 transition-all">
                      <LifeBuoy className="w-4 h-4" /> Support
                    </a>
                  )}
                  {product.website && (
                    <a href={product.website} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-indigo-400 hover:border-indigo-500/30 transition-all">
                      <ExternalLink className="w-4 h-4" /> Website
                    </a>
                  )}
                </div>
              </motion.div>
            )}

            {featuresList.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">Features</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {featuresList.map((f, i) => (
                    <motion.div key={i} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
                      <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      {f}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          <div className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-color)] bg-[var(--bg-secondary)]/20">
            <div className="sticky top-8 p-6 space-y-5">
              {cheapestPrice > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">Starting from</p>
                  <p className="text-4xl font-bold text-[var(--text-primary)]">{formatPrice(cheapestPrice)}</p>
                </motion.div>
              )}

              <div className="flex flex-col gap-2">
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { onBuyNow(product, selectedPlan); }}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/25">
                  <ArrowRight className="w-4 h-4" />
                  Buy Now
                </motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { onAddToCart(product, selectedPlan); }}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl border-2 border-indigo-500/30 text-indigo-400 font-bold text-sm hover:bg-indigo-500/10 transition-all hover:border-indigo-500/50">
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </motion.button>
                {inWishlist ? (
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { onRemoveFromWishlist(product.id, selectedPlan?.id); }}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl border-2 border-rose-400/40 text-rose-400 font-bold text-sm hover:bg-rose-500/10 transition-all">
                    <Heart className="w-4 h-4 fill-current" />
                    Remove from Wishlist
                  </motion.button>
                ) : (
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { onAddToWishlist(product, selectedPlan); }}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl border-2 border-indigo-500/30 text-indigo-400 font-bold text-sm hover:bg-indigo-500/10 transition-all hover:border-indigo-500/50">
                    <Heart className="w-4 h-4" />
                    Add to Wishlist
                  </motion.button>
                )}
              </div>

              {activePlans.length > 0 && (
                <motion.div className="space-y-2 text-xs text-[var(--text-secondary)] pt-4 border-t border-[var(--border-color)]"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" />{activePlans.length} plan{activePlans.length !== 1 ? 's' : ''} available</div>
                  <div className="flex items-center gap-2"><Monitor className="w-3.5 h-3.5 text-emerald-400" />Up to {Math.max(...activePlans.map(p => p.max_devices))} devices</div>
                  {hasTrial && <div className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-emerald-400" />Free trial available</div>}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StarRating() {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className="w-3.5 h-3.5 text-[var(--border-color)]" />
      ))}
    </div>
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

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

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

  const handleBuyNow = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    const params = new URLSearchParams();
    params.set("product", product.name);
    if (plan) params.set("plan", plan.name);
    params.set("version", product.version || "1.0.0");
    router.push(`/contact?${params.toString()}`);
  }, [router]);

  const handleCheckout = useCallback(() => {
    const items = cart.items.map(i => ({
      product: i.product.name,
      plan: i.plan?.name || '',
      version: i.product.version || '1.0.0',
      quantity: i.quantity,
    }));
    const params = new URLSearchParams();
    params.set("cart_items", JSON.stringify(items));
    router.push(`/contact?${params.toString()}`);
  }, [cart.items, router]);

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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <AnimatePresence>
        {toast && (
          <motion.div className="fixed top-4 right-4 z-[100]"
            initial={{ opacity: 0, y: -20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }} transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}>
            <div className={`flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg backdrop-blur-md border ${
              toast.type === "success"
                ? "bg-emerald-500/90 border-emerald-400/30 text-white"
                : "bg-red-500/90 border-red-400/30 text-white"
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                toast.type === "success" ? "bg-white/20" : "bg-white/20"
              }`}>
                {toast.type === "success" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              </div>
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Nav */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-[var(--text-primary)] hidden sm:block">Software Store</span>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search software..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all backdrop-blur-sm" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <motion.button onClick={() => setShowWishlist(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Heart className="w-4 h-4 text-rose-400" />
              {wishlist.items.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {wishlist.items.length}
                </span>
              )}
            </motion.button>
            <motion.button onClick={() => setShowCart(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-400 hover:to-purple-500 transition-all"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <ShoppingCart className="w-4 h-4" />
              {cart.totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-amber-400 text-amber-900 text-[9px] font-bold flex items-center justify-center leading-none">
                  {cart.totalItems}
                </span>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.2) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15) 0%, transparent 40%)' }} />
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-20 text-center">
          <motion.h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-lg"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}>
            Software Store
          </motion.h1>
          <motion.p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }}>
            Discover production-ready software solutions for your business
          </motion.p>
          <motion.div className="mt-6 max-w-md mx-auto relative"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search software..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 transition-all" />
          </motion.div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-[57px] z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mr-2">
              <Filter className="w-4 h-4" />
              <span className="font-medium">{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex-1" />

            {categories.length > 0 && (
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-sm text-[var(--text-primary)] outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {platforms.length > 0 && (
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-sm text-[var(--text-primary)] outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all">
                <option value="">All Platforms</option>
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}

            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-sm text-[var(--text-primary)] outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all">
              <option value="newest">Sort: Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
            </select>

            <div className="flex items-center border border-[var(--border-color)] rounded-xl overflow-hidden">
              <motion.button onClick={() => setViewMode("grid")}
                whileTap={{ scale: 0.9 }}
                className={`p-2 transition-all ${viewMode === "grid" ? "bg-indigo-500/15 text-indigo-400" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                <LayoutGrid className="w-4 h-4" />
              </motion.button>
              <div className="w-px h-4 bg-[var(--border-color)]" />
              <motion.button onClick={() => setViewMode("list")}
                whileTap={{ scale: 0.9 }}
                className={`p-2 transition-all ${viewMode === "list" ? "bg-indigo-500/15 text-indigo-400" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
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
          <motion.div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={containerVariants} initial="hidden" animate="show">
            {filteredProducts.map(product => {
              const hasTrial = product.has_trial || product.plans?.some(p => p.is_trial_plan);
              const cheapestPrice = product.plans && product.plans.length > 0
                ? Math.min(...product.plans.filter(p => p.is_active).map(p => p.price)) : null;
              const planCount = product.plans?.filter(p => p.is_active).length || 0;
              const inWishlist = wishlist.isInWishlist(product.id);
              return (
                <motion.div key={product.id} variants={itemVariants}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="group relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 backdrop-blur-sm overflow-hidden cursor-pointer hover:border-indigo-500/30 hover:shadow-[0_8px_40px_-8px_rgba(99,102,241,0.15)] transition-all duration-300">
                  {product.featured && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30 backdrop-blur-sm">
                      <Star className="w-3 h-3 fill-current" /> Featured
                    </div>
                  )}

                  <div onClick={() => openDetail(product)}>
                    <div className="relative h-36 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)]/80 to-transparent" />
                      <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-lg border border-white/20 shrink-0">
                          {product.logo_url ? (
                            <img src={product.logo_url} alt={product.name} className="w-10 h-10 rounded-xl object-contain" />
                          ) : (
                            <span className="text-white/80 font-bold">{product.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="text-white min-w-0 flex-1">
                          <h3 className="font-bold text-base drop-shadow-sm truncate">{product.name}</h3>
                          <div className="flex items-center gap-2">
                            {product.company_name && <p className="text-[11px] text-white/70 truncate">{product.company_name}</p>}
                            {product.version && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-white/70 font-medium shrink-0">v{product.version}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                        {product.short_description || product.description || 'No description available.'}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {product.product_type && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Tag className="w-2.5 h-2.5" />{product.product_type}
                          </span>
                        )}
                        {product.platform && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <Monitor className="w-2.5 h-2.5" />{product.platform}
                          </span>
                        )}
                        {hasTrial && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">Free Trial</span>
                        )}
                        {product.featured && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30">Featured</span>
                        )}
                      </div>

                      {/* Rating placeholder + Last updated */}
                      <div className="flex items-center justify-between">
                        <StarRating />
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                          {formatDate((product as any).updated_at) || formatDate((product as any).created_at) || "Recently"}
                        </span>
                      </div>

                      {/* Pricing */}
                      {planCount > 0 && cheapestPrice !== null && (
                        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
                          <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                            <Layers className="w-3 h-3" />
                            {planCount} plan{planCount !== 1 ? 's' : ''}
                          </div>
                          <div className="text-lg font-bold text-[var(--text-primary)]">
                            {cheapestPrice === 0 ? 'Free' : `${formatPrice(cheapestPrice)}+`}
                          </div>
                        </div>
                      )}

                      {/* View Details button */}
                      <motion.div className="w-full"
                        initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}>
                        <button className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/20 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                          View Details <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    </div>
                  </div>

                  {/* Quick Actions overlay */}
                  <div className="absolute bottom-14 left-5 right-5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find(p => p.is_active); handleBuyNow(product, firstPlan); }}
                      className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-500 transition-all text-center shadow-lg">
                      Buy Now
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find(p => p.is_active); handleAddToCart(product, firstPlan); }}
                      className="flex-1 px-3 py-2 rounded-lg bg-indigo-600/90 text-white text-[10px] font-bold hover:bg-indigo-500 transition-all text-center backdrop-blur-sm shadow-lg">
                      <ShoppingCart className="w-3 h-3 inline mr-0.5" /> Add to Cart
                    </motion.button>
                    {inWishlist ? (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); wishlist.removeItem(product.id); showToast(`${product.name} removed from wishlist`); }}
                        className="px-3 py-2 rounded-lg bg-rose-500/20 text-rose-400 text-[10px] font-bold hover:bg-rose-500/30 transition-all shadow-lg">
                        <Heart className="w-3 h-3 fill-current" />
                      </motion.button>
                    ) : (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find(p => p.is_active); handleAddToWishlist(product, firstPlan); }}
                        className="px-3 py-2 rounded-lg bg-white/10 text-white/70 text-[10px] font-bold hover:bg-white/20 transition-all shadow-lg">
                        <Heart className="w-3 h-3" />
                      </motion.button>
                    )}
                  </div>

                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.15)' }} />
                </motion.div>
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
              const inWishlist = wishlist.isInWishlist(product.id);
              return (
                <motion.div key={product.id}
                  variants={staggerItem(idx)}
                  whileHover={{ scale: 1.01, x: 2 }}
                  className="group relative flex items-center gap-5 p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm cursor-pointer hover:border-indigo-500/30 hover:shadow-[0_4px_24px_-4px_rgba(99,102,241,0.1)] transition-all duration-300"
                  onClick={() => openDetail(product)}>
                  {product.featured && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30 backdrop-blur-sm">
                      <Star className="w-2.5 h-2.5 fill-current" /> Featured
                    </div>
                  )}

                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center text-2xl shadow-lg border border-white/10 shrink-0">
                    {product.logo_url ? (
                      <img src={product.logo_url} alt={product.name} className="w-11 h-11 rounded-xl object-contain" />
                    ) : (
                      <span className="text-[var(--text-primary)] font-bold">{product.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="font-bold text-base text-[var(--text-primary)] truncate">{product.name}</h3>
                      {product.version && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-medium shrink-0">v{product.version}</span>
                      )}
                      {hasTrial && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-medium shrink-0">Free Trial</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                      {product.company_name && <span>{product.company_name}</span>}
                      {product.platform && <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />{product.platform}</span>}
                      {product.product_type && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{product.product_type}</span>}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1.5 line-clamp-1">
                      {product.short_description || product.description || 'No description available.'}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <StarRating />
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                        {formatDate((product as any).updated_at) || formatDate((product as any).created_at) || "Recently"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    {cheapestPrice !== null && (
                      <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {cheapestPrice === 0 ? 'Free' : `${formatPrice(cheapestPrice)}`}
                      </div>
                    )}
                    {product.plans && product.plans.length > 0 && (
                      <div className="text-[10px] text-[var(--text-secondary)]">{product.plans.filter(p => p.is_active).length} plan{product.plans.filter(p => p.is_active).length !== 1 ? 's' : ''}</div>
                    )}
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find(p => p.is_active); handleBuyNow(product, firstPlan); }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg">
                        Buy Now
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find(p => p.is_active); handleAddToCart(product, firstPlan); }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg">
                        <ShoppingCart className="w-3 h-3 inline mr-1" /> Add to Cart
                      </motion.button>
                      {inWishlist ? (
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={(e) => { e.stopPropagation(); wishlist.removeItem(product.id); showToast(`${product.name} removed from wishlist`); }}
                          className="px-3 py-2 rounded-xl border border-rose-400/30 text-rose-400 text-xs font-bold hover:bg-rose-500/10 transition-all">
                          <Heart className="w-3.5 h-3.5 fill-current" />
                        </motion.button>
                      ) : (
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find(p => p.is_active); handleAddToWishlist(product, firstPlan); }}
                          className="px-3 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-bold hover:bg-[var(--bg-secondary)] transition-all">
                          <Heart className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
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
            onBuyNow={handleBuyNow}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCart && (
          <CartPanel
            key="cart-panel"
            cart={cart}
            wishlist={wishlist}
            onClose={() => setShowCart(false)}
            onRemoveFromCart={(productId, planId) => cart.removeItem(productId, planId)}
            onUpdateQty={(productId, planId, delta) => cart.updateQuantity(productId, planId, delta)}
            onClearCart={() => cart.clearCart()}
            onCheckout={handleCheckout}
            onBuyNow={(item) => handleBuyNow(item.product, item.plan)}
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
    </div>
  );
}
