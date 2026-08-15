// FILE: app/internal/api/auth/login/page.tsx
// PURPOSE: API Center Login Page - Universal API Center Authentication
// FEATURES: Video background, glassmorphism, animations, password toggle, remember me
// FIXED: Clean login with Remember Me saving both email and password
// FIXED: Removed email suggestions, disabled browser autofill, fixed layout shift

"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
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
import OtpVerification from "@/components/shared/OtpVerification";
import type { OtpCallResult } from "@/components/shared/OtpVerification";

// ==== 25-bubble ambient field — inspired by the landing "Built With the Right Technology" banner ====
type BubbleItem = { name: string; icon: string };

const BUBBLES: BubbleItem[] = [
  { name: "TypeScript", icon: "/wds_icon/typescript.svg" },
  { name: "JavaScript", icon: "/wds_icon/javascript.svg" },
  { name: "React", icon: "/wds_icon/react.svg" },
  { name: "Next.js", icon: "/wds_icon/nextjs.svg" },
  { name: "Node.js", icon: "/wds_icon/nodejs.svg" },
  { name: "Python", icon: "/wds_icon/python.svg" },
  { name: "Go", icon: "/wds_icon/go.svg" },
  { name: "Rust", icon: "/wds_icon/rust.svg" },
  { name: "PostgreSQL", icon: "/wds_icon/postgresql.svg" },
  { name: "MongoDB", icon: "/wds_icon/mongodb.svg" },
  { name: "Redis", icon: "/wds_icon/redis.svg" },
  { name: "MySQL", icon: "/wds_icon/mysql.svg" },
  { name: "GraphQL", icon: "/wds_icon/graphql.svg" },
  { name: "Docker", icon: "/wds_icon/docker.svg" },
  { name: "Kubernetes", icon: "/wds_icon/kubernetes.svg" },
  { name: "Git", icon: "/wds_icon/git.svg" },
  { name: "HTML5", icon: "/wds_icon/html5.svg" },
  { name: "CSS3", icon: "/wds_icon/css3.svg" },
  { name: "Flutter", icon: "/wds_icon/flutter.svg" },
  { name: "Swift", icon: "/wds_icon/swift.svg" },
  { name: "Kotlin", icon: "/wds_icon/kotlin.svg" },
  { name: "Express", icon: "/wds_icon/express.svg" },
  { name: "FastAPI", icon: "/wds_icon/fastapi.svg" },
  { name: "Firebase", icon: "/wds_icon/firebase.svg" },
  { name: "AWS", icon: "/wds_icon/aws.svg" },
];

type BubbleParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  drift: number;
  driftSpeed: number;
  floatPhase: number;
  floatSpeed: number;
  floatAmp: number;
  turnTimer: number;
  turnEvery: number;
  scale: number;
  opacity: number;
};

