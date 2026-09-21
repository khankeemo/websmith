"use client";

// FILE: app/software-store/components/store-email-center.tsx
// PURPOSE: Approved Software Store Email Center header entry. Renders an
//          Email / Support icon beside the existing Wishlist and Cart controls
//          in the /software-store header. Clicking opens the SHARED
//          UniversalEmailDialog in customer mode — the FULL existing customer
//          Email Center (all actionConfig actions except the admin-only Email
//          History): Send Email, Buy License, Renew License, Activate,
//          Reactivation, Device Replacement, Support, General, Software Store
//          Enquiry. No mailto, no /contact redirect, no duplicate form, no
//          admin endpoint, no /internal/api redirect. Customer-mode Send posts
//          to the PUBLIC /api/portal/support-message route (no admin session);
//          the recipient is resolved SERVER-SIDE per action (buy-license /
//          renew / software-store → sales@; support/activation/general →
//          support@). Known customer identity (saved history email / last
//          order email + name) is prefilled where available.
// SCOPE: UI-only; cart/wishlist/product cards/search/checkout/payment and all
//        /api/v1/store/* + /api/v1/checkout/* logic are untouched.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import UniversalEmailDialog from "@/components/internal-api/UniversalEmailDialog";
import { STORAGE_HISTORY_EMAIL_KEY, STORE_DARK_STYLE } from "../store-state";

type StoreEmailCenterProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderButton?: boolean;
};

export default function StoreEmailCenter({
  open: controlledOpen,
  onOpenChange,
  renderButton = false,
}: StoreEmailCenterProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    setInternalOpen(val);
  };
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
      {renderButton && (
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
      )}

      <UniversalEmailDialog
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        customerMode
        defaultEmail={knownEmail}
        defaultCustomerName={knownName}
        themeStyle={STORE_DARK_STYLE}
      />
    </>
  );
}
