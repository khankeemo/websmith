"use client";

// FILE: app/internal/api/renew/page.tsx
// PURPOSE: Universal Renew License Portal (customer-facing, standalone — no
//          admin chrome). Flow:
//          Validate License → Load Current Product/Plan → Customer Details →
//          OTP → Payment → Extend Existing License → Refresh Status → Return to SDK.
//          Server-side rules: renewal NEVER generates a new license (it extends
//          the existing one); license key is bound to the order server-side;
//          eligibility comes from resolveGlobalLicenseStatus() (Rule 1).

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  KeyRound, LayoutGrid, User, Smartphone, CreditCard, Check,
  ChevronRight, AlertCircle, Mail, Phone, ShieldCheck, Loader2,
  Package, RefreshCw, CalendarDays, ArrowLeft
} from "lucide-react";
import {
  PortalShell, PortalStepper, Field, Toast, inputClass, portalPrice,
} from "../portal/_ui";
import ContactSales from "../portal/_ContactSales";
import {
  fetchLicenseInfo, LicenseInfo, createPortalOrder, payPortalOrder, sendOtp, verifyOtp,
} from "../portal/portalClient";

const OTP_RESEND_SECONDS = 60;

interface RenewResult {
  order_number: string;
  new_expiry: string;
  old_expiry: string;
  plan: string;
  max_devices: number;
  extra_days: number;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  mobile?: string;
  country?: string;
  postalCode?: string;
  state?: string;
  city?: string;
}

