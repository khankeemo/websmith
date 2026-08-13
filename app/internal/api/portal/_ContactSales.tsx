"use client";

// FILE: app/internal/api/portal/_ContactSales.tsx
// PURPOSE: Contact Sales entry for the Universal Buy & Renew Portal. Renders a
//          header button that opens the shared UniversalEmailDialog in customer
//          mode. Customer mode posts to the PUBLIC /api/portal/support-message
//          route (no admin session required) and the recipient is resolved
//          SERVER-SIDE (Buy / Renew → sales@websmithdigital.com) — the browser
//          never supplies an address. The dialog is the ONLY email UI here: no
//          duplicated email form / send logic.

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import UniversalEmailDialog from "@/components/internal-api/UniversalEmailDialog";

export default function ContactSales({
  action,
  defaultEmail,
  defaultCustomerName,
  defaultCustomerMobile,
  defaultLicenseKey,
  defaultProductName,
}: {
  action: "buy-license" | "renew";
  defaultEmail?: string;
  defaultCustomerName?: string;
  defaultCustomerMobile?: string;
  defaultLicenseKey?: string;
  defaultProductName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all"
      >
        <MessageSquare className="w-3.5 h-3.5" /> Contact Sales
      </button>

      <UniversalEmailDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        customerMode
        defaultAction={action}
        allowedActions={[action]}
        defaultEmail={defaultEmail}
        defaultCustomerName={defaultCustomerName}
        defaultCustomerMobile={defaultCustomerMobile}
        defaultLicenseKey={defaultLicenseKey}
        defaultProductName={defaultProductName}
      />
    </>
  );
}