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
  Loader2,
  Code2,
  Braces,
  Terminal,
  Database,
  Cloud,
  Server,
  Cpu,
  GitBranch,
  Network,
  Workflow,
  type LucideIcon
} from "lucide-react";
import { isValidEmail } from "@/lib/validation";
import OtpVerification from "@/components/shared/OtpVerification";
import type { OtpCallResult } from "@/components/shared/OtpVerification";
import { useMediaAsset } from "@/hooks/useMediaAsset";

// ==== 60-icon floating language field — inspired by the landing "Built With the Right Technology" banner ====
type FloatIcon = {
  name: string;
  icon?: string;
  lucide?: LucideIcon;
  accent: string;
};

const FLOAT_ICONS: FloatIcon[] = [
  { name: "TypeScript", icon: "/wds_icon/typescript.svg", accent: "49,120,198" },
  { name: "JavaScript", icon: "/wds_icon/javascript.svg", accent: "247,223,30" },
  { name: "Python", icon: "/wds_icon/python.svg", accent: "85,118,171" },
  { name: "Java", icon: "/wds_icon/java.svg", accent: "248,152,32" },
  { name: "C#", icon: "/wds_icon/csharp.svg", accent: "104,33,122" },
  { name: "C++", icon: "/wds_icon/cplusplus.svg", accent: "0,89,156" },
  { name: "C", icon: "/wds_icon/c.svg", accent: "168,185,204" },
  { name: "Go", icon: "/wds_icon/go.svg", accent: "0,173,216" },
  { name: "Rust", icon: "/wds_icon/rust.svg", accent: "222,165,132" },
  { name: "PHP", icon: "/wds_icon/php.svg", accent: "119,123,180" },
  { name: "Ruby", icon: "/wds_icon/ruby.svg", accent: "204,52,45" },
  { name: "Kotlin", icon: "/wds_icon/kotlin.svg", accent: "127,82,255" },
  { name: "Swift", icon: "/wds_icon/swift.svg", accent: "240,81,56" },
  { name: "Dart", icon: "/wds_icon/dart.svg", accent: "1,117,194" },
  { name: "Scala", icon: "/wds_icon/scala.svg", accent: "220,50,32" },
  { name: "R", icon: "/wds_icon/r.svg", accent: "39,109,195" },
  { name: "Lua", icon: "/wds_icon/lua.svg", accent: "45,85,190" },
  { name: "Perl", icon: "/wds_icon/perl.svg", accent: "57,69,126" },
  { name: "Bash", icon: "/wds_icon/bash.svg", accent: "78,170,37" },
  { name: "Objective-C", icon: "/wds_icon/objectivec.svg", accent: "67,142,255" },
  { name: "HTML5", icon: "/wds_icon/html5.svg", accent: "227,79,38" },
  { name: "CSS3", icon: "/wds_icon/css3.svg", accent: "21,114,182" },
  { name: "Node.js", icon: "/wds_icon/nodejs.svg", accent: "51,153,51" },
  { name: "React", icon: "/wds_icon/react.svg", accent: "97,218,251" },
  { name: "Next.js", icon: "/wds_icon/nextjs.svg", accent: "229,231,235" },
  { name: "Vue.js", icon: "/wds_icon/vue.svg", accent: "66,184,131" },
  { name: "Angular", icon: "/wds_icon/angular.svg", accent: "221,0,49" },
  { name: "Svelte", icon: "/wds_icon/svelte.svg", accent: "255,62,0" },
  { name: "Express", icon: "/wds_icon/express.svg", accent: "161,161,170" },
  { name: "NestJS", icon: "/wds_icon/nestjs.svg", accent: "224,35,78" },
  { name: ".NET", icon: "/wds_icon/dotnet.svg", accent: "81,43,212" },
  { name: "Spring", icon: "/wds_icon/spring.svg", accent: "109,179,63" },
  { name: "Laravel", icon: "/wds_icon/laravel.svg", accent: "255,45,32" },
  { name: "Django", icon: "/wds_icon/django.svg", accent: "68,183,139" },
  { name: "Flask", icon: "/wds_icon/flask.svg", accent: "148,163,184" },
  { name: "FastAPI", icon: "/wds_icon/fastapi.svg", accent: "0,150,136" },
  { name: "Flutter", icon: "/wds_icon/flutter.svg", accent: "2,86,155" },
  { name: "React Native", icon: "/wds_icon/react-native.svg", accent: "0,216,255" },
  { name: "MongoDB", icon: "/wds_icon/mongodb.svg", accent: "71,162,56" },
  { name: "PostgreSQL", icon: "/wds_icon/postgresql.svg", accent: "51,103,145" },
  { name: "MySQL", icon: "/wds_icon/mysql.svg", accent: "0,117,143" },
  { name: "Redis", icon: "/wds_icon/redis.svg", accent: "255,68,56" },
  { name: "GraphQL", icon: "/wds_icon/graphql.svg", accent: "225,0,152" },
  { name: "Firebase", icon: "/wds_icon/firebase.svg", accent: "255,202,40" },
  { name: "Supabase", icon: "/wds_icon/supabase.svg", accent: "62,207,142" },
  { name: "Docker", icon: "/wds_icon/docker.svg", accent: "36,150,237" },
  { name: "Kubernetes", icon: "/wds_icon/kubernetes.svg", accent: "50,108,229" },
  { name: "AWS", icon: "/wds_icon/aws.svg", accent: "255,153,0" },
  { name: "Google Cloud", icon: "/wds_icon/google-cloud.svg", accent: "66,133,244" },
  { name: "Git", icon: "/wds_icon/git.svg", accent: "240,80,50" },
  { name: "APIs", lucide: Code2, accent: "167,139,250" },
  { name: "Data Models", lucide: Braces, accent: "251,191,36" },
  { name: "Dev Tools", lucide: Terminal, accent: "34,211,238" },
  { name: "Databases", lucide: Database, accent: "96,165,250" },
  { name: "Cloud", lucide: Cloud, accent: "147,197,253" },
  { name: "Servers", lucide: Server, accent: "196,181,253" },
  { name: "Compute", lucide: Cpu, accent: "45,212,191" },
  { name: "Version Control", lucide: GitBranch, accent: "248,113,113" },
  { name: "Networking", lucide: Network, accent: "56,189,248" },
  { name: "Pipelines", lucide: Workflow, accent: "52,211,153" },
];

