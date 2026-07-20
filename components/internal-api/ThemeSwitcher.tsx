// FILE: components/internal-api/ThemeSwitcher.tsx
// PURPOSE: Theme switcher component for API Center
// FEATURES: Dark (Blue), Light (Amber/Golden), System (Windows 11 Glass - both themes)

"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/app/internal/api/auth/hooks/useTheme";

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, isDark } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render during SSR/static generation
  if (!mounted) {
    return (
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)]">
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-tertiary)]/30 animate-pulse" />
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-tertiary)]/30 animate-pulse" />
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-tertiary)]/30 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-tertiary)]/15 border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all duration-300">
      
      {/* ===== DARK BUTTON ===== */}
      <button
        onClick={() => setTheme("dark")}
        className={`
          group relative flex items-center gap-2.5 px-4 py-2 rounded-lg
          transition-all duration-300 ease-out
          ${theme === "dark"
            ? "bg-blue-500/20 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/40 scale-105"
            : "text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 hover:scale-105"
          }
        `}
        title="Dark Mode"
      >
        {theme === "dark" && (
          <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent" />
        )}
        <Moon className={`w-4 h-4 transition-all duration-300 ${
          theme === "dark" ? "text-blue-400" : "text-[var(--text-primary)] group-hover:text-[var(--text-primary)]"
        }`} />
        <span className={`text-xs font-medium transition-all duration-300 ${
          theme === "dark" ? "text-blue-400" : "text-[var(--text-primary)] group-hover:text-[var(--text-primary)]"
        }`}>
          Dark
        </span>
        {theme === "dark" && (
          <>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-400/60 shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
          </>
        )}
      </button>

      {/* ===== LIGHT BUTTON ===== */}
      <button
        onClick={() => setTheme("light")}
        className={`
          group relative flex items-center gap-2.5 px-4 py-2 rounded-lg
          transition-all duration-300 ease-out
          ${theme === "light"
            ? "bg-amber-500/20 text-amber-600 shadow-[0_0_35px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/40 scale-105"
            : "text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 hover:scale-105"
          }
        `}
        title="Light Mode"
      >
        {theme === "light" && (
          <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent" />
        )}
        <Sun className={`w-4 h-4 transition-all duration-300 ${
          theme === "light" ? "text-amber-600" : "text-[var(--text-primary)] group-hover:text-[var(--text-primary)]"
        }`} />
        <span className={`text-xs font-medium transition-all duration-300 ${
          theme === "light" ? "text-amber-600" : "text-[var(--text-primary)] group-hover:text-[var(--text-primary)]"
        }`}>
          Light
        </span>
        {theme === "light" && (
          <>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-pulse" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
          </>
        )}
      </button>

      {/* ===== SYSTEM BUTTON - Windows 11 Style (adapts to theme) ===== */}
      <button
        onClick={() => setTheme("system")}
        className={`
          group relative flex items-center gap-2.5 px-4 py-2 rounded-lg
          transition-all duration-300 ease-out
          ${
            theme === "system"
              ? isDark
                ? "bg-blue-900/30 text-blue-200 shadow-[0_0_40px_rgba(59,130,246,0.1)] ring-1 ring-blue-400/30 backdrop-blur-xl scale-105"
                : "bg-blue-50/40 text-blue-700 shadow-[0_0_40px_rgba(59,130,246,0.15)] ring-1 ring-blue-200/50 backdrop-blur-xl scale-105"
              : "text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 hover:scale-105"
          }
        `}
        title="System Default (Follows OS)"
      >
        {/* Windows 11 Glass Effect - adapts to theme */}
        {theme === "system" && (
          <>
            {isDark ? (
              // Dark mode glass overlay
              <>
                <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-blue-500/10" />
                <span className="absolute inset-0 rounded-lg backdrop-blur-[3px]" />
                <span className="absolute inset-0 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
              </>
            ) : (
              // Light mode glass overlay
              <>
                <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-100/30 via-blue-50/20 to-blue-100/30" />
                <span className="absolute inset-0 rounded-lg backdrop-blur-[3px]" />
                <span className="absolute inset-0 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
              </>
            )}
          </>
        )}
        
        <Monitor className={`w-4 h-4 transition-all duration-300 ${
          theme === "system"
            ? isDark
              ? "text-blue-200"
              : "text-blue-700"
            : "text-[var(--text-primary)] group-hover:text-[var(--text-primary)]"
        }`} />
        
        <span className={`text-xs font-medium transition-all duration-300 ${
          theme === "system"
            ? isDark
              ? "text-blue-200"
              : "text-blue-700"
            : "text-[var(--text-primary)] group-hover:text-[var(--text-primary)]"
        }`}>
          System
        </span>
        
        {theme === "system" && (
          <>
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
              isDark ? "bg-blue-300" : "bg-blue-400"
            } shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse`} />
            <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full ${
              isDark ? "bg-blue-300/40" : "bg-blue-400/60"
            } shadow-[0_0_10px_rgba(59,130,246,0.4)]`} />
          </>
        )}
      </button>
    </div>
  );
}