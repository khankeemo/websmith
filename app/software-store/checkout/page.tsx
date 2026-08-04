"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Lock, CreditCard, ShieldCheck, Check, X,
  ChevronRight, AlertCircle, ArrowLeft, MapPin, Building2, Globe,
  Phone, Mail, User, BadgePercent, UserCircle2, Loader2, KeyRound,
  FileText, ChevronDown
} from "lucide-react";
import { StoreProduct, StoreProductPlan } from "../services/softwareStoreService";
import { isValidEmail, mobileDigitsError } from "@/lib/validation";
import { FieldIndicator } from "@/components/internal-api/validation/FieldIndicator";

const STORAGE_CART_KEY = "software_store_cart";
const STORAGE_ORDER_KEY = "software_store_order";

interface CartItem {
  product: StoreProduct;
  plan?: StoreProductPlan;
  quantity: number;
  addedAt: string;
}

interface CheckoutCountry {
  code: string;
  name: string;
  dial: string;
  flag: string;
  minDigits: number | null;
  maxDigits: number | null;
}

interface CheckoutState {
  id: number;
  country_code: string;
  name: string;
  code: string | null;
}

interface CheckoutCity {
  id: number;
  state_id: number;
  country_code: string;
  name: string;
}

interface CheckoutGateway {
  name: string;
  display_name: string;
  supported_currencies: string[];
}

interface CheckoutTax {
  rate: number;
  name: string;
  currency: string;
}

interface OrderTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  taxName?: string;
}

