"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from "@/core/services/authService";
import {
  getPasswordChecklistItems,
  getPasswordValidationMessage,
  validateEmail,
  validateStrongPassword,
} from "@/core/utils/validation";

type ResetStep = "request" | "verify" | "reset" | "done";
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const checklistItems = useMemo(() => getPasswordChecklistItems(newPassword), [newPassword]);

  const handleRequestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await requestPasswordResetOtp(email);
      setMessage(response.message || "OTP has been sent to your registered email.");
      setStep("verify");
    } catch (err: any) {
      setError(err.response?.data?.message || "Email not found. Please register first.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Enter the 6-digit OTP sent to your email.");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyPasswordResetOtp(email, otp.trim());
      setMessage(response.message || "OTP verified successfully.");
      setStep("reset");
    } catch (err: any) {
      setError(err.response?.data?.message || "OTP is incorrect or expired. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!validateStrongPassword(newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await resetPasswordWithOtp({
        email,
        newPassword,
        confirmPassword,
      });
      setMessage(response.message || "Password reset successfully.");
      setStep("done");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendSecondsLeft > 0 || loading) {
      return;
    }
    setLoading(true);
    try {
      await requestPasswordResetOtp(email);
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setMessage("A new OTP has been sent to your email.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.headerMenu}>
        <nav style={styles.nav}>
          <Link href="/" style={styles.logoArea}>
            <div style={styles.logoCircle}>
              <Image src="/images/websmith.png" alt="Websmith logo" width={34} height={34} style={styles.logoImage} priority />
            </div>
            <span style={styles.logoText}>Websmith</span>
          </Link>
          <div style={styles.navActions}>
            <Link href="/login" style={styles.navButton}>
              Back to login
            </Link>
          </div>
        </nav>
      </header>

      <div style={styles.dialogArea}>
        <div style={styles.card}>
          <Link href="/login" style={styles.backLink}>
            <ArrowLeft size={16} />
            Back to login
          </Link>

          <div style={styles.hero}>
            <div style={styles.iconWrap}>
              {step === "done" ? <CheckCircle2 size={28} color="#10B981" /> : <ShieldCheck size={28} color="#007AFF" />}
            </div>
            <h1 style={styles.title}>Reset your password</h1>
            <p style={styles.subtitle}>
              {step === "request" && "Enter your registered organization email address."}
              {step === "verify" && "Enter the OTP sent to your email."}
              {step === "reset" && "Create your new password to complete reset."}
              {step === "done" && "Your password has been changed successfully."}
            </p>
          </div>

          {message ? <div style={styles.successBox}>{message}</div> : null}
          {error ? <div style={styles.errorBox}>{error}</div> : null}

          {step === "request" && (
            <form onSubmit={handleRequestOtp} style={styles.form}>
              <label style={styles.label}>Registered email address</label>
              <div style={styles.inputWrap}>
                <Mail size={18} style={styles.inputIcon} />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={styles.input} placeholder="name@example.com" />
              </div>
              <button type="submit" style={styles.primaryButton} disabled={loading}>
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerifyOtp} style={styles.form}>
              <label style={styles.label}>Registered email address</label>
              <div style={styles.inputWrap}>
                <Mail size={18} style={styles.inputIcon} />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={styles.input} />
              </div>
              <label style={styles.label}>OTP</label>
              <div style={styles.inputWrap}>
                <KeyRound size={18} style={styles.inputIcon} />
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} type="text" style={styles.input} placeholder="123456" />
              </div>
              <button type="submit" style={styles.primaryButton} disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
              <button type="button" onClick={handleResendOtp} style={styles.secondaryButton} disabled={loading || resendSecondsLeft > 0} title={resendSecondsLeft > 0 ? `Please wait ${resendSecondsLeft}s` : ""}>
                {resendSecondsLeft > 0 ? `Resend OTP in ${resendSecondsLeft}s` : "Resend OTP"}
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleResetPassword} style={styles.form}>
              <label style={styles.label}>New password</label>
              <div style={styles.inputWrap}>
                <KeyRound size={18} style={styles.inputIcon} />
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type={showNewPassword ? "text" : "password"}
                  style={styles.input}
                  placeholder="Enter a strong password"
                />
                <button type="button" onClick={() => setShowNewPassword((value) => !value)} style={styles.eyeButton}>
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <label style={styles.label}>Confirm password</label>
              <div style={styles.inputWrap}>
                <KeyRound size={18} style={styles.inputIcon} />
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  style={styles.input}
                  placeholder="Re-enter your password"
                />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} style={styles.eyeButton}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div style={styles.checklist}>
                {checklistItems.map((item) => (
                  <div key={item.key} style={styles.checklistItem}>
                    <span style={{ ...styles.checkDot, backgroundColor: item.met ? "#10B981" : "#D1D5DB" }} />
                    <span style={{ color: item.met ? "#111827" : "#6B7280" }}>{item.label}</span>
                  </div>
                ))}
              </div>

              <button type="submit" style={styles.primaryButton} disabled={loading}>
                {loading ? "Updating password..." : "Reset password"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div style={styles.doneState}>
              <Link href="/login" style={styles.primaryLinkButton}>
                Go to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  headerMenu: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderBottom: "1px solid #E5E7EB",
    backdropFilter: "blur(10px)",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
  },
  logoArea: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
  },
  logoCircle: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  logoText: {
    color: "#111827",
    fontSize: "18px",
    fontWeight: 700,
  },
  navActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  navButton: {
    textDecoration: "none",
    border: "1px solid #D1D5DB",
    color: "#111827",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: 600,
  },
  dialogArea: {
    minHeight: "100vh",
    paddingTop: "80px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    backgroundColor: "rgba(17, 24, 39, 0.2)",
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    marginTop: "34px",
    borderRadius: "20px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
    boxShadow: "0 24px 50px rgba(15, 23, 42, 0.2)",
    padding: "32px",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    color: "#4B5563",
    textDecoration: "none",
    fontSize: "14px",
    marginBottom: "24px",
  },
  hero: { marginBottom: "20px" },
  iconWrap: {
    width: "58px",
    height: "58px",
    borderRadius: "18px",
    backgroundColor: "#EFF6FF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "18px",
  },
  title: { margin: 0, fontSize: "30px", fontWeight: 700, color: "#111827" },
  subtitle: { margin: "10px 0 0 0", color: "#6B7280", lineHeight: 1.6, fontSize: "15px" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#111827" },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: "14px", color: "#6B7280" },
  input: {
    width: "100%",
    borderRadius: "16px",
    border: "1px solid #D1D5DB",
    padding: "14px 16px 14px 44px",
    fontSize: "15px",
    outline: "none",
    backgroundColor: "#F9FAFB",
  },
  eyeButton: {
    position: "absolute",
    right: "14px",
    border: "none",
    background: "transparent",
    color: "#6B7280",
    cursor: "pointer",
    display: "flex",
  },
  primaryButton: {
    marginTop: "6px",
    border: "none",
    borderRadius: "16px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  successBox: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    color: "#047857",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    borderRadius: "14px",
    padding: "12px 14px",
    marginBottom: "18px",
    fontSize: "14px",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#B91C1C",
    border: "1px solid rgba(239, 68, 68, 0.18)",
    borderRadius: "14px",
    padding: "12px 14px",
    marginBottom: "18px",
    fontSize: "14px",
  },
  checklist: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
    backgroundColor: "#F9FAFB",
    border: "1px solid #E5E7EB",
    borderRadius: "16px",
    padding: "14px",
  },
  checklistItem: { display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" },
  checkDot: { width: "10px", height: "10px", borderRadius: "999px", flexShrink: 0 },
  doneState: { display: "flex", justifyContent: "flex-start" },
  primaryLinkButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 18px",
    borderRadius: "16px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    textDecoration: "none",
    fontWeight: 700,
  },
};
