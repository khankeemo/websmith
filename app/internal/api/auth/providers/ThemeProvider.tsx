// FILE: app/internal/api/auth/providers/ThemeProvider.tsx
// PURPOSE: Theme Provider for API Center
// FIX: Ensures theme is applied on every mount/navigation

"use client";

import { createContext, useEffect, useState, useCallback, useRef } from "react";
import { ThemeMode, ThemeContextType, ThemeProviderProps } from "../types/theme";
import { ThemeContext } from "../hooks/useTheme";

export function ThemeProvider({ children, defaultTheme = "dark" }: ThemeProviderProps) {
  // Lazy initialization
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("api_center_theme") as ThemeMode;
      if (stored && ["dark", "light", "system"].includes(stored)) {
        return stored;
      }
    }
    return defaultTheme;
  });

  const [mounted, setMounted] = useState(false);
  const isInitialized = useRef(false);
  const themeRef = useRef(theme);

  // Keep ref in sync
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const applyTheme = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    let effectiveTheme = mode;

    if (mode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      effectiveTheme = prefersDark ? "dark" : "light";
    }

    root.classList.remove("dark-theme", "light-theme");
    
    if (effectiveTheme === "dark") {
      root.classList.add("dark-theme");
      root.style.colorScheme = "dark";
    } else {
      root.classList.add("light-theme");
      root.style.colorScheme = "light";
    }
  }, []);

  // ✅ CRITICAL FIX: Re-apply theme on every mount/navigation
  useEffect(() => {
    const stored = localStorage.getItem("api_center_theme") as ThemeMode;
    if (stored && ["dark", "light", "system"].includes(stored)) {
      setTheme(stored);
      applyTheme(stored);
    } else {
      // If no stored theme, use default
      const initialTheme = defaultTheme === "system" 
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : defaultTheme;
      setTheme(initialTheme);
      applyTheme(initialTheme);
    }
  }, []); // ✅ Runs on EVERY mount (including navigation)

  // Mark as mounted and apply initial theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Save to localStorage and apply whenever theme changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("api_center_theme", theme);
      applyTheme(theme);
    }
  }, [theme, mounted, applyTheme]);

  // System preference listener
  useEffect(() => {
    if (!mounted) return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (themeRef.current === "system") {
        applyTheme("system");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted, applyTheme]);

  const updateTheme = useCallback((nextTheme: ThemeMode) => {
    localStorage.setItem("api_center_theme", nextTheme);
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }, [applyTheme]);

  // Toggle with immediate apply
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : prev === "light" ? "system" : "dark";
      localStorage.setItem("api_center_theme", next);
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const value: ThemeContextType = {
    theme,
    setTheme: updateTheme,
    toggleTheme,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
