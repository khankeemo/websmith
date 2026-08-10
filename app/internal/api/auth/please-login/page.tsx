// FILE: app/internal/api/auth/please-login/page.tsx
// PURPOSE: "Please Login First" entry guard for the Internal API Center.
//          Shown by proxy.ts whenever a user reaches the Internal API auth
//          area WITHOUT a valid WEBSITE login session first. The ONLY action
//          is an explicit button to the public website /login. The Internal
//          API login form is never exposed through this page.

"use client";

import { useRouter } from "next/navigation";
import { LogIn, ShieldAlert } from "lucide-react";

export default function PleaseLoginFirstPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-[#0B1120]">
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#0B1120]/90 via-[#0B1120]/60 to-[#0B1120]/80" />
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-3xl animate-pulse z-10" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/20 blur-3xl animate-pulse delay-1000 z-10" />

      <div className="relative z-20 w-full max-w-md px-4 sm:px-6">
        <div className="animate-fadeInUp">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/10 mb-4 shadow-2xl">
              <ShieldAlert className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Please Login First
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              Websmith Digital · API Center
            </p>
          </div>

          <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40 animate-fadeInUp animation-delay-200">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 blur-sm -z-10" />

            <p className="text-slate-300 text-sm leading-relaxed mb-6 text-center">
              You must login to your <span className="text-white font-medium">Websmith account</span>{" "}
              before accessing the API Center.
            </p>

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 group"
            >
              <span className="flex items-center justify-center gap-2">
                <LogIn className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                Login
              </span>
            </button>
          </div>

          <div className="text-center mt-6">
            <p className="text-xs text-slate-500/50">
              © 2026 Websmith Digital · Universal API Center v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}