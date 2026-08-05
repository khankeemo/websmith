// FILE: app/software-store/checkout/layout.tsx
// PURPOSE: Dedicated standalone checkout layout.
// SECURITY: This layout is the ONLY chrome around the checkout page — no
//           sidebar, no dashboard header, no admin navigation, no public
//           marketing nav, no theme toggle, no chat widget. The root
//           ClientLayout suppresses its own shell for /software-store/checkout.
//           Everything here is deliberately minimal, like Stripe/Shopify/Paddle.

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Secure Checkout | Websmith Software Store",
  description: "Secure checkout for Websmith software products. Fast, minimal and distraction-free.",
  robots: { index: false, follow: false },
};

// Matches the Software Store's premium dark theme so the checkout flow feels
// continuous with the storefront (presentation only — no layout changes).
const CHECKOUT_DARK_STYLE = {
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

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)]" style={CHECKOUT_DARK_STYLE}>
      {/* Checkout header — logo + back to store only */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/software-store"
            aria-label="Websmith Software Store"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-sm">
              <Image
                src="/images/websmith_1x1.jpg"
                alt="Websmith logo"
                width={36}
                height={36}
                className="h-full w-full object-cover"
                priority
              />
            </span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">Websmith</span>
          </Link>

          <Link
            href="/software-store"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Store
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Checkout footer — legal + support links only */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6">
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Secure checkout — your payment information is encrypted.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/privacy"
              className="text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Terms
            </Link>
            <Link
              href="/support"
              className="text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Support
            </Link>
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Lock className="h-3 w-3" />
              Powered by Websmith
            </span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
