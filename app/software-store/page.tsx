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
import { usePublicTheme } from "@/app/providers/PublicThemeProvider";
import { useStoreUI } from "./StoreUIContext";

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
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
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
      pending: { label: "Pending", cls: isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200" },
      paid: { label: "Paid", cls: isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200" },
      completed: { label: "Completed", cls: isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200" },
      failed: { label: "Failed", cls: isDark ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-red-50 text-red-700 border-red-200" },
      cancelled: { label: "Cancelled", cls: isDark ? "bg-white/5 text-slate-400 border-white/10" : "bg-slate-100 text-slate-500 border-slate-200" },
    };
    const s = map[status] || { label: status, cls: isDark ? "bg-white/5 text-slate-400 border-white/10" : "bg-slate-100 text-slate-500 border-slate-200" };
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
      <div className={`fixed inset-0 backdrop-blur-sm ${isDark ? "bg-[#02040A]/70" : "bg-slate-900/30"}`} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Purchase history"
        className={`relative w-full max-w-2xl backdrop-blur-2xl shadow-2xl overflow-y-auto border-l ${
          isDark
            ? "bg-[#0B1220]/95 shadow-black/50 border-white/10 text-slate-100"
            : "bg-white/95 shadow-slate-400/20 border-slate-200 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
      >
        <div className={`sticky top-0 z-10 flex items-center justify-between p-5 border-b backdrop-blur-md ${
          isDark ? "border-white/10 bg-[#0B1220]/90" : "border-slate-200 bg-white/90"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isDark ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-600"
            }`}>
              <HistoryIcon className="w-4 h-4" />
            </div>
            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Purchase History</h2>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close purchase history"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className={`text-sm mb-3 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Enter the email you used at checkout to see your orders, payments and license keys.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="you@example.com"
                aria-label="Email used at checkout"
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-white placeholder-slate-500 focus:border-indigo-500/50"
                    : "border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-500"
                }`}
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
            {error && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
          </div>

          {orders && orders.length > 0 && (
            <div className="space-y-3">
              {orders.map((order) => {
                const paid = order.status === "paid" || order.status === "completed" || order.paid_at;
                return (
                  <motion.div
                    key={order.id}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      isDark
                        ? "border-white/10 bg-white/[0.03] hover:border-indigo-400/30"
                        : "border-slate-200 bg-slate-50/70 hover:border-indigo-300 shadow-xs"
                    }`}
                  >
                    <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>
                      <div>
                        <p className={`font-bold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>#{order.order_number}</p>
                        <p className={`text-[11px] mt-0.5 ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                          {formatDate(order.created_at)} · {order.payment_gateway || "checkout"}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        {statusBadge(order.status)}
                        <p className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {formatPrice(order.total)} <span className={`text-[10px] font-normal ${isDark ? "text-slate-500" : "text-slate-500"}`}>{order.currency}</span>
                        </p>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {order.items.length > 0 && (
                        <div className="space-y-1.5">
                          {order.items.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-2 text-xs">
                              <ShoppingBag className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className={`truncate flex-1 ${isDark ? "text-white" : "text-slate-800"}`}>{item.plan_name || item.product_id} × {item.quantity}</span>
                              <span className={isDark ? "text-slate-400" : "text-slate-600"}>{formatPrice(Number(item.total_price) || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {order.payments.length > 0 && (
                        <div className="space-y-1.5">
                          {order.payments.map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-[11px]">
                              <CreditCard className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className={isDark ? "text-slate-400" : "text-slate-600"}>Payment {p.payment_number} · {p.gateway}</span>
                              <span className={`ml-auto font-medium ${p.status === "paid" || p.status === "completed" ? "text-emerald-500" : "text-amber-500"}`}>{p.status}</span>
                              {p.paid_at && <span className="text-slate-400">{formatDate(p.paid_at)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {order.licenses.length > 0 && (
                        <div className="space-y-1.5">
                          {order.licenses.map((l: any) => (
                            <div
                              key={l.license_key}
                              className={`flex items-center gap-2 text-[11px] rounded-lg border px-2.5 py-1.5 ${
                                isDark
                                  ? "border-emerald-400/20 bg-emerald-500/5"
                                  : "border-emerald-200 bg-emerald-50"
                              }`}
                            >
                              <BadgeCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                              <code className={`font-mono truncate flex-1 font-semibold ${isDark ? "text-emerald-300" : "text-emerald-800"}`}>{l.license_key}</code>
                              <span className={isDark ? "text-slate-400" : "text-slate-600"}>{l.plan_name || ""}{l.status ? ` · ${l.status}` : ""}</span>
                              {l.expiry_date && <span className={isDark ? "text-slate-500" : "text-slate-400"}>until {formatDate(l.expiry_date)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {!paid && order.payments.length === 0 && order.licenses.length === 0 && (
                        <p className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>No payment captured for this order.</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {orders && orders.length === 0 && lookedUp && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${
                isDark ? "bg-indigo-500/10 border-white/10" : "bg-indigo-50 border-slate-200"
              }`}>
                <Receipt className={`w-7 h-7 ${isDark ? "text-slate-600" : "text-slate-400"}`} />
              </div>
              <p className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-800"}`}>No purchases found</p>
              <p className={`text-sm mt-1 ${isDark ? "text-slate-500" : "text-slate-500"}`}>We couldn't find any orders for this email address.</p>
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

function ProductCard({ product, cheapestPrice, planCount, hasTrial, inCart, onOpen, onAddToCart, isDark = true }: {
  product: StoreProduct;
  cheapestPrice: number | null;
  planCount: number;
  hasTrial: boolean;
  inCart: boolean;
  onOpen: () => void;
  onAddToCart: () => void;
  isDark?: boolean;
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
        className={`relative flex h-full flex-1 flex-col overflow-hidden rounded-3xl border transition-all duration-500 focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
          isDark
            ? "border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-20px_rgba(0,0,0,0.7)] group-hover:border-indigo-400/30 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(129,140,248,0.18),0_30px_80px_-20px_rgba(99,102,241,0.5)]"
            : "border-slate-200 bg-white shadow-sm hover:shadow-xl hover:border-indigo-400/40"
        }`}
      >
        {/* cursor spotlight */}
        {spot && isDark && (
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
        {isDark && (
          <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-indigo-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        )}

        {/* icon header */}
        <div className="relative h-40 shrink-0 overflow-hidden">
          <div className={`absolute inset-0 ${isDark ? "bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.28),rgba(139,92,246,0.12)_45%,transparent_75%)]" : "bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_75%)]"}`} />
          <motion.div
            className="absolute -inset-x-1/4 -inset-y-1/2 opacity-60"
            style={{ background: "linear-gradient(110deg, rgba(99,102,241,0.22), transparent 35%, rgba(34,211,238,0.16) 55%, transparent 75%, rgba(139,92,246,0.2))" }}
            animate={{ x: ["-20%", "20%"] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 opacity-35"
            style={{ backgroundImage: isDark ? "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)" : "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? "from-[#0B1220]" : "from-white"} via-transparent to-transparent`} />

          {/* status badges */}
          <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5">
            {product.featured && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm ${
                isDark ? "bg-amber-400/15 text-amber-300 border-amber-400/25" : "bg-amber-100 text-amber-800 border-amber-200"
              }`}>
                <Star className="w-3 h-3 fill-current" /> Featured
              </span>
            )}
            {hasTrial && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm ${
                isDark ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}>
                <Sparkles className="w-3 h-3" /> Trial
              </span>
            )}
          </div>

          {/* floating icon */}
          <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
            <motion.div
              className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border shrink-0 ${
                isDark
                  ? "bg-[#0B1220]/85 backdrop-blur-md border-white/10 shadow-[0_8px_30px_-6px_rgba(99,102,241,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] text-white"
                  : "bg-white border-slate-200 shadow-md text-slate-900"
              }`}
              animate={{ y: [0, -5, 0], rotate: [0, 1.5, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-cyan-400/20 opacity-80" />
              <span className="relative text-2xl font-bold">
                {product.logo_url ? (
                  <img src={product.logo_url} alt={product.name} className="w-10 h-10 rounded-xl object-contain" />
                ) : (
                  product.name.charAt(0).toUpperCase()
                )}
              </span>
            </motion.div>
            <div className="min-w-0 flex-1 pb-0.5">
              <h3 className={`font-bold text-base truncate transition-colors duration-300 ${
                isDark ? "text-white group-hover:text-indigo-200" : "text-slate-900 group-hover:text-indigo-600"
              }`}>{product.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {product.company_name && <p className={`text-[11px] truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>{product.company_name}</p>}
                {product.version && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border shrink-0 ${
                    isDark ? "bg-white/10 text-slate-300 border-white/10" : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}>v{product.version}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* body */}
        <div className="flex flex-1 flex-col p-5 pt-4 space-y-3">
          <p className={`text-xs leading-relaxed line-clamp-2 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            {product.short_description || product.description || "No description available."}
          </p>

          {/* chips */}
          <div className="flex flex-wrap gap-1.5">
            {product.product_type && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                isDark ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" : "bg-indigo-50 text-indigo-700 border-indigo-200"
              }`}>
                <Tag className="w-2.5 h-2.5" />{product.product_type}
              </span>
            )}
            {product.platform && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                isDark ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20" : "bg-cyan-50 text-cyan-700 border-cyan-200"
              }`}>
                <Monitor className="w-2.5 h-2.5" />{product.platform}
              </span>
            )}
            {(product.tags || []).slice(0, 2).map((t) => (
              <span key={t} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                isDark ? "bg-white/5 text-slate-400 border-white/10" : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>{t}</span>
            ))}
          </div>

          {/* rating + updated */}
          <div className="flex items-center justify-between">
            <StarRating />
            <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
              <Clock className="w-2.5 h-2.5 inline mr-0.5" />
              {formatDate((product as any).updated_at) || formatDate((product as any).created_at) || "Recently"}
            </span>
          </div>

          {/* pricing */}
          {planCount > 0 && cheapestPrice !== null && (
            <div className={`flex items-center justify-between pt-3 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
              <span className={`flex items-center gap-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Layers className="w-3 h-3" /> {planCount} plan{planCount !== 1 ? "s" : ""}
              </span>
              <span className={`text-lg font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
                {cheapestPrice === 0 ? "Free" : `${formatPrice(cheapestPrice)}+`}
              </span>
            </div>
          )}

          {/* actions — Add to Cart, View Details, Free Trial only */}
          <div className="mt-auto pt-2 space-y-2.5">
            {hasTrial && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-400 text-xs font-semibold hover:bg-emerald-500/15 hover:border-emerald-400/40 active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
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
                    ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/25"
                    : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md hover:brightness-110"
                }`}
              >
                {inCart ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                {inCart ? "In Cart" : "Add to Cart"}
              </motion.button>
              <button
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                className={`group/btn flex-1 flex items-center justify-center gap-1 px-3 py-3 rounded-xl border text-xs font-semibold active:scale-[0.97] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-slate-200 hover:border-indigo-400/40 hover:bg-white/[0.08] hover:text-white"
                    : "border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 hover:border-slate-300"
                }`}
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
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const storeUI = useStoreUI();
  const [showEmailCenter, setShowEmailCenter] = useState(false);
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

  useEffect(() => {
    if (storeUI) {
      storeUI.setDrawerHandlers({
        openCart: () => setShowCart(true),
        openWishlist: () => setShowWishlist(true),
        openHistory: () => setShowHistory(true),
        openEmailCenter: () => setShowEmailCenter(true),
      });
    }
  }, [storeUI]);

  useEffect(() => {
    if (storeUI) {
      storeUI.setCartCount(cart.totalItems);
    }
  }, [cart.totalItems, storeUI]);

  useEffect(() => {
    if (storeUI) {
      storeUI.setWishlistCount(wishlist.items.length);
    }
  }, [wishlist.items.length, storeUI]);

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

  const effectiveQuery = (storeUI?.searchQuery !== undefined && storeUI.searchQuery !== "" ? storeUI.searchQuery : query).trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    const q = effectiveQuery;
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
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? "bg-[#070B14] text-slate-100" : "bg-[#F8FAFC] text-slate-900"}`}>
      <StoreToast toast={toast} />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className={`absolute inset-0 ${isDark ? "bg-[radial-gradient(ellipse_at_50%_-20%,rgba(99,102,241,0.35),transparent_60%),radial-gradient(ellipse_at_85%_10%,rgba(34,211,238,0.12),transparent_50%),radial-gradient(ellipse_at_5%_45%,rgba(139,92,246,0.16),transparent_55%)]" : "bg-[radial-gradient(ellipse_at_50%_-20%,rgba(99,102,241,0.12),transparent_60%),radial-gradient(ellipse_at_85%_10%,rgba(34,211,238,0.06),transparent_50%),radial-gradient(ellipse_at_5%_45%,rgba(139,92,246,0.08),transparent_55%)]"}`} />
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: isDark ? "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)" : "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
        {isDark && (
          <>
            <motion.div className="absolute -top-24 left-[22%] w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"
              animate={{ y: [0, 22, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div className="absolute top-6 right-[20%] w-56 h-56 rounded-full bg-violet-600/15 blur-3xl pointer-events-none"
              animate={{ y: [0, -18, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
          </>
        )}
        <div className="relative max-w-7xl mx-auto px-6 pt-10 pb-8 md:pt-12 md:pb-10 text-center">
          <motion.h1
            className={`text-3xl md:text-5xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
          >
            Software <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent">Store</span>
          </motion.h1>
          <motion.p
            className={`text-base md:text-lg max-w-xl mx-auto mt-2.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            Discover production-ready software solutions for your business
          </motion.p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`backdrop-blur-2xl border-b transition-colors duration-200 ${
        isDark
          ? "bg-[#070B14]/85 border-white/[0.08]"
          : "bg-white/90 border-slate-200 shadow-sm"
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 backdrop-blur-sm ${
              isDark
                ? "text-slate-300 bg-white/[0.04] border border-white/10"
                : "text-slate-700 bg-slate-100 border border-slate-200"
            }`}>
              <Filter className={`w-3.5 h-3.5 ${isDark ? "text-indigo-300" : "text-indigo-600"}`} />
              {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
            </span>

            <div className="flex-1" />

            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className={`px-3 py-2 rounded-xl border text-sm outline-none cursor-pointer backdrop-blur-sm transition-all ${
                  isDark
                    ? "border-white/10 bg-[#0B1220]/90 text-slate-200 hover:border-indigo-500/40"
                    : "border-slate-200 bg-white text-slate-800 hover:border-indigo-500/40 shadow-sm"
                }`}
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
                className={`px-3 py-2 rounded-xl border text-sm outline-none cursor-pointer backdrop-blur-sm transition-all ${
                  isDark
                    ? "border-white/10 bg-[#0B1220]/90 text-slate-200 hover:border-indigo-500/40"
                    : "border-slate-200 bg-white text-slate-800 hover:border-indigo-500/40 shadow-sm"
                }`}
              >
                <option value="">All Platforms</option>
                {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort products"
              className={`px-3 py-2 rounded-xl border text-sm outline-none cursor-pointer backdrop-blur-sm transition-all ${
                isDark
                  ? "border-white/10 bg-[#0B1220]/90 text-slate-200 hover:border-indigo-500/40"
                  : "border-slate-200 bg-white text-slate-800 hover:border-indigo-500/40 shadow-sm"
              }`}
            >
              <option value="newest">Sort: Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
            </select>

            <div className={`flex items-center rounded-xl border p-0.5 ${isDark ? "border-white/10 bg-[#0B1220]/60" : "border-slate-200 bg-slate-100"}`}>
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? isDark ? "bg-white/10 text-white" : "bg-white text-slate-900 shadow-sm"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "list"
                    ? isDark ? "bg-white/10 text-white" : "bg-white text-slate-900 shadow-sm"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
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
            <h3 className={`text-xl font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>Something went wrong</h3>
            <p className={`text-sm mb-6 max-w-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>{error}</p>
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
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 border ${
              isDark ? "bg-indigo-500/10 border-white/10" : "bg-indigo-50 border-slate-200"
            }`}>
              <Search className={`w-10 h-10 ${isDark ? "text-slate-500" : "text-slate-400"}`} />
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>No products found</h3>
            <p className={`text-sm mb-6 max-w-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>We couldn't find any products matching your criteria. Try adjusting your search or filters.</p>
            <motion.button
              onClick={() => {
                setQuery("");
                if (storeUI) storeUI.setSearchQuery("");
                setCategoryFilter("");
                setPlatformFilter("");
              }}
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
                  isDark={isDark}
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
                  className={`group relative flex items-center gap-5 p-5 rounded-2xl border backdrop-blur-xl cursor-pointer transition-all duration-300 ${
                    isDark
                      ? "border-white/10 bg-white/[0.03] hover:border-indigo-400/30 hover:shadow-[0_0_0_1px_rgba(129,140,248,0.15),0_16px_50px_-16px_rgba(99,102,241,0.35)]"
                      : "border-slate-200 bg-white hover:border-indigo-300 shadow-sm hover:shadow-md"
                  }`}
                >
                  {product.featured && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-500 dark:text-amber-300 text-[10px] font-bold border border-amber-400/25 backdrop-blur-sm">
                      <Star className="w-2.5 h-2.5 fill-current" /> Featured
                    </div>
                  )}

                  <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border shrink-0 ${
                    isDark
                      ? "bg-[#0B1220]/85 border-white/10 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.4)] text-white"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}>
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-cyan-400/15" />
                    <span className="relative font-bold">
                      {product.logo_url ? (
                        <img src={product.logo_url} alt={product.name} className="w-11 h-11 rounded-xl object-contain" />
                      ) : (
                        product.name.charAt(0).toUpperCase()
                      )}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className={`font-bold text-base truncate ${isDark ? "text-white" : "text-slate-900"}`}>{product.name}</h3>
                      {product.version && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border shrink-0 ${
                          isDark ? "bg-white/10 text-slate-300 border-white/10" : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>v{product.version}</span>
                      )}
                      {hasTrial && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-600 dark:text-emerald-300 border border-emerald-400/25 font-medium shrink-0">Free Trial</span>
                      )}
                    </div>
                    <div className={`flex items-center gap-3 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {product.company_name && <span>{product.company_name}</span>}
                      {product.platform && <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />{product.platform}</span>}
                      {product.product_type && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{product.product_type}</span>}
                    </div>
                    <p className={`text-xs mt-1.5 line-clamp-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {product.short_description || product.description || "No description available."}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <StarRating />
                      <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                        {formatDate((product as any).updated_at) || formatDate((product as any).created_at) || "Recently"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-2.5">
                    <div>
                      {cheapestPrice !== null && (
                        <div className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {cheapestPrice === 0 ? "Free" : `${formatPrice(cheapestPrice)}`}
                        </div>
                      )}
                      {planCount > 0 && (
                        <div className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>{planCount} plan{planCount !== 1 ? "s" : ""}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.stopPropagation(); const firstPlan = product.plans?.find((p) => p.is_active); handleAddToCart(product, firstPlan); }}
                        aria-label={`Add ${product.name} to cart`}
                        className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                          inCart
                            ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/25"
                            : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] hover:brightness-110"
                        }`}
                      >
                        {inCart ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                        {inCart ? "In Cart" : "Add to Cart"}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.stopPropagation(); openDetail(product); }}
                        className={`group/btn flex items-center justify-center gap-1 px-4 py-3 rounded-xl border text-xs font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                          isDark
                            ? "border-white/10 bg-white/[0.04] text-slate-200 hover:border-indigo-400/40 hover:text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:text-slate-900"
                        }`}
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

      {/* Subtle smooth transition into footer */}
      <div className={`h-10 pointer-events-none ${isDark ? "bg-gradient-to-b from-transparent to-[#070B14]" : "bg-gradient-to-b from-transparent to-[#F8FAFC]"}`} />

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

      {/* Email Center Dialog triggered via StoreUIContext from PublicSiteNav */}
      <StoreEmailCenter open={showEmailCenter} onOpenChange={setShowEmailCenter} />
    </div>
  );
}
