"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { XCircle, RefreshCw, HeadphonesIcon, ShoppingBag, ArrowLeft } from "lucide-react";

function XMarkAnimation() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      className="relative"
    >
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-2xl shadow-red-500/30">
        <motion.div
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <XCircle className="w-14 h-14 text-white" strokeWidth={2.5} />
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-lg w-full mx-4 text-center"
      >
        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 backdrop-blur-xl p-10 shadow-2xl">
          <div className="flex justify-center mb-6">
            <XMarkAnimation />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-extrabold text-[var(--text-primary)] mb-3"
          >
            Payment Failed
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-[var(--text-secondary)] mb-2"
          >
            Something went wrong with your payment.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-[var(--text-secondary)] mb-8"
          >
            Please try again or contact support.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col gap-3"
          >
            <Link
              href="/software-store/checkout"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/25"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Payment
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-all"
            >
              <HeadphonesIcon className="w-4 h-4" />
              Contact Support
            </Link>

            <Link
              href="/software-store"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              Continue Shopping
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6"
        >
          <Link
            href="/software-store/checkout"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Checkout
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
