"use client";

// FILE: app/internal/api/buy/page.tsx
// PURPOSE: Universal Buy License Portal (customer-facing, standalone — no
//          admin sidebar / navigation / auth). Flow:
//          Product → Plan → Customer Details → OTP Verification → Payment →
//          Payment Verified → Generate License → Activation Ready → Return to SDK.
//          Every decision is validated server-side by /api/portal/* (OTP is
//          enforced server-side before any order is created; prices come from
//          the database, never the browser).

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Package, LayoutGrid, User, KeyRound, CreditCard, Check,
  ChevronRight, AlertCircle, Mail, Phone, ShieldCheck, Loader2,
  MapPin, Building2, Globe, Home, Hash, Copy, ArrowLeft, Smartphone, Lock
} from "lucide-react";
import {
  PortalShell, PortalStepper, Field, Toast, inputClass,
  portalPrice, portalDate, toMoney,
} from "../portal/_ui";
import ContactSales from "../portal/_ContactSales";
import {
  PortalProduct, PortalPlan, CheckoutCountry,
  fetchPortalProducts, fetchPortalConfig, sendOtp, verifyOtp,
  createPortalOrder, payPortalOrder,
} from "../portal/portalClient";
import { isValidEmail, mobileDigitsError } from "@/lib/validation";

const OTP_RESEND_SECONDS = 60;

interface PayResult {
  order_number: string;
  mode: string;
  license_key: string;
  expiry_date: string;
  plan: string;
  max_devices: number;
  totals?: { total?: number; currency?: string };
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  country?: string;
  postalCode?: string;
  state?: string;
  city?: string;
}

