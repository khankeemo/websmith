"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "wsd-public-theme";

type PublicTheme = "light" | "dark";

type PublicThemeContextValue = {
  publicTheme: PublicTheme;
  setPublicTheme: (theme: PublicTheme) => void;
  togglePublicTheme: () => void;
};

const PublicThemeContext = createContext<PublicThemeContextValue | undefined>(undefined);

function readStoredTheme(): PublicTheme {
  if (typeof window === "undefined") return "light";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // ignore
  }
  return "light";
}

export function PublicThemeProvider({ children }: { children: React.ReactNode }) {
  const [publicTheme, setPublicThemeState] = useState<PublicTheme>("light");

  useEffect(() => {
    setPublicThemeState(readStoredTheme());
  }, []);

  const setPublicTheme = useCallback((theme: PublicTheme) => {
    setPublicThemeState(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, []);

  const togglePublicTheme = useCallback(() => {
    setPublicThemeState((current) => {
      const next = current === "light" ? "dark" : "light";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ publicTheme, setPublicTheme, togglePublicTheme }),
    [publicTheme, setPublicTheme, togglePublicTheme]
  );

  return <PublicThemeContext.Provider value={value}>{children}</PublicThemeContext.Provider>;
}

export function usePublicTheme() {
  const ctx = useContext(PublicThemeContext);
  if (!ctx) {
    throw new Error("usePublicTheme must be used within PublicThemeProvider");
  }
  return ctx;
}
