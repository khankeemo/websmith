"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Download, ArrowLeft, ShoppingBag, ArrowRight } from "lucide-react";

function ConfettiBackground() {
  const [particles, setParticles] = useState<{ id: number; x: number; delay: number; size: number; color: string }[]>([]);

  useEffect(() => {
    const colors = ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#06b6d4", "#10b981"];
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 3,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(items);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: -10,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          animate={{
            y: [0, window.innerHeight + 20],
            rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
            opacity: [1, 0.8, 0],
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

function CheckmarkAnimation() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      className="relative"
    >
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
        <motion.div
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          <Check className="w-14 h-14 text-white" strokeWidth={3} />
        </motion.div>
      </div>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [1, 1.5, 0] }}
        transition={{ duration: 1, delay: 0.3, repeat: Infinity, repeatDelay: 2 }}
        className="absolute inset-0 rounded-full bg-emerald-500/20"
      />
    </motion.div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center relative overflow-hidden">
      <ConfettiBackground />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 max-w-lg w-full mx-4 text-center"
      >
        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 backdrop-blur-xl p-10 shadow-2xl">
          <div className="flex justify-center mb-6">
            <CheckmarkAnimation />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-extrabold text-[var(--text-primary)] mb-3"
          >
            Order Complete!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-lg text-[var(--text-secondary)] mb-2"
          >
            Your license is being prepared.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-sm text-[var(--text-secondary)] mb-8"
          >
            You will receive an email confirmation shortly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col gap-3"
          >
            <Link
              href="/software-store"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/25"
            >
              <Download className="w-4 h-4" />
              Download SDK
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
          transition={{ delay: 1.2 }}
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
