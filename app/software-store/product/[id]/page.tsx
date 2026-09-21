// FILE: app/software-store/product/[id]/page.tsx
// PURPOSE: Focused product details experience for the Software Store.
//          The website header/footer are suppressed on this route (see
//          ClientLayout) — the only chrome is a dedicated header with
//          Back to Store, Cart, Wishlist and Compare.
// ACCESS: Public (no login required)
// URL: https://www.websmithdigital.com/software-store/product/[id]
// DATA: Product always loads dynamically from the Internal API via
//       getProductById() (/api/v1/store/products?id=...) — never hardcoded.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Heart, ArrowRight, Check, Clock, Star, ExternalLink,
  BookOpen, LifeBuoy, ChevronLeft, ShieldCheck, Scale, Monitor, Tag,
  Package, Sparkles, Layers, CalendarDays, Building2,
} from "lucide-react";
import { getProductById, StoreProduct } from "../../services/softwareStoreService";
import {
  MAX_COMPARE, formatPrice, formatDuration, formatDate, useCart, useWishlist, useCompare,
} from "../../store-state";
import {
  StoreToast, CartPanel, WishlistPanel, CompareModal, CompareTray,
} from "../../components/store-panels";

// Scoped premium dark theme — matches the storefront and checkout (presentation only).
const PRODUCT_PAGE_DARK_STYLE = {
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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(0);
  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const cart = useCart();
  const wishlist = useWishlist();
  const compare = useCompare();

  const id = params?.id as string;

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    getProductById(id)
      .then((p) => {
        if (mounted) {
          setProduct(p);
          setLoading(false);
          if (p?.plans?.length) {
            const trialIdx = p.plans.findIndex((pl) => pl.is_active && pl.is_trial_plan);
            setSelectedPlanIndex(trialIdx >= 0 ? trialIdx : 0);
          }
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!product) return;
    document.title = `${product.name} — Software Store`;
  }, [product]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]" style={PRODUCT_PAGE_DARK_STYLE}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-10 w-48 rounded-xl bg-[var(--border-color)]" />
            <div className="h-72 md:h-80 rounded-3xl bg-[var(--border-color)]" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-6 w-3/4 rounded-xl bg-[var(--border-color)]" />
                <div className="h-4 w-full rounded-xl bg-[var(--border-color)]" />
                <div className="h-4 w-5/6 rounded-xl bg-[var(--border-color)]" />
                <div className="h-4 w-2/3 rounded-xl bg-[var(--border-color)]" />
                <div className="h-32 rounded-2xl bg-[var(--border-color)]" />
              </div>
              <div className="h-96 rounded-3xl bg-[var(--border-color)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" style={PRODUCT_PAGE_DARK_STYLE}>
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">🔍</div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Product Not Found</h2>
          <p className="text-[var(--text-secondary)] mb-6">This product doesn't exist or has been removed.</p>
          <button
            onClick={() => router.push("/software-store")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:from-indigo-500 hover:to-purple-500 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Store
          </button>
        </div>
      </div>
    );
  }

  const activePlans = product.plans.filter((p) => p.is_active);
  const selectedPlan = activePlans[selectedPlanIndex];
  const inCart = cart.items.some((i) => i.product.id === product.id);
  const inWishlist = wishlist.isInWishlist(product.id, selectedPlan?.id);
  const inCompare = compare.isInCompare(product.id);
  const hasTrial = activePlans.some((p) => p.is_trial_plan);
  const cheapestPrice = activePlans.length > 0 ? Math.min(...activePlans.map((p) => p.price)) : 0;
  const featuresList = selectedPlan?.features || [];
  const tags = product.tags || [];

  const addToCart = () => {
    cart.addItem(product, selectedPlan);
    showToast(inCart ? `${product.name} updated in cart` : `${product.name} added to cart`);
  };

  const toggleWishlist = () => {
    if (inWishlist) {
      wishlist.removeItem(product.id, selectedPlan?.id);
      showToast(`${product.name} removed from wishlist`);
    } else {
      wishlist.addItem(product, selectedPlan);
      showToast(`${product.name} added to wishlist`);
    }
  };

  const toggleCompare = () => {
    if (!inCompare && compare.items.length >= MAX_COMPARE) {
      showToast(`You can compare up to ${MAX_COMPARE} products`, "error");
      return;
    }
    compare.toggle(product);
    showToast(inCompare ? `${product.name} removed from compare` : `${product.name} added to compare`);
  };

  const proceedToCheckout = () => {
    if (!cart.items.some((i) => i.product.id === product.id)) {
      cart.addItem(product, selectedPlan);
    }
    router.push("/software-store/checkout");
  };

  const selectTrialPlan = () => {
    const idx = activePlans.findIndex((p) => p.is_trial_plan);
    if (idx >= 0) {
      setSelectedPlanIndex(idx);
      document.getElementById("pricing-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]" style={PRODUCT_PAGE_DARK_STYLE}>
      <StoreToast toast={toast} />

      {/* Focused product header — Back to Store + Cart/Wishlist/Compare */}
      <header className="sticky top-[65px] z-30 bg-[#070B14]/85 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/software-store")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 text-sm font-semibold hover:border-indigo-400/40 hover:text-white hover:bg-white/[0.06] active:scale-[0.97] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Store
          </button>

          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setShowCompare(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label={`Compare (${compare.items.length} items)`}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-indigo-300 hover:bg-white/[0.07] hover:border-indigo-400/40 transition-all"
            >
              <Scale className="w-4 h-4" />
              {compare.items.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_12px_rgba(99,102,241,0.6)]">
                  {compare.items.length}
                </span>
              )}
            </motion.button>
            <motion.button
              onClick={() => setShowWishlist(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label={`Wishlist (${wishlist.items.length} items)`}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-rose-300 hover:bg-white/[0.07] hover:border-rose-400/40 transition-all"
            >
              <Heart className="w-4 h-4" />
              {wishlist.items.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_12px_rgba(244,63,94,0.6)]">
                  {wishlist.items.length}
                </span>
              )}
            </motion.button>
            <motion.button
              onClick={() => setShowCart(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label={`Cart (${cart.totalItems} items)`}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              {cart.totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-amber-950 text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_12px_rgba(251,191,36,0.7)]">
                  {cart.totalItems}
                </span>
              )}
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10">
        {/* Large Product Hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 240, damping: 24 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,0.4),transparent_55%),radial-gradient(ellipse_at_80%_10%,rgba(139,92,246,0.25),transparent_50%),radial-gradient(ellipse_at_60%_110%,rgba(34,211,238,0.14),transparent_55%)]" />
          <div className="absolute inset-0 opacity-30"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
          <motion.div className="absolute -top-24 left-[30%] w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"
            animate={{ y: [0, 24, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
          <div className="relative px-6 sm:px-10 py-10 md:py-14">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <motion.div
                className="relative w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-[#0B1220]/80 backdrop-blur-md flex items-center justify-center text-5xl border border-white/15 shadow-[0_24px_70px_-15px_rgba(99,102,241,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] shrink-0"
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring" as const, stiffness: 260, damping: 20, delay: 0.1 }}
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-cyan-400/20" />
                <motion.span
                  className="relative font-bold text-white"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                >
                  {product.logo_url ? (
                    <img src={product.logo_url} alt={product.name} className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-contain" />
                  ) : (
                    product.name.charAt(0).toUpperCase()
                  )}
                </motion.span>
              </motion.div>

              <div className="min-w-0 flex-1 text-white">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {product.featured && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 text-[10px] font-bold border border-amber-400/25 backdrop-blur-sm">
                      <Star className="w-3 h-3 fill-current" /> Featured
                    </span>
                  )}
                  {hasTrial && (
                    <button
                      onClick={selectTrialPlan}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-300 text-[10px] font-bold border border-emerald-400/25 backdrop-blur-sm hover:bg-emerald-400/25 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Free Trial
                    </button>
                  )}
                  {product.product_type && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-slate-200 text-[10px] font-semibold border border-white/15 backdrop-blur-sm">
                      <Package className="w-3 h-3" /> {product.product_type}
                    </span>
                  )}
                </div>

                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg">{product.name}</h1>

                {/* Version · Developer */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-1.5"><Layers className="w-4 h-4 text-indigo-300" /> v{product.version || "1.0.0"}</span>
                  {product.latest_version && product.latest_version !== product.version && (
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      <span className="text-slate-500">·</span> Latest: v{product.latest_version}
                    </span>
                  )}
                  {product.company_name && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-slate-500">·</span>
                      <Building2 className="w-4 h-4 text-emerald-300" /> {product.company_name}
                    </span>
                  )}
                  {product.platform && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-slate-500">·</span>
                      <Monitor className="w-4 h-4 text-cyan-300" /> {product.platform}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] text-slate-300 border border-white/10">
                        <Tag className="w-3 h-3" /> {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Starting price strip */}
                {activePlans.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 mt-5 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-indigo-300" />
                      Updated {formatDate((product as any).updated_at) || formatDate((product as any).created_at) || "Recently"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-violet-300" />
                      {activePlans.length} plan{activePlans.length !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                      Starting at <span className="font-bold text-white">{cheapestPrice === 0 ? "Free" : formatPrice(cheapestPrice)}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left column — sections */}
          <div className="lg:col-span-2 space-y-10 min-w-0">
            {/* Overview */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="flex items-center gap-2.5 text-xl font-bold text-white mb-4">
                <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                Overview
              </h2>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
                <p className="text-sm text-slate-300 leading-relaxed">{product.description || "No description available."}</p>
                {product.short_description && (
                  <p className="text-sm text-slate-400 mt-4 italic border-l-2 border-indigo-400/40 pl-4">{product.short_description}</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  {[
                    { label: "Version", value: `v${product.version || "1.0.0"}` },
                    { label: "Developer", value: product.company_name || "Websmith" },
                    { label: "Category", value: product.product_type || "Software" },
                    { label: "Plans", value: `${activePlans.length} active` },
                  ].map((stat) => (
                    <div key={stat.label} className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-sm font-bold text-white mt-1 truncate">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* Pricing Plans */}
            {activePlans.length > 0 && (
              <motion.section
                id="pricing-plans"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
              >
                <h2 className="flex items-center gap-2.5 text-xl font-bold text-white mb-4">
                  <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                  Pricing Plans
                </h2>
                <div className="grid gap-3" role="radiogroup" aria-label="Pricing plans">
                  {activePlans.map((plan, index) => {
                    const selected = selectedPlanIndex === index;
                    return (
                      <motion.div
                        key={plan.id}
                        onClick={() => setSelectedPlanIndex(index)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedPlanIndex(index);
                          }
                        }}
                        whileHover={{ scale: 1.008, y: -2 }}
                        whileTap={{ scale: 0.995 }}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        className={`relative flex items-center justify-between gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 overflow-hidden ${
                          selected
                            ? "border-indigo-400/60 bg-indigo-500/[0.08] shadow-[0_0_0_1px_rgba(129,140,248,0.35),0_0_40px_-8px_rgba(99,102,241,0.5)]"
                            : "border-white/10 bg-white/[0.03] hover:border-indigo-400/30 hover:bg-white/[0.05]"
                        }`}
                      >
                        {selected && (
                          <motion.div
                            className="pointer-events-none absolute inset-0"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ background: "radial-gradient(ellipse at 0% 50%, rgba(99,102,241,0.12), transparent 60%)" }}
                          />
                        )}
                        <div className="flex-1 min-w-0 relative">
                          <div className="flex items-center gap-2.5 mb-1">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${
                              selected ? "border-indigo-400 bg-indigo-500/25" : "border-white/15"
                            }`}>
                              {selected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring" as const, stiffness: 400, damping: 16 }}
                                >
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </motion.div>
                              )}
                            </div>
                            <h3 className="font-bold text-sm text-white">{plan.name}</h3>
                            {plan.is_trial_plan && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">Trial</span>
                            )}
                          </div>
                          {plan.description && <p className="text-xs text-slate-400 mb-2 ml-8">{plan.description}</p>}
                          <div className="flex items-center gap-3 text-xs text-slate-400 ml-8">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(plan.duration_days)}</span>
                            <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />{plan.max_devices} device{plan.max_devices !== 1 ? "s" : ""}</span>
                          </div>
                          {plan.features && plan.features.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                              {plan.features.slice(0, 4).map((f, i) => (
                                <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                  <Check className="w-2.5 h-2.5" />{f}
                                </span>
                              ))}
                              {plan.features.length > 4 && <span className="text-[10px] text-slate-500">+{plan.features.length - 4} more</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 relative">
                          <div className="text-2xl font-extrabold text-white">{plan.price === 0 ? "Free" : formatPrice(plan.price)}</div>
                          {plan.price > 0 && plan.duration_days > 0 && (
                            <div className="text-[11px] text-slate-500">per {formatDuration(plan.duration_days)}</div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* Features */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
            >
              <h2 className="flex items-center gap-2.5 text-xl font-bold text-white mb-4">
                <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                Features
              </h2>
              {featuresList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {featuresList.map((f, i) => (
                    <motion.div
                      key={`${f}-${i}`}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm text-slate-300"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.22 + i * 0.04 }}
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                      {f}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-500">
                  No feature list published for the selected plan.
                </div>
              )}
            </motion.section>

            {/* Resources */}
            {(product.docs_url || product.support_url || product.website) && (
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
              >
                <h2 className="flex items-center gap-2.5 text-xl font-bold text-white mb-4">
                  <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                  Resources
                </h2>
                <div className="flex flex-wrap gap-2">
                  {product.docs_url && (
                    <a href={product.docs_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-300 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all">
                      <BookOpen className="w-4 h-4" /> Documentation
                    </a>
                  )}
                  {product.support_url && (
                    <a href={product.support_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-300 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all">
                      <LifeBuoy className="w-4 h-4" /> Support
                    </a>
                  )}
                  {product.website && (
                    <a href={product.website} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-300 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all">
                      <ExternalLink className="w-4 h-4" /> Website
                    </a>
                  )}
                </div>
              </motion.section>
            )}
          </div>

          {/* Sticky Action Card */}
          <aside className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 }}
              className="sticky top-24 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <div className="p-6 space-y-5">
                {selectedPlan && (
                  <>
                    {/* Plan picker */}
                    {activePlans.length > 1 && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Select Plan</p>
                        <div className="flex flex-wrap gap-1.5">
                          {activePlans.map((p, i) => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPlanIndex(i)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                selectedPlanIndex === i
                                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-400/40 shadow-[0_0_12px_-4px_rgba(99,102,241,0.4)]"
                                  : "border-white/10 text-slate-400 hover:border-indigo-400/30 hover:text-slate-200"
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Price */}
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{selectedPlan.name}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-extrabold text-white">{selectedPlan.price === 0 ? "Free" : formatPrice(selectedPlan.price)}</p>
                        {selectedPlan.price > 0 && selectedPlan.duration_days > 0 && (
                          <span className="text-sm text-slate-400">/ {formatDuration(selectedPlan.duration_days)}</span>
                        )}
                      </div>
                    </div>

                    {/* Included summary */}
                    <div className="space-y-2 text-xs text-slate-400">
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" />{activePlans.length} plan{activePlans.length !== 1 ? "s" : ""} available</div>
                      <div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-indigo-400" />Up to {selectedPlan.max_devices} device{selectedPlan.max_devices !== 1 ? "s" : ""}</div>
                      <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" />{formatDuration(selectedPlan.duration_days)} access</div>
                      {hasTrial && <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" />Free trial available</div>}
                    </div>

                    {selectedPlan.features?.length > 0 && (
                      <div className="border-t border-white/10 pt-4">
                        <p className="text-xs font-bold text-white mb-3">What's included</p>
                        <div className="space-y-2">
                          {selectedPlan.features.slice(0, 5).map((f, i) => (
                            <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                              <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                              {f}
                            </div>
                          ))}
                          {selectedPlan.features.length > 5 && (
                            <p className="text-[11px] text-slate-500 pl-6">+{selectedPlan.features.length - 5} more in full feature list</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2.5 pt-1">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={addToCart}
                    className={`flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                      inCart
                        ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 shadow-[0_0_28px_-8px_rgba(52,211,153,0.5)]"
                        : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_12px_36px_-10px_rgba(99,102,241,0.7)] hover:brightness-110 active:brightness-95"
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {inCart ? "In Cart — Add Another" : "Add to Cart"}
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={proceedToCheckout}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-2xl border border-white/15 bg-white/[0.04] text-slate-200 font-bold text-sm hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Proceed to Checkout
                  </motion.button>

                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={toggleWishlist}
                      className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl border text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 ${
                        inWishlist
                          ? "border-rose-400/40 bg-rose-500/10 text-rose-300"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-rose-400/40 hover:text-rose-300 hover:bg-rose-500/5"
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${inWishlist ? "fill-current" : ""}`} />
                      {inWishlist ? "Saved" : "Wishlist"}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={toggleCompare}
                      className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl border text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                        inCompare
                          ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-300 shadow-[0_0_24px_-8px_rgba(99,102,241,0.5)]"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] hover:border-indigo-400/40 hover:text-indigo-300"
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5" />
                      {inCompare ? "In Compare" : "Compare"}
                    </motion.button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Instant license delivery&nbsp;·&nbsp;Secure checkout
                </div>
              </div>
            </motion.div>
          </aside>
        </div>
      </main>

      {/* Overlays */}
      <AnimatePresence>
        {showCart && (
          <CartPanel
            key="product-cart-panel"
            cart={cart}
            onClose={() => setShowCart(false)}
            onRemoveFromCart={(productId, planId) => cart.removeItem(productId, planId)}
            onUpdateQty={(productId, planId, delta) => cart.updateQuantity(productId, planId, delta)}
            onClearCart={() => cart.clearCart()}
            onCheckout={() => router.push("/software-store/checkout")}
            showGst={false}
            onToggleGst={() => {}}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWishlist && (
          <WishlistPanel
            key="product-wishlist-panel"
            wishlist={wishlist}
            cart={cart}
            onClose={() => setShowWishlist(false)}
            onAddToCart={(product, plan) => { cart.addItem(product, plan); showToast(`${product.name} moved to cart`); }}
            onRemoveFromWishlist={(productId, planId) => wishlist.removeItem(productId, planId)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCompare && compare.items.length >= 2 && (
          <CompareModal
            key="product-compare-modal"
            products={compare.items}
            onClose={() => setShowCompare(false)}
            onRemove={(id) => { compare.remove(id); if (compare.items.length - 1 < 2) setShowCompare(false); }}
          />
        )}
      </AnimatePresence>

      <CompareTray
        items={compare.items}
        onRemove={(id) => compare.remove(id)}
        onClear={() => compare.clear()}
        onOpen={() => compare.items.length >= 2 && setShowCompare(true)}
      />
    </div>
  );
}
