"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const COOKIE_CONSENT_KEY = "cookie_consent_accepted";

declare global {
  interface Window {
    analytics?: {
      track: (event: string, data?: Record<string, any>) => void;
    };
  }
}

export function useAnalytics() {
  const [isConsentGiven, setIsConsentGiven] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== "undefined") {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      setIsConsentGiven(consent === "true");
    }
  }, []);

  const track = useCallback(
    (event: string, data?: Record<string, any>) => {
      if (!hasMounted || !isConsentGiven) return;
      if (typeof window !== "undefined" && window.analytics) {
        window.analytics.track(event, data);
      }
    },
    [hasMounted, isConsentGiven]
  );

  useEffect(() => {
    if (!hasMounted || !isConsentGiven || !pathname) return;
    track("page_view", {
      path: pathname,
      timestamp: new Date().toISOString(),
    });
  }, [hasMounted, isConsentGiven, pathname, track]);

  return { isConsentGiven, track };
}