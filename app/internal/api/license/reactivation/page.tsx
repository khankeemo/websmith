"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, KeyRound, User, Mail, Phone, Monitor, Loader2, ExternalLink, ArrowRight, RefreshCw } from "lucide-react";

const API_BASE = "/internal/backend";

type Step = "welcome" | "key-entry" | "fetching" | "review" | "submitting" | "submitted" | "success" | "error";

interface CustomerData {
  name: string;
  email: string;
  phone: string;
}

interface HardwareData {
  hardware_id: string;
  device_name: string;
  os_version: string;
  last_seen: string;
}

interface LicenseFetchResult {
  license_key: string;
  product_id: string;
  product_name: string;
  plan: string;
  status: string;
  expiry_date: string;
  is_trial: boolean;
  has_paid_history: boolean;
  customer: CustomerData;
  hardware: HardwareData | null;
}

export default function LicenseReactivationPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseData, setLicenseData] = useState<LicenseFetchResult | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editHardwareId, setEditHardwareId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [keyError, setKeyError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [changedFields, setChangedFields] = useState<string[]>([]);

  const handleLicenseKeySubmit = async () => {
    const trimmed = licenseKey.trim().toUpperCase();
    if (!trimmed) {
      setKeyError("Please enter your license key");
      return;
    }
    setKeyError("");
    setStep("fetching");
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
      setLicenseData(result);
      setEditName(result.customer?.name || "");
      setEditEmail(result.customer?.email || "");
      setEditPhone(result.customer?.phone || "");
      setEditHardwareId(result.hardware?.hardware_id || "");
      setStep("review");
    } catch (e) {
      setError("Unable to connect. Please check your internet connection and try again.");
      setStep("key-entry");
    }
  };

  const handleFieldChange = (field: string, newVal: string, origVal: string) => {
    setChangedFields(prev => {
      const isChanged = newVal !== origVal;
      if (isChanged && !prev.includes(field)) return [...prev, field];
      if (!isChanged) return prev.filter(f => f !== field);
      return prev;
    });
  };

  const handleSubmitRequest = async () => {
    if (!licenseData) return;
    setStep("submitting");
    setError("");

    try {
      const res = await fetch(`${API_BASE}/licenses/reactivation/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: licenseData.license_key,
          customerName: licenseData.customer?.name || "",
          customerEmail: licenseData.customer?.email || "",
          customerPhone: licenseData.customer?.phone || "",
          hardwareId: licenseData.hardware?.hardware_id || "",
          newCustomerName: editName !== licenseData.customer?.name ? editName : undefined,
          newCustomerEmail: editEmail !== licenseData.customer?.email ? editEmail : undefined,
          newCustomerPhone: editPhone !== licenseData.customer?.phone ? editPhone : undefined,
          newHardwareId: editHardwareId !== licenseData.hardware?.hardware_id ? editHardwareId : undefined,
          reason,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to submit request. Please try again.");
        setStep("review");
        return;
      }

      setRequestId(data.request_id || `REQ-${Date.now()}`);
      setEmailSent(data.data?.email_sent || false);
      setStep("submitted");
    } catch (e) {
      setError("Unable to connect. Please try again.");
      setStep("review");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLicenseKeySubmit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1a3e 30%, #16213e 60%, #0f3460 100%)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
      <div className="w-full max-w-[500px]"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "20px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
          overflow: "hidden",
          transition: "all 0.3s ease",
        }}>

        {step !== "success" && (
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
                License Required
              </h1>
            </div>
            {step !== "submitted" && (
              <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: "1.6" }}>
                This device was previously activated with a paid license. Trial mode is no longer available.
                Please activate or renew your license to continue.
              </p>
            )}
          </div>
        )}

        {step === "welcome" && (
          <div style={{ padding: "0 32px 32px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={() => setStep("key-entry")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", borderRadius: "14px",
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  border: "none", color: "white", fontSize: "15px", fontWeight: "600",
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                <span>Activate License</span>
                <ArrowRight size="18" />
              </button>
              <button
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", borderRadius: "14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)",
                  fontSize: "15px", fontWeight: "500",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                }}
                onClick={() => window.open("https://websmithdigital.com/renew", "_blank")}>
                <span>Renew License</span>
                <ExternalLink size="16" />
              </button>
              <button
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", borderRadius: "14px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                  fontSize: "15px", fontWeight: "400",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                }}
                onClick={() => window.open("https://websmithdigital.com/support", "_blank")}>
                <span>Contact Support</span>
                <ExternalLink size="16" />
              </button>
            </div>
          </div>
        )}

        {step === "key-entry" && (
          <div style={{ padding: "0 32px 32px" }}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block", fontSize: "13px", fontWeight: "600",
                color: "rgba(255,255,255,0.7)", marginBottom: "8px",
              }}>
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
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#ef4444" }}>
                  {keyError}
                </p>
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

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep("welcome")}
                style={{
                  padding: "12px 20px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: "500",
                  cursor: "pointer", flex: 1,
                }}>
                Back
              </button>
              <button onClick={handleLicenseKeySubmit}
                style={{
                  padding: "12px 24px", borderRadius: "10px", flex: 2,
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  border: "none", color: "white", fontSize: "14px", fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "fetching" && (
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              border: "3px solid rgba(99,102,241,0.2)",
              borderTopColor: "#6366f1",
              animation: "lr-spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }} />
            <style>{`@keyframes lr-spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ margin: 0, fontSize: "15px", color: "rgba(255,255,255,0.8)", fontWeight: "500" }}>
              Verifying license...
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
              Retrieving your license information
            </p>
          </div>
        )}

        {step === "review" && licenseData && (
          <div style={{ padding: "0 32px 32px", maxHeight: "500px", overflowY: "auto" }}>
            <div style={{
              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: "12px", padding: "14px 18px", marginBottom: "20px",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <CheckCircle size="18" color="#22c55e" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: "13px", color: "#22c55e", fontWeight: "600" }}>
                  License Found
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  {licenseData.product_name} — {licenseData.plan}
                </p>
              </div>
            </div>

            <p style={{ margin: "0 0 14px", fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>
              Your Information
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              <FieldRow
                icon={<User size="15" />}
                label="Name"
                value={editName}
                originalValue={licenseData.customer?.name || ""}
                onChange={v => {
                  setEditName(v);
                  handleFieldChange("name", v, licenseData.customer?.name || "");
                }}
              />
              <FieldRow
                icon={<Mail size="15" />}
                label="Email"
                value={editEmail}
                originalValue={licenseData.customer?.email || ""}
                onChange={v => {
                  setEditEmail(v);
                  handleFieldChange("email", v, licenseData.customer?.email || "");
                }}
              />
              <FieldRow
                icon={<Phone size="15" />}
                label="Phone"
                value={editPhone}
                originalValue={licenseData.customer?.phone || ""}
                onChange={v => {
                  setEditPhone(v);
                  handleFieldChange("phone", v, licenseData.customer?.phone || "");
                }}
              />
              <FieldRow
                icon={<Monitor size="15" />}
                label="Hardware ID"
                value={editHardwareId}
                originalValue={licenseData.hardware?.hardware_id || ""}
                onChange={v => {
                  setEditHardwareId(v);
                  handleFieldChange("hardware", v, licenseData.hardware?.hardware_id || "");
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block", fontSize: "13px", fontWeight: "600",
                color: "rgba(255,255,255,0.7)", marginBottom: "8px",
              }}>
                Reason for Reactivation <span style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
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

            {changedFields.length > 0 && (
              <div style={{
                background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.15)",
                borderRadius: "10px", padding: "10px 14px", marginBottom: "16px",
              }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#fbbf24" }}>
                  Changes detected: {changedFields.join(", ")}. An admin will review these updates.
                </p>
              </div>
            )}

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px", padding: "10px 14px", marginBottom: "12px",
              }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>{error}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setStep("key-entry"); setError(""); }}
                style={{
                  padding: "12px 20px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: "500",
                  cursor: "pointer", flex: 1,
                }}>
                Back
              </button>
              <button onClick={handleSubmitRequest}
                style={{
                  padding: "12px 24px", borderRadius: "10px", flex: 2,
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  border: "none", color: "white", fontSize: "14px", fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                }}>
                Submit Request
              </button>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              border: "3px solid rgba(99,102,241,0.2)",
              borderTopColor: "#6366f1",
              animation: "lr-spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }} />
            <p style={{ margin: 0, fontSize: "15px", color: "rgba(255,255,255,0.8)", fontWeight: "500" }}>
              Submitting request...
            </p>
          </div>
        )}

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
              Your reactivation request has been received.
            </p>
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
              Reference: <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'SF Mono', monospace", fontWeight: 600 }}>{requestId}</span>
            </p>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
              {emailSent
                ? "You will receive an email once an admin reviews your request."
                : "An admin will review your request shortly."}
            </p>
            <button onClick={() => { setStep("welcome"); setLicenseKey(""); setLicenseData(null); setError(""); setKeyError(""); setReason(""); setChangedFields([]); }}
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

        {step === "success" && (
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
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
              License Activated
            </h2>
            <p style={{ margin: "0 0 6px", fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: "1.6" }}>
              Your license has been activated successfully.
            </p>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: "1.6" }}>
              The application must restart to apply the new license.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => window.close()}
                style={{
                  padding: "12px 28px", borderRadius: "10px",
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  border: "none", color: "white", fontSize: "14px", fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                }}>
                Restart Now
              </button>
              <button
                style={{
                  padding: "12px 28px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: "500",
                  cursor: "pointer",
                }}>
                Restart Later
              </button>
            </div>
          </div>
        )}

        <div style={{
          padding: "14px 32px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.5px" }}>
            Protected by WebSmith License Management
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  icon, label, value, originalValue, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  originalValue: string;
  onChange: (v: string) => void;
}) {
  const isChanged = value !== originalValue;
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
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", padding: "0", fontSize: "14px", fontWeight: "500",
            background: "transparent", border: "none", color: "white", outline: "none",
            fontFamily: "inherit",
          }}
          placeholder={label}
        />
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
