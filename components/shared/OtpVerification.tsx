// FILE: components/shared/OtpVerification.tsx
// PURPOSE: ONE shared OTP verification UI used by BOTH login entry points:
//          the public website login (/login) and the Internal API Center
//          login (/internal/api/auth/login). Presentational only — all
//          server calls are delegated to the parent via onVerify/onResend.
// FEATURES: 6-digit boxed input, paste support, auto-advance, resend
//           countdown, error display, loading states, "back" action.

"use client";

import { useEffect, useRef, useState } from "react";

export interface OtpCallResult {
  success: boolean;
  error?: string;
  expires_in?: number;
}

interface OtpVerificationProps {
  email: string;
  title?: string;
  subtitle?: string;
  verifyLabel?: string;
  expiresIn?: number;
  variant?: "light" | "dark";
  onVerify: (otp: string) => Promise<OtpCallResult>;
  onResend: () => Promise<OtpCallResult>;
  onBack: () => void;
}

const OTP_LENGTH = 6;

export default function OtpVerification({
  email,
  title = "Check your email",
  subtitle = "We sent a 6-digit verification code to",
  verifyLabel = "Verify & Sign In",
  expiresIn = 300,
  variant = "light",
  onVerify,
  onResend,
  onBack,
}: OtpVerificationProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(expiresIn);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedAttempts, setUsedAttempts] = useState(0);
  // When the user clicks/focuses a completed OTP again (e.g. after a wrong
  // attempt), the whole existing code is treated as selected so typing a new
  // code replaces it immediately — no manual deletion required.
  const [allSelected, setAllSelected] = useState(false);
  const maxAttempts = 15;

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const canResend = secondsLeft <= 0 && !resending;

  // Focusing a completed OTP marks the whole code as selected: the very next
  // typed digit starts a fresh code (overwrite) instead of blocking on a full
  // box or requiring the old code to be deleted first.
  const handleFocus = () => {
    if (!verifying && !resending && digits.every((digit) => digit !== "")) {
      setAllSelected(true);
    }
  };

  const executeVerify = async (code: string) => {
    if (code.length !== OTP_LENGTH || verifying) {
      if (code.length !== OTP_LENGTH) {
        setError("Please enter the 6-digit code.");
      }
      return;
    }
    setError(null);
    setAllSelected(false);
    setVerifying(true);
    try {
      const result = await onVerify(code);
      if (!result.success) {
        if (result.error) {
          setError(result.error);
        } else {
          setUsedAttempts((u) => u + 1);
          setError(
            usedAttempts + 1 >= maxAttempts
              ? "Too many invalid attempts. Request a new code."
              : "Invalid code. Please try again."
          );
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleVerify = () => {
    executeVerify(digits.join(""));
  };

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 1) {
      if (allSelected) {
        const next = Array(OTP_LENGTH).fill("");
        next[0] = clean;
        setAllSelected(false);
        setDigits(next);
        if (clean) {
          inputsRef.current[1]?.focus();
        }
        return;
      }
      const next = [...digits];
      next[index] = clean;
      setDigits(next);
      if (clean && index < OTP_LENGTH - 1) {
        inputsRef.current[index + 1]?.focus();
      }
      const fullCode = next.join("");
      if (fullCode.length === OTP_LENGTH && next.every((d) => d !== "")) {
        executeVerify(fullCode);
      }
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    setAllSelected(false);
    inputsRef.current[Math.min(index + pasted.length, OTP_LENGTH - 1)]?.focus();
    setError(null);
    if (next.every((d) => d !== "") && next.join("").length === OTP_LENGTH) {
      executeVerify(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVerify();
      return;
    }
    // While the whole OTP is selected, a digit key replaces the code entirely
    // (the first typed digit becomes the new first digit). Intercepted here
    // because a maxLength=1 box would otherwise swallow the first keystroke.
    if (allSelected && e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const next = Array(OTP_LENGTH).fill("");
      next[0] = e.key;
      setAllSelected(false);
      setDigits(next);
      inputsRef.current[1]?.focus();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (allSelected) {
        setAllSelected(false);
        setDigits(Array(OTP_LENGTH).fill(""));
        inputsRef.current[0]?.focus();
        return;
      }
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleResend = async () => {
    setError(null);
    setResending(true);
    try {
      const result = await onResend();
      if (result.success) {
        setDigits(Array(OTP_LENGTH).fill(""));
        setAllSelected(false);
        setUsedAttempts(0);
        setSecondsLeft(result.expires_in || expiresIn);
        inputsRef.current[0]?.focus();
      } else {
        setError(result.error || "Could not resend the code. Please try again.");
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const dark = variant === "dark";

  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <h3 className={`text-lg font-semibold ${dark ? "text-white" : "text-[#1C1C1E]"}`}>
          {title}
        </h3>
        <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-[#6E6E73]"}`}>
          {subtitle} <span className="font-medium">{email}</span>
        </p>
      </div>

      {error && (
        <div
          className={`mb-4 p-3 rounded-xl flex items-start gap-2 text-sm animate-shake ${
            dark
              ? "bg-red-500/10 border border-red-500/20 text-red-400"
              : "bg-[#FF3B30]/10 border border-[#FF3B30]/25 text-[#D70015]"
          }`}
        >
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
        className="w-full"
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          {digits.map((value, index) => (
            <input
              key={index}
              ref={(el) => {
                inputsRef.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={value}
              disabled={verifying || resending}
              onChange={(e) => setDigit(index, e.target.value)}
              onFocus={handleFocus}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={(e) => handlePaste(index, e)}
              className={`w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all duration-200 ${
                dark
                  ? "bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  : "bg-[#F5F5F7] border-2 border-[#E3E3E6] text-[#1C1C1E] focus:border-[#007AFF] focus:ring-4 focus:ring-[#007AFF]/10"
              } ${allSelected ? (dark ? "border-blue-500 ring-2 ring-blue-500/50" : "border-[#007AFF] ring-4 ring-[#007AFF]/10") : ""} disabled:opacity-50`}
              aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={verifying || resending}
          className={`w-full py-3 px-4 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed ${
            dark
              ? "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white focus:ring-blue-500/50"
              : "bg-[#007AFF] hover:bg-[#0071EB] text-white focus:ring-[#007AFF]/40"
          }`}
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying...
            </span>
          ) : (
            verifyLabel
          )}
        </button>
      </form>

      <div className="flex items-center justify-between mt-5 text-sm">
        <button
          type="button"
          onClick={onBack}
          disabled={verifying}
          className={`font-medium transition-colors disabled:opacity-50 ${
            dark
              ? "text-blue-400 hover:text-blue-300"
              : "text-[#007AFF] hover:text-[#0071EB]"
          }`}
        >
          ← Use password instead
        </button>

        <div>
          {canResend ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className={`font-medium transition-colors disabled:opacity-50 ${
                dark
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-[#007AFF] hover:text-[#0071EB]"
              }`}
            >
              {resending ? "Resending..." : "Resend code"}
            </button>
          ) : (
            <span className={`${dark ? "text-slate-400" : "text-[#6E6E73]"} tabular-nums`}>
              Resend in {Math.ceil(secondsLeft)}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}