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

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      {/* Checkout header — logo + back to store only */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/software-store"
            aria-label="Websmith Software Store"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#0f172a]/80 shadow-sm p-0.5">
              <Image
                src="/images/icon.png"
                alt="Websmith logo"
                width={40}
                height={40}
                className="h-full w-full object-contain scale-110"
                priority
              />
            </span>
            <Image
              src="/images/wordmark1.png"
              alt="Websmith Digital"
              width={190}
              height={42}
              style={{ height: "42px", width: "auto", objectFit: "contain" }}
              priority
            />
          </Link>

          <Link
            href="/software-store"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Store
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Checkout footer — legal + support links only */}
      <footer className="border-t border-slate-200/80 dark:border-white/10 bg-white/40 dark:bg-[#0f172a]/40 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6">
          <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
            Secure checkout — your payment information is encrypted.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/privacy"
              className="text-xs text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              Terms
            </Link>
            <Link
              href="/support"
              className="text-xs text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              Support
            </Link>
            <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
              <Lock className="h-3 w-3" />
              Powered by Websmith
            </span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
