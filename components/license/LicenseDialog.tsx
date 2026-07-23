"use client";

import { useState, useCallback } from "react";
import {
  KeyRound,
  User,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Repeat,
  Calendar,
  Clock,
  Cpu,
} from "lucide-react";

type LicenseMode = "activation" | "renewal" | "reactivation";

interface LicenseState {
  mode: LicenseMode;
  licenseKey: string;
  status: string;
  productName: string;
  plan: string;
  expiryDate: string;
  daysRemaining: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  hardwareId: string;
  deviceName: string;
  hasPaidHistory: boolean;
  isTrial: boolean;
}

const API_BASE = "/internal/backend";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function LicenseDialog() {
  const [step, setStep] = useState<"key-entry" | "detecting" | "mode-selected" | "submitting" | "submitted" | "error" | "success">("key-entry");
  const [licenseKey, setLicenseKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [error, setError] = useState("");
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
  const [mode, setMode] = useState<LicenseMode>("activation");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState("");

  const detectMode = useCallback((state: LicenseState): LicenseMode => {
    const s = state.status.toLowerCase();

    if (s === "active" || s === "renewal due") {
      return "renewal";
    }

    if (state.hasPaidHistory || s === "inactive" || s === "expired" || !!state.hardwareId) {
      return "reactivation";
    }

    return "activation";
  }, []);

  const handleLicenseKeySubmit = async () => {
    const trimmed = licenseKey.trim().toUpperCase();
    if (!trimmed) {
      setKeyError("Please enter your license key");
      return;
    }
    setKeyError("");
    setStep("detecting");
    setError("");

    try {
      const res = await fetch(`${API_BASE}/licenses/reactivation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "License key not found. Please check and try again.");
        setStep("key-entry");
        return;
      }

      const result = data.data;
      const state: LicenseState = {
        mode: "activation",
        licenseKey: result.license_key,
        status: result.status,
        productName: result.product_name || "",
        plan: result.plan || "",
        expiryDate: result.expiry_date || "",
        daysRemaining: result.days_remaining ?? 0,
        customerName: result.customer?.name || "",
        customerEmail: result.customer?.email || "",
        customerPhone: result.customer?.phone || "",
        hardwareId: result.hardware?.hardware_id || "",
        deviceName: result.hardware?.device_name || "",
        hasPaidHistory: result.has_paid_history || false,
        isTrial: result.is_trial || false,
      };

      if (!state.customerName && !state.customerEmail) {
        const valRes = await fetch(`${API_BASE}/licenses/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ license_key: trimmed }),
        });
        const valData = await valRes.json();
        if (valData.valid) {
          state.status = valData.status || state.status;
          state.daysRemaining = valData.days_remaining ?? state.daysRemaining;
          state.expiryDate = valData.expiry_date || state.expiryDate;
        }
      }

      const detectedMode = detectMode(state);
      state.mode = detectedMode;
      setLicenseState(state);
      setMode(detectedMode);
      setCustomerName(state.customerName);
      setCustomerEmail(state.customerEmail);
      setCustomerPhone(state.customerPhone);
      setStep("mode-selected");
    } catch {
      setError("Unable to connect. Please check your connection and try again.");
      setStep("key-entry");
    }
  };

  const [otpCode, setOtpCode] = useState("");
  const [requiresOtp, setRequiresOtp] = useState(false);

  const handleActivate = async () => {
    if (!licenseState) return;
    setStep("submitting");
    setError("");

    try {
      const body: any = {
        license_key: licenseState.licenseKey,
        name: customerName || licenseState.customerName,
        email: customerEmail || licenseState.customerEmail,
        phone: customerPhone || licenseState.customerPhone,
        hardware_id: "web-activation",
        device_name: "Web Activation",
      };
      if (otpCode) body.otp_code = otpCode;

      const res = await fetch(`${API_BASE}/licenses/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.requires_otp) {
        setRequiresOtp(true);
        setStep("mode-selected");
        return;
      }

      if (data.success) {
        setStep("success");
      } else {
        setError(data.error || "Activation failed");
        setStep("mode-selected");
      }
    } catch {
      setError("Failed to activate. Please try again.");
      setStep("mode-selected");
    }
  };

  const handleRenew = async () => {
    if (!licenseState) return;

    const subject = encodeURIComponent(`License Renewal Request - ${licenseState.licenseKey}`);
    const body = encodeURIComponent(
      `License Key: ${licenseState.licenseKey}\n` +
      `Product: ${licenseState.productName}\n` +
      `Current Expiry: ${formatDate(licenseState.expiryDate)}\n` +
      `Name: ${customerName || licenseState.customerName}\n` +
      `Email: ${customerEmail || licenseState.customerEmail}`
    );
    window.open(`mailto:support@websmithdigital.com?subject=${subject}&body=${body}`, '_blank');
    setError("Please email support to process your renewal.");
    setStep("mode-selected");
  };

  const handleReactivate = async () => {
    if (!licenseState) return;
    setStep("submitting");
    setError("");

    try {
      const res = await fetch(`${API_BASE}/licenses/reactivation/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: licenseState.licenseKey,
          customerName: licenseState.customerName,
          customerEmail: licenseState.customerEmail,
          customerPhone: licenseState.customerPhone,
          hardwareId: licenseState.hardwareId,
          newCustomerName: customerName !== licenseState.customerName ? customerName : undefined,
          newCustomerEmail: customerEmail !== licenseState.customerEmail ? customerEmail : undefined,
          newCustomerPhone: customerPhone !== licenseState.customerPhone ? customerPhone : undefined,
          newHardwareId: undefined,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRequestId(data.request_id || `REQ-${Date.now()}`);
        setStep("submitted");
      } else {
        setError(data.error || "Failed to submit reactivation request");
        setStep("mode-selected");
      }
    } catch {
      setError("Failed to submit request. Please try again.");
      setStep("mode-selected");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLicenseKeySubmit();
  };

  const handleReset = () => {
    setStep("key-entry");
    setLicenseKey("");
    setLicenseState(null);
    setError("");
    setKeyError("");
    setReason("");
    setRequestId("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setOtpCode("");
    setRequiresOtp(false);
  };

  const modeLabels: Record<LicenseMode, { title: string; description: string; action: string }> = {
    activation: {
      title: "Activate License",
      description: "Enter your details to activate this license key.",
      action: "Activate",
    },
    renewal: {
      title: "Renew License",
      description: "Contact support to extend your license duration.",
      action: "Contact Support",
    },
    reactivation: {
      title: "Reactivate License",
      description: "Request reactivation for a previously active license.",
      action: "Submit Request",
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1a3e 30%, #16213e 60%, #0f3460 100%)",
      }}>
      <div className="w-full max-w-[520px]"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "20px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}>

        {/* Header */}
        <div style={{ padding: "32px 32px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "12px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
            }}>
              <KeyRound size="18" color="white" />
            </div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#ffffff" }}>
              {step === "success" || step === "submitted" ? "License Management" : "License Required"}
            </h1>
          </div>
        </div>

        {/* ===== KEY ENTRY ===== */}
        {step === "key-entry" && (
          <div style={{ padding: "0 32px 32px" }}>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: "1.6" }}>
              Enter your license key to activate, renew, or reactivate your license.
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>
                License Key
              </label>
              <input
                autoFocus
                value={licenseKey}
                onChange={e => { setLicenseKey(e.target.value.toUpperCase()); setKeyError(""); }}
                onKeyDown={handleKeyDown}
                placeholder="Enter your license key"
                style={{
                  width: "100%", padding: "14px 16px", borderRadius: "12px", fontSize: "15px",
                  background: "rgba(255,255,255,0.06)",
                  border: keyError ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.12)",
                  color: "white", outline: "none", letterSpacing: "1px",
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"}
                onBlur={e => e.currentTarget.style.borderColor = keyError ? "#ef4444" : "rgba(255,255,255,0.12)"}
              />
              {keyError && (
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#ef4444" }}>{keyError}</p>
              )}
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px", padding: "12px 16px", marginBottom: "16px",
                display: "flex", alignItems: "flex-start", gap: "8px",
              }}>
                <AlertCircle size="16" color="#ef4444" style={{ marginTop: "1px", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>{error}</p>
              </div>
            )}

            <button onClick={handleLicenseKeySubmit}
              style={{
                width: "100%", padding: "14px 24px", borderRadius: "12px",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                border: "none", color: "white", fontSize: "15px", fontWeight: "600",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              }}>
              Continue
              <ArrowRight size="16" />
            </button>
          </div>
        )}

        {/* ===== DETECTING ===== */}
        {step === "detecting" && (
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              border: "3px solid rgba(99,102,241,0.2)",
              borderTopColor: "#6366f1",
              animation: "ld-spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }} />
            <style>{`@keyframes ld-spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ margin: 0, fontSize: "15px", color: "rgba(255,255,255,0.8)", fontWeight: "500" }}>
              Verifying license...
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
              Detecting the appropriate activation mode
            </p>
          </div>
        )}

        {/* ===== MODE SELECTED ===== */}
        {step === "mode-selected" && licenseState && (
          <div style={{ padding: "0 32px 32px", maxHeight: "520px", overflowY: "auto" }}>
            {/* Mode Banner */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "12px 16px", borderRadius: "12px", marginBottom: "20px",
              background: mode === "activation" ? "rgba(99,102,241,0.1)" :
                          mode === "renewal" ? "rgba(16,185,129,0.1)" :
                          "rgba(245,158,11,0.1)",
              border: mode === "activation" ? "1px solid rgba(99,102,241,0.2)" :
                      mode === "renewal" ? "1px solid rgba(16,185,129,0.2)" :
                      "1px solid rgba(245,158,11,0.2)",
            }}>
              {mode === "activation" ? <ShieldCheck size="18" color="#818cf8" /> :
               mode === "renewal" ? <Repeat size="18" color="#34d399" /> :
               <RefreshCw size="18" color="#fbbf24" />}
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600",
                  color: mode === "activation" ? "#818cf8" :
                         mode === "renewal" ? "#34d399" : "#fbbf24" }}>
                  {modeLabels[mode].title}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  {modeLabels[mode].description}
                </p>
              </div>
            </div>

            {/* License Info */}
            <div style={{
              background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: "12px", padding: "14px 18px", marginBottom: "20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle size="16" color="#22c55e" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#22c55e", fontWeight: "600" }}>
                    License Found
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                    {licenseState.productName || "Product"} — {licenseState.plan || "Standard"}
                  </p>
                </div>
              </div>
              {licenseState.expiryDate && (
                <div style={{ display: "flex", gap: "16px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size="12" color="rgba(255,255,255,0.4)" />
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Expires: {formatDate(licenseState.expiryDate)}</span>
                  </div>
                  {licenseState.daysRemaining > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size="12" color="rgba(255,255,255,0.4)" />
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{licenseState.daysRemaining}d remaining</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ===== ACTIVATION MODE ===== */}
            {mode === "activation" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>
                  Customer Information
                </p>
                <FieldInput icon={<User size="14" />} label="Full Name" value={customerName} onChange={setCustomerName} placeholder="Your name" />
                <FieldInput icon={<Mail size="14" />} label="Email Address" value={customerEmail} onChange={setCustomerEmail} placeholder="your@email.com" />
                <FieldInput icon={<Phone size="14" />} label="Phone Number" value={customerPhone} onChange={setCustomerPhone} placeholder="+1 234 567 8900" />
                {requiresOtp && (
                  <FieldInput icon={<KeyRound size="14" />} label="OTP Code" value={otpCode} onChange={setOtpCode} placeholder="Enter OTP sent to your email" />
                )}
              </div>
            )}

            {/* ===== RENEWAL MODE ===== */}
            {mode === "renewal" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{
                  background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)",
                  borderRadius: "10px", padding: "12px 16px", marginBottom: "16px",
                }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#34d399" }}>
                    Your license is eligible for renewal. To extend your license, please contact our support team.
                  </p>
                </div>

                <div style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "12px 16px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <Mail size="16" color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Support Email
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
                      support@websmithdigital.com
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ===== REACTIVATION MODE ===== */}
            {mode === "reactivation" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)",
                  borderRadius: "10px", padding: "12px 16px", marginBottom: "16px",
                }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#fbbf24" }}>
                    This license was previously active. Please verify your information and submit a reactivation request.
                  </p>
                </div>

                {licenseState.hardwareId && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
                    background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)",
                  }}>
                    <Cpu size="14" color="rgba(255,255,255,0.4)" />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Previously Bound Hardware
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>
                        {licenseState.hardwareId}
                      </p>
                    </div>
                  </div>
                )}

                <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>
                  Contact Information
                </p>

                <FieldInput icon={<User size="14" />} label="Name" value={customerName} onChange={setCustomerName} placeholder="Your name"
                  isChanged={customerName !== licenseState.customerName} />
                <div style={{ height: "8px" }} />
                <FieldInput icon={<Mail size="14" />} label="Email" value={customerEmail} onChange={setCustomerEmail} placeholder="your@email.com"
                  isChanged={customerEmail !== licenseState.customerEmail} />
                <div style={{ height: "8px" }} />
                <FieldInput icon={<Phone size="14" />} label="Phone" value={customerPhone} onChange={setCustomerPhone} placeholder="+1 234 567 8900"
                  isChanged={customerPhone !== licenseState.customerPhone} />
                <div style={{ height: "12px" }} />

                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>
                  Reason for Reactivation <span style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</span>
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Upgraded hardware, lost access, etc."
                  rows={2}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: "10px", fontSize: "14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white", outline: "none", resize: "none",
                    fontFamily: "inherit", boxSizing: "border-box",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
            )}

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px", padding: "10px 14px", marginBottom: "12px",
                display: "flex", alignItems: "flex-start", gap: "8px",
              }}>
                <AlertCircle size="14" color="#ef4444" style={{ marginTop: "2px", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>{error}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleReset}
                style={{
                  padding: "12px 20px", borderRadius: "10px", flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: "500",
                  cursor: "pointer",
                }}>
                Back
              </button>
              <button onClick={mode === "activation" ? handleActivate : mode === "renewal" ? handleRenew : handleReactivate}
                style={{
                  padding: "12px 24px", borderRadius: "10px", flex: 2,
                  background: mode === "activation" ? "linear-gradient(135deg, #6366f1, #4f46e5)" :
                             mode === "renewal" ? "linear-gradient(135deg, #10b981, #059669)" :
                             "linear-gradient(135deg, #f59e0b, #d97706)",
                  border: "none", color: "white", fontSize: "14px", fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: mode === "activation" ? "0 4px 12px rgba(99,102,241,0.3)" :
                             mode === "renewal" ? "0 4px 12px rgba(16,185,129,0.3)" :
                             "0 4px 12px rgba(245,158,11,0.3)",
                }}>
                {modeLabels[mode].action}
              </button>
            </div>
          </div>
        )}

        {/* ===== SUBMITTING ===== */}
        {step === "submitting" && (
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              border: "3px solid rgba(99,102,241,0.2)",
              borderTopColor: "#6366f1",
              animation: "ld-spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }} />
            <p style={{ margin: 0, fontSize: "15px", color: "rgba(255,255,255,0.8)", fontWeight: "500" }}>
              Processing...
            </p>
          </div>
        )}

        {/* ===== SUBMITTED (Reactivation) ===== */}
        {step === "submitted" && (
          <div style={{ padding: "0 32px 32px", textAlign: "center" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "rgba(34,197,94,0.15)",
              border: "2px solid rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle size="28" color="#22c55e" />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "700", color: "#ffffff" }}>
              Request Submitted
            </h2>
            <p style={{ margin: "0 0 6px", fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: "1.6" }}>
              Your request has been received and will be reviewed.
            </p>
            {requestId && (
              <p style={{ margin: "0 0 20px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                Reference: <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{requestId}</span>
              </p>
            )}
            <button onClick={handleReset}
              style={{
                padding: "12px 28px", borderRadius: "10px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.8)", fontSize: "14px", fontWeight: "500",
                cursor: "pointer",
              }}>
              Done
            </button>
          </div>
        )}

        {/* ===== SUCCESS (Activation/Renewal) ===== */}
        {step === "success" && (
          <div style={{ padding: "0 32px 32px", textAlign: "center" }}>
            <div style={{
              width: "64px", height: "64px", borderRadius: "50%",
              background: "rgba(34,197,94,0.15)",
              border: "2px solid rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle size="32" color="#22c55e" />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: "700", color: "#ffffff" }}>
              {mode === "activation" ? "License Activated" : "License Renewed"}
            </h2>
            <p style={{ margin: "0 0 6px", fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: "1.6" }}>
              {mode === "activation"
                ? "Your license has been activated successfully."
                : "Your license has been renewed successfully."}
            </p>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
              The application will now have full access.
            </p>
            <button onClick={handleReset}
              style={{
                padding: "12px 28px", borderRadius: "10px",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                border: "none", color: "white", fontSize: "14px", fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              }}>
              Continue
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: "14px 32px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.5px" }}>
            Protected by Websmith License Management
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldInput({ icon, label, value, onChange, placeholder, isChanged }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isChanged?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 14px", borderRadius: "10px",
      background: isChanged ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.04)",
      border: isChanged ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(255,255,255,0.06)",
      transition: "all 0.2s",
    }}>
      <div style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "11px", fontWeight: "600", color: "rgba(255,255,255,0.35)", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </div>
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%", padding: "0", fontSize: "14px", fontWeight: "500",
            background: "transparent", border: "none", color: "white", outline: "none",
            fontFamily: "inherit",
          }} />
      </div>
      {isChanged && (
        <div style={{
          fontSize: "10px", padding: "2px 8px", borderRadius: "6px",
          background: "rgba(99,102,241,0.2)", color: "#818cf8", fontWeight: "600",
          flexShrink: 0, whiteSpace: "nowrap",
        }}>
          CHANGED
        </div>
      )}
    </div>
  );
}
