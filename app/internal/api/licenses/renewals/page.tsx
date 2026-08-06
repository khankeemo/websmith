// FILE: app/internal/api/licenses/renewals/page.tsx
// PURPOSE: Dedicated Renewals page - mounts the UI-only RenewalsTab component
// SCOPE: View and renew licenses (active or expired)
// RULE: UI only - NO database queries, NO business logic
// NOTE: Reuses the existing RenewalsTab (same component as License Center Tab 4)
//       so no functionality is duplicated. Theme variables only.
"use client";

import { Repeat } from "lucide-react";
import { RenewalsTab } from "../generate/tabs/RenewalsTab";

export default function RenewalsPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Repeat size={18} className="text-[var(--api-blue-400)]" />
          License Renewals
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Renew active or expired licenses — select a plan and duration to extend.
        </p>
      </div>
      <RenewalsTab />
    </div>
  );
}