// PATH: C:\websmith\app\login\page.tsx
"use client";

import { useState } from "react";
import { login } from "../../core/services/authService";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, Menu, X } from "lucide-react";
import { getDefaultRouteForRole } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await login(email, password);
      router.push(getDefaultRouteForRole(result.user?.role));
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Features", href: "/#features" },
    { name: "Developers", href: "/#developers" },
    { name: "Clients", href: "/#clients" },
    { name: "Contact", href: "/#contact" },
  ];

  return (
    <div style={styles.container}>
      {/* Header Menu */}
      <header style={styles.headerMenu}>
        <nav style={styles.nav}>
          <div style={styles.leftNavGroup}>
            {/* Logo */}
            <a href="/" style={styles.logoArea}>
              <div 
                style={styles.logoCircle}
                className="logo-circle"
              >
                <span style={styles.logoCircleText}>W</span>
              </div>
              <span style={styles.logoText} className="logo-text">
                Websmith
              </span>
            </a>

            {/* Desktop Navigation */}
            <div style={styles.navLinks} className="desktop-nav">
              {navItems.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  style={styles.navLink}
                  className="nav-link"
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>

          {/* Desktop Auth Buttons */}
          <div style={styles.authButtons} className="desktop-auth">
            <button
              onClick={() => router.push("/login")}
              style={styles.loginButton}
              className="login-button"
            >
              Login
            </button>
            <button
              onClick={() => router.push("/services")}
              style={styles.getStartedButton}
              className="get-started-button"
            >
              Get Started 🚀
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={styles.mobileMenuButton}
            className="mobile-menu-button"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={styles.mobileMenu}>
            {navItems.map((item, index) => (
              <a
                key={index}
                href={item.href}
                style={styles.mobileNavLink}
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div style={styles.mobileAuthButtons}>
              <button
                onClick={() => router.push("/login")}
                style={styles.mobileLoginButton}
              >
                Login
              </button>
              <button
                onClick={() => router.push("/services")}
                style={styles.mobileGetStartedButton}
              >
                Get Started 🚀
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Background gradient */}
      <div style={styles.background}></div>

      {/* Main content */}
      <div style={styles.card}>
        {/* Logo - Circle Mask with WSD */}
        <div style={styles.logoContainer}>
          <div 
            style={styles.circleMask}
            className="circle-mask-hover"
          >
            <span style={styles.circleText}>WSD</span>
          </div>
          <h1 
            style={styles.logoTextLarge}
            className="logo-text-hover"
          >
            Web Smith Digital
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

        {/* Email input */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Email address</label>
          <div style={styles.inputWrapper}>
            <Mail size={18} style={styles.inputIcon} />
            <input
              suppressHydrationWarning
              type="email"
              placeholder="hello@websmith.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          <a 
            href="#" 
            style={styles.forgotLink}
            className="forgot-link-hover"
          >
            Forgot password?
          </a>
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
          {isLoading ? (
            <div style={styles.spinner}></div>
          ) : (
            "Sign In"
          )}
        </button>

        {/* Sign up link */}
        <div style={styles.signupContainer}>
          <span style={styles.signupText}>Need a new project?</span>
          <button 
            onClick={() => router.push("/services")} 
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

      {/* All Animations */}
      <style>{`
        /* Logo Circle Hover */
        .logo-circle {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .logo-circle:hover {
          transform: scale(1.05);
          background: #007AFF;
        }
        
        /* Logo Text Hover */
        .logo-text {
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .logo-text:hover {
          color: #007AFF;
        }
        
        /* Nav Link Hover - Slide Right Effect */
        .nav-link {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .nav-link:hover {
          color: #007AFF;
          transform: translateX(4px);
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: #007AFF;
          transition: width 0.3s ease;
        }
        .nav-link:hover::after {
          width: 100%;
        }
        
        /* Login Button Hover */
        .login-button {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .login-button:hover {
          background: #007AFF;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,122,255,0.3);
        }
        
        /* Get Started Button Hover */
        .get-started-button {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .get-started-button:hover {
          background: #34C759;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(52,199,89,0.3);
          padding-left: 20px;
          padding-right: 20px;
        }
        .get-started-button:active {
          transform: translateY(0);
        }
        
        /* Mobile Menu Button Hover */
        .mobile-menu-button {
          display: none;
          transition: all 0.2s ease;
        }
        .mobile-menu-button:hover {
          background: #F2F2F7;
          transform: scale(1.05);
        }
        
        /* Mobile Nav Link Hover */
        .mobile-nav-link {
          transition: all 0.2s ease;
        }
        .mobile-nav-link:hover {
          background: #F2F2F7;
          padding-left: 24px;
          color: #007AFF;
        }
        
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

        @media (max-width: 768px) {
          .desktop-nav,
          .desktop-auth {
            display: none !important;
          }

          .mobile-menu-button {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F7",
    position: "relative",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  headerMenu: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(224,224,230,0.5)",
  },

  nav: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftNavGroup: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
    minWidth: 0,
  },

  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    textDecoration: "none",
  },

  logoCircle: {
    width: "36px",
    height: "36px",
    backgroundColor: "#1C1C1E",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s ease",
  },

  logoCircleText: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#FFFFFF",
  },

  logoText: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1C1C1E",
    letterSpacing: "-0.5px",
  },

  navLinks: {
    display: "flex",
    gap: "28px",
    alignItems: "center",
  },

  navLink: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#3A3A3C",
    textDecoration: "none",
    transition: "all 0.25s ease",
    cursor: "pointer",
  },

  authButtons: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },

  loginButton: {
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#007AFF",
    backgroundColor: "transparent",
    border: "1px solid #007AFF",
    borderRadius: "20px",
    cursor: "pointer",
    transition: "all 0.25s ease",
  },

  getStartedButton: {
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#FFFFFF",
    backgroundColor: "#007AFF",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
    transition: "all 0.25s ease",
  },

  mobileMenuButton: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  },

  mobileMenu: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    borderTop: "1px solid #E5E5EA",
    padding: "16px 24px",
    gap: "12px",
  },

  mobileNavLink: {
    padding: "12px 16px",
    fontSize: "16px",
    color: "#1C1C1E",
    textDecoration: "none",
    borderRadius: "12px",
    transition: "all 0.2s ease",
  },

  mobileAuthButtons: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "8px",
  },

  mobileLoginButton: {
    padding: "12px",
    fontSize: "16px",
    fontWeight: 500,
    color: "#007AFF",
    backgroundColor: "transparent",
    border: "1px solid #007AFF",
    borderRadius: "12px",
    cursor: "pointer",
  },

  mobileGetStartedButton: {
    padding: "12px",
    fontSize: "16px",
    fontWeight: 500,
    color: "#FFFFFF",
    backgroundColor: "#007AFF",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
  },

  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "radial-gradient(circle at 20% 50%, rgba(0,122,255,0.08) 0%, rgba(242,242,247,0) 50%)",
    pointerEvents: "none",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "28px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "440px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)",
    border: "1px solid rgba(224,224,230,0.5)",
    position: "relative",
    zIndex: 1,
    marginTop: "80px",
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
    backgroundColor: "#1C1C1E",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
  },

  circleText: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: "0.5px",
  },

  logoTextLarge: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1C1C1E",
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
    color: "#1C1C1E",
    letterSpacing: "-0.5px",
    margin: 0,
    marginBottom: "8px",
  },

  subtitle: {
    fontSize: "15px",
    color: "#8E8E93",
    margin: 0,
  },

  errorContainer: {
    backgroundColor: "#FFE5E5",
    border: "1px solid #FF3B30",
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

  inputGroup: {
    marginBottom: "20px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#1C1C1E",
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
    color: "#8E8E93",
    pointerEvents: "none",
  },

  input: {
    width: "100%",
    padding: "14px 16px 14px 44px",
    fontSize: "16px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    backgroundColor: "#FFFFFF",
    color: "#1C1C1E",
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
    color: "#8E8E93",
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
    color: "#8E8E93",
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
    color: "#8E8E93",
    margin: 0,
  },
};