function IconBadge({ icon: Icon, color = "indigo" }: { icon: any; color?: string }) {
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color === "indigo" ? "from-indigo-500/15 to-purple-500/15" : "from-emerald-500/15 to-teal-500/15"} border border-indigo-500/20 flex items-center justify-center shrink-0`}>
      <Icon className="w-5 h-5 text-indigo-400" />
    </div>
  );
}

export default function BuyLicensePage() {
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [countries, setCountries] = useState<CheckoutCountry[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [taxConfig, setTaxConfig] = useState({ rate: 0, name: "VAT", currency: "USD" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [step, setStep] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<PortalProduct | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PortalPlan | null>(null);

  // Customer details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [countryName, setCountryName] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");

  // OTP
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Payment
  const [orderTotals, setOrderTotals] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const steps = [
    { label: "Product", icon: Package },
    { label: "Plan", icon: LayoutGrid },
    { label: "Details", icon: User },
    { label: "OTP", icon: Smartphone },
    { label: "Payment", icon: CreditCard },
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prods, cfg] = await Promise.all([fetchPortalProducts(), fetchPortalConfig().catch(() => null)]);
        if (!cancelled) {
          setProducts(prods);
          if (cfg) {
            setCountries(cfg.countries || []);
            setStates(cfg.states || []);
            setCities(cfg.cities || []);
            if (cfg.tax) setTaxConfig(cfg.tax);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Could not load the store.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedCountry = useMemo(
    () => countries.find(c => c.dial === countryCode || c.code === countryCode),
    [countries, countryCode]
  );

  const availableStates = useMemo(
    () => states.filter(s => s.country_code === selectedCountry?.code),
    [states, selectedCountry]
  );
  const selectedStateId = useMemo(() => availableStates.find(s => s.name === state)?.id || null, [availableStates, state]);
  const availableCities = useMemo(() => (selectedStateId ? cities.filter(c => c.state_id === selectedStateId) : []), [cities, selectedStateId]);

  const emailValid = isValidEmail(email);
  const mobileError = mobileDigitsError(selectedCountry, mobile.replace(/\D/g, ""));
  const detailsDone = Boolean(firstName.trim() && lastName.trim() && isValidEmail(email));
  const billingDone = Boolean(postalCode.trim() && state.trim() && city.trim() && countryName.trim());

  const validateForm = useCallback((): FormErrors => {
    const errors: FormErrors = {};
    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!lastName.trim()) errors.lastName = "Last name is required";
    if (!email.trim()) errors.email = "Email address is required";
    else if (!isValidEmail(email)) errors.email = "Please enter a valid email address";
    if (mobile.trim() && mobileError) errors.mobile = mobileError;
    if (!countryName.trim()) errors.country = "Please select your country";
    if (!postalCode.trim()) errors.postalCode = "Postal code is required";
    else if (!/^[a-zA-Z0-9]{3,12}$/.test(postalCode.replace(/[\s-]/g, ""))) errors.postalCode = "Please enter a valid postal code";
    if (!state.trim()) errors.state = "State / Province is required";
    if (!city.trim()) errors.city = "City is required";
    return errors;
  }, [firstName, lastName, email, mobile, mobileError, countryName, postalCode, state, city]);

  useEffect(() => {
    if (Object.keys(touched).length === 0) return;
    setFormErrors(validateForm());
  }, [firstName, lastName, email, mobile, mobileError, countryName, postalCode, state, city, touched, validateForm]);

  const markTouched = useCallback(() => {
    setTouched({ firstName: true, lastName: true, email: true, mobile: true, country: true, postalCode: true, state: true, city: true });
  }, []);

  const handleSendOtp = useCallback(async () => {
    if (!emailValid) {
      setOtpError("Enter a valid email address first.");
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      await sendOtp(email.trim());
      setOtpSent(true);
      setOtp("");
      setResendIn(OTP_RESEND_SECONDS);
      setToast({ message: "OTP sent to your email", type: "success" });
    } catch (e: any) {
      setOtpError(e.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpSending(false);
    }
  }, [email, emailValid]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.trim().length < 4) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }
    setOtpVerifying(true);
    setOtpError(null);
    try {
      await verifyOtp(email.trim(), otp.trim());
      setOtpVerified(true);
      setToast({ message: "Email verified", type: "success" });
    } catch (e: any) {
      setOtpError(e.message || "Verification failed. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  }, [email, otp]);

  const goDetails = useCallback(() => {
    const errs = validateForm();
    setFormErrors(errs);
    markTouched();
    if (Object.keys(errs).length > 0) {
      setToast({ message: "Please fix the highlighted fields.", type: "error" });
      return;
    }
    setStep(2);
  }, [validateForm, markTouched]);

  const handlePay = useCallback(async () => {
    if (!otpVerified) {
      setOtpError("OTP verification is required before payment.");
      setStep(3);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        mode: "buy",
        customer: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: company.trim(),
          email: email.trim(),
          mobile: `${countryCode}${mobile.replace(/\s/g, "")}`,
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim(),
          city: city.trim(),
          state: state.trim(),
          country: countryName,
          postal_code: postalCode.trim(),
        },
        items: [{ product_id: selectedProduct?.id, plan_id: selectedPlan?.id, quantity: 1 }],
        payment_gateway: "dummy",
      };
      const created = await createPortalOrder(payload);
      setOrderTotals(created.totals);
      const paid = await payPortalOrder(created.order_number);
      setResult({
        order_number: paid.order_number,
        mode: paid.mode,
        license_key: paid.license_key,
        expiry_date: paid.expiry_date,
        plan: paid.plan,
        max_devices: paid.max_devices,
        totals: paid.totals,
      });
      setStep(5);
    } catch (e: any) {
      setError(e.message || "Payment processing failed. Please try again.");
      setToast({ message: e.message || "Payment processing failed. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [otpVerified, firstName, lastName, company, email, countryCode, mobile, addressLine1, addressLine2, city, state, countryName, postalCode, selectedProduct, selectedPlan]);

  // Contact Sales entry — opens the shared email dialog in customer mode.
  // Posts to the public /api/portal/support-message route; recipient is
  // resolved server-side (Buy → sales@websmithdigital.com).
  const contactSalesEntry = (
    <ContactSales
      action="buy-license"
      defaultEmail={email}
      defaultCustomerName={[firstName, lastName].filter(Boolean).join(" ").trim() || undefined}
      defaultCustomerMobile={mobile}
      defaultProductName={selectedProduct?.name}
    />
  );

  if (loading) {
    return (
      <PortalShell eyebrow="Buy License" title="Buy License" headerAction={contactSalesEntry}>
        <div className="grid lg:grid-cols-2 gap-6 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 p-6 h-40" />
          ))}
        </div>
      </PortalShell>
    );
  }

  // ============================================================
  // SUCCESS — Payment Verified → License Generated → Activation Ready
  // ============================================================
  if (result) {
    return (
      <PortalShell eyebrow="Buy License" title="License Ready for Activation" headerAction={contactSalesEntry}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent p-6 sm:p-8 text-center"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2">Payment Successful</h2>
          <p className="text-[var(--text-secondary)] mb-6">
            Your license has been generated and is ready for activation.
          </p>

          <div className="text-left rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 divide-y divide-[var(--border-color)] mb-6">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Order</span>
              <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{result.order_number}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Product</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{selectedProduct?.name}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Plan</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{result.plan}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Amount Paid</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {orderTotals ? `${toMoney(orderTotals.total).toFixed(2)} ${orderTotals.currency}` : (result.totals?.total ? `${toMoney(result.totals.total).toFixed(2)} ${result.totals.currency}` : "Paid")}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Expires</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{portalDate(result.expiry_date)}</span>
            </div>
          </div>

          <div className="text-left rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 p-4 mb-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3">
              <KeyRound className="w-4 h-4 text-indigo-400" /> Your License Key
            </h3>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <code className="font-mono text-sm text-[var(--text-primary)] break-all">{result.license_key}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(result.license_key); setToast({ message: "License key copied", type: "success" }); }}
                className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-2 justify-center">
            <a
              href=""
              onClick={(e) => { e.preventDefault(); window.close(); }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-color)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/40 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Return to activation in your SDK
            </a>
            <span className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-bold cursor-default">
              <Check className="w-4 h-4" /> Activation Ready
            </span>
          </div>

          <p className="flex items-center justify-center gap-2 mt-6 text-xs text-[var(--text-secondary)]">
            <Mail className="w-3.5 h-3.5" /> Your license key has been delivered to <span className="text-[var(--text-primary)]">{email}</span>
          </p>
        </motion.div>
      </PortalShell>
    );
  }

  // ============================================================
  // MAIN FLOW
  // ============================================================
  return (
    <PortalShell eyebrow="Buy License" title="Buy License" headerAction={contactSalesEntry}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <PortalStepper steps={steps} current={step} />
      </motion.div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-2 mb-6">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* STEP 0 — PRODUCT */}
      {step === 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-4">
          {products.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedProduct(p); setSelectedPlan(null); setStep(1); }}
              className={`group text-left rounded-2xl border p-5 transition-all ${
                selectedProduct?.id === p.id
                  ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_30px_-10px_rgba(99,102,241,0.4)]"
                  : "border-[var(--border-color)] bg-[var(--bg-secondary)]/30 hover:border-indigo-500/40"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-lg font-bold text-indigo-300 shrink-0 overflow-hidden">
                  {p.logo_url ? <img src={p.logo_url} alt={p.name} className="w-full h-full object-contain" /> : p.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[var(--text-primary)] truncate">{p.name}</p>
                  {p.version && <p className="text-xs text-[var(--text-secondary)]">v{p.version}</p>}
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">{p.description || p.short_description || ""}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">{p.plans.length} plan{p.plans.length !== 1 ? "s" : ""}</span>
                <span className="inline-flex items-center gap-1 text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Select <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </button>
          ))}
          {products.length === 0 && (
            <div className="md:col-span-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 p-8 text-center text-sm text-[var(--text-secondary)]">
              No products are currently available for purchase.
            </div>
          )}
        </motion.div>
      )}

      {/* STEP 1 — PLAN */}
      {step === 1 && selectedProduct && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <button onClick={() => setStep(0)} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to products
          </button>
          <div className="grid md:grid-cols-2 gap-4">
            {selectedProduct.plans.filter(p => !p.is_trial_plan).map(plan => (
              <button
                key={plan.id}
                onClick={() => { setSelectedPlan(plan); setStep(2); }}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  selectedPlan?.id === plan.id
                    ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_30px_-10px_rgba(99,102,241,0.4)]"
                    : "border-[var(--border-color)] bg-[var(--bg-secondary)]/30 hover:border-indigo-500/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-[var(--text-primary)]">{plan.name}</p>
                  <p className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    {portalPrice(plan.price)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)] mb-3">
                  <span>{plan.duration_days} days</span>
                  <span>{plan.max_devices} device{plan.max_devices !== 1 ? "s" : ""}</span>
                </div>
                {plan.description && <p className="text-sm text-[var(--text-secondary)]">{plan.description}</p>}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* STEP 2 — CUSTOMER DETAILS */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <IconBadge icon={User} />
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Contact Information</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="First Name" required error={formErrors.firstName}>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" className={inputClass} autoComplete="given-name" />
              </Field>
              <Field label="Last Name" required error={formErrors.lastName}>
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" className={inputClass} autoComplete="family-name" />
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
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@acme.com" className={`${inputClass} pl-10`} autoComplete="email" />
                  </div>
                </Field>
              </div>
              <Field label="Mobile Number" required error={formErrors.mobile}>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    className={`${inputClass} w-auto appearance-none cursor-pointer`}
                  >
                    {countries.map(c => <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>)}
                  </select>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <input type="tel" value={mobile} onChange={e => setMobile(e.target.value.replace(/[^0-9\s]/g, ""))} placeholder="98765 43210" className={`${inputClass} pl-10`} autoComplete="tel" />
                  </div>
                </div>
                {mobile.trim() && mobileError && <p className="text-xs text-amber-400 mt-1.5">{mobileError}</p>}
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <IconBadge icon={MapPin} />
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Billing Address</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Country" required error={formErrors.country}>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <select value={countryName} onChange={e => { setCountryName(e.target.value); setState(""); setCity(""); }} className={`${inputClass} pl-10 appearance-none cursor-pointer`}>
                      <option value="">Select your country</option>
                      {countries.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
                    </select>
                  </div>
                </Field>
              </div>
              <Field label="State / Province" required error={formErrors.state}>
                <input list="portal-states" value={state} onChange={e => { setState(e.target.value); setCity(""); }} placeholder={availableStates.length ? "Select or type your state" : "California"} className={inputClass} autoComplete="address-level1" />
                <datalist id="portal-states">{availableStates.map(s => <option key={s.id} value={s.name} />)}</datalist>
              </Field>
              <Field label="Postal Code" required error={formErrors.postalCode}>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                  <input value={postalCode} onChange={e => setPostalCode(e.target.value.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 12))} placeholder="560001" className={`${inputClass} pl-10`} autoComplete="postal-code" />
                </div>
              </Field>
              <Field label="City" required error={formErrors.city}>
                <input list="portal-cities" value={city} onChange={e => setCity(e.target.value)} placeholder="Bengaluru" className={inputClass} autoComplete="address-level2" />
                <datalist id="portal-cities">{availableCities.map(c => <option key={c.id} value={c.name} />)}</datalist>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Street Address" hint="Street address / Road name">
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} placeholder="12A, MG Road" className={`${inputClass} pl-10`} autoComplete="address-line1" />
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Address Line 2" hint="Building, landmark (optional)">
                  <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} placeholder="Sunrise Towers" className={inputClass} autoComplete="address-line2" />
                </Field>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-[var(--border-color)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
              Back
            </button>
            <button
              onClick={goDetails}
              disabled={!detailsDone || !billingDone}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
            >
              Continue to OTP <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 3 — OTP */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Verify Your Email</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              We sent a one-time code to <span className="text-[var(--text-primary)] font-medium">{email}</span>
            </p>

            {otpVerified ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <Check className="w-4 h-4" /> Email verified — you can proceed to payment.
              </div>
            ) : (
              <>
                {!otpSent ? (
                  <button
                    onClick={handleSendOtp}
                    disabled={otpSending || !emailValid}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                  >
                    {otpSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Send OTP
                  </button>
                ) : (
                  <>
                    <div className="flex gap-2 justify-center mb-4">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <input
                          key={i}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={otp[i] || ""}
                          onChange={e => {
                            const v = e.target.value.replace(/\D/g, "");
                            setOtp(p => {
                              const arr = (p || "").split("");
                              arr[i] = v;
                              const next = arr.join("").slice(0, 6);
                              if (v && i < 5) (document.getElementById(`otp-${i + 1}`) as HTMLInputElement)?.focus();
                              return next;
                            });
                          }}
                          id={`otp-${i}`}
                          className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                        />
                      ))}
                    </div>
                    {otpError && <p className="text-xs text-red-400 mb-3">{otpError}</p>}
                    <button
                      onClick={handleVerifyOtp}
                      disabled={otpVerifying || otp.trim().length < 6}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                    >
                      {otpVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      Verify & Continue
                    </button>
                    <button
                      onClick={handleSendOtp}
                      disabled={otpSending || resendIn > 0}
                      className="w-full mt-3 text-xs text-[var(--text-secondary)] hover:text-indigo-400 disabled:opacity-50"
                    >
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend OTP"}
                    </button>
                  </>
                )}
              </>
            )}

            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(2)} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back
              </button>
              <button
                onClick={() => { if (otpVerified) setStep(4); }}
                disabled={!otpVerified}
                className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
              >
                {otpVerified ? <>Proceed to Payment <ChevronRight className="w-4 h-4" /></> : ""}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 4 — PAYMENT */}
      {step === 4 && selectedProduct && selectedPlan && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <IconBadge icon={CreditCard} />
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Payment</h2>
                <p className="text-xs text-[var(--text-secondary)]">Test gateway — payment is simulated, license is generated instantly.</p>
              </div>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-400">
                Secure checkout via the same payment architecture as the Software Store. No real charge is made.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6 relative overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(147,51,234,0.08))" }} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <IconBadge icon={Package} />
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Order Summary</h2>
                    <p className="text-[11px] text-[var(--text-secondary)]">{selectedProduct.name} · {selectedPlan.name}</p>
                  </div>
                </div>
                <div className="space-y-2.5 border-t border-[var(--border-color)] pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Subtotal</span>
                    <span className="text-[var(--text-primary)] font-medium">{portalPrice(selectedPlan.price)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Tax ({taxConfig.name})</span>
                    <span className="text-[var(--text-secondary)]">{orderTotals ? toMoney(orderTotals.tax).toFixed(2) : `${taxConfig.rate}%`}</span>
                  </div>
                  <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                    <span className="text-base font-bold text-[var(--text-primary)]">Total</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      {orderTotals ? `${toMoney(orderTotals.total).toFixed(2)} ${orderTotals.currency}` : portalPrice(selectedPlan.price)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handlePay}
                  disabled={submitting}
                  className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  {submitting ? "Processing Payment..." : `Pay & Generate License`}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </PortalShell>
  );
}