"use client";

import { useEffect, useState } from "react";
import { Cookie, Shield, Check, X } from "lucide-react";

const COOKIE_CONSENT_KEY = "websmith_cookie_consent_choice";

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ choice: "all", date: new Date().toISOString() }));
    setShowBanner(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ choice: "essential", date: new Date().toISOString() }));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-label="Cookie preferences consent banner"
      style={{
        position: "fixed",
        bottom: "20px",
        left: "20px",
        right: "20px",
        maxWidth: "520px",
        zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "20px",
        padding: "20px 24px",
        boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.5)",
        color: "#ffffff",
        animation: "slideUp 0.4s ease-out forwards",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "12px",
            backgroundColor: "rgba(99, 102, 241, 0.2)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#818cf8",
            flexShrink: 0,
          }}
        >
          <Cookie size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
            We Value Your Privacy
          </h4>
          <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8", lineHeight: 1.5 }}>
            We use essential cookies to keep our platform secure and functional. With your permission, we also use optional cookies to improve performance and analytics.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={handleEssentialOnly}
          style={{
            padding: "8px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 500,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            color: "#cbd5e1",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          Essential Only
        </button>
        <button
          onClick={handleAcceptAll}
          style={{
            padding: "8px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
            transition: "all 0.2s ease",
          }}
        >
          Accept All
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