export default function RenewLicensePage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // License validation
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [renewalPlans, setRenewalPlans] = useState<any[]>([]);
  const [validating, setValidating] = useState(false);
  const [selectedRenewPlan, setSelectedRenewPlan] = useState<any>(null);

  // Customer (prefilled from license)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  // OTP
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Payment
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RenewResult | null>(null);

  const steps = [
    { label: "License", icon: KeyRound },
    { label: "Renewal Plan", icon: LayoutGrid },
    { label: "Details", icon: User },
    { label: "OTP", icon: Smartphone },
    { label: "Payment", icon: CreditCard },
  ];

  const handleValidateLicense = useCallback(async () => {
    const key = licenseKey.trim();
    if (!key) {
      setError("Please enter your license key.");
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const info = await fetchLicenseInfo(key);
      if (!info.renewable) {
        setError(info.status === "EXPIRED" ? "This license has expired. You can renew it below." : "This license is not currently available for renewal.");
      }
      setLicenseInfo(info.license);
      setRenewalPlans(info.plans || []);
      const plans = info.plans || [];
      const current = plans.find((p: any) => p.name === info.license.current_plan.name) || plans[0] || null;
      setSelectedRenewPlan(current);
      // Prefill customer from the license (email is the OTP/order identity and
      // must stay the license email for the server-side match).
      const name = info.license.customer_name || "";
      const parts = name.trim().split(/\s+/);
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
      setEmail(info.license.customer_email || "");
      setStep(1);
    } catch (e: any) {
      setError(e.message || "Could not validate license. Check the key and try again.");
    } finally {
      setValidating(false);
    }
  }, [licenseKey]);

  const selectPlanNext = useCallback(() => {
    if (!selectedRenewPlan) {
      setToast({ message: "Please select a renewal plan.", type: "error" });
      return;
    }
    setStep(2);
  }, [selectedRenewPlan]);

  const handleSendOtp = useCallback(async () => {
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
  }, [email]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.trim().length < 6) { setOtpError("Enter the 6-digit OTP."); return; }
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

  const handleRenewPay = useCallback(async () => {
    if (!otpVerified) { setOtpError("OTP verification is required before payment."); setStep(3); return; }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        mode: "renew",
        license_key: licenseInfo?.license_key,
        plan_id: selectedRenewPlan?.id,
        customer: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: company.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
        },
        payment_gateway: "dummy",
      };
      const created = await createPortalOrder(payload);
      const paid = await payPortalOrder(created.order_number);
      setResult({
        order_number: created.order_number,
        new_expiry: paid.new_expiry,
        old_expiry: paid.old_expiry,
        plan: paid.plan || paid.new_plan || selectedRenewPlan?.name,
        max_devices: paid.max_devices,
        extra_days: paid.extra_days,
      });
      setStep(5);
    } catch (e: any) {
      setError(e.message || "Renewal processing failed. Please try again.");
      setToast({ message: e.message || "Renewal processing failed. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [otpVerified, licenseInfo, selectedRenewPlan, firstName, lastName, company, email, mobile]);

  // Contact Sales entry — opens the shared email dialog in customer mode.
  // Posts to the public /api/portal/support-message route; recipient is
  // resolved server-side (Renew → sales@websmithdigital.com).
  const contactSalesEntry = (
    <ContactSales
      action="renew"
      defaultEmail={email}
      defaultCustomerName={[firstName, lastName].filter(Boolean).join(" ").trim() || undefined}
      defaultCustomerMobile={mobile}
      defaultLicenseKey={licenseInfo?.license_key || licenseKey}
      defaultProductName={licenseInfo?.product_name}
    />
  );

  // ============================================================
  // SUCCESS — License Extended, Refresh Status
  // ============================================================
  if (result) {
    return (
      <PortalShell eyebrow="Renew License" title="License Renewed" headerAction={contactSalesEntry}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent p-6 sm:p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2">License Renewed</h2>
          <p className="text-[var(--text-secondary)] mb-2">Your existing license has been extended — no new license was created.</p>

          <div className="text-left rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 divide-y divide-[var(--border-color)] mb-6">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Order</span>
              <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{result.order_number}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Plan</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{result.plan}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Days Added</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{result.extra_days} days</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">Previous Expiry</span>
              <span className="text-sm font-medium text-[var(--text-secondary)]">{new Date(result.old_expiry).toISOString().split("T")[0]}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">New Expiry</span>
              <span className="text-sm font-bold text-emerald-400">{new Date(result.new_expiry).toISOString().split("T")[0]}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-2 justify-center">
            <a href="" onClick={(e) => { e.preventDefault(); window.close(); }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-color)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/40 transition-all">
              <ArrowLeft className="w-4 h-4" /> Return to your SDK
            </a>
            <span className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-bold cursor-default">
              <RefreshCw className="w-4 h-4" /> License Extended
            </span>
          </div>

          <p className="flex items-center justify-center gap-2 mt-6 text-xs text-[var(--text-secondary)]">
            <Mail className="w-3.5 h-3.5" /> Renewal confirmed for <span className="text-[var(--text-primary)]">{email}</span>
          </p>
        </motion.div>
      </PortalShell>
  );
  }

  return (
    <PortalShell eyebrow="Renew License" title="Renew License" subtitle="Renew your existing license. Your license is extended with additional time — a new license is never created." headerAction={contactSalesEntry}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <PortalStepper steps={steps} current={step} />
      </motion.div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-2 mb-6">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-400">{error}</div>
        </div>
      )}

      {/* STEP 0 — LICENSE */}
      {step === 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Validate Your License</h2>
                <p className="text-xs text-[var(--text-secondary)]">Enter the license key you want to renew.</p>
              </div>
            </div>
            <Field label="License Key" required>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                <input
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="XXXXX-XXXX-XXXX-XXXX-XXXX"
                  className={`${inputClass} pl-10 font-mono uppercase`}
                  autoComplete="off"
                />
              </div>
            </Field>
            <button
              onClick={handleValidateLicense}
              disabled={validating || !licenseKey.trim()}
              className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              {validating ? "Validating..." : "Validate & Load Details"}
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 1 — RENEWAL PLAN */}
      {step === 1 && licenseInfo && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6 grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Product</p>
              <p className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" /> {licenseInfo.product_name || "Your product"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Current Plan</p>
              <p className="font-bold text-[var(--text-primary)]">{licenseInfo.current_plan.name}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Current Expiry</p>
              <p className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-indigo-400" /> {new Date(licenseInfo.expiry_date).toISOString().split("T")[0]}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Devices</p>
              <p className="font-bold text-[var(--text-primary)]">{licenseInfo.max_devices}</p>
            </div>
          </div>

          <h3 className="text-base font-bold text-[var(--text-primary)]">Select Renewal Plan</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {renewalPlans.length === 0 && (
              <div className="md:col-span-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 p-6 text-sm text-[var(--text-secondary)]">
                No renewal plans are available. You will be renewed on your current plan.
              </div>
            )}
            {renewalPlans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedRenewPlan(plan)}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  selectedRenewPlan?.id === plan.id
                    ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_30px_-10px_rgba(99,102,241,0.4)]"
                    : "border-[var(--border-color)] bg-[var(--bg-secondary)]/30 hover:border-indigo-500/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-[var(--text-primary)]">{plan.name}</p>
                  <p className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{portalPrice(plan.price)}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                  <span>{plan.duration_days} days</span>
                  <span>{plan.max_devices} device{plan.max_devices !== 1 ? "s" : ""}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(0)} className="px-5 py-3 rounded-xl border border-[var(--border-color)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
              Back
            </button>
            <button onClick={selectPlanNext} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 2 — DETAILS */}
      {step === 2 && licenseInfo && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Contact / Billing</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="First Name" required>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} autoComplete="given-name" />
              </Field>
              <Field label="Last Name" required>
                <input value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} autoComplete="family-name" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Company">
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc. (optional)" className={inputClass} autoComplete="organization" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Email Address" required hint="This is the OTP identity and must match your license.">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`${inputClass} pl-10 bg-[var(--bg-tertiary)]/40`} readOnly />
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Mobile Number">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50" />
                    <input type="tel" value={mobile} onChange={e => setMobile(e.target.value.replace(/[^0-9\s+]/g, ""))} placeholder="98765 43210" className={`${inputClass} pl-10`} autoComplete="tel" />
                  </div>
                </Field>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-[var(--border-color)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
              Back
            </button>
            <button onClick={() => setStep(3)} disabled={!firstName.trim() || !lastName.trim() || !email.trim()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50">
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
                  <button onClick={handleSendOtp} disabled={otpSending}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50">
                    {otpSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Send OTP
                  </button>
                ) : (
                  <>
                    <div className="flex gap-2 justify-center mb-4">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <input key={i} type="text" inputMode="numeric" maxLength={1} value={otp[i] || ""}
                          onChange={e => { const v = e.target.value.replace(/\D/g, ""); setOtp(p => { const arr = (p || "").split(""); arr[i] = v; if (v && i < 5) (document.getElementById(`r-otp-${i + 1}`) as HTMLInputElement)?.focus(); return arr.join("").slice(0, 6); }); }}
                          id={`r-otp-${i}`}
                          className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50" />
                      ))}
                    </div>
                    {otpError && <p className="text-xs text-red-400 mb-3">{otpError}</p>}
                    <button onClick={handleVerifyOtp} disabled={otpVerifying || otp.trim().length < 6}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50">
                      {otpVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Verify & Continue
                    </button>
                    <button onClick={handleSendOtp} disabled={otpSending || resendIn > 0} className="w-full mt-3 text-xs text-[var(--text-secondary)] hover:text-indigo-400 disabled:opacity-50">
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
              <button onClick={() => { if (otpVerified) setStep(4); }} disabled={!otpVerified} className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-40">
                {otpVerified ? <>Proceed to Payment <ChevronRight className="w-4 h-4" /></> : ""}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 4 — PAYMENT */}
      {step === 4 && licenseInfo && selectedRenewPlan && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Payment</h2>
                <p className="text-xs text-[var(--text-secondary)]">Test gateway — renewal is simulated, your license is extended instantly.</p>
              </div>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-400">Using the same secure payment architecture as the Software Store. No real charge is made.</p>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-6 relative overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(147,51,234,0.08))" }} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shrink-0"><LayoutGrid className="w-5 h-5 text-indigo-400" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Renewal Summary</h2>
                    <p className="text-[11px] text-[var(--text-secondary)]">{licenseInfo.product_name} · {selectedRenewPlan.name}</p>
                  </div>
                </div>
                <div className="space-y-2.5 border-t border-[var(--border-color)] pt-4">
                  <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Renewal ({selectedRenewPlan.duration_days} days)</span><span className="text-[var(--text-primary)] font-medium">{portalPrice(selectedRenewPlan.price)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">License</span><span className="font-mono text-xs text-[var(--text-primary)] break-all">{licenseInfo.license_key}</span></div>
                  <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                    <span className="text-base font-bold text-[var(--text-primary)]">Total</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{portalPrice(selectedRenewPlan.price)}</span>
                  </div>
                </div>
                <button onClick={handleRenewPay} disabled={submitting}
                  className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50">
                  {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                  {submitting ? "Processing..." : "Renew & Extend License"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </PortalShell>
  );
}