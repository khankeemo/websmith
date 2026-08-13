"use client";

// FILE: app/software-store/components/store-email-center.tsx
// PURPOSE: Approved Software Store Email Center header entry. Renders an
//          Email / Support icon beside the existing Wishlist and Cart controls
//          in the /software-store header. Clicking opens the SHARED
//          UniversalEmailDialog in customer mode — no mailto, no /contact
//          redirect, no duplicate form, no admin endpoint. Customer-mode Send
//          posts to the PUBLIC /api/portal/support-message route (no admin
//          session); the recipient is resolved SERVER-SIDE (software-store →
//          sales@websmithdigital.com). Known customer identity (saved history
//          email / last order email + name) is prefilled where available.
// SCOPE: UI-only; cart/wishlist/product cards/search/checkout/payment and all
//        /api/v1/store/* + /api/v1/checkout/* logic are untouched.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import UniversalEmailDialog from "@/components/internal-api/UniversalEmailDialog";
import { STORAGE_HISTORY_EMAIL_KEY } from "../store-state";

export default function StoreEmailCenter() {
  const [open, setOpen] = useState(false);
  const [knownEmail, setKnownEmail] = useState("");
  const [knownName, setKnownName] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY_EMAIL_KEY);
      if (saved) setKnownEmail(saved);
      try {
        const lastOrder = sessionStorage.getItem("software_store_order");
        if (lastOrder) {
          const parsed = JSON.parse(lastOrder);
          if (parsed?.customer_email && !saved) setKnownEmail(parsed.customer_email);
          if (parsed?.customer_name) setKnownName(parsed.customer_name);
        }
      } catch {}
    } catch {}
  }, []);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-sky-300 hover:bg-white/[0.07] hover:border-sky-400/40 transition-all"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Email / Support"
        title="Email / Support"
      >
        <Mail className="w-4 h-4" />
      </motion.button>

      <UniversalEmailDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        customerMode
        defaultAction="software-store"
        allowedActions={["software-store"]}
        defaultEmail={knownEmail}
        defaultCustomerName={knownName}
      />
    </>
  );
}
