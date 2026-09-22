"use client";

// FILE: app/software-store/checkout/page.tsx
// PURPOSE: Standalone, secure Software Store checkout.
// SECURITY: This page intentionally imports NOTHING from the admin/dashboard
//           app. It renders inside its own dedicated checkout layout with no
//           sidebar, no dashboard header, no admin navigation, no profile,
//           no logout, no dark-mode toggle. It behaves like a professional
//           payment page (Stripe / Shopify / Paddle / Gumroad).
// FLOW: Cart -> Checkout -> Contact -> Billing -> Payment -> Processing ->
//       Success -> License delivery -> Auto-redirect to /software-store.

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Lock, CreditCard, ShieldCheck, Check, X,
  ChevronRight, AlertCircle, MapPin, Building2, Globe,
  Phone, Mail, User, Loader2, KeyRound, ChevronDown,
  Search, Home, Hash, LayoutGrid, Flag, MailCheck, Sparkles
} from "lucide-react";
import { StoreProduct, StoreProductPlan } from "../services/softwareStoreService";
import { isValidEmail, mobileDigitsError } from "@/lib/validation";

const STORAGE_CART_KEY = "software_store_cart";
const STORAGE_ORDER_KEY = "software_store_order";
const SUCCESS_REDIRECT_SECONDS = 10;

// Safe money normalization. Server values may arrive as a number, a numeric
// string ("49", "0.00"), null, undefined or a DB numeric — never call
// .toFixed() directly on an unknown value.
function toMoney(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

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

interface AddressLookupResult {
  postal_code: string;
  country_code: string;
  country: string;
  state: string;
  state_code: string | null;
  district: string | null;
  city: string;
  locality: string;
  area: string | null;
  region: string | null;
  provider: string;
}

type AddressLookupStatus = "idle" | "loading" | "done" | "unsupported" | "error";

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  altMobile?: string;
  country?: string;
  postalCode?: string;
  state?: string;
  city?: string;
}

// Local validation indicator — checkout is fully self-contained (no dashboard imports).
function FieldIndicator({ state }: { state: "empty" | "valid" | "invalid" }) {
  if (state === "valid") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm font-bold text-[#16a34a]">✓</span>
    );
  }
  if (state === "invalid") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm font-bold text-[#dc2626]">✗</span>
    );
  }
  return <span className="h-5 w-5 shrink-0" />;
}

function OrderSummarySkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 p-6 animate-pulse space-y-4">
      <div className="h-6 w-32 rounded-lg bg-[var(--border-color)]" />
      <div className="space-y-3">
        {[1, 2].map(i => (
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
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center mb-6">
        <ShoppingCart className="w-12 h-12 text-[var(--border-color)]" />
      </div>
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Your cart is empty</h2>
      <p className="text-[var(--text-secondary)] mb-8 max-w-md">
        Looks like you haven&apos;t added any products yet. Browse our store to find what you need.
      </p>
      <a
        href="/software-store"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-600/25"
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
  "w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all";
const inputErrorClass =
  "border-red-500/60 focus:ring-red-500/20 focus:border-red-500/60";
const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5";
const requiredMark = <span className="text-red-400">*</span>;

function Field({ label, required, error, children, hint }: { label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required ? requiredMark : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-400 mt-1.5">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">{hint}</p>
      ) : null}
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

  // Contact information
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [altMobile, setAltMobile] = useState("");

  // Billing address — auto-filled from address lookup where possible, always editable
  const [countryName, setCountryName] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [locality, setLocality] = useState("");
  const [area, setArea] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  // Manual fields — the customer only types these
  const [flatNo, setFlatNo] = useState("");
  const [building, setBuilding] = useState("");
  const [street, setStreet] = useState("");
  const [block, setBlock] = useState("");
  const [landmark, setLandmark] = useState("");

  // Address lookup state
  const [addressLookupStatus, setAddressLookupStatus] = useState<AddressLookupStatus>("idle");
  const [addressLookupMessage, setAddressLookupMessage] = useState("");
  const addressLookupSeq = useRef(0);

  const [selectedGateway, setSelectedGateway] = useState("dummy");
  const [error, setError] = useState<string | null>(null);
  const [paidOrder, setPaidOrder] = useState<PaymentResult | null>(null);
  const [orderTotals, setOrderTotals] = useState<OrderTotals | null>(null);
  const [redirectIn, setRedirectIn] = useState(SUCCESS_REDIRECT_SECONDS);

  // Validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});

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

  // Auto-redirect to the store after a successful payment
  useEffect(() => {
    if (!paidOrder) return;
    setRedirectIn(SUCCESS_REDIRECT_SECONDS);
    const tick = setInterval(() => setRedirectIn(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    const redirect = setTimeout(() => router.replace("/software-store"), SUCCESS_REDIRECT_SECONDS * 1000);
    return () => { clearInterval(tick); clearTimeout(redirect); };
  }, [paidOrder, router]);

  // Country dial lookup. countryCode holds the dial (e.g. "+91"); resolve the
  // matching country so phone validation follows the selected country's rules.
  const selectedCountry = useMemo(
    () => countries.find(c => c.dial === countryCode || c.code === countryCode),
    [countries, countryCode]
  );

  const selectedCountryName = useMemo(() => {
    const byCode = countries.find(c => c.dial === countryCode || c.code === countryCode);
    const byName = countries.find(c => c.name.toLowerCase() === countryName.toLowerCase());
    return (countryName && (byName || !byCode)) ? countryName : (byCode?.name || countryName);
  }, [countries, countryCode, countryName]);

  const selectedCountryISO = useMemo(
    () => countries.find(c => c.name === countryName)?.code || null,
    [countries, countryName]
  );

  const availableStates = useMemo(
    () => states.filter(s => s.country_code === (selectedCountry?.code || selectedCountryISO || "")),
    [states, selectedCountry, selectedCountryISO]
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

  const estimatedTax = Math.round(subtotal * (taxConfig.rate / 100) * 100) / 100;
  const estimatedTotal = Math.round((subtotal + estimatedTax) * 100) / 100;
  const displayTotal = orderTotals ? orderTotals.total : estimatedTotal;
  const displayCurrency = orderTotals?.currency || taxConfig.currency;

  const emailValid = isValidEmail(email);
  const mobileError = mobileDigitsError(selectedCountry, mobile.replace(/\D/g, ""));
  const altMobileError = altMobile.trim() && mobileDigitsError(selectedCountry, altMobile.replace(/\D/g, ""));

  const contactDone = Boolean(firstName.trim() && lastName.trim() && isValidEmail(email));
  const billingDone = Boolean(
    postalCode.trim() && state.trim() && city.trim() && countryName.trim() &&
    (street.trim() || flatNo.trim() || building.trim())
  );
  const stepsMeta = [
    { label: "Contact", done: contactDone, icon: User },
    { label: "Billing", done: billingDone, icon: MapPin },
    { label: "Payment", done: gateways.length > 0, icon: CreditCard },
  ];

  // ============================================================
  // VALIDATION — inline, never silent
  // ============================================================
  const validateForm = useCallback((): FormErrors => {
    const errors: FormErrors = {};
    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!lastName.trim()) errors.lastName = "Last name is required";
    if (!email.trim()) errors.email = "Email address is required";
    else if (!isValidEmail(email)) errors.email = "Please enter a valid email address";
    if (mobile.trim() && mobileError) errors.mobile = mobileError;
    if (altMobile.trim() && altMobileError) errors.altMobile = altMobileError;
    if (!countryName.trim()) errors.country = "Please select your country";
    if (!postalCode.trim()) errors.postalCode = "Postal code is required";
    else if (!/^[a-zA-Z0-9]{3,12}$/.test(postalCode.replace(/[\s-]/g, ""))) errors.postalCode = "Please enter a valid postal code";
    if (!state.trim()) errors.state = "State / Province is required";
    if (!city.trim()) errors.city = "City is required";
    return errors;
  }, [firstName, lastName, email, mobile, mobileError, altMobile, altMobileError, countryName, postalCode, state, city]);

  const markTouched = useCallback(() => {
    setTouched({
      firstName: true, lastName: true, email: true, mobile: true, altMobile: true,
      country: true, postalCode: true, state: true, city: true,
    });
  }, []);

  // Recompute inline errors live once a field has been touched (never silent)
  useEffect(() => {
    if (Object.keys(touched).length === 0) return;
    setFormErrors(validateForm());
  }, [firstName, lastName, email, mobile, altMobile, countryName, postalCode, state, city, touched, validateForm]);

  // ============================================================
  // SMART ADDRESS LOOKUP — API-assisted, always editable result
  // ============================================================
  const runAddressLookup = useCallback(async () => {
    if (!selectedCountryISO) {
      setAddressLookupStatus("error");
      setAddressLookupMessage("Please select a country first");
      return;
    }
    const cleanPostal = postalCode.trim();
    if (!cleanPostal) {
      setAddressLookupStatus("error");
      setAddressLookupMessage("Please enter a postal code first");
      return;
    }
    const seq = ++addressLookupSeq.current;
    setAddressLookupStatus("loading");
    setAddressLookupMessage("");
    try {
      const res = await fetch("/api/v1/checkout/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: selectedCountryISO, postalCode: cleanPostal }),
      });
      const data = await res.json();
      if (seq !== addressLookupSeq.current) return;

      if (data.success && data.supported && data.data) {
        const d: AddressLookupResult = data.data;
        if (d.state) setState(d.state);
        if (d.city || d.district) setCity(d.city || d.district);
        if (d.district) setDistrict(d.district);
        if (d.locality || d.area) setLocality(d.locality || d.area);
        if (d.area || d.locality) setArea(d.area || d.locality);
        if (d.region) setRegion(d.region);
        setAddressLookupStatus("done");
        setAddressLookupMessage("Address found — the fields below were filled automatically. You can review and edit them.");
      } else if (data.success && data.supported === false) {
        setAddressLookupStatus("unsupported");
        setAddressLookupMessage(data.message || "Automatic address lookup is not available for this country. You can enter your address manually.");
      } else {
        setAddressLookupStatus("error");
        setAddressLookupMessage(data.error || "We couldn't find this postal code. Please check it and try again.");
      }
    } catch {
      if (seq !== addressLookupSeq.current) return;
      setAddressLookupStatus("error");
      setAddressLookupMessage("Address lookup is temporarily unavailable. You can enter your address manually.");
    }
  }, [selectedCountryISO, postalCode]);

  // Auto-lookup shortly after the customer finishes typing the postal code
  useEffect(() => {
    const digits = postalCode.replace(/[\s-]/g, "");
    if (!digits || digits.length < 3 || !selectedCountryISO) return;
    const timer = setTimeout(() => {
      runAddressLookup();
    }, 900);
    return () => clearTimeout(timer);
  }, [postalCode, selectedCountryISO, runAddressLookup]);

  const handleCountryPick = useCallback((c: CheckoutCountry) => {
    setCountryCode(c.dial);
    setCountryName(c.name);
    setState("");
    setCity("");
    setDistrict("");
    setLocality("");
    setArea("");
    setRegion("");
    setPostalCode("");
    setAddressLookupStatus("idle");
    setAddressLookupMessage("");
    setShowCountryDropdown(false);
    setCountrySearch("");
  }, []);

  const handleCountrySelect = (name: string) => {
    setCountryName(name);
    const c = countries.find(x => x.name === name);
    if (c) setCountryCode(c.dial);
    setState("");
    setCity("");
    setDistrict("");
    setLocality("");
    setArea("");
    setRegion("");
    setPostalCode("");
    setAddressLookupStatus("idle");
    setAddressLookupMessage("");
  };

  const handleStateChange = (value: string) => {
    setState(value);
    setCity("");
    setDistrict("");
  };

  // ============================================================
  // PLACE ORDER — existing business flow, untouched
  // ============================================================
  const handlePlaceOrder = useCallback(async () => {
    const validationErrors = validateForm();
    setFormErrors(validationErrors);
    markTouched();
    const hasErrors = Object.keys(validationErrors).length > 0;
    if (hasErrors) {
      setToast({ message: "Please fix the highlighted fields before paying.", type: "error" });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Step 1 — create pending order (server-authoritative pricing)
      const addressLine1 = [flatNo, building, street].filter(Boolean).join(", ");
      const addressLine2 = [block, landmark, locality, area].filter(Boolean).join(", ");

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
            address_line1: addressLine1,
            address_line2: addressLine2,
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
          coupon_code: null,
          payment_gateway: selectedGateway,
          notes: null,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      setOrderTotals(orderData.totals);

      // Step 2 — payment capture (existing gateway integration)
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
      const scrollable = document.querySelector(".app-main-scroll") as HTMLElement | null;
      (scrollable || window).scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setToast({ message: err.message || "Something went wrong. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [validateForm, markTouched, flatNo, building, street, block, landmark, locality, area, firstName, lastName, company, email, countryCode, mobile, altMobile, city, state, selectedCountryName, postalCode, selectedGateway, cartItems]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
  // SUCCESS VIEW — payment successful, license delivered, auto-redirect
  // ============================================================
  if (paidOrder) {
    const t = paidOrder.totals;
    const productNames = cartItems.map(i => i.product.name);
    const productLabel = productNames.length > 1
      ? `${productNames[0]} +${productNames.length - 1} more`
      : (productNames[0] || "Your product");

    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent p-6 sm:p-8 text-center"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2">Payment Successful</h1>
            <p className="text-[var(--text-secondary)] mb-6">Thank you for your purchase!</p>

            <div className="text-left rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 divide-y divide-[var(--border-color)] mb-6">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-[var(--text-secondary)]">Order Number</span>
                <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{paidOrder.order_number}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-[var(--text-secondary)]">Product</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{productLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-[var(--text-secondary)]">Amount Paid</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {t ? `${toMoney(t.total).toFixed(2)} ${t.currency}` : ""}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-[var(--text-secondary)]">License Delivery</span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                  <MailCheck className="w-4 h-4" /> Delivered
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-[var(--text-secondary)]">Customer Email</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{email}</span>
              </div>
            </div>

            <div className="text-left space-y-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3">
                  <KeyRound className="w-4 h-4 text-blue-400" /> Your License Keys
                </h3>
                <div className="space-y-3">
                  {paidOrder.licenses.map((lic) => (
                    <div key={lic.license_key} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <code className="font-mono text-sm text-[var(--text-primary)] break-all">{lic.license_key}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(lic.license_key);
                            setToast({ message: "License key copied", type: "success" });
                          }}
                          className="text-xs text-blue-400 hover:text-cyan-300"
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
                  Your license key{paidOrder.licenses.length > 1 ? "s have" : " has"} been delivered to{" "}
                  <span className="text-[var(--text-primary)]">{email}</span> along with your payment receipt.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
              <a
                href="/software-store"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-600/25"
              >
                <ShoppingCart className="w-4 h-4" /> Continue Shopping
              </a>
            </div>

            <p className="flex items-center justify-center gap-2 mt-6 text-xs text-[var(--text-secondary)]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Redirecting you to the Software Store in {redirectIn}s…
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================================
  // CHECKOUT FORM
  // ============================================================
  return (
    <div className="min-h-screen bg-transparent">
      <AnimatePresence>
        {toast && (
          <Toast key="toast" message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-32 lg:pb-10">
        {/* Checkout progress stepper */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center">
            {stepsMeta.map((s, i) => (
              <div key={s.label} className={`flex items-center ${i < stepsMeta.length - 1 ? "flex-1" : ""}`}>
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                    s.done
                      ? "bg-gradient-to-br from-blue-600 to-cyan-500 border-transparent text-white shadow-lg shadow-blue-600/25"
                      : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                  }`}>
                    {s.done ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                  </div>
                  <span className={`mt-2 text-[11px] font-semibold ${s.done ? "text-blue-500 dark:text-blue-400" : "text-[var(--text-secondary)]"}`}>{s.label}</span>
                </div>
                {i < stepsMeta.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 rounded-full mb-5 transition-all ${stepsMeta[i].done ? "bg-gradient-to-r from-blue-600 to-cyan-500" : "bg-[var(--border-color)]"}`} />
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Contact Information</h2>
                <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">Step 1</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="First Name" required error={formErrors.firstName}>
                  <input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, firstName: true }))}
                    placeholder="John"
                    className={`${inputClass} ${touched.firstName && formErrors.firstName ? inputErrorClass : ""}`}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last Name" required error={formErrors.lastName}>
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, lastName: true }))}
                    placeholder="Doe"
                    className={`${inputClass} ${touched.lastName && formErrors.lastName ? inputErrorClass : ""}`}
                    autoComplete="family-name"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Company">
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc. (optional)" className={`${inputClass} pl-10`} autoComplete="organization" />
                    </div>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Email Address" required error={formErrors.email}>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                        placeholder="john@acme.com"
                        className={`${inputClass} pl-10 pr-12 ${touched.email && formErrors.email ? inputErrorClass : ""}`}
                        autoComplete="email"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <FieldIndicator state={email.trim() === "" ? "empty" : isValidEmail(email) ? "valid" : "invalid"} />
                      </div>
                    </div>
                  </Field>
                </div>
                <Field label="Mobile Number" required error={formErrors.mobile}>
                  <div className="flex gap-2">
                    <div ref={countryDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="flex items-center gap-1.5 px-3 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] hover:border-blue-500/40 transition-colors whitespace-nowrap"
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
                              className="w-full px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50"
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
                              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-[var(--bg-tertiary)]/40 transition-colors ${c.dial === countryCode ? "bg-blue-500/10 text-blue-600 dark:text-blue-300" : "text-[var(--text-primary)]"}`}
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
                        onBlur={() => setTouched(prev => ({ ...prev, mobile: true }))}
                        placeholder="98765 43210"
                        className={`${inputClass} pl-10 pr-12 ${touched.mobile && formErrors.mobile ? inputErrorClass : ""}`}
                        autoComplete="tel"
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
                  <Field label="Alternative Mobile" error={formErrors.altMobile}>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input
                        type="tel"
                        value={altMobile}
                        onChange={e => setAltMobile(e.target.value.replace(/[^0-9\s]/g, ""))}
                        onBlur={() => setTouched(prev => ({ ...prev, altMobile: true }))}
                        placeholder="Alternate contact number (optional)"
                        className={`${inputClass} pl-10 pr-12 ${touched.altMobile && formErrors.altMobile ? inputErrorClass : ""}`}
                        autoComplete="tel"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <FieldIndicator state={altMobile.trim() === "" ? "empty" : altMobileError === "" ? "valid" : "invalid"} />
                      </div>
                    </div>
                  </Field>
                </div>
              </div>
            </motion.div>

            {/* Billing Address — API-assisted lookup */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Billing Address</h2>
                <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">Step 2</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Country" required error={formErrors.country}>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <select
                        value={countryName}
                        onChange={e => handleCountrySelect(e.target.value)}
                        className={`${inputClass} pl-10 appearance-none cursor-pointer ${touched.country && formErrors.country ? inputErrorClass : ""}`}
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

                <Field label="State / Province" required error={formErrors.state}>
                  <input
                    list="checkout-states"
                    value={state}
                    onChange={e => handleStateChange(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, state: true }))}
                    placeholder={availableStates.length > 0 ? "Select or type your state" : "California"}
                    className={`${inputClass} ${touched.state && formErrors.state ? inputErrorClass : ""}`}
                    autoComplete="address-level1"
                  />
                  <datalist id="checkout-states">
                    {availableStates.map(s => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </Field>

                <Field label="Postal Code" required error={formErrors.postalCode}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input
                        value={postalCode}
                        onChange={e => setPostalCode(e.target.value.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 12))}
                        onBlur={() => setTouched(prev => ({ ...prev, postalCode: true }))}
                        placeholder="560001"
                        className={`${inputClass} pl-10 ${touched.postalCode && formErrors.postalCode ? inputErrorClass : ""}`}
                        autoComplete="postal-code"
                        inputMode="numeric"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={runAddressLookup}
                      disabled={addressLookupStatus === "loading"}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl border border-blue-500/40 text-sm font-semibold text-blue-500 dark:text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-50"
                    >
                      {addressLookupStatus === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      {addressLookupStatus === "loading" ? "Looking up…" : "Look up"}
                    </button>
                  </div>
                </Field>

                {addressLookupStatus !== "idle" && (
                  <div className="sm:col-span-2">
                    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs border ${
                      addressLookupStatus === "done"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : addressLookupStatus === "unsupported"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : addressLookupStatus === "error"
                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                            : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                    }`}>
                      {addressLookupStatus === "loading" ? (
                        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin mt-0.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      )}
                      <span>{addressLookupMessage}</span>
                    </div>
                  </div>
                )}

                <Field label="City" required error={formErrors.city}>
                  <input
                    list="checkout-cities"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, city: true }))}
                    placeholder="Entered automatically — you can edit it"
                    className={`${inputClass} ${touched.city && formErrors.city ? inputErrorClass : ""}`}
                    autoComplete="address-level2"
                  />
                  <datalist id="checkout-cities">
                    {availableCities.map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </Field>

                <Field label="District" hint="Auto-filled from the postal code — editable">
                  <input value={district} onChange={e => setDistrict(e.target.value)} placeholder="Auto-filled" className={inputClass} autoComplete="off" />
                </Field>

                <Field label="Locality / Area" hint="Auto-filled from the postal code — editable">
                  <input value={locality} onChange={e => setLocality(e.target.value)} placeholder="Auto-filled" className={inputClass} autoComplete="off" />
                </Field>

                <Field label="Region" hint="Auto-filled from the postal code — editable">
                  <input value={region} onChange={e => setRegion(e.target.value)} placeholder="Auto-filled" className={inputClass} autoComplete="off" />
                </Field>

                <div className="sm:col-span-2 mt-2">
                  <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    The fields above are filled automatically whenever possible — you can always edit them.
                  </p>
                </div>

                <Field label="Flat / House Number">
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <input value={flatNo} onChange={e => setFlatNo(e.target.value)} placeholder="12A" className={`${inputClass} pl-10`} autoComplete="address-line1" />
                  </div>
                </Field>
                <Field label="Building">
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <input value={building} onChange={e => setBuilding(e.target.value)} placeholder="Sunrise Towers (optional)" className={`${inputClass} pl-10`} autoComplete="address-line1" />
                  </div>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Street" hint="Street address / Road name">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                      <input value={street} onChange={e => setStreet(e.target.value)} placeholder="MG Road" className={`${inputClass} pl-10`} autoComplete="address-line1" />
                    </div>
                  </Field>
                </div>
                <Field label="Block">
                  <div className="relative">
                    <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <input value={block} onChange={e => setBlock(e.target.value)} placeholder="Block C (optional)" className={`${inputClass} pl-10`} autoComplete="off" />
                  </div>
                </Field>
                <Field label="Landmark">
                  <div className="relative">
                    <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <input value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Near City Mall (optional)" className={`${inputClass} pl-10`} autoComplete="off" />
                  </div>
                </Field>
              </div>
            </motion.div>

            {/* Payment Method */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Payment Method</h2>
                <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">Step 3</span>
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
                          ? "border-blue-500 bg-blue-500/5 shadow-[0_0_20px_-5px_rgba(59,130,246,0.2)]"
                          : "border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-blue-500/40"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedGateway === g.name ? "border-blue-500" : "border-[var(--border-color)]"
                      }`}>
                        {selectedGateway === g.name && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
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

          {/* Right Column — Sticky Order Summary */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24">
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
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[var(--text-primary)]">Order Summary</h2>
                      <p className="text-[11px] text-[var(--text-secondary)]">{cartItems.length} item{cartItems.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5 max-h-[40vh] overflow-y-auto pr-1">
                    {cartItems.map((item, idx) => (
                      <div key={`${item.product.id}-${item.plan?.id || 0}-${idx}`} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--border-color)]/50 hover:border-blue-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-base font-bold shrink-0 overflow-hidden">
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
                            {item.plan?.name || "Standard"} &times; {item.quantity} · ${toMoney(item.plan?.price || item.product.price).toFixed(2)} each
                          </p>
                        </div>
                        <p className="text-sm font-bold text-[var(--text-primary)] shrink-0">
                          ${(toMoney(item.plan?.price || item.product.price) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[var(--border-color)] pt-4 space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Subtotal</span>
                      <span className="text-[var(--text-primary)] font-medium">${toMoney(subtotal).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Discount</span>
                      <span className="text-emerald-400 font-medium">
                        {orderTotals && toMoney(orderTotals.discount) > 0 ? `-$${toMoney(orderTotals.discount).toFixed(2)}` : "$0.00"}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Tax ({taxConfig.name})</span>
                      <span className="text-[var(--text-secondary)]">{orderTotals ? toMoney(orderTotals.tax).toFixed(2) : `${taxConfig.rate}%`}</span>
                    </div>

                    <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                      <span className="text-base font-bold text-[var(--text-primary)]">Grand Total</span>
                      <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                        {orderTotals ? `${toMoney(orderTotals.total).toFixed(2)} ${orderTotals.currency}` : `$${toMoney(estimatedTotal).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Secure Pay Button — always visible on desktop */}
                  <button
                    onClick={handlePlaceOrder}
                    disabled={submitting || cartItems.length === 0}
                    className="hidden lg:flex w-full mt-6 items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-base hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin w-5 h-5" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Pay {toMoney(displayTotal).toFixed(2)} {displayCurrency}
                      </>
                    )}
                  </button>

                  <div className="hidden lg:flex items-center justify-center gap-2 mt-4 text-xs text-[var(--text-secondary)]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Secure Checkout — Your info is safe with us</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile — sticky compact summary + full-width pay button */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden border-t border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-sm px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Total</p>
            <p className="text-lg font-bold text-[var(--text-primary)] leading-tight">
              {orderTotals ? `${toMoney(orderTotals.total).toFixed(2)} ${orderTotals.currency}` : `$${toMoney(estimatedTotal).toFixed(2)}`}
            </p>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={submitting || cartItems.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                Processing…
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Secure Pay
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
