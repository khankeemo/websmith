// PATH: C:\websmith\app\login\page.tsx
"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import Link from "next/link";
import { login } from "../../core/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { getDefaultRouteForRole } from "../../lib/auth";
import PublicSiteNav from "../../components/layout/PublicSiteNav";
import { useLeadFunnel } from "../providers/LeadFunnelProvider";

function LoginPageContent() {
  const router = useRouter();
  const { openLeadServicesModal } = useLeadFunnel();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const loginReason = searchParams.get("reason");
  const showSessionExpiredNotice = loginReason === "session-expired";
  const showPasswordUpdateRequiredNotice = loginReason === "password-update-required";

  const handleLogin = async () => {
    if (!identifier || !password) {
      setError("Please enter both email/ID and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await login(identifier, password);
      router.push(getDefaultRouteForRole(result.user?.role));
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div style={styles.container} className="login-page-shell">
      {/* Main content area (centers card without moving the navbar) */}

      <div style={styles.main}>
        {/* Background gradient */}
        <div style={styles.background}></div>

        {/* Main content */}
        <div style={styles.card}>
          {/* Logo - Circle Mask with WSD */}
          <div style={styles.logoContainer}>
            <div style={styles.circleMask} className="circle-mask-hover">
              <Image src="/images/websmith.png" alt="Websmith logo" width={64} height={64} style={styles.logoImage} priority />
            </div>
            <h1 style={styles.logoTextLarge} className="logo-text-hover">
              Websmith
            </h1>
          </div>

          {/* Welcome text */}
          <div style={styles.headerText}>
            <h2 style={styles.title}>Welcome back</h2>
            <p style={styles.subtitle}>Sign in to continue to your workspace</p>
          </div>

          {/* Error message */}
          {error && (
            <div style={styles.errorContainer}>
              <span style={styles.errorText}>{error}</span>
            </div>
          )}

          {showSessionExpiredNotice && !error && (
            <div style={styles.infoContainer}>
              <span style={styles.infoText}>Your session expired. Please sign in again to continue.</span>
            </div>
          )}

          {showPasswordUpdateRequiredNotice && !error && (
            <div style={styles.infoContainer}>
              <span style={styles.infoText}>You must update your password after signing in with a temporary password.</span>
            </div>
          )}

          {/* Email input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email or Client ID</label>
            <div style={styles.inputWrapper}>
              <Mail size={18} style={styles.inputIcon} />
              <input
                suppressHydrationWarning
                type="text"
                placeholder="Email or CL-0000"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyPress={handleKeyPress}
                style={styles.input}
                disabled={isLoading}
                className="input-focus"
              />
            </div>
          </div>

          {/* Password input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                suppressHydrationWarning
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                style={styles.input}
                disabled={isLoading}
                className="input-focus"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                type="button"
                className="eye-button-hover"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Forgot password link */}
          <div style={styles.forgotContainer}>
            <Link href="/forgot-password" style={styles.forgotLink} className="forgot-link-hover">
              Forgot password?
            </Link>
          </div>

          {/* Sign In button */}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            style={{
              ...styles.signinButton,
              ...(isLoading ? styles.signinButtonDisabled : {}),
            }}
            className="signin-button"
          >
            {isLoading ? <div style={styles.spinner}></div> : "Sign In"}
          </button>

          {/* Sign up link */}
          <div style={styles.signupContainer}>
            <span style={styles.signupText}>Need a new project?</span>
            <button
              type="button"
              onClick={() => openLeadServicesModal()}
              style={styles.signupButton}
              className="signup-button"
            >
              Get started
            </button>
          </div>
        </div>

        {/* Footer - Copyright */}
        <div style={styles.footer}>
          <p style={styles.copyright}>
            © {new Date().getFullYear()} Websmith. All rights reserved.
          </p>
        </div>
      </div>

      {/* All Animations */}
      <style>{`
        /* Circle Mask Hover - Zoom In */
        .circle-mask-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .circle-mask-hover:hover {
          transform: scale(1.1) translateY(-3px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.12);
        }
        
        /* Logo Text Large Hover */
        .logo-text-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          display: inline-block;
        }
        .logo-text-hover:hover {
          transform: scale(1.05) translateY(-2px);
        }
        
        /* Input Focus Effect */
        .input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1) !important;
        }
        
        /* Eye Button Hover */
        .eye-button-hover {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .eye-button-hover:hover {
          transform: scale(1.1);
          color: #007AFF;
        }
        
        /* Forgot Link Hover */
        .forgot-link-hover {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: inline-block;
        }
        .forgot-link-hover:hover {
          transform: translateX(4px);
          color: #FF9500 !important;
          text-decoration: underline !important;
        }
        
        /* SIGN IN BUTTON */
        .signin-button {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative;
          overflow: hidden;
        }
        .signin-button:hover:not(:disabled) {
          background-color: #34C759 !important;
          transform: translateX(4px) translateY(-2px) !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
          border-left: 3px solid #1C1C1E !important;
          padding-left: 11px !important;
        }
        .signin-button:active:not(:disabled) {
          transform: scale(0.98) !important;
        }
        
        /* SIGN UP BUTTON */
        .signup-button {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          display: inline-block !important;
          position: relative !important;
        }
        .signup-button:hover {
          transform: translateX(4px) translateY(-2px) !important;
          color: #34C759 !important;
          border-left: 3px solid #34C759 !important;
          padding-left: 8px !important;
        }
        .signup-button:active {
          transform: scale(0.98) !important;
        }
        
        /* Spinner Animation */
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

const styles: any = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "var(--bg-secondary)",
    position: "relative",
    fontFamily: "var(--font-sans)",
  },

  main: {
    flex: 1,
    width: "100%",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "radial-gradient(circle at 20% 50%, color-mix(in srgb, #007AFF 14%, transparent) 0%, transparent 55%)",
    pointerEvents: "none",
  },

  card: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "28px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "440px",
    boxShadow: "var(--card-shadow)",
    border: "1px solid var(--border-color)",
    position: "relative",
    zIndex: 1,
    marginTop: 0,
  },

  logoContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "32px",
  },

  circleMask: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
    overflow: "hidden",
    backgroundColor: "var(--bg-primary)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  logoTextLarge: {
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--text-primary)",
    letterSpacing: "-0.3px",
    margin: 0,
  },

  headerText: {
    textAlign: "center",
    marginBottom: "32px",
  },

  title: {
    fontSize: "28px",
    fontWeight: 600,
    color: "var(--text-primary)",
    letterSpacing: "-0.5px",
    margin: 0,
    marginBottom: "8px",
  },

  subtitle: {
    fontSize: "15px",
    color: "var(--text-secondary)",
    margin: 0,
  },

  errorContainer: {
    backgroundColor: "color-mix(in srgb, #FF3B30 12%, var(--bg-secondary))",
    border: "1px solid color-mix(in srgb, #FF3B30 45%, var(--border-color))",
    borderRadius: "12px",
    padding: "12px 16px",
    marginBottom: "24px",
  },

  errorText: {
    color: "#FF3B30",
    fontSize: "13px",
    fontWeight: 500,
    margin: 0,
  },

  infoContainer: {
    backgroundColor: "color-mix(in srgb, #007AFF 12%, var(--bg-secondary))",
    border: "1px solid color-mix(in srgb, #007AFF 40%, var(--border-color))",
    borderRadius: "12px",
    padding: "12px 16px",
    marginBottom: "24px",
  },

  infoText: {
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: 500,
    margin: 0,
  },

  inputGroup: {
    marginBottom: "20px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-primary)",
    marginBottom: "8px",
    letterSpacing: "-0.2px",
  },

  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  inputIcon: {
    position: "absolute",
    left: "16px",
    color: "var(--text-secondary)",
    pointerEvents: "none",
  },

  input: {
    width: "100%",
    padding: "14px 16px 14px 44px",
    fontSize: "16px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "12px",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    transition: "all 0.2s ease",
    outline: "none",
    fontFamily: "inherit",
  },

  eyeButton: {
    position: "absolute",
    right: "16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-secondary)",
    padding: 0,
    display: "flex",
    alignItems: "center",
  },

  forgotContainer: {
    textAlign: "right",
    marginBottom: "28px",
  },

  forgotLink: {
    fontSize: "13px",
    color: "#007AFF",
    textDecoration: "none",
    fontWeight: 500,
  },

  signinButton: {
    width: "100%",
    padding: "14px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#FFFFFF",
    backgroundColor: "#007AFF",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    marginBottom: "20px",
    fontFamily: "inherit",
  },

  signinButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#FFFFFF",
    borderRadius: "50%",
    margin: "0 auto",
    animation: "spin 0.8s linear infinite",
  },

  signupContainer: {
    textAlign: "center",
    marginBottom: "0",
  },

  signupText: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    marginRight: "6px",
  },

  signupButton: {
    background: "none",
    border: "none",
    fontSize: "14px",
    color: "#007AFF",
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
  },

  footer: {
    position: "absolute",
    bottom: "24px",
    left: 0,
    right: 0,
    textAlign: "center",
    zIndex: 1,
  },

  copyright: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    margin: 0,
  },
};
