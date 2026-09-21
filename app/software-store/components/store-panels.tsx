// FILE: app/software-store/components/store-panels.tsx
// PURPOSE: Reusable Software Store overlay panels — Cart, Wishlist, Compare
//          modal, Compare tray and the toast notification. Shared by the
//          storefront page and the product details page so there is exactly
//          one implementation of each feature.
//          Fully theme-aware supporting dynamic light and dark modes.

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
import { usePublicTheme } from "@/app/providers/PublicThemeProvider";

export type ToastType = { message: string; type: "success" | "error" } | null;

export function StoreToast({ toast }: { toast: ToastType }) {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

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
                ? isDark
                  ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200 shadow-emerald-500/10"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-500/5"
                : isDark
                  ? "bg-red-500/15 border-red-400/30 text-red-200 shadow-red-500/10"
                  : "bg-red-50 border-red-200 text-red-800 shadow-red-500/5"
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-black/5"}`}>
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
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

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
      <div className={`fixed inset-0 backdrop-blur-sm ${isDark ? "bg-[#02040A]/70" : "bg-slate-900/30"}`} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`relative w-full max-w-lg backdrop-blur-2xl shadow-2xl overflow-y-auto border-l ${
          isDark
            ? "bg-[#0B1220]/95 shadow-black/50 border-white/10 text-slate-100"
            : "bg-white/95 shadow-slate-400/20 border-slate-200 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
        variants={slideInRight}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <div className={`sticky top-0 z-10 flex items-center justify-between p-5 border-b backdrop-blur-md ${
          isDark ? "border-white/10 bg-[#0B1220]/90" : "border-slate-200 bg-white/90"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isDark ? "bg-indigo-500/20 border-indigo-400/30 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-600"
            }`}>
              <ShoppingCart className="w-4 h-4" />
            </div>
            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Cart ({cart.totalItems})</h2>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close cart"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 border ${
                isDark ? "bg-indigo-500/10 border-white/10" : "bg-indigo-50 border-slate-200"
              }`}>
                <ShoppingBag className={`w-8 h-8 ${isDark ? "text-slate-600" : "text-slate-400"}`} />
              </div>
            </motion.div>
            <p className={`font-semibold text-lg ${isDark ? "text-slate-300" : "text-slate-800"}`}>Your cart is empty</p>
            <p className={`text-sm mt-1.5 max-w-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
              Browse our software catalog and add items you'd like to purchase
            </p>
          </div>
        ) : (
          <motion.div className="p-5 space-y-3" variants={containerVariants} initial="hidden" animate="show">
            {cart.items.map((item, idx) => (
              <motion.div
                key={`${item.product.id}-${item.plan?.id || 0}-${idx}`}
                variants={staggerItem(idx)}
                className={`flex gap-3 p-4 rounded-xl border transition-all ${
                  isDark
                    ? "border-white/10 bg-white/[0.03] hover:border-indigo-400/30 hover:bg-white/[0.05]"
                    : "border-slate-200 bg-slate-50/70 hover:border-indigo-300 hover:bg-white shadow-xs"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                  isDark ? "bg-indigo-500/20 border-white/10 text-white" : "bg-indigo-50 border-slate-200 text-slate-900"
                }`}>
                  {item.product.logo_url ? (
                    <img src={item.product.logo_url} alt={item.product.name} className="w-8 h-8 rounded-lg object-contain" />
                  ) : (
                    <span className="font-bold">{item.product.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-bold text-sm truncate ${isDark ? "text-white" : "text-slate-900"}`}>{item.product.name}</h4>
                    {item.product.version && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border shrink-0 ${
                        isDark ? "bg-white/10 text-slate-400 border-white/10" : "bg-slate-200 text-slate-600 border-slate-300"
                      }`}>
                        v{item.product.version}
                      </span>
                    )}
                  </div>
                  {item.plan && <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>{item.plan.name}</p>}
                  <p className={`text-[11px] mt-0.5 ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                    {formatPrice(item.plan?.price || item.product.price || 0)} each
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateQty(item.product.id, item.plan?.id, -1)}
                      aria-label={`Decrease quantity of ${item.product.name}`}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                        isDark
                          ? "border-white/10 hover:bg-white/10 hover:border-indigo-400/40 text-slate-400 hover:text-white"
                          : "border-slate-300 hover:bg-slate-200 hover:border-indigo-400 text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Minus className="w-3 h-3" />
                    </motion.button>
                    <span className={`text-sm font-bold w-6 text-center ${isDark ? "text-white" : "text-slate-900"}`}>{item.quantity}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onUpdateQty(item.product.id, item.plan?.id, 1)}
                      aria-label={`Increase quantity of ${item.product.name}`}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                        isDark
                          ? "border-white/10 hover:bg-white/10 hover:border-indigo-400/40 text-slate-400 hover:text-white"
                          : "border-slate-300 hover:bg-slate-200 hover:border-indigo-400 text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                    {formatPrice((item.plan?.price || item.product.price || 0) * item.quantity)}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onRemoveFromCart(item.product.id, item.plan?.id)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:text-rose-600 transition-colors"
                    aria-label={`Remove ${item.product.name} from cart`}
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </motion.button>
                </div>
              </motion.div>
            ))}

            <div className={`mt-5 overflow-hidden rounded-2xl border ${
              isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50/80"
            }`}>
              <div className={`flex items-center gap-2 px-4 py-3 border-b ${
                isDark ? "border-white/10 bg-indigo-500/10 text-indigo-300" : "border-slate-200 bg-indigo-50 text-indigo-700"
              }`}>
                <Receipt className="w-4 h-4" />
                <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>Order Summary</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>Subtotal</span>
                  <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{formatPrice(cart.totalPrice)}</span>
                </div>
                <label className="flex items-center justify-between text-sm cursor-pointer select-none">
                  <span className={isDark ? "text-slate-400" : "text-slate-600"}>GST ({Math.round(GST_RATE * 100)}%)</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {showGst ? `+${formatPrice(cart.totalPrice * GST_RATE)}` : "-"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showGst}
                      aria-label="Toggle GST"
                      onClick={onToggleGst}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                        showGst ? "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" : isDark ? "bg-white/15" : "bg-slate-300"
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
                <div className={`flex justify-between items-center pt-3 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
                  <span className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Total</span>
                  <span className={`text-lg font-extrabold ${
                    isDark ? "bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent" : "text-indigo-600"
                  }`}>
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
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    isDark
                      ? "border-rose-400/30 text-rose-300 hover:bg-rose-500/10"
                      : "border-rose-200 text-rose-600 hover:bg-rose-50"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    isDark
                      ? "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
                      : "border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
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
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

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
      <div className={`fixed inset-0 backdrop-blur-sm ${isDark ? "bg-[#02040A]/70" : "bg-slate-900/30"}`} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Wishlist"
        className={`relative w-full max-w-lg backdrop-blur-2xl shadow-2xl overflow-y-auto border-l ${
          isDark
            ? "bg-[#0B1220]/95 shadow-black/50 border-white/10 text-slate-100"
            : "bg-white/95 shadow-slate-400/20 border-slate-200 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
        variants={slideInRight}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <div className={`sticky top-0 z-10 flex items-center justify-between p-5 border-b backdrop-blur-md ${
          isDark ? "border-white/10 bg-[#0B1220]/90" : "border-slate-200 bg-white/90"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isDark ? "bg-rose-500/20 border-rose-400/30 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-600"
            }`}>
              <Heart className="w-4 h-4" />
            </div>
            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Wishlist ({wishlist.items.length})</h2>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close wishlist"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        {wishlist.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 border ${
                isDark ? "bg-rose-500/10 border-white/10" : "bg-rose-50 border-slate-200"
              }`}>
                <Heart className={`w-8 h-8 ${isDark ? "text-slate-600" : "text-slate-400"}`} />
              </div>
            </motion.div>
            <p className={`font-semibold text-lg ${isDark ? "text-slate-300" : "text-slate-800"}`}>Your wishlist is empty</p>
            <p className={`text-sm mt-1.5 max-w-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
              Save products you're interested in and come back to them later
            </p>
          </div>
        ) : (
          <motion.div className="p-5 space-y-3" variants={containerVariants} initial="hidden" animate="show">
            {wishlist.items.map((item, idx) => (
              <motion.div
                key={`wl-${item.product.id}-${item.plan?.id || 0}-${idx}`}
                variants={staggerItem(idx)}
                className={`flex gap-3 p-4 rounded-xl border transition-all ${
                  isDark
                    ? "border-white/10 bg-white/[0.03] hover:border-rose-400/30 hover:bg-white/[0.05]"
                    : "border-slate-200 bg-slate-50/70 hover:border-rose-300 hover:bg-white shadow-xs"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                  isDark ? "bg-rose-500/20 border-white/10 text-white" : "bg-rose-50 border-slate-200 text-slate-900"
                }`}>
                  {item.product.logo_url ? (
                    <img src={item.product.logo_url} alt={item.product.name} className="w-8 h-8 rounded-lg object-contain" />
                  ) : (
                    <span className="font-bold">{item.product.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-bold text-sm truncate ${isDark ? "text-white" : "text-slate-900"}`}>{item.product.name}</h4>
                    {item.product.version && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border shrink-0 ${
                        isDark ? "bg-white/10 text-slate-400 border-white/10" : "bg-slate-200 text-slate-600 border-slate-300"
                      }`}>
                        v{item.product.version}
                      </span>
                    )}
                  </div>
                  {item.plan && <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>{item.plan.name}</p>}
                  {item.plan && (
                    <p className={`text-xs font-semibold mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                      {formatPrice(item.plan.price)}
                    </p>
                  )}
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
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      isDark
                        ? "border-rose-400/30 text-rose-300 hover:bg-rose-500/10"
                        : "border-rose-200 text-rose-600 hover:bg-rose-50"
                    }`}
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
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

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
    <tr className={`border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>
      <td className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap w-32 align-top ${
        isDark ? "text-slate-400" : "text-slate-500"
      }`}>
        {label}
      </td>
      {products.map((p) => (
        <td key={p.id} className={`px-4 py-3 text-xs align-top min-w-[160px] ${
          isDark ? "text-white" : "text-slate-900"
        }`}>
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
      <div className={`fixed inset-0 backdrop-blur-md ${isDark ? "bg-[#02040A]/80" : "bg-slate-900/40"}`} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Compare products"
        className={`relative w-full max-w-6xl backdrop-blur-2xl border rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col ${
          isDark
            ? "bg-[#0B1220]/95 border-white/10 shadow-black/50 text-slate-100"
            : "bg-white/98 border-slate-200 shadow-slate-400/30 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 28 }}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
          isDark ? "border-white/10" : "border-slate-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isDark ? "bg-indigo-500/20 border-indigo-400/30 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-600"
            }`}>
              <Scale className="w-4 h-4" />
            </div>
            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Compare Products ({products.length})</h2>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close compare"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className={`border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>
                <th className="px-4 py-4 text-left text-[10px] uppercase tracking-wider text-slate-500 w-32" />
                {products.map((p) => (
                  <th key={p.id} className="px-4 py-4 text-left min-w-[180px] align-top">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                          isDark ? "bg-indigo-500/20 border-white/10 text-white" : "bg-indigo-50 border-slate-200 text-slate-900"
                        }`}>
                          {p.logo_url ? (
                            <img src={p.logo_url} alt={p.name} className="w-7 h-7 rounded-lg object-contain" />
                          ) : (
                            <span className="font-bold">{p.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-bold text-sm truncate max-w-[130px] ${isDark ? "text-white" : "text-slate-900"}`}>{p.name}</p>
                          {p.company_name && (
                            <p className="text-[11px] text-slate-500 truncate max-w-[130px]">{p.company_name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(p.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
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
              {row("Category", (p) => p.product_type || <span className="text-slate-400">-</span>)}
              {row("Platform", (p) => p.platform || <span className="text-slate-400">-</span>)}
              {row("Version", (p) => p.version || <span className="text-slate-400">-</span>)}
              {row("Description", (p) => (
                <span className={`line-clamp-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  {p.short_description || p.description || "-"}
                </span>
              ))}
              {row("Starting Price", (p) => {
                const c = cheapest(p);
                return c === null ? (
                  <span className="text-slate-400">-</span>
                ) : c === 0 ? (
                  <span className="font-bold text-emerald-500">Free</span>
                ) : (
                  <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{formatPrice(c)}</span>
                );
              })}
              {row("Plans", (p) => {
                const plans = activePlans(p);
                if (plans.length === 0) return <span className="text-slate-400">-</span>;
                return (
                  <span className="space-y-1 block">
                    {plans.map((pl) => (
                      <span key={pl.id} className="flex flex-col">
                        <span className={isDark ? "text-white font-medium" : "text-slate-900 font-medium"}>
                          {pl.name}
                          {pl.is_trial_plan && <span className="ml-1 text-[10px] text-emerald-500 font-semibold">(Trial)</span>}
                        </span>
                        <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
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
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Yes
                  </span>
                ) : (
                  <span className="text-slate-400">No</span>
                )
              )}
              {allFeatures.length > 0 &&
                row("Features", (p) => (
                  <span className="space-y-1 block">
                    {allFeatures.map((f) => (
                      <span
                        key={f}
                        className={`flex items-center gap-1.5 text-[11px] ${
                          hasFeature(p, f) ? "text-emerald-500 font-medium" : "text-slate-400 opacity-50"
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
                    <a href={p.docs_url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Docs
                    </a>
                  )}
                  {p.support_url && (
                    <a href={p.support_url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1">
                      <LifeBuoy className="w-3 h-3" /> Support
                    </a>
                  )}
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Website
                    </a>
                  )}
                  {!p.docs_url && !p.support_url && !p.website && <span className="text-slate-400">-</span>}
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
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

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
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl backdrop-blur-2xl border shadow-xl ${
            isDark
              ? "bg-[#0B1220]/95 border-indigo-400/30 shadow-black/80"
              : "bg-white/95 border-indigo-300 shadow-slate-400/30"
          }`}>
            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 pl-1.5 pr-1">
              <Scale className="w-3.5 h-3.5" /> {items.length}/{MAX_COMPARE}
            </span>
            {items.map((p) => (
              <div key={p.id} className="relative group">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm border cursor-pointer ${
                    isDark ? "bg-indigo-500/20 border-white/10 text-white" : "bg-indigo-50 border-slate-200 text-slate-900"
                  }`}
                  title={p.name}
                >
                  {p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} className="w-6 h-6 rounded-lg object-contain" />
                  ) : (
                    <span className="font-bold">{p.name.charAt(0)}</span>
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
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
