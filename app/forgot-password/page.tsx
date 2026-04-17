"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from "@/core/services/authService";
import { validateEmail } from "@/core/utils/validation";

type ResetStep = "request" | "verify" | "reset" | "done";
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    if (resendSecondsLeft <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setResendSecondsLeft((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSecondsLeft]);

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
      setMessage(response.message || "If the account is eligible, an OTP has been sent.");
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setStep("verify");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send OTP.");
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
      setMessage(response.message || "OTP verified. Please set your new password.");
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

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
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
      setMessage(response.message || "Password updated successfully. You can now sign in.");
      setStep("done");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendSecondsLeft > 0 || loading) {
      return;
    }
    setError("");
    setMessage("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await requestPasswordResetOtp(email);
      setMessage(response.message || "If the account is eligible, an OTP has been sent.");
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
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
            {step === "request" && "Enter your email to receive a one-time password."}
            {step === "verify" && "Check your inbox and enter the 6-digit OTP."}
            {step === "reset" && "Create a new password for your account."}
            {step === "done" && "Your password has been reset successfully. Sign in with your new password."}
          </p>
        </div>

        {message ? <div style={styles.successBox}>{message}</div> : null}
        {error ? <div style={styles.errorBox}>{error}</div> : null}

        {step === "request" && (
          <form onSubmit={handleRequestOtp} style={styles.form}>
            <label style={styles.label}>Email address</label>
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
            <label style={styles.label}>Email address</label>
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
            <button type="button" onClick={handleResendOtp} style={styles.secondaryButton} disabled={loading || resendSecondsLeft > 0}>
              {resendSecondsLeft > 0 ? `Resend OTP in ${resendSecondsLeft}s` : "Resend OTP"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div style={styles.doneState}>
            <Link href="/login" style={styles.primaryLinkButton}>
              Sign in
            </Link>
          </div>
        )}

        {step === "reset" && (
          <form onSubmit={handleResetPassword} style={styles.form}>
            <label style={styles.label}>New password</label>
            <div style={styles.inputWrap}>
              <KeyRound size={18} style={styles.inputIcon} />
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                style={styles.input}
                placeholder="Enter new password"
              />
            </div>

            <label style={styles.label}>Confirm new password</label>
            <div style={styles.inputWrap}>
              <KeyRound size={18} style={styles.inputIcon} />
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                style={styles.input}
                placeholder="Re-enter new password"
              />
            </div>

            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? "Resetting password..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "linear-gradient(135deg, #eef5ff 0%, #ffffff 55%, #f7fbff 100%)",
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    borderRadius: "28px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
    boxShadow: "0 30px 80px rgba(15, 23, 42, 0.08)",
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
  secondaryButton: {
    marginTop: "6px",
    border: "1px solid #D1D5DB",
    borderRadius: "16px",
    backgroundColor: "#FFFFFF",
    color: "#1F2937",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 600,
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