type FloatParticle = {
  ox: number;
  oy: number;
  rx: number;
  ry: number;
  fx: number;
  fy: number;
  px: number;
  py: number;
  x: number;
  y: number;
  size: number;
};

const rand = (() => {
  let s = 20260815;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
})();

function FloatIconField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLElement | null)[]>([]);
  const particles = useRef<FloatParticle[]>([]);
  const sizes = useRef({ w: 1, h: 1, node: 106.2 });
  const reducedMotion = useRef(false);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = media.matches;

    const readSize = () => {
      const rect = field.getBoundingClientRect();
      const node = nodeRefs.current[0]?.offsetWidth || 106.2;
      sizes.current = { w: Math.max(rect.width, 1), h: Math.max(rect.height, 1), node };
    };
    readSize();

    const init = () => {
      const { w, h, node } = sizes.current;
      const r = node / 2;
      const D = node * 1.5;
      const placed: { x: number; y: number }[] = [];
      particles.current = FLOAT_ICONS.map((_, i) => {
        let x = r;
        let y = r;
        let ok = false;
        for (let a = 0; a < 48 && !ok; a++) {
          x = r + rand() * Math.max(w - r * 2, 1);
          y = r + rand() * Math.max(h - r * 2, 1);
          ok = placed.every((q) => {
            const dx = q.x - x;
            const dy = q.y - y;
            return dx * dx + dy * dy >= D * D;
          });
        }
        placed.push({ x, y });
        return {
          ox: x,
          oy: y,
          rx: Math.min(node * (0.7 + rand() * 1.5), w * 0.16),
          ry: Math.min(node * (0.7 + rand() * 1.5), h * 0.16),
          fx: 0.08 + rand() * 0.14,
          fy: 0.08 + rand() * 0.14,
          px: rand() * Math.PI * 2,
          py: rand() * Math.PI * 2,
          x,
          y,
          size: 0.9 + rand() * 0.2,
        };
      });
    };
    init();

    let raf = 0;
    let last = performance.now();
    let active = false;

    const applyTransforms = () => {
      const r2 = sizes.current.node / 2;
      for (let i = 0; i < particles.current.length; i++) {
        const el = nodeRefs.current[i];
        if (!el) continue;
        const p = particles.current[i];
        el.style.transform = `translate3d(${p.x - r2}px, ${p.y - r2}px, 0)`;
      }
    };

    const step = (now: number) => {
      if (!active) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { w, h, node } = sizes.current;
      const r2 = node / 2;
      const D = node * 1.18;
      const ps = particles.current;
      const n = ps.length;

      for (let i = 0; i < n; i++) {
        const p = ps[i];
        p.px += p.fx * dt;
        p.py += p.fy * dt;
        const tx = p.ox + Math.sin(p.px) * p.rx;
        const ty = p.oy + Math.cos(p.py) * p.ry;
        p.x += (tx - p.x) * 0.05;
        p.y += (ty - p.y) * 0.05;
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = ps[i];
          const b = ps[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy;
          if (distSq >= D * D) continue;
          const dist = Math.sqrt(Math.max(distSq, 0.0001));
          const overlap = D - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const f = overlap * 0.04;
          a.x -= nx * f;
          a.y -= ny * f;
          b.x += nx * f;
          b.y += ny * f;
        }
      }

      for (let i = 0; i < n; i++) {
        const p = ps[i];
        if (p.x < r2) p.x += (r2 - p.x) * 0.15;
        else if (p.x > w - r2) p.x += (w - r2 - p.x) * 0.15;
        if (p.y < r2) p.y += (r2 - p.y) * 0.15;
        else if (p.y > h - r2) p.y += (h - r2 - p.y) * 0.15;
        const el = nodeRefs.current[i];
        if (el) el.style.transform = `translate3d(${p.x - r2}px, ${p.y - r2}px, 0)`;
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

    let zoomTimer: number | null = null;
    const zoomQueue: number[] = [];
    let lastZoom = -1;

    const pickZoom = () => {
      if (zoomQueue.length === 0) {
        const seq = Array.from({ length: FLOAT_ICONS.length }, (_, i) => i);
        for (let i = seq.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [seq[i], seq[j]] = [seq[j], seq[i]];
        }
        if (seq.length > 1 && seq[0] === lastZoom) {
          const t = seq[0];
          seq[0] = seq[1];
          seq[1] = t;
        }
        zoomQueue.push(...seq);
      }
      const idx = zoomQueue.shift();
      if (idx === undefined) return;
      lastZoom = idx;
      const el = nodeRefs.current[idx];
      if (!el || reducedMotion.current) return;
      const size = particles.current[idx]?.size ?? 1;
      const peak = size * (1.18 + size * 0.06);
      el.style.setProperty("--zoom-start", String(size));
      el.style.setProperty("--zoom-peak", String(peak));
      el.classList.add("float-node-zoom");
      window.setTimeout(() => el.classList.remove("float-node-zoom"), 620);
    };

    if (!reducedMotion.current) {
      zoomTimer = window.setInterval(pickZoom, 1000);
    }

    const ro = new ResizeObserver(() => {
      readSize();
      const { w: w2, h: h2, node: n2 } = sizes.current;
      const rr = n2 / 2;
      for (const p of particles.current) {
        p.ox = Math.max(rr, Math.min(w2 - rr, p.ox));
        p.oy = Math.max(rr, Math.min(h2 - rr, p.oy));
        p.x = Math.max(rr, Math.min(w2 - rr, p.x));
        p.y = Math.max(rr, Math.min(h2 - rr, p.y));
      }
      applyTransforms();
    });
    ro.observe(field);

    const onReducedChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
      if (e.matches) {
        stop();
        if (zoomTimer !== null) {
          window.clearInterval(zoomTimer);
          zoomTimer = null;
        }
      } else {
        start();
        if (zoomTimer === null) zoomTimer = window.setInterval(pickZoom, 1000);
      }
    };
    media.addEventListener("change", onReducedChange);

    return () => {
      stop();
      if (zoomTimer !== null) window.clearInterval(zoomTimer);
      ro.disconnect();
      media.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div ref={fieldRef} className="float-icon-field" aria-hidden="true">
      {FLOAT_ICONS.map((f, i) => (
        <span
          key={f.name}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          className="float-node"
          style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
        >
          <span
            className="float-node-ring"
            style={{
              borderColor: `rgba(${f.accent},0.55)`,
              boxShadow: `0 0 20px rgba(${f.accent},0.32), 0 12px 32px rgba(0,0,0,0.45), inset 0 0 14px rgba(${f.accent},0.14)`,
              transform: `scale(${particles.current[i]?.size ?? 1})`,
              transformOrigin: "center",
            }}
          >
            {f.icon ? (
              <img src={f.icon} alt="" draggable={false} loading="lazy" />
            ) : f.lucide ? (
              <f.lucide color={`rgb(${f.accent})`} strokeWidth={1.75} />
            ) : null}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const loginBackground = useMediaAsset("internal_api_login_background");
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
        .float-icon-field {
          position: absolute;
          inset: 0;
          z-index: 11;
          overflow: hidden;
          pointer-events: none;
          --float-node: 106.2px;
        }
        .float-node {
          position: absolute;
          left: 0;
          top: 0;
          width: var(--float-node, 106.2px);
          height: var(--float-node, 106.2px);
          will-change: transform;
        }
        .float-node-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 32% 26%, #1a2040, #0b0f22 72%);
          border: 1px solid rgba(139, 92, 246, 0.5);
          transform-origin: center;
        }
        .float-node-ring img,
        .float-node-ring svg {
          width: 58%;
          height: 58%;
          object-fit: contain;
        }
        .float-node-zoom .float-node-ring {
          animation: float-node-zoom 0.55s ease-in-out forwards;
        }
        .wds-video-zoom {
          transform-origin: center;
          animation: wds-video-zoom 26s ease-in-out infinite;
        }
        @keyframes float-node-zoom {
          0% { transform: scale(var(--zoom-start, 1)); }
          45% { transform: scale(var(--zoom-peak, 1.24)); }
          100% { transform: scale(var(--zoom-start, 1)); }
        }
        @keyframes wds-video-zoom {
          0% { transform: scale(1); }
          38% { transform: scale(1.14); }
          72% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @media (max-width: 1023px) {
          .float-icon-field { --float-node: 86.4px; }
        }
        @media (max-width: 639px) {
          .float-icon-field { --float-node: 57.6px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .float-node { animation: none !important; }
          .float-node-zoom .float-node-ring { animation: none !important; }
          .wds-video-zoom { animation: none !important; }
        }
      `}</style>
      {/* Video Background — full-width, aspect-correct, subtle slow zoom */}
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            transform: "translate(-50%, -50%)",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="wds-video-zoom w-full h-full object-cover"
            onLoadedMetadata={() => {
              const v = videoRef.current;
              const p = v?.parentElement;
              if (v && p && v.videoWidth && v.videoHeight) {
                p.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
              }
            }}
          >
            <source src={loginBackground.url} type="video/mp4" />
          </video>
        </div>
      </div>

      {/* 60-icon floating language field (inspired by the landing technology banner) */}
      <FloatIconField />

      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,rgba(16,24,48,0.5)_0%,rgba(11,17,32,0.38)_48%,rgba(7,10,20,0.62)_100%)]" />

      <div className="absolute inset-0 z-[2] overflow-hidden">
        <div className="absolute top-[6%] -left-[14%] w-[46vw] h-[46vw] rounded-full bg-violet-700/20 blur-3xl animate-pulse" />
        <div className="absolute top-[26%] -right-[12%] w-[40vw] h-[40vw] rounded-full bg-blue-700/20 blur-3xl animate-pulse delay-500" />
        <div className="absolute bottom-[2%] left-[10%] w-[38vw] h-[38vw] rounded-full bg-cyan-600/15 blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-[14%] right-[4%] w-[30vw] h-[30vw] rounded-full bg-fuchsia-700/15 blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="absolute inset-0 z-[3] bg-gradient-to-br from-[#0B1120]/55 via-[#0B1120]/25 to-[#0B1120]/45" />
      <div className="absolute inset-0 z-[4] bg-[radial-gradient(ellipse_at_center,rgba(11,17,32,0.4),transparent_62%)]" />

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
                <span className="text-emerald-400 font-medium">TLS Secured</span>
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