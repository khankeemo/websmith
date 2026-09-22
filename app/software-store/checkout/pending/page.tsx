"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, RefreshCw, ArrowLeft, ShoppingBag } from "lucide-react";

function SpinnerAnimation() {
  return (
    <div className="relative">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      >
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30">
          <Clock className="w-14 h-14 text-white" strokeWidth={2} />
        </div>
      </motion.div>
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-400"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        style={{ margin: -4 }}
      />
    </div>
  );
}

export default function CheckoutPendingPage() {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleCheckStatus = useCallback(() => {
    setCountdown(30);
  }, []);

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-lg w-full mx-4 text-center"
      >
        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 wsd-unified-card backdrop-blur-xl p-10 shadow-2xl">
          <div className="flex justify-center mb-6">
            <SpinnerAnimation />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-extrabold text-[var(--text-primary)] mb-3"
          >
            Payment Pending
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-[var(--text-secondary)] mb-2"
          >
            Your payment is being processed.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-[var(--text-secondary)] mb-8"
          >
            Please wait while we confirm your payment.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col gap-3"
          >
            <div className="text-sm text-[var(--text-secondary)] mb-2">
              Auto-checking in <span className="text-amber-400 font-bold">{countdown}</span>s
            </div>

            <button
              onClick={handleCheckStatus}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-600/25"
            >
              <RefreshCw className="w-4 h-4" />
              Check Status
            </button>

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
          transition={{ delay: 0.9 }}
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
