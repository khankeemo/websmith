// FILE: app/software-store/page.tsx
// PURPOSE: Public Software Storefront. Loads the live product catalog from the
//          Internal API exclusively via getPublicProducts() (/api/v1/store/products)
//          — no hardcoded products, no mock data, no generated IDs.
// ACCESS: Public (no login required)
// URL: https://www.websmithdigital.com/software-store
// FLOW: Store → Product Card → Details View (/software-store/product/[id])
//       → Select Plan → Add to Cart → Proceed to Checkout (/software-store/checkout)

"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, Heart, X, Check, Clock, ChevronRight,
  Star, LayoutGrid, List, Filter,
  Sparkles, Tag, Monitor, Layers, Package, Loader2, AlertCircle,
  ShoppingBag, RefreshCw, History as HistoryIcon,
  Receipt, BadgeCheck, CreditCard, ArrowUpRight,
} from "lucide-react";
import { getPublicProducts, StoreProduct, StoreProductPlan } from "./services/softwareStoreService";
import { getSoftwareStoreVisibility } from "@/core/services/publicSettingsService";
import {
  STORAGE_HISTORY_EMAIL_KEY, MAX_COMPARE, containerVariants, itemVariants,
  staggerItem, formatPrice, formatDate, useCart, useWishlist,
  useCompare, STORE_DARK_STYLE,
} from "./store-state";
import {
  StoreToast, CartPanel, WishlistPanel, CompareModal, CompareTray,
} from "./components/store-panels";
import StoreEmailCenter from "./components/store-email-center";

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
      pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
      paid: { label: "Paid", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
      completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
      failed: { label: "Failed", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
      cancelled: { label: "Cancelled", cls: "bg-white/5 text-slate-400 border-white/10" },
    };
    const s = map[status] || { label: status, cls: "bg-white/5 text-slate-400 border-white/10" };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>{s.label}</span>;
  };

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
        aria-label="Purchase history"
        className="relative w-full max-w-2xl bg-[var(--bg-secondary)]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-y-auto border-l border-white/10"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/10 bg-[var(--bg-secondary)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/25 flex items-center justify-center border border-emerald-400/20">
              <HistoryIcon className="w-4 h-4 text-emerald-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Purchase History</h2>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close purchase history"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4 text-slate-400" />
          </motion.button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-slate-400 mb-3">Enter the email you used at checkout to see your orders, payments and license keys.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="you@example.com"
                aria-label="Email used at checkout"
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={lookup}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} Lookup
              </motion.button>
            </div>
            {error && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
          </div>

          {orders && orders.length > 0 && (
            <div className="space-y-3">
              {orders.map((order) => {
                const paid = order.status === "paid" || order.status === "completed" || order.paid_at;
                return (
                  <motion.div key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-indigo-400/30 transition-all">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                      <div>
                        <p className="font-bold text-sm text-white">#{order.order_number}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(order.created_at)} · {order.payment_gateway || "checkout"}</p>
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
                              <span className={`ml-auto ${p.status === "paid" || p.status === "completed" ? "text-emerald-400" : "text-amber-400"}`}>{p.status}</span>
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
                              <span className="text-slate-500">{l.plan_name || ""}{l.status ? ` · ${l.status}` : ""}</span>
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
      {[1, 2, 3, 4, 5].map((i) => (
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
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.02, y: -10 }}
      transition={{ type: "spring" as const, stiffness: 260, damping: 22 }}
      onClick={onOpen}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setSpot(null)}
      className="group relative h-full flex flex-col cursor-pointer focus-visible:outline-none"
      role="button"
      tabIndex={0}
      aria-label={`View details of ${product.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {/* animated conic border — revealed on hover */}
      <div className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <motion.div
          className="absolute inset-0 rounded-3xl"
          style={{ background: "conic-gradient(from 0deg, rgba(99,102,241,0.9), rgba(139,92,246,0.6), rgba(34,211,238,0.7), rgba(99,102,241,0.9))" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div
        className="relative flex h-full flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-20px_rgba(0,0,0,0.7)]
        group-hover:border-indigo-400/30 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(129,140,248,0.18),0_30px_80px_-20px_rgba(99,102,241,0.5)]
        focus-visible:ring-2 focus-visible:ring-indigo-400/50 transition-all duration-500"
      >
        {/* cursor spotlight */}
        {spot && (
          <div
            className="pointer-events-none absolute z-10 h-72 w-72 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              left: spot.x - 144,
              top: spot.y - 144,
              background: "radial-gradient(circle, rgba(99,102,241,0.14), transparent 60%)",
            }}
          />
        )}

        {/* hover glow orb */}
        <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-indigo-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* icon header */}
        <div className="relative h-40 shrink-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.28),rgba(139,92,246,0.12)_45%,transparent_75%)]" />
          <motion.div
            className="absolute -inset-x-1/4 -inset-y-1/2 opacity-60"
            style={{ background: "linear-gradient(110deg, rgba(99,102,241,0.22), transparent 35%, rgba(34,211,238,0.16) 55%, transparent 75%, rgba(139,92,246,0.2))" }}
            animate={{ x: ["-20%", "20%"] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
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
              animate={{ y: [0, -5, 0], rotate: [0, 1.5, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
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
            {product.short_description || product.description || "No description available."}
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
            {(product.tags || []).slice(0, 2).map((t) => (
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
                <Layers className="w-3 h-3" /> {planCount} plan{planCount !== 1 ? "s" : ""}
              </span>
              <span className="text-lg font-extrabold text-white">
                {cheapestPrice === 0 ? "Free" : `${formatPrice(cheapestPrice)}+`}
              </span>
            </div>
          )}

          {/* actions — Add to Cart, View Details, Free Trial only */}
          <div className="mt-auto pt-2 space-y-2.5">
            {hasTrial && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-300 text-xs font-semibold hover:bg-emerald-500/15 hover:border-emerald-400/40 hover:shadow-[0_0_28px_-8px_rgba(52,211,153,0.5)] active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              >
                <Sparkles className="w-3 h-3" /> Free Trial
              </button>
            )}
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
                aria-label={`Add ${product.name} to cart`}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                  inCart
                    ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 hover:shadow-[0_0_24px_-6px_rgba(52,211,153,0.5)]"
                    : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_8px_28px_-8px_rgba(99,102,241,0.6)] hover:brightness-110 hover:shadow-[0_10px_36px_-8px_rgba(99,102,241,0.8)]"
                }`}
              >
                {inCart ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                {inCart ? "In Cart" : "Add to Cart"}
              </motion.button>
              <button
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                className="group/btn flex-1 flex items-center justify-center gap-1 px-3 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 text-xs font-semibold hover:border-indigo-400/40 hover:bg-white/[0.08] hover:text-white active:scale-[0.97] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
              >
                View Details
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
              </button>
            </div>
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
  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showGst, setShowGst] = useState(false);

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
          setProducts(productData.filter((p) => p.is_active));
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
    products.forEach((p) => { if (p.product_type) set.add(p.product_type); });
    return Array.from(set).sort();
  }, [products]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.platform) set.add(p.platform); });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = products.filter((p) => {
      const matchesSearch = !q || [p.name, p.short_description || p.description, p.company_name].filter(Boolean).join(" ").toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || p.product_type === categoryFilter;
      const matchesPlatform = !platformFilter || p.platform === platformFilter;
      return matchesSearch && matchesCategory && matchesPlatform;
    });

    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => {
          const aP = a.plans?.length ? Math.min(...a.plans.filter((p) => p.is_active).map((p) => p.price)) : Infinity;
          const bP = b.plans?.length ? Math.min(...b.plans.filter((p) => p.is_active).map((p) => p.price)) : Infinity;
          return aP - bP;
        });
        break;
      case "price-desc":
        result.sort((a, b) => {
          const aP = a.plans?.length ? Math.min(...a.plans.filter((p) => p.is_active).map((p) => p.price)) : 0;
          const bP = b.plans?.length ? Math.min(...b.plans.filter((p) => p.is_active).map((p) => p.price)) : 0;
          return bP - aP;
        });
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        result.sort((a, b) => (b.display_order ?? 999) - (a.display_order ?? 999));
        break;
    }
    return result;
  }, [products, query, categoryFilter, platformFilter, sortBy]);

  // Store → Product Card → Details View: cards navigate to the focused
  // product details page (/software-store/product/[id]).
  const openDetail = (product: StoreProduct) => {
    router.push(`/software-store/product/${encodeURIComponent(product.id)}`);
  };

  const handleCheckout = useCallback(() => {
    // Cart is already persisted to localStorage by the cart hook.
    if (cart.items.length === 0) {
      showToast("Your cart is empty");
      return;
    }
    router.push("/software-store/checkout");
  }, [cart.items.length, router, showToast]);

  const handleAddToCart = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    cart.addItem(product, plan);
    showToast(`${product.name} added to cart`);
  }, [cart, showToast]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const productData = await getPublicProducts();
        setProducts(productData.filter((p) => p.is_active));
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
      <StoreToast toast={toast} />

      {/* Sticky Nav */}
      <div className="sticky top-0 z-40 bg-[#070B14]/85 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <motion.div
              className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-500 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)]"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/40 to-cyan-400/30 opacity-70" />
              <Package className="w-4 h-4 text-white relative" />
            </motion.div>
            <span className="text-sm font-bold text-white hidden sm:block tracking-tight">Software Store</span>
          </div>

          <div className="hidden sm:block flex-1 max-w-md relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search software..."
              aria-label="Search software"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all backdrop-blur-sm"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              onClick={() => setShowHistory(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-emerald-300 hover:bg-white/[0.07] hover:border-emerald-400/40 transition-all"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label="Purchase History"
              title="Purchase History"
            >
              <HistoryIcon className="w-4 h-4" />
            </motion.button>
            <motion.button
              onClick={() => setShowWishlist(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-rose-300 hover:bg-white/[0.07] hover:border-rose-400/40 transition-all"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label={`Wishlist (${wishlist.items.length} items)`}
            >
              <Heart className="w-4 h-4" />
              {wishlist.items.length > 0 && (
                <motion.span
                  key={`wish-${wishlist.items.length}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" as const, stiffness: 500, damping: 16 }}
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                >
                  {wishlist.items.length}
                </motion.span>
              )}
            </motion.button>
            <motion.button
              onClick={() => setShowCart(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label={`Cart (${cart.totalItems} items)`}
            >
              <ShoppingCart className="w-4 h-4" />
              {cart.totalItems > 0 && (
                <motion.span
                  key={`cart-${cart.totalItems}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" as const, stiffness: 500, damping: 16 }}
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-amber-950 text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_12px_rgba(251,191,36,0.7)]"
                >
                  {cart.totalItems}
                </motion.span>
              )}
            </motion.button>
            <StoreEmailCenter />
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
          <motion.span
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-indigo-400/25 bg-indigo-500/10 text-indigo-300 text-xs font-semibold backdrop-blur-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 22 }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Premium Software Marketplace
          </motion.span>
          <motion.h1
            className="text-4xl md:text-6xl font-extrabold text-white mt-4 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24, delay: 0.05 }}
          >
            Software <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">Store</span>
          </motion.h1>
          <motion.p
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.4 }}
          >
            Discover production-ready software solutions for your business
          </motion.p>
          <motion.div
            className="mt-7 max-w-md mx-auto relative"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search software..."
              aria-label="Search software"
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 text-white placeholder-slate-500 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
            />
          </motion.div>
          {!loading && products.length > 0 && (
            <motion.p
              className="text-xs text-slate-500 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {products.length} products available · instant license delivery · secure checkout
            </motion.p>
          )}
        </div>
      </div>

      {/* Filter Bar — sticky flush below the nav (nav = 60px content + 1px border) */}
      <div className="sticky top-[61px] z-30 bg-[#070B14]/85 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
              <Filter className="w-3.5 h-3.5 text-indigo-300" />
              {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
            </span>

            <div className="flex-1" />

            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className="px-3 py-2 rounded-xl border border-white/10 bg-[#0B1220]/90 text-sm text-slate-200 outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all"
              >
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {platforms.length > 0 && (
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                aria-label="Filter by platform"
                className="px-3 py-2 rounded-xl border border-white/10 bg-[#0B1220]/90 text-sm text-slate-200 outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all"
              >
                <option value="">All Platforms</option>
                {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort products"
              className="px-3 py-2 rounded-xl border border-white/10 bg-[#0B1220]/90 text-sm text-slate-200 outline-none cursor-pointer backdrop-blur-sm hover:border-indigo-500/40 transition-all"
            >
              <option value="newest">Sort: Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
            </select>

            <div className="flex items-center border border-white/10 rounded-xl overflow-hidden bg-white/[0.03]">
              <motion.button
                onClick={() => setViewMode("grid")}
                whileTap={{ scale: 0.9 }}
                aria-label="Grid view"
                className={`p-2 transition-all ${viewMode === "grid" ? "bg-indigo-500/25 text-indigo-300" : "text-slate-400 hover:text-white"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </motion.button>
              <div className="w-px h-4 bg-white/10" />
              <motion.button
                onClick={() => setViewMode("list")}
                whileTap={{ scale: 0.9 }}
                aria-label="List view"
                className={`p-2 transition-all ${viewMode === "list" ? "bg-indigo-500/25 text-indigo-300" : "text-slate-400 hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <SkeletonCard />
              </motion.div>
            ))}
          </div>
        ) : error ? (
          <motion.div
            className="flex flex-col items-center justify-center py-24 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/10 to-rose-500/10 flex items-center justify-center mb-5 border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Something went wrong</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs">{error}</p>
            <motion.button
              onClick={handleRetry}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-purple-500 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </motion.button>
          </motion.div>
        ) : filteredProducts.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-24 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-6 border border-[var(--border-color)]">
              <Search className="w-10 h-10 text-[var(--border-color)]" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No products found</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs">We couldn't find any products matching your criteria. Try adjusting your search or filters.</p>
            <motion.button
              onClick={() => { setQuery(""); setCategoryFilter(""); setPlatformFilter(""); }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-purple-500 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Clear All Filters
            </motion.button>
          </motion.div>
        ) : viewMode === "grid" ? (
          <motion.div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch" variants={containerVariants} initial="hidden" animate="show">
            {filteredProducts.map((product) => {
              const hasTrial = product.has_trial || product.plans?.some((p) => p.is_trial_plan);
              const cheapestPrice = product.plans && product.plans.length > 0
                ? Math.min(...product.plans.filter((p) => p.is_active).map((p) => p.price))
                : null;
              const planCount = product.plans?.filter((p) => p.is_active).length || 0;
              const inCart = cart.items.some((i) => i.product.id === product.id);
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
                    const firstPlan = product.plans?.find((p) => p.is_active);
                    handleAddToCart(product, firstPlan);
                  }}
                />
              );
            })}
          </motion.div>
        ) : (
          /* List View */
          <motion.div className="space-y-4" variants={containerVariants} initial="hidden" animate="show">
            {filteredProducts.map((product, idx) => {
              const hasTrial = product.has_trial || product.plans?.some((p) => p.is_trial_plan);
              const cheapestPrice = product.plans && product.plans.length > 0
                ? Math.min(...product.plans.filter((p) => p.is_active).map((p) => p.price))
                : null;
              const planCount = product.plans?.filter((p) => p.is_active).length || 0;
              const inCart = cart.items.some((i) => i.product.id === product.id);
              return (
                <motion.div
                  key={product.id}
                  variants={staggerItem(idx)}
                  whileHover={{ x: 4 }}
                  onClick={() => openDetail(product)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details of ${product.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(product);
                    }
                  }}
                  className="group relative flex items-center gap-5 p-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl cursor-pointer hover:border-indigo-400/30 hover:shadow-[0_0_0_1px_rgba(129,140,248,0.15),0_16px_50px_-16px_rgba(99,102,241,0.35)] transition-all duration-300"
                >
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
                      {product.short_description || product.description || "No description available."}
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
                          {cheapestPrice === 0 ? "Free" : `${formatPrice(cheapestPrice)}`}
                        </div>
                      )}
                      {planCount > 0 && (
                        <div className="text-[10px] text-slate-500">{planCount} plan{planCount !== 1 ? "s" : ""}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find((p) => p.is_active); handleAddToCart(product, firstPlan); }}
                        aria-label={`Add ${product.name} to cart`}
                        className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                          inCart
                            ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25"
                            : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] hover:brightness-110"
                        }`}
                      >
                        {inCart ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                        {inCart ? "In Cart" : "Add to Cart"}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.stopPropagation(); openDetail(product); }}
                        className="group/btn flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 text-xs font-semibold hover:border-indigo-400/40 hover:text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                      >
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
            onToggleGst={() => setShowGst((v) => !v)}
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
            onRemove={(id) => { compare.remove(id); if (compare.items.length - 1 < 2) setShowCompare(false); }}
          />
        )}
      </AnimatePresence>

      {/* Compare tray — fixed bottom bar */}
      <CompareTray
        items={compare.items}
        onRemove={(id) => compare.remove(id)}
        onClear={() => compare.clear()}
        onOpen={() => compare.items.length >= 2 && setShowCompare(true)}
      />
    </div>
  );
}
