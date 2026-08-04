"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShoppingCart, Heart, ArrowRight, Check, Clock, X, Star, ExternalLink, BookOpen, LifeBuoy, Monitor, Smartphone, Globe, Terminal, ChevronLeft, ShieldCheck } from "lucide-react";
import { getProductById, StoreProduct, StoreProductPlan } from "../../services/softwareStoreService";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);

const formatDuration = (days: number) => {
  if (days >= 365) { const y = Math.floor(days / 365); return y === 1 ? "1 year" : `${y} years`; }
  if (days >= 30) { const m = Math.floor(days / 30); return m === 1 ? "1 month" : `${m} months`; }
  return `${days} days`;
};

const STORAGE_CART_KEY = "software_store_cart";
const STORAGE_WISHLIST_KEY = "software_store_wishlist";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(0);
  const [inCart, setInCart] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  const id = params?.id as string;

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    getProductById(id).then((p) => {
      if (mounted) {
        setProduct(p);
        setLoading(false);
        if (p?.plans?.length) {
          const trialIdx = p.plans.findIndex((pl) => pl.is_trial_plan);
          setSelectedPlanIndex(trialIdx >= 0 ? trialIdx : 0);
        }
      }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (!product) return;
    try {
      const cart = JSON.parse(localStorage.getItem(STORAGE_CART_KEY) || "[]");
      setInCart(cart.some((i: any) => i.product.id === product.id));
      const wishlist = JSON.parse(localStorage.getItem(STORAGE_WISHLIST_KEY) || "[]");
      setInWishlist(wishlist.some((i: any) => i.product.id === product.id));
    } catch {}
  }, [product]);

  const addToCart = () => {
    if (!product) return;
    const selectedPlan = product.plans[selectedPlanIndex];
    const cart = JSON.parse(localStorage.getItem(STORAGE_CART_KEY) || "[]");
    const exists = cart.findIndex((i: any) => i.product.id === product.id && (!selectedPlan || i.plan?.id === selectedPlan.id));
    if (exists >= 0) {
      cart[exists].quantity += 1;
    } else {
      cart.push({ product, plan: selectedPlan, quantity: 1, addedAt: new Date().toISOString() });
    }
    localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(cart));
    setInCart(true);
  };

  const toggleWishlist = () => {
    if (!product) return;
    const wishlist = JSON.parse(localStorage.getItem(STORAGE_WISHLIST_KEY) || "[]");
    if (inWishlist) {
      const updated = wishlist.filter((i: any) => i.product.id !== product.id);
      localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(updated));
      setInWishlist(false);
    } else {
      const selectedPlan = product.plans[selectedPlanIndex];
      wishlist.push({ product, plan: selectedPlan, addedAt: new Date().toISOString() });
      localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(wishlist));
      setInWishlist(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 w-48 rounded-xl bg-[var(--border-color)]" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-72 rounded-3xl bg-[var(--border-color)]" />
                <div className="h-6 w-3/4 rounded-xl bg-[var(--border-color)]" />
                <div className="h-4 w-full rounded-xl bg-[var(--border-color)]" />
                <div className="h-4 w-5/6 rounded-xl bg-[var(--border-color)]" />
                <div className="h-4 w-2/3 rounded-xl bg-[var(--border-color)]" />
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
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">🔍</div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Product Not Found</h2>
          <p className="text-[var(--text-secondary)] mb-6">This product doesn't exist or has been removed.</p>
          <button onClick={() => router.push("/software-store")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:from-indigo-500 hover:to-purple-500 transition-all">
            <ChevronLeft className="w-4 h-4" /> Back to Store
          </button>
        </div>
      </div>
    );
  }

  const activePlans = product.plans.filter((p) => p.is_active);
  const selectedPlan = activePlans[selectedPlanIndex];
  const hasTrial = activePlans.some((p) => p.is_trial_plan);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <button onClick={() => router.push("/software-store")} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-indigo-400 transition-colors mb-6">
          <ChevronLeft className="w-4 h-4" /> Back to Store
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left — Product Info */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-8">
            {/* Banner */}
            <div className="relative h-64 md:h-80 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMjAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
              <div className="absolute bottom-6 left-8 flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl shadow-xl border border-white/30">
                  {product.logo_url ? <img src={product.logo_url} alt={product.name} className="w-14 h-14 rounded-xl object-contain" /> : product.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-white">
                  <h1 className="text-3xl md:text-4xl font-extrabold drop-shadow-sm">{product.name}</h1>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {product.company_name && <span className="text-sm text-white/80">{product.company_name}</span>}
                    <span className="text-white/40">·</span>
                    <span className="text-sm text-white/80">v{product.version || "1.0.0"}</span>
                    {product.latest_version && product.latest_version !== product.version && (
                      <>
                        <span className="text-white/40">·</span>
                        <span className="text-sm text-white/80">Latest: v{product.latest_version}</span>
                      </>
                    )}
                    {hasTrial && <span className="text-xs px-3 py-0.5 rounded-full bg-emerald-400/25 text-emerald-200 border border-emerald-400/30 font-medium">Free Trial</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">About This Product</h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{product.description || "No description available."}</p>
              {product.short_description && (
                <p className="text-sm text-[var(--text-secondary)] mt-4 italic border-l-2 border-indigo-500/30 pl-4">{product.short_description}</p>
              )}
            </div>

            {/* Tags & Metadata */}
            <div className="flex flex-wrap gap-2">
              {product.category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {product.category}
                </span>
              )}
              {product.platform && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                  <Monitor className="w-3 h-3" /> {product.platform}
                </span>
              )}
              {product.tags?.map((tag) => (
                <span key={tag} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                  {tag}
                </span>
              ))}
              {product.featured && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Star className="w-3 h-3 fill-current" /> Featured
                </span>
              )}
            </div>

            {/* Pricing Plans */}
            {activePlans.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Available Plans</h2>
                <div className="grid gap-3">
                  {activePlans.map((plan, index) => (
                    <motion.div
                      key={plan.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedPlanIndex(index)}
                      className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${
                        selectedPlanIndex === index
                          ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]"
                          : "border-[var(--border-color)] bg-[var(--bg-secondary)]/30 hover:border-indigo-500/40"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlanIndex === index ? "border-indigo-500" : "border-[var(--border-color)]"}`}>
                            {selectedPlanIndex === index && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                          </div>
                          <h3 className="font-bold text-sm text-[var(--text-primary)]">{plan.name}</h3>
                          {plan.is_trial_plan && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">Trial</span>
                          )}
                        </div>
                        {plan.description && <p className="text-xs text-[var(--text-secondary)] ml-7 mb-2">{plan.description}</p>}
                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] ml-7">
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(plan.duration_days)}</span>
                          <span className="flex items-center gap-1"><Monitor className="w-3.5 h-3.5" />{plan.max_devices} device{plan.max_devices !== 1 ? "s" : ""}</span>
                        </div>
                        {plan.features?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                            {plan.features.slice(0, 4).map((f, i) => (
                              <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <Check className="w-2.5 h-2.5" />{f}
                              </span>
                            ))}
                            {plan.features.length > 4 && <span className="text-[10px] text-[var(--text-secondary)]">+{plan.features.length - 4} more</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">{plan.price === 0 ? "Free" : formatPrice(plan.price)}</div>
                        {plan.price > 0 && plan.duration_days > 0 && <div className="text-[11px] text-[var(--text-secondary)]">per {formatDuration(plan.duration_days)}</div>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Resources */}
            {(product.docs_url || product.support_url || product.website) && (
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">Resources</h2>
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
              </div>
            )}
          </motion.div>

          {/* Right — Purchase Card */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1">
            <div className="sticky top-24 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 backdrop-blur-sm overflow-hidden">
              <div className="p-6 space-y-6">
                {selectedPlan && (
                  <>
                    {activePlans.length > 1 && (
                      <div>
                        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">Select Plan</p>
                        <div className="flex flex-wrap gap-1.5">
                          {activePlans.map((p, i) => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPlanIndex(i)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                selectedPlanIndex === i
                                  ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/40 shadow-[0_0_12px_-4px_rgba(99,102,241,0.4)]"
                                  : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-indigo-500/30 hover:text-[var(--text-primary)]"
                              }`}>
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">{selectedPlan.name}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-extrabold text-[var(--text-primary)]">{selectedPlan.price === 0 ? "Free" : formatPrice(selectedPlan.price)}</p>
                        {selectedPlan.price > 0 && <span className="text-sm text-[var(--text-secondary)]">/{formatDuration(selectedPlan.duration_days)}</span>}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                      {activePlans.length > 0 && (
                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" />{activePlans.length} plan{activePlans.length !== 1 ? "s" : ""} available</div>
                      )}
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" />Up to {selectedPlan.max_devices} device{selectedPlan.max_devices !== 1 ? "s" : ""}</div>
                      <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" />{formatDuration(selectedPlan.duration_days)} access</div>
                      {hasTrial && <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" />Free trial available</div>}
                    </div>

                    {selectedPlan.features?.length > 0 && (
                      <div className="border-t border-[var(--border-color)] pt-4">
                        <p className="text-xs font-bold text-[var(--text-primary)] mb-3">What's included</p>
                        <div className="space-y-2">
                          {selectedPlan.features.map((f, i) => (
                            <div key={i} className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
                              <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                              {f}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-col gap-2.5">
                  <button onClick={addToCart}
                    className={`flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                      inCart
                        ? "bg-emerald-600 text-white shadow-emerald-600/25"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/25"
                    }`}>
                    <ShoppingCart className="w-4 h-4" />
                    {inCart ? "Added to Cart" : "Add to Cart"}
                  </button>
                  <button
                    onClick={() => router.push(`/software-store/checkout`)}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl border-2 border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/5 transition-all">
                    <ArrowRight className="w-4 h-4" />
                    Buy Now
                  </button>
                  <button onClick={toggleWishlist}
                    className={`flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl border-2 transition-all text-sm font-bold ${
                      inWishlist
                        ? "border-red-400/30 text-red-400 hover:bg-red-500/5"
                        : "border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/5"
                    }`}>
                    <Heart className={`w-4 h-4 ${inWishlist ? "fill-current" : ""}`} />
                    {inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 px-4 py-2.5 text-[11px] text-[var(--text-secondary)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Instant license delivery&nbsp;·&nbsp;Secure checkout
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
