"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { getStoredUser, getToken } from "../../lib/auth";
import { usePublicTheme } from "../../app/providers/PublicThemeProvider";
import { useLeadFunnel } from "../../app/providers/LeadFunnelProvider";

export const PUBLIC_SITE_NAV_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Features", href: "/#features" },
  { name: "Projects", href: "/#projects" },
  { name: "Clients", href: "/#clients" },
  { name: "Developers", href: "/#developers" },
  { name: "Testimonials", href: "/#testimonials" },
  { name: "Contact", href: "/#contact" },
];

type PublicSiteNavProps = {
  /** Minimal bar (logo + Home + CTA) for sign-in pages — avoids the full marketing menu on /login */
  variant?: "full" | "auth";
};

/**
 * Single shared top navigation for public marketing pages (home, login, register, etc.).
 * Avoid duplicating separate header implementations per page.
 */
export default function PublicSiteNav({ variant = "full" }: PublicSiteNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navMounted, setNavMounted] = useState(false);
  const { publicTheme, togglePublicTheme } = usePublicTheme();
  const { openLeadServicesModal } = useLeadFunnel();
  const isLogin = pathname === "/login";
  const isAuthLayout = variant === "auth";

  useLayoutEffect(() => {
    setNavMounted(true);
  }, []);

  const showGuestThemeToggle = navMounted && !getToken() && !getStoredUser();

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  if (isAuthLayout) {
    return (
      <nav style={styles.navAuth} className="landing-nav-shell public-site-nav public-site-nav--auth">
        <div style={styles.navAuthInner} className="landing-nav-content">
          <a href="/" style={styles.logo} className="logo-hover" onClick={() => setMobileOpen(false)}>
            <div style={styles.logoCircle}>W</div>
            <span style={styles.logoText}>Websmith</span>
          </a>
          <div style={styles.authNavRight}>
            <a href="/" style={styles.authTextLink}>
              Home
            </a>
            {showGuestThemeToggle && (
              <button
                type="button"
                onClick={togglePublicTheme}
                style={styles.themeToggleBtn}
                aria-label={`Switch to ${publicTheme === "light" ? "dark" : "light"} mode`}
              >
                {publicTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            )}
            <button type="button" onClick={() => openLeadServicesModal()} style={styles.ctaBtn} className="cta-hover public-nav-cta">
              Get Started
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav style={styles.nav} className="landing-nav-shell public-site-nav">
      <div style={styles.navContent} className="landing-nav-content">
        <div style={styles.leftNavGroup}>
          <a href="/" style={styles.logo} className="logo-hover" onClick={() => setMobileOpen(false)}>
            <div style={styles.logoCircle}>W</div>
            <span style={styles.logoText}>Websmith</span>
          </a>
          <div style={styles.desktopMenu} className="desktop-menu">
            {PUBLIC_SITE_NAV_ITEMS.map((item, index) => (
              <a key={index} href={item.href} style={styles.menuItem} className="menu-item-hover">
                {item.name}
              </a>
            ))}
          </div>
        </div>

        <div style={styles.navButtons} className="nav-buttons">
          {showGuestThemeToggle && (
            <button
              type="button"
              onClick={togglePublicTheme}
              style={styles.themeToggleBtn}
              aria-label={`Switch to ${publicTheme === "light" ? "dark" : "light"} mode`}
            >
              {publicTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          )}
          {!isLogin && (
            <button type="button" onClick={() => router.push("/login")} style={styles.loginBtn} className="login-btn-hover">
              Log in
            </button>
          )}
          <button type="button" onClick={() => openLeadServicesModal()} style={styles.ctaBtn} className="cta-hover public-nav-cta">
            Get Started
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={styles.mobileMenuBtn}
          className="mobile-menu-btn"
          aria-expanded={mobileOpen}
          aria-controls="public-site-navigation"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            style={styles.mobileMenuOverlay}
            className="public-mobile-menu-overlay"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          />
          <div id="public-site-navigation" style={styles.mobileMenu} className="public-mobile-menu-panel">
            {PUBLIC_SITE_NAV_ITEMS.map((item, index) => (
              <a
                key={index}
                href={item.href}
                style={styles.mobileMenuItem}
                className="mobile-menu-item"
                onClick={() => setMobileOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div style={styles.mobileMenuDivider} />
            {showGuestThemeToggle && (
              <button type="button" onClick={togglePublicTheme} style={styles.mobileThemeBtn} className="mobile-theme-btn">
                {publicTheme === "light" ? (
                  <>
                    <Moon size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Dark mode
                  </>
                ) : (
                  <>
                    <Sun size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Light mode
                  </>
                )}
              </button>
            )}
            {!isLogin && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  router.push("/login");
                }}
                style={styles.mobileLoginBtn}
                className="mobile-login-btn"
              >
                Log in
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openLeadServicesModal();
              }}
              style={styles.mobileCtaBtn}
              className="cta-hover"
            >
              Get Started
            </button>
          </div>
        </>
      )}
      <style>{`
        @media (max-width: 900px) {
          .public-site-nav .desktop-menu,
          .public-site-nav .nav-buttons {
            display: none !important;
          }
          .public-site-nav .mobile-menu-btn {
            display: flex !important;
            align-items: center;
            justify-content: center;
            margin-right: 16px;
          }
          .public-site-nav .landing-nav-content {
            padding-right: 8px;
          }
        }

        /* Keep mobile nav behavior consistent with the home page */
        @media (max-width: 768px) {
          .landing-nav-shell {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0;
            width: 100%;
          }
          .landing-nav-content {
            padding: 10px 16px !important;
          }
        }
      `}</style>
    </nav>
  );
}

const styles: Record<string, CSSProperties> = {
  navAuth: {
    position: "sticky",
    top: 0,
    zIndex: 1300,
    width: "100%",
    backgroundColor: "var(--bg-primary)",
    borderBottom: "1px solid var(--border-color)",
    boxShadow: "var(--card-shadow)",
  },
  navAuthInner: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "14px clamp(16px, 4vw, 40px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
  },
  authNavRight: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  authTextLink: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    textDecoration: "none",
  },
  nav: {
    position: "sticky",
    top: 0,
    backgroundColor: "color-mix(in srgb, var(--bg-primary) 92%, transparent)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid var(--border-color)",
    zIndex: 1300,
    width: "100%",
  },
  navContent: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "12px clamp(16px, 4vw, 40px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftNavGroup: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
    minWidth: 0,
    paddingLeft: 0,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    textDecoration: "none",
  },
  logoCircle: {
    width: "36px",
    height: "36px",
    backgroundColor: "var(--text-primary)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--bg-primary)",
    fontWeight: 700,
    fontSize: "18px",
  },
  logoText: {
    fontSize: "20px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  desktopMenu: {
    display: "flex",
    gap: "32px",
    alignItems: "center",
    paddingRight: "24px",
  },
  menuItem: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-primary)",
    cursor: "pointer",
    padding: "8px 0",
    fontFamily: "inherit",
    backgroundColor: "transparent",
    textDecoration: "none",
  },
  navButtons: {
    display: "flex",
    gap: "12px",
    paddingRight: 0,
    alignItems: "center",
  },
  themeToggleBtn: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background-color 0.2s ease, border-color 0.2s ease",
  },
  loginBtn: {
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 500,
    backgroundColor: "transparent",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
    color: "var(--text-primary)",
  },
  ctaBtn: {
    padding: "8px 18px",
    fontSize: "14px",
    fontWeight: 600,
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  mobileMenuBtn: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    color: "var(--text-primary)",
  },
  mobileMenu: {
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    border: "1px solid var(--border-color)",
    borderRadius: "20px",
    backgroundColor: "var(--bg-primary)",
    position: "fixed",
    top: "64px",
    left: "16px",
    right: "16px",
    zIndex: 1302,
    boxShadow: "var(--card-shadow)",
    maxHeight: "calc(100dvh - 80px)",
    overflowY: "auto",
  },
  mobileMenuOverlay: {
    position: "fixed",
    top: "57px",
    left: 0,
    right: 0,
    bottom: 0,
    border: "none",
    backgroundColor: "rgba(0,0,0,0.22)",
    zIndex: 1301,
    cursor: "pointer",
  },
  mobileMenuItem: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 500,
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: "8px",
    fontFamily: "inherit",
    color: "var(--text-primary)",
    textDecoration: "none",
    display: "block",
  },
  mobileMenuDivider: {
    height: "1px",
    backgroundColor: "var(--border-color)",
    margin: "12px 0",
  },
  mobileThemeBtn: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 500,
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "8px",
    fontFamily: "inherit",
    color: "var(--text-primary)",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
  },
  mobileLoginBtn: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 500,
    backgroundColor: "transparent",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "8px",
    fontFamily: "inherit",
    color: "var(--text-primary)",
  },
  mobileCtaBtn: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 600,
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
