"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { PublicPage } from "../(public)/_components/PublicPage";
import { SimplePublicBody } from "../(public)/_components/SimplePublicContent";
import { COMPANY_NAME } from "@/lib/email/branding";

export const dynamic = "force-dynamic";

const PRIMARY = "#007AFF";
const SUCCESS = "#2ecc71";
const ERROR = "#e12d39";

export default function UnsubscribePage() {
  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<"confirm" | "processing" | "success" | "error">("confirm");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t && t.length >= 32) {
      setToken(t);
    } else {
      setStep("error");
      setErrorMessage("Invalid or missing unsubscribe token. Please use the link from your email.");
    }
  }, []);

  const handleUnsubscribe = async () => {
    if (!token) return;

    setStep("processing");
    setErrorMessage("");

    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (data.success) {
        setEmail(data.email || null);
        setStep("success");
      } else {
        setErrorMessage(data.error || "An unexpected error occurred.");
        setStep("error");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to process unsubscribe request.");
      setStep("error");
    }
  };

  const handleCancel = () => {
    window.location.href = "/";
  };

  return (
    <PublicPage
      eyebrow="Email Preferences"
      title="Unsubscribe"
      description="Manage your email subscriptions with Websmith Digital."
    >
      <SimplePublicBody>
        {step === "confirm" && token && (
          <>
            <div style={styles.card}>
              <p style={styles.description}>
                You are about to unsubscribe from non-essential emails from {COMPANY_NAME}. This will stop support replies and sales correspondence, but you will continue to receive transactional notifications (OTP codes, license activations, payment receipts, etc.).
              </p>

              <div style={styles.buttonRow}>
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  style={{ ...styles.primaryButton, backgroundColor: ERROR, color: "#fff" }}
                >
                  Unsubscribe me
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={styles.secondaryButton}
                >
                  Cancel — keep my emails
                </button>
              </div>
            </div>
          </>
        )}

        {step === "processing" && (
          <div style={styles.card}>
            <p style={styles.description}>Processing your unsubscribe request…</p>
            <div style={styles.loadingBar} />
          </div>
        )}

        {step === "success" && (
          <div style={styles.card}>
            <div style={styles.successIcon}>✓</div>
            <h3 style={styles.successTitle}>Unsubscribed successfully</h3>
            <p style={styles.description}>
              You will no longer receive non-essential emails from {COMPANY_NAME}. Transactional notifications (OTP codes, license activations, payment receipts, etc.) will still be delivered as needed.
            </p>
            <button
              type="button"
              onClick={handleCancel}
              style={{ ...styles.primaryButton, backgroundColor: PRIMARY, color: "#fff" }}
            >
              Back to website
            </button>
          </div>
        )}

        {step === "error" && (
          <div style={styles.card}>
            <div style={styles.errorIcon}>!</div>
            <h3 style={styles.errorTitle}>Unable to process request</h3>
            <p style={styles.description}>
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={handleCancel}
              style={styles.secondaryButton}
            >
              Back to website
            </button>
          </div>
        )}
      </SimplePublicBody>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: "grid",
    gap: "16px",
    maxWidth: "560px",
    margin: "0 auto",
    padding: "clamp(24px, 4vw, 32px)",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
  },
  description: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.7,
    color: "var(--text-secondary)",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    marginTop: "8px",
  },
  primaryButton: {
    flex: 1,
    padding: "12px 20px",
    borderRadius: "10px",
    border: "none",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.18s ease",
  },
  secondaryButton: {
    flex: 1,
    padding: "12px 20px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    fontSize: "14px",
    fontWeight: 700,
    backgroundColor: "transparent",
    color: "var(--text-primary)",
    cursor: "pointer",
    transition: "all 0.18s ease",
  },
  successIcon: {
    width: "48px",
    height: "48px",
    margin: "0 auto",
    borderRadius: "999px",
    backgroundColor: "rgba(46, 204, 113, 0.15)",
    color: SUCCESS,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: 700,
  },
  successTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    color: SUCCESS,
    textAlign: "center",
  },
  errorIcon: {
    width: "48px",
    height: "48px",
    margin: "0 auto",
    borderRadius: "999px",
    backgroundColor: "rgba(225, 45, 57, 0.15)",
    color: ERROR,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: 700,
  },
  errorTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    color: ERROR,
    textAlign: "center",
  },
  loadingBar: {
    width: "100%",
    height: "4px",
    backgroundColor: "var(--border-color)",
    borderRadius: "2px",
    overflow: "hidden",
    position: "relative",
  },
};