interface PaymentResult {
  order_number: string;
  payment: { payment_number: string; gateway: string; transaction_id: string; amount: number; currency: string };
  licenses: { license_key: string; product_id: string; plan: string; expiry_date: string; max_devices: number }[];
  totals: { subtotal: number; discount: number; tax: number; total: number; currency: string };
}

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
    const timer = setTimeout(onClose, 3500);
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

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all";
const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5";
const requiredMark = <span className="text-red-400">*</span>;

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required ? requiredMark : null}
      </label>
      {children}
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Checkout configuration (DB-driven)
  const [countries, setCountries] = useState<CheckoutCountry[]>([]);
  const [states, setStates] = useState<CheckoutState[]>([]);
  const [cities, setCities] = useState<CheckoutCity[]>([]);
  const [gateways, setGateways] = useState<CheckoutGateway[]>([]);
  const [taxConfig, setTaxConfig] = useState<CheckoutTax>({ rate: 0, name: "VAT", currency: "USD" });

  // Customer information
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [altMobile, setAltMobile] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [countryName, setCountryName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [selectedGateway, setSelectedGateway] = useState("dummy");
  const [error, setError] = useState<string | null>(null);
  const [paidOrder, setPaidOrder] = useState<PaymentResult | null>(null);
  const [orderTotals, setOrderTotals] = useState<OrderTotals | null>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Load cart + config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = localStorage.getItem(STORAGE_CART_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) setCartItems(parsed);
        }
        const savedOrder = sessionStorage.getItem(STORAGE_ORDER_KEY);
        if (savedOrder) {
          try {
            setPaidOrder(JSON.parse(savedOrder));
          } catch { sessionStorage.removeItem(STORAGE_ORDER_KEY); }
        }
      } catch { /* storage unavailable */ }

      try {
        const res = await fetch("/api/v1/checkout/config");
        const data = await res.json();
        if (data.success && data.data) {
          setCountries(data.data.countries || []);
          setStates(data.data.states || []);
          setCities(data.data.cities || []);
          setGateways(data.data.gateways || []);
          if (data.data.tax) setTaxConfig(data.data.tax);
          const firstGateway = data.data.gateways?.[0]?.name;
          if (firstGateway) setSelectedGateway(firstGateway);
        }
      } catch { /* config unavailable — text inputs fall back */ }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Country dial lookup
  const selectedCountry = useMemo(
    () => countries.find(c => c.code === countryCode),
    [countries, countryCode]
  );

  const selectedCountryName = useMemo(() => {
    const byCode = countries.find(c => c.code === countryCode);
    const byName = countries.find(c => c.name.toLowerCase() === countryName.toLowerCase());
    return (countryName && (byName || !byCode)) ? countryName : (byCode?.name || countryName);
  }, [countries, countryCode, countryName]);

  const availableStates = useMemo(
    () => states.filter(s => s.country_code === (selectedCountry?.code || "")),
    [states, selectedCountry]
  );

  const selectedStateId = useMemo(() => {
    const s = availableStates.find(s => s.name === state);
    return s?.id || null;
  }, [availableStates, state]);

  const availableCities = useMemo(
    () => (selectedStateId ? cities.filter(c => c.state_id === selectedStateId) : []),
    [cities, selectedStateId]
  );

  // Client-side totals (server recomputes authoritatively)
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = item.plan?.price || item.product.price || 0;
      return sum + price * item.quantity;
    }, 0);
  }, [cartItems]);

  const emailValid = isValidEmail(email);
  const mobileError = mobileDigitsError(selectedCountry, mobile.replace(/\D/g, ""));
  const altMobileError = altMobile.trim() && mobileDigitsError(selectedCountry, altMobile.replace(/\D/g, ""));

  const contactDone = Boolean(firstName.trim() && lastName.trim() && isValidEmail(email));
  const billingDone = Boolean(addressLine1.trim() && city.trim() && countryName.trim() && postalCode.trim());
  const stepsMeta = [
    { label: "Contact", done: contactDone, icon: User },
    { label: "Billing", done: billingDone, icon: MapPin },
    { label: "Payment", done: gateways.length > 0, icon: CreditCard },
  ];

  const validateForm = (): string | null => {
    if (!firstName.trim() || !lastName.trim()) return "First name and last name are required";
    if (!isValidEmail(email)) return "A valid email address is required";
    if (mobile.trim() && mobileError) return mobileError;
    if (altMobile.trim() && altMobileError) return altMobileError;
    if (!addressLine1.trim()) return "Address Line 1 is required";
    if (!city.trim()) return "City is required";
    if (!countryName.trim()) return "Please select a country";
    if (!postalCode.trim()) return "Postal code is required";
    if (cartItems.length === 0) return "Your cart is empty";
    return null;
  };

  const handleCountryPick = useCallback((c: CheckoutCountry) => {
    setCountryCode(c.code);
    setCountryName(c.name);
    setState("");
    setCity("");
    setShowCountryDropdown(false);
    setCountrySearch("");
  }, []);

  const handleStateChange = (value: string) => {
    setState(value);
    setCity("");
  };

  const handlePlaceOrder = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setToast({ message: validationError, type: "error" });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Step 1 — create pending order
      const orderRes = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            company: company.trim(),
            email: email.trim(),
            mobile: `${countryCode}${mobile.replace(/\s/g, "")}`,
            alternative_mobile: altMobile.trim() ? `${countryCode}${altMobile.replace(/\s/g, "")}` : "",
            address_line1: addressLine1.trim(),
            address_line2: addressLine2.trim(),
            city: city.trim(),
            state: state.trim(),
            country: selectedCountryName,
            postal_code: postalCode.trim(),
          },
          items: cartItems.map(i => ({
            product_id: i.product.id,
            plan_id: i.plan?.id,
            quantity: i.quantity,
          })),
          coupon_code: couponCode.trim() || null,
          payment_gateway: selectedGateway,
          notes: orderNotes.trim() || null,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      setOrderTotals(orderData.totals);

      // Step 2 — dummy payment gateway (development)
      const payRes = await fetch("/api/v1/checkout/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: orderData.order_number }),
      });

      const payData = await payRes.json();
      if (!payRes.ok || !payData.success) {
        throw new Error(payData.error || "Payment processing failed");
      }

      setPaidOrder(payData);
      sessionStorage.setItem(STORAGE_ORDER_KEY, JSON.stringify(payData));
      localStorage.removeItem(STORAGE_CART_KEY);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      setError(error.message || "Something went wrong. Please try again.");
      setToast({ message: error.message || "Something went wrong. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [firstName, lastName, company, email, countryCode, mobile, altMobile, addressLine1, addressLine2, city, state, selectedCountryName, postalCode, orderNotes, couponCode, selectedGateway, cartItems, selectedCountry]);

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

  // ============================================================
  // SUCCESS VIEW — licenses generated after payment
  // ============================================================
  if (paidOrder) {
    const t = paidOrder.totals;
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent p-8 text-center"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Payment Successful</h1>
            <p className="text-[var(--text-secondary)] mb-1">Order <span className="font-mono text-[var(--text-primary)]">{paidOrder.order_number}</span> confirmed</p>
            <p className="text-sm text-[var(--text-secondary)] mb-8">
              {t ? `Paid ${t.total.toFixed(2)} ${t.currency} via ${paidOrder.payment.gateway === "dummy" ? "Test Payment (Development)" : paidOrder.payment.gateway}` : "Thank you for your purchase"}
              {" · "}Transaction <span className="font-mono">{paidOrder.payment.transaction_id}</span>
            </p>

            <div className="text-left space-y-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3">
                  <KeyRound className="w-4 h-4 text-indigo-400" /> Your License Keys
                </h3>
                <div className="space-y-3">
                  {paidOrder.licenses.map((lic) => (
                    <div key={lic.license_key} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <code className="font-mono text-sm text-[var(--text-primary)]">{lic.license_key}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(lic.license_key);
                            setToast({ message: "License key copied", type: "success" });
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[var(--text-secondary)]">
                        <span>Plan: {lic.plan}</span>
                        <span>Expires: {lic.expiry_date.split("T")[0]}</span>
                        <span>Devices: {lic.max_devices}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  <Mail className="inline w-4 h-4 mr-1.5 text-blue-400" />
                  Your license key{paidOrder.licenses.length > 1 ? "s have" : " has"} been emailed to <span className="text-[var(--text-primary)]">{email}</span> along with your payment receipt.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
              <a
                href="/software-store"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25"
              >
                <ShoppingCart className="w-4 h-4" /> Continue Shopping
              </a>
              <a
                href="/docs"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-color)] text-sm font-medium text-[var(--text-primary)] hover:border-indigo-500/40 transition-all"
              >
                <FileText className="w-4 h-4" /> SDK &amp; Activation Documentation
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================================
  // CHECKOUT FORM
  // ============================================================
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <AnimatePresence>
        {toast && (
          toast.type === "success" ? (
            <Toast key="toast" message={toast.message} type="success" onClose={() => setToast(null)} />
          ) : (
            <Toast key="toast" message={toast.message} type="error" onClose={() => setToast(null)} />
          )
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <a href="/software-store" className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Store
          </a>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Checkout</span>
        </motion.div>

        {/* Checkout progress stepper */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="flex items-center">
            {stepsMeta.map((s, i) => (
              <div key={s.label} className={`flex items-center ${i < stepsMeta.length - 1 ? "flex-1" : ""}`}>
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                    s.done
                      ? "bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent text-white shadow-lg shadow-indigo-600/25"
                      : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                  }`}>
                    {s.done ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                  </div>
                  <span className={`mt-2 text-[11px] font-semibold ${s.done ? "text-indigo-400" : "text-[var(--text-secondary)]"}`}>{s.label}</span>
                </div>
                {i < stepsMeta.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 rounded-full mb-5 transition-all ${stepsMeta[i].done ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-[var(--border-color)]"}`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid lg:grid-cols-5 gap-8"
        >
          {/* Left Column */}
          <div className="lg:col-span-3 space-y-6">
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Contact Information</h2>
                <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Step 1</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="First Name" required>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" className={inputClass} />
                </Field>
                <Field label="Last Name" required>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Company">
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc. (optional)" className={`${inputClass} pl-10`} />
                    </div>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Email Address" required>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="john@acme.com"
                        className={`${inputClass} pl-10 pr-12`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <FieldIndicator state={email.trim() === "" ? "empty" : isValidEmail(email) ? "valid" : "invalid"} />
                      </div>
                    </div>
                  </Field>
                </div>
                <Field label="Mobile Number" required>
                  <div className="flex gap-2">
                    <div ref={countryDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="flex items-center gap-1.5 px-3 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] hover:border-indigo-500/40 transition-colors whitespace-nowrap"
                      >
                        <span>{selectedCountry?.flag || "🌐"}</span>
                        <span>{countryCode}</span>
                        <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
                      </button>
                      {showCountryDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl z-50">
                          <div className="sticky top-0 bg-[var(--bg-secondary)] p-2 border-b border-[var(--border-color)]">
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={e => setCountrySearch(e.target.value)}
                              placeholder="Search country..."
                              className="w-full px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                              autoFocus
                            />
                          </div>
                          {countries.filter(c =>
                            !countrySearch ||
                            c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                            c.code.toLowerCase().includes(countrySearch.toLowerCase()) ||
                            c.dial.includes(countrySearch)
                          ).map(c => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => handleCountryPick(c)}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-[var(--bg-tertiary)]/40 transition-colors ${c.code === countryCode ? "bg-indigo-500/10 text-indigo-300" : "text-[var(--text-primary)]"}`}
                            >
                              <span className="w-7">{c.flag}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-[var(--text-secondary)]">{c.dial}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input
                        type="tel"
                        value={mobile}
                        onChange={e => setMobile(e.target.value.replace(/[^0-9\s]/g, ""))}
                        placeholder="98765 43210"
                        className={`${inputClass} pl-10 pr-12`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <FieldIndicator state={mobile.trim() === "" ? "empty" : mobileError === "" ? "valid" : "invalid"} />
                      </div>
                    </div>
                  </div>
                  {mobile.trim() && mobileError && (
                    <p className="text-xs text-amber-400 mt-1.5">{mobileError}</p>
                  )}
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Alternative Mobile">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input
                        type="tel"
                        value={altMobile}
                        onChange={e => setAltMobile(e.target.value.replace(/[^0-9\s]/g, ""))}
                        placeholder="Alternate contact number (optional)"
                        className={`${inputClass} pl-10 pr-12`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <FieldIndicator state={altMobile.trim() === "" ? "empty" : altMobileError === "" ? "valid" : "invalid"} />
                      </div>
                    </div>
                  </Field>
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
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Billing Address</h2>
                <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Step 2</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Country" required>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <select
                        value={countryName}
                        onChange={e => {
                          const name = e.target.value;
                          setCountryName(name);
                          const c = countries.find(x => x.name === name);
                          if (c) setCountryCode(c.dial);
                          setState("");
                          setCity("");
                        }}
                        className={`${inputClass} pl-10 appearance-none cursor-pointer`}
                      >
                        <option value="">Select your country</option>
                        {countries.map(c => (
                          <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
                    </div>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Address Line 1" required>
                    <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} placeholder="123 Main Street" className={inputClass} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Address Line 2">
                    <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} placeholder="Suite 100 (optional)" className={inputClass} />
                  </Field>
                </div>
                <Field label="City" required>
                  {availableCities.length > 0 ? (
                    <select value={city} onChange={e => setCity(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
                      <option value="">Select your city</option>
                      {availableCities.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco" className={inputClass} />
                  )}
                </Field>
                <Field label="State / Province" required>
                  {availableStates.length > 0 ? (
                    <select value={state} onChange={e => handleStateChange(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
                      <option value="">Select your state</option>
                      {availableStates.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={state} onChange={e => handleStateChange(e.target.value)} placeholder="California" className={inputClass} />
                  )}
                </Field>
                <Field label="Postal Code" required>
                  <input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="94102" className={inputClass} />
                </Field>
              </div>
            </motion.div>

            {/* Coupon */}
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
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={() => {
                    if (!couponCode.trim()) {
                      setToast({ message: "Please enter a coupon code", type: "error" });
                      return;
                    }
                    setToast({ message: "Coupon will be verified when you place your order", type: "success" });
                  }}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                >
                  Apply
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Coupons are validated against our offers when you place the order.
              </p>
            </motion.div>

            {/* Order Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <UserCircle2 className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Order Notes</h2>
              </div>
              <textarea
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Special instructions, additional details, or questions..."
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </motion.div>

            {/* Payment */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Payment Method</h2>
                <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Step 3</span>
              </div>
              {gateways.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No payment gateway is enabled. Orders are placed as pending and cannot be fulfilled.</span>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {gateways.map((g) => (
                    <button
                      key={g.name}
                      onClick={() => setSelectedGateway(g.name)}
                      className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                        selectedGateway === g.name
                          ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]"
                          : "border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-indigo-500/40"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedGateway === g.name ? "border-indigo-500" : "border-[var(--border-color)]"
                      }`}>
                        {selectedGateway === g.name && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <CreditCard className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">{g.display_name}</span>
                      </div>
                      {g.name === "dummy" && (
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
                          Test Mode
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedGateway === "dummy" && (
                <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Test gateway (development). Payment is simulated — no real charge is made. Your license is generated instantly.</span>
                </div>
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
                style={{ border: "1px solid var(--border-color)" }}
              >
                <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(147,51,234,0.08))",
                }} />
                <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
                  background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.5), rgba(147,51,234,0.5), transparent)",
                }} />

                <div className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[var(--text-primary)]">Order Summary</h2>
                      <p className="text-[11px] text-[var(--text-secondary)]">{cartItems.length} item{cartItems.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    {cartItems.map((item, idx) => (
                      <div key={`${item.product.id}-${item.plan?.id || 0}-${idx}`} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--border-color)]/50 hover:border-indigo-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-base font-bold shrink-0 overflow-hidden">
                          {item.product.logo_url ? (
                            <img src={item.product.logo_url} alt={item.product.name} className="w-8 h-8 rounded-lg object-contain" />
                          ) : (
                            item.product.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.product.name}</p>
                            {item.product.version && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-medium shrink-0">v{item.product.version}</span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {item.plan?.name || "Standard"} &times; {item.quantity} · ${(item.plan?.price || item.product.price || 0).toFixed(2)} each
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

                    {orderTotals && orderTotals.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-400 font-medium">Discount</span>
                        <span className="text-emerald-400 font-medium">-${orderTotals.discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Tax ({taxConfig.name})</span>
                      <span className="text-[var(--text-secondary)]">{orderTotals ? orderTotals.tax.toFixed(2) : `${taxConfig.rate}%`}</span>
                    </div>

                    <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                      <span className="text-base font-bold text-[var(--text-primary)]">Grand Total</span>
                      <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        {orderTotals ? `${orderTotals.total.toFixed(2)} ${orderTotals.currency}` : `$${(subtotal * (1 + taxConfig.rate / 100)).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={submitting || cartItems.length === 0}
                    className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin w-5 h-5" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Pay {orderTotals ? `${orderTotals.total.toFixed(2)} ${orderTotals.currency}` : `$${(subtotal * (1 + taxConfig.rate / 100)).toFixed(2)}`}
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--text-secondary)]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Secure Checkout — Your info is safe with us</span>
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
