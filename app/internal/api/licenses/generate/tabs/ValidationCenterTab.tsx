// FILE: app/internal/api/licenses/generate/tabs/ValidationCenterTab.tsx
// PURPOSE: Tab 3 - Validation Center
// SCOPE: Validate license keys by checking against database
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState } from "react";
import {
  KeyRound,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";

// ============================================================
// VALIDATION CENTER TAB
// ============================================================

export function ValidationCenterTab() {
  const [licenseKey, setLicenseKey] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; message: string } | null>(null);

  const API_BASE = "/internal/backend";

  // ============================================================
  // HANDLE VALIDATE
  // ============================================================
  const handleValidate = async () => {
    if (!licenseKey.trim()) return;

    setValidating(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/licenses/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: licenseKey }),
      });

      const data = await response.json();
      setResult({
        valid: data.valid || false,
        message: data.message || (data.valid ? "License is valid" : "License is invalid"),
      });
    } catch (err) {
      setResult({
        valid: false,
        message: "Failed to validate license. Please try again.",
      });
    } finally {
      setValidating(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Enter license key to validate..."
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleValidate()}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all font-mono"
          />
        </div>
        <button
          onClick={handleValidate}
          disabled={validating || !licenseKey.trim()}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {validating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Validating...
            </>
          ) : (
            "Validate"
          )}
        </button>
      </div>

      {/* Result Section */}
      {result && (
        <div
          className={`rounded-2xl border p-6 animate-in fade-in slide-in-from-top-2 ${
            result.valid
              ? "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]"
              : "border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)]"
          }`}
        >
          <div className="flex items-center gap-3">
            {result.valid ? (
              <CheckCircle className="h-6 w-6 text-[var(--api-green-400)]" />
            ) : (
              <XCircle className="h-6 w-6 text-[var(--api-red-400)]" />
            )}
            <div>
              <h3
                className={`font-semibold ${
                  result.valid ? "text-[var(--api-green-400)]" : "text-[var(--api-red-400)]"
                }`}
              >
                {result.valid ? "Valid License" : "Invalid License"}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">{result.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-center text-sm text-[var(--text-muted)] mt-4">
        <p>Enter a license key to check its validity status.</p>
        <p className="text-xs mt-1">
          Press Enter or click the Validate button to check.
        </p>
      </div>
    </div>
  );
}