"use client";

// FILE: app/internal/api/portal/_ui.tsx
// PURPOSE: Shared presentational building blocks for the Universal Buy & Renew
//          Portal (/internal/api/buy and /internal/api/renew). These pages
//          visually match the Software Store checkout (premium dark theme,
//          indigo→violet gradients, cards) but are fully standalone in the
//          Internal API — no admin sidebar, no admin navigation, no admin auth.
//          This module must NEVER import anything from the admin/dashboard app.

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertCircle, ShieldCheck, Lock } from "lucide-react";

export const PORTAL_DARK_STYLE = {
  "--bg-primary": "#070B14",
  "--bg-secondary": "#0B1220",
  "--bg-tertiary": "#111827",
  "--text-primary": "#F1F5F9",
  "--text-secondary": "#94A3B8",
  "--text-muted": "#64748B",
  "--border-color": "rgba(148, 163, 184, 0.16)",
  "--card-shadow": "0 20px 60px -15px rgba(0, 0, 0, 0.6)",
  colorScheme: "dark",
} as React.CSSProperties;

export function toMoney(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function portalPrice(value: unknown, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(toMoney(value));
  } catch {
    return `$${toMoney(value).toFixed(2)}`;
  }
}

export function portalDate(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).split("T")[0] || "—";
    return d.toISOString().split("T")[0];
  } catch {
    return "—";
  }
}

export const inputClass =
  "w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all";
export const inputErrorClass =
  "border-red-500/60 focus:ring-red-500/20 focus:border-red-500/60";
export const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5";
export const requiredMark = <span className="text-red-400">*</span>;

export function Field({
  label,
  required,
  error,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required ? requiredMark : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-400 mt-1.5">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm ${
        type === "success" ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
      }`}
    >
      {type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export interface StepDef {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function PortalStepper({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <div key={s.label} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center shrink-0">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                i <= current
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent text-white shadow-lg shadow-indigo-600/25"
                  : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
              }`}
            >
              {i < current ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
            </div>
            <span
              className={`mt-2 text-[11px] font-semibold ${
                i <= current ? "text-indigo-400" : "text-[var(--text-secondary)]"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-3 rounded-full mb-5 transition-all ${
                i < current
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500"
                  : "bg-[var(--border-color)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function PortalShell({
  eyebrow,
  title,
  subtitle,
  children,
  headerAction,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)]" style={PORTAL_DARK_STYLE}>
      <header className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-600/25">
              W
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Websmith</p>
              <p className="text-[11px] text-[var(--text-secondary)]">{eyebrow}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
              <Lock className="w-3.5 h-3.5" /> Secure Portal
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2">{title}</h1>
          {subtitle ? <p className="text-[var(--text-secondary)] max-w-2xl">{subtitle}</p> : null}
        </div>
        <AnimatePresence>{children}</AnimatePresence>
      </main>

      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6">
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Secure checkout — your payment information is encrypted.
          </p>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Lock className="h-3 w-3" /> Powered by Websmith
          </span>
        </div>
      </footer>
    </div>
  );
}