function BubbleField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLElement | null)[]>([]);
  const particles = useRef<BubbleParticle[]>([]);
  const sizes = useRef({ w: 1, h: 1, node: 104 });
  const reducedMotion = useRef(false);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = media.matches;

    const readSize = () => {
      const rect = field.getBoundingClientRect();
      const node = nodeRefs.current[0]?.offsetWidth || 104;
      sizes.current = { w: Math.max(rect.width, 1), h: Math.max(rect.height, 1), node };
    };
    readSize();

    const { w, h, node } = sizes.current;
    const r = node / 2;

    particles.current = BUBBLES.map((_, i) => {
      const fx = ((i * 67) % 100) / 100;
      const fy = ((i * 29) % 100) / 100;
      const up = i % 2 === 0;
      const base = 0.34 + ((i * 37) % 10) / 24;
      return {
        x: r + fx * Math.max(w - r * 2, 1),
        y: r + fy * Math.max(h - r * 2, 1),
        vx: (Math.random() - 0.5) * 0.5,
        vy: up ? -base : base,
        drift: Math.random() * Math.PI * 2,
        driftSpeed: 0.1 + ((i * 13) % 10) / 48,
        floatPhase: Math.random() * Math.PI * 2,
        floatSpeed: 0.16 + ((i * 7) % 10) / 40,
        floatAmp: 5 + ((i * 11) % 10) * 1.5,
        turnTimer: 0,
        turnEvery: 2 + ((i * 17) % 10) / 4,
        scale: 0.8 + ((i * 23) % 10) / 32,
        opacity: 0.25 + ((i * 19) % 10) / 30,
      };
    });

    let raf = 0;
    let last = performance.now();
    let active = false;

    const applyTransforms = () => {
      const r2 = sizes.current.node / 2;
      for (let i = 0; i < particles.current.length; i++) {
        const el = nodeRefs.current[i];
        if (!el) continue;
        const p = particles.current[i];
        const bob = Math.sin(p.floatPhase) * p.floatAmp;
        el.style.transform = `translate3d(${p.x - r2}px, ${p.y + bob - r2}px, 0) scale(${p.scale})`;
      }
    };

    const step = (now: number) => {
      if (!active) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { w, h, node } = sizes.current;
      const r2 = node / 2;

      for (let i = 0; i < particles.current.length; i++) {
        const p = particles.current[i];
        p.drift += p.driftSpeed * dt * 60;
        p.floatPhase += p.floatSpeed * dt * 60;
        p.turnTimer -= dt;
        if (p.turnTimer <= 0) {
          p.turnTimer = p.turnEvery;
          p.vx += (Math.random() - 0.5) * 0.24;
        }
        p.x += (p.vx + Math.sin(p.drift) * 0.35) * dt * 60;
        p.y += p.vy * dt * 60;

        if (p.x < r2) {
          p.x = r2;
          p.vx = Math.abs(p.vx);
        } else if (p.x > w - r2) {
          p.x = w - r2;
          p.vx = -Math.abs(p.vx);
        }

        if (p.y > h + r2 * 1.5) p.y = -r2 * 1.5;
        else if (p.y < -r2 * 1.5) p.y = h + r2 * 1.5;
      }

      for (let i = 0; i < particles.current.length; i++) {
        const el = nodeRefs.current[i];
        if (!el) continue;
        const p = particles.current[i];
        const bob = Math.sin(p.floatPhase) * p.floatAmp;
        el.style.transform = `translate3d(${p.x - r2}px, ${p.y + bob - r2}px, 0) scale(${p.scale})`;
      }
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (active || reducedMotion.current) return;
      active = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      active = false;
      cancelAnimationFrame(raf);
    };

    applyTransforms();
    if (!reducedMotion.current) start();

    const ro = new ResizeObserver(() => {
      readSize();
      const { w: w2, h: h2, node: n2 } = sizes.current;
      const rr = n2 / 2;
      for (const p of particles.current) {
        p.x = Math.max(rr, Math.min(w2 - rr, p.x));
        p.y = Math.max(rr, Math.min(h2 - rr, p.y));
      }
      applyTransforms();
    });
    ro.observe(field);

    const onReducedChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
      if (e.matches) stop();
      else start();
    };
    media.addEventListener("change", onReducedChange);

    return () => {
      stop();
      ro.disconnect();
      media.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div ref={fieldRef} className="login-bubble-field" aria-hidden="true">
      {BUBBLES.map((bubble, i) => (
        <span
          key={bubble.name}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          className="login-bubble"
          style={{
            opacity: particles.current[i]?.opacity ?? 0.4,
            transform: "translate3d(-9999px, -9999px, 0)",
          }}
        >
          <span className="login-bubble-mask">
            <img src={bubble.icon} alt="" draggable={false} loading="lazy" />
          </span>
        </span>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/internal/api/dashboard");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpEmailMasked, setOtpEmailMasked] = useState("");
  const [otpExpiresIn, setOtpExpiresIn] = useState(300);

  useEffect(() => {
    setMounted(true);
    
    if (typeof window !== "undefined") {
      // Preserve the ?next= destination added by proxy.ts redirects
      const nextParam = new URLSearchParams(window.location.search).get("next");
      if (nextParam && nextParam.startsWith("/internal/")) {
        setNextPath(nextParam);
      }
      
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
        if (data.requires_otp) {
          // ✅ Move to the shared OTP step (credentials confirmed) — password
          //    stays in memory so Remember Me can still save it after OTP verify
          setOtpEmail(data.email);
          setOtpEmailMasked(data.email_masked || data.email);
          setOtpExpiresIn(data.expires_in || 300);
          setStep("otp");
          return;
        }
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
        
        // ✅ Navigate to destination (preserves ?next= from proxy.ts)
        router.push(nextPath);
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ STEP 2: Complete login by verifying the OTP (session issued only here)
  const handleOtpVerify = async (otp: string): Promise<OtpCallResult> => {
    try {
      const response = await fetch("/internal/backend/api/auth/login/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, otp, rememberMe }),
      });
      const data = await response.json();

      if (data.success) {
        localStorage.setItem("api_center_token", data.token);
        document.cookie = `api_center_token=${data.token}; path=/; max-age=86400; SameSite=Lax`;

        if (rememberMe) {
          localStorage.setItem("api_center_saved_email", email.trim());
          localStorage.setItem("api_center_saved_password", password);
          localStorage.setItem("api_center_remember", "true");
        } else {
          localStorage.removeItem("api_center_saved_email");
          localStorage.removeItem("api_center_saved_password");
          localStorage.removeItem("api_center_remember");
        }

        setPassword("");
        router.push(nextPath);
        return { success: true };
      }
      return { success: false, error: data.error || "Invalid code. Please try again." };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  // ✅ STEP 2: Resend the login OTP
  const handleOtpResend = async (): Promise<OtpCallResult> => {
    try {
      const response = await fetch("/internal/backend/api/auth/login/otp/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = await response.json();
      if (data.success) return { success: true, expires_in: data.expires_in || 300 };
      return { success: false, error: data.error || "Could not resend the code." };
    } catch {
      return { success: false, error: "Network error. Please try again." };
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
      <style>{`
        .login-bubble-field {
          position: absolute;
          inset: 0;
          z-index: 11;
          overflow: hidden;
          pointer-events: none;
          --login-bubble: 104px;
        }
        .login-bubble {
          position: absolute;
          left: 0;
          top: 0;
          width: var(--login-bubble, 104px);
          height: var(--login-bubble, 104px);
          will-change: transform;
        }
        .login-bubble-mask {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 32% 26%, rgba(35, 39, 67, 0.8), rgba(15, 17, 34, 0.76) 72%);
          border: 1px solid rgba(139, 92, 246, 0.32);
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4), inset 0 0 14px rgba(139, 92, 246, 0.12);
          -webkit-backdrop-filter: blur(2px);
          backdrop-filter: blur(2px);
        }
        .login-bubble-mask img {
          width: 52%;
          height: 52%;
          object-fit: contain;
          opacity: 0.9;
          filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.25));
        }
        @media (max-width: 768px) {
          .login-bubble-field { --login-bubble: 78px; }
        }
        @media (max-width: 520px) {
          .login-bubble-field { --login-bubble: 68px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-bubble { animation: none !important; }
        }
      `}</style>
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
      >
        <source src="/videos/WDS_UAC.mp4" type="video/mp4" />
      </video>

      {/* 25-bubble ambient field (inspired by the landing technology banner) */}
      <BubbleField />

      <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#0B1120]/90 via-[#0B1120]/60 to-[#0B1120]/80" />
      <div className="absolute inset-0 z-10 bg-gradient-to-tr from-blue-600/5 via-purple-600/5 to-transparent animate-pulse" />
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,rgba(11,17,32,0.55),transparent_62%)]" />

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

            {step === "credentials" && error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {step === "otp" ? (
              <OtpVerification
                variant="dark"
                email={otpEmailMasked}
                expiresIn={otpExpiresIn}
                onVerify={handleOtpVerify}
                onResend={handleOtpResend}
                onBack={() => {
                  setStep("credentials");
                  setError(null);
                }}
              />
            ) : (
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
            )}

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