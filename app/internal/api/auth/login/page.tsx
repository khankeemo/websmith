// FILE: app/internal/api/auth/login/page.tsx
// PURPOSE: API Center Login Page - Universal API Center Authentication
// FEATURES: Video background, glassmorphism, animations, password toggle, remember me
// FIXED: Clean login with Remember Me saving both email and password
// FIXED: Removed email suggestions, disabled browser autofill, fixed layout shift

"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn,
  Sparkles,
  Shield,
  AlertCircle,
  Loader2
} from "lucide-react";
import { isValidEmail } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (typeof window !== "undefined") {
      // ✅ Check for saved credentials (email + password)
      const savedEmail = localStorage.getItem("api_center_saved_email");
      const savedPassword = localStorage.getItem("api_center_saved_password");
      const savedRemember = localStorage.getItem("api_center_remember");
      
      if (savedEmail && savedPassword && savedRemember === "true") {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
      
      // Clear token on login page (security)
      localStorage.removeItem("api_center_token");
      document.cookie = "api_center_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email || !isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password || password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/internal/backend/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim(), 
          password,
          rememberMe 
        }),
      });

      const data = await response.json();

      if (data.success) {
        // ✅ Store token in localStorage and cookie (for proxy.ts middleware)
        localStorage.setItem("api_center_token", data.token);
        document.cookie = `api_center_token=${data.token}; path=/; max-age=86400; SameSite=Lax`;
        
        // ✅ Store credentials if Remember Me is checked
        if (rememberMe) {
          localStorage.setItem("api_center_saved_email", email.trim());
          localStorage.setItem("api_center_saved_password", password);
          localStorage.setItem("api_center_remember", "true");
        } else {
          localStorage.removeItem("api_center_saved_email");
          localStorage.removeItem("api_center_saved_password");
          localStorage.removeItem("api_center_remember");
        }
        
        // ✅ Clear sensitive data from memory
        setPassword("");
        
        // ✅ Navigate to dashboard
        router.push("/internal/api/dashboard");
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1120]">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-[#0B1120]">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
      >
        <source src="/videos/API-Center.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#0B1120]/90 via-[#0B1120]/60 to-[#0B1120]/80" />
      <div className="absolute inset-0 z-10 bg-gradient-to-tr from-blue-600/5 via-purple-600/5 to-transparent animate-pulse" />

      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-3xl animate-pulse z-10" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/20 blur-3xl animate-pulse delay-1000 z-10" />

      <div className="relative z-20 w-full max-w-md px-4 sm:px-6">
        <div className="animate-fadeInUp">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/10 mb-4 shadow-2xl">
              <Sparkles className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Universal API Center
            </h1>
            <p className="text-slate-400 text-sm mt-2">Websmith Digital · Secure Admin Access</p>
          </div>

          <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40 animate-fadeInUp animation-delay-200">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 blur-sm -z-10" />

            <div className="flex items-center justify-center gap-2 mb-6">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400 font-medium">Secured · JWT Authentication</span>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              {/* Email Field - Fixed height to prevent layout shift */}
              <div className="space-y-1.5 min-h-[80px]">
                <label htmlFor="email" className="text-sm font-medium text-slate-300 block">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors duration-200" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your email"
                    autoFocus
                    disabled={loading}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    name="email"
                  />
                </div>
              </div>

              {/* Password Field - Fixed height to prevent layout shift */}
              <div className="space-y-1.5 min-h-[80px]">
                <label htmlFor="password" className="text-sm font-medium text-slate-300 block">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors duration-200" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your password"
                    disabled={loading}
                    autoComplete="off"
                    name="password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0 transition-all"
                    disabled={loading}
                  />
                  <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                    Remember me
                  </span>
                </label>
                <a
                  href="/internal/api/auth/forgot-password"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                    Sign In
                  </span>
                )}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-transparent text-slate-500">Secure Access Only</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-500">
                Contact your administrator for access ·{" "}
                <span className="text-emerald-400 font-medium">Brevo Secured</span>
              </p>
            </div>
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