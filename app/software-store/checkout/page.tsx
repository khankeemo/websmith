"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Lock, CreditCard, ShieldCheck, Check, X,
  ChevronRight, Clock, AlertCircle, ArrowLeft, Tag, MessageSquare,
  MapPin, Building2, Globe, Phone, Mail, User, Package, BadgePercent
} from "lucide-react";
import { StoreProduct, StoreProductPlan } from "../services/softwareStoreService";

const STORAGE_CART_KEY = "software_store_cart";

interface CartItem {
  product: StoreProduct;
  plan?: StoreProductPlan;
  quantity: number;
  addedAt: string;
}

type PaymentMethod = "credit_card" | "paypal" | "razorpay" | "paddle" | "bank_transfer" | "manual_invoice";

interface PaymentMethodInfo {
  id: PaymentMethod;
  label: string;
  icon: string;
}

const paymentMethods: PaymentMethodInfo[] = [
  { id: "credit_card", label: "Credit Card", icon: "💳" },
  { id: "paypal", label: "PayPal", icon: "🅿️" },
  { id: "razorpay", label: "Razorpay", icon: "💰" },
  { id: "paddle", label: "Paddle", icon: "🛶" },
  { id: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
  { id: "manual_invoice", label: "Manual Invoice", icon: "📄" },
];

const countries = [
  "United States", "Canada", "United Kingdom", "Germany", "France",
  "Australia", "India", "Japan", "Brazil", "Netherlands",
  "Singapore", "United Arab Emirates", "South Korea", "Sweden", "Norway",
  "Denmark", "Finland", "Switzerland", "New Zealand", "Ireland",
  "Spain", "Italy", "China", "Mexico", "South Africa",
];

function OrderSummarySkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 p-6 animate-pulse space-y-4">
      <div className="h-6 w-32 rounded-lg bg-[var(--border-color)]" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--border-color)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-[var(--border-color)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--border-color)]" />
            </div>
            <div className="h-4 w-16 rounded bg-[var(--border-color)]" />
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--border-color)] pt-4 space-y-2">
        <div className="h-4 w-full rounded bg-[var(--border-color)]" />
        <div className="h-4 w-full rounded bg-[var(--border-color)]" />
        <div className="h-4 w-full rounded bg-[var(--border-color)]" />
        <div className="h-6 w-full rounded bg-[var(--border-color)]" />
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-6">
        <ShoppingCart className="w-12 h-12 text-[var(--border-color)]" />
      </div>
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Your cart is empty</h2>
      <p className="text-[var(--text-secondary)] mb-8 max-w-md">
        Looks like you haven&apos;t added any products yet. Browse our store to find what you need.
      </p>
      <a
        href="/software-store"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25"
      >
        Browse Store <ChevronRight className="w-4 h-4" />
      </a>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm ${
        type === "success" ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
      }`}
    >
      {type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  return <Toast message={message} type="success" onClose={onClose} />;
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  return <Toast message={message} type="error" onClose={onClose} />;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CART_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCartItems(parsed);
        }
      }
    } catch {
      console.error("Failed to parse cart");
    } finally {
      setLoading(false);
    }
  }, []);

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = item.plan?.price || item.product.price || 0;
      return sum + price * item.quantity;
    }, 0);
  }, [cartItems]);

  const discount = couponApplied ? subtotal * 0.1 : 0;
  const grandTotal = subtotal - discount;

  const handleApplyCoupon = useCallback(() => {
    if (!couponCode.trim()) {
      setToast({ message: "Please enter a coupon code", type: "error" });
      return;
    }
    setCouponApplied(true);
    setToast({ message: `Coupon "${couponCode}" applied! 10% discount`, type: "success" });
  }, [couponCode]);

  const handlePaymentSelect = useCallback((method: PaymentMethod) => {
    setSelectedPayment(method);
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 4000);
  }, []);

  const handlePlaceOrder = useCallback(async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setToast({ message: "Please fill in required fields (Name, Email, Phone)", type: "error" });
      return;
    }

    if (cartItems.length === 0) {
      setToast({ message: "Your cart is empty", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const itemsText = cartItems.map(item =>
        `${item.product.name}${item.plan ? ` (${item.plan.name})` : ""} x${item.quantity} - $${((item.plan?.price || item.product.price || 0) * item.quantity).toFixed(2)}`
      ).join("\n");

      const primary = cartItems[0];
      const payload = {
        product_name: primary.product.name,
        selected_plan: primary.plan?.name || null,
        product_version: primary.product.version || null,
        full_name: fullName.trim(),
        email: email.trim(),
        mobile: phone.trim(),
        company: company.trim() || null,
        country: country || null,
        requirements: [
          orderNotes ? `Notes: ${orderNotes}` : "",
          cartItems.length > 1 ? `All items:\n${itemsText}` : "",
          `Payment method: ${selectedPayment ? paymentMethods.find(p => p.id === selectedPayment)?.label || "Not selected" : "Not selected"}`,
          `Address: ${addressLine}, ${city}, ${state} ${postalCode}, ${country}`,
        ].filter(Boolean).join("\n\n"),
      };

      const res = await fetch("/internal/backend/store/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit order");
      }

      localStorage.removeItem(STORAGE_CART_KEY);
      router.push("/software-store/checkout/success");
    } catch (error: any) {
      setToast({ message: error.message || "Something went wrong. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [fullName, email, phone, company, country, state, city, postalCode, addressLine, orderNotes, cartItems, selectedPayment, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="h-8 w-48 rounded-lg bg-[var(--border-color)] animate-pulse mb-8" />
          <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 p-6 animate-pulse space-y-4">
                  <div className="h-5 w-32 rounded bg-[var(--border-color)]" />
                  <div className="h-10 w-full rounded-xl bg-[var(--border-color)]" />
                  <div className="h-10 w-full rounded-xl bg-[var(--border-color)]" />
                </div>
              ))}
            </div>
            <div className="lg:col-span-2">
              <OrderSummarySkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <AnimatePresence>
        {toast && (
          toast.type === "success" ? (
            <SuccessToast key="toast" message={toast.message} onClose={() => setToast(null)} />
          ) : (
            <ErrorToast key="toast" message={toast.message} onClose={() => setToast(null)} />
          )
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <a href="/software-store" className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Store
          </a>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Checkout</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid lg:grid-cols-5 gap-8"
        >
          {/* Left Column */}
          <div className="lg:col-span-3 space-y-6">
            {/* Contact Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <User className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Contact Information</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Full Name <span className="text-red-400">*</span></label>
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Company</label>
                  <input
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="Acme Inc."
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="john@acme.com"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Phone <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>
              </div>
            </motion.div>

            {/* Billing Address */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Billing Address</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Country</label>
                  <select
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select your country</option>
                    {countries.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">State / Province</label>
                  <input
                    value={state}
                    onChange={e => setState(e.target.value)}
                    placeholder="California"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">City</label>
                  <input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="San Francisco"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Postal Code</label>
                  <input
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    placeholder="94102"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Address Line</label>
                  <input
                    value={addressLine}
                    onChange={e => setAddressLine(e.target.value)}
                    placeholder="123 Main Street, Suite 100"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>
              </div>
            </motion.div>

            {/* Coupon Code */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <BadgePercent className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Coupon Code</h2>
              </div>
              <div className="flex gap-3">
                <input
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  disabled={couponApplied}
                  className="flex-1 px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all disabled:opacity-50"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={couponApplied}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                >
                  Apply
                </button>
              </div>
              {couponApplied && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-center gap-1.5 mt-3 text-sm text-emerald-400 font-medium"
                >
                  <Check className="w-4 h-4" /> Coupon &quot;{couponCode}&quot; applied — 10% discount
                </motion.p>
              )}
            </motion.div>

            {/* Order Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Order Notes</h2>
              </div>
              <textarea
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Special instructions, additional details, or questions..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all resize-none"
              />
            </motion.div>

            {/* Payment Method Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Payment Method</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => handlePaymentSelect(method.id)}
                    className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                      selectedPayment === method.id
                        ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]"
                        : "border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-indigo-500/40"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedPayment === method.id ? "border-indigo-500" : "border-[var(--border-color)]"
                    }`}>
                      {selectedPayment === method.id && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{method.icon}</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{method.label}</span>
                    </div>
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                      Coming Soon
                    </span>
                  </button>
                ))}
              </div>
              {showComingSoon && selectedPayment && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400"
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Payment gateway integration coming soon. Your order will be submitted as an enquiry.</span>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Right Column — Order Summary */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-8">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6 relative overflow-hidden"
                style={{
                  border: "1px solid var(--border-color)",
                }}
              >
                <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(147,51,234,0.08))",
                }} />
                <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
                  background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.5), rgba(147,51,234,0.5), transparent)",
                }} />

                <div className="relative">
                  <div className="flex items-center gap-2 mb-5">
                    <ShoppingCart className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Order Summary</h2>
                  </div>

                  <div className="space-y-3 mb-5">
                    {cartItems.map((item, idx) => (
                      <div key={`${item.product.id}-${item.plan?.id || 0}-${idx}`} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-primary)]/50">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-base font-bold shrink-0">
                          {item.product.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.product.name}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {item.plan?.name || "Standard"} &times; {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-[var(--text-primary)] shrink-0">
                          ${((item.plan?.price || item.product.price || 0) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[var(--border-color)] pt-4 space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Subtotal</span>
                      <span className="text-[var(--text-primary)] font-medium">${subtotal.toFixed(2)}</span>
                    </div>

                    {couponApplied && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-emerald-400 font-medium">Discount (10%)</span>
                        <span className="text-emerald-400 font-medium">-${discount.toFixed(2)}</span>
                      </motion.div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Tax</span>
                      <span className="text-[var(--text-secondary)]">Calculated at next step</span>
                    </div>

                    <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                      <span className="text-base font-bold text-[var(--text-primary)]">Grand Total</span>
                      <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        ${grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={submitting}
                    className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Place Order — ${grandTotal.toFixed(2)}
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--text-secondary)]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Secure Checkout — Your info is safe with us</span>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[var(--border-color)]">
                    <p className="text-xs text-[var(--text-secondary)] text-center mb-3">Accepted Payment Methods</p>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <span className="text-sm">💳</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">Stripe</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <span className="text-sm">🅿️</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">PayPal</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <span className="text-sm">💰</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">Razorpay</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <span className="text-sm">🛶</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">Paddle</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
