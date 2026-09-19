"use client";

import { useEffect, useState } from "react";

const COOKIE_CONSENT_KEY = "cookie_consent_accepted";

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== "undefined") {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        setShowBanner(true);
      }
    }
  }, []);

  const acceptCookies = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(COOKIE_CONSENT_KEY, "true");
      localStorage.setItem("cookie_consent_timestamp", Date.now().toString());
    }
    setShowBanner(false);
  };

  const declineCookies = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(COOKIE_CONSENT_KEY, "false");
    }
    setShowBanner(false);
  };

  if (!hasMounted || !showBanner) return null;

  return (
    <div
      className="cookie-consent-banner"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1500,
        backgroundColor: "var(--bg-secondary, #1a1a1a)",
        borderTop: "1px solid var(--border-color, #333)",
        padding: "16px 24px",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "14px", color: "var(--text-secondary, #86868b)", lineHeight: 1.5 }}>
        We use cookies to improve your experience, analyze site traffic, and personalize content.
        By continuing to browse, you accept our{" "}
        <a href="/privacy" style={{ color: "var(--primary-color, #007AFF)", textDecoration: "underline" }}>
          Privacy Policy
        </a>
        .
      </div>
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          onClick={declineCookies}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            backgroundColor: "transparent",
            color: "var(--text-secondary, #86868b)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Reject
        </button>
        <button
          onClick={acceptCookies}
          style={{
            padding: "8px 20px",
            fontSize: "13px",
            backgroundColor: "var(--primary-color, #007AFF)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
