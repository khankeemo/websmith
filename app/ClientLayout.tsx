// C:\websmith\app\ClientLayout.tsx
// Client Layout Component
// Features: Conditional sidebar rendering based on route

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import Sidebar from "../components/layout/Sidebar";
import CrispChat from "../components/ui/crispchat";
import { clearAuthSession, getDefaultRouteForRole, getStoredUser, getToken } from "../lib/auth";
import { LeadFunnelProvider } from "./providers/LeadFunnelProvider";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [publicTheme, setPublicTheme] = useState<"light" | "dark">("light");
  
  const publicPaths = ["/", "/login", "/register", "/auth/callback", "/services", "/lead-form", "/success", "/auth/change-password"];
  const legacyProtectedPaths = ["/dashboard", "/projects", "/clients", "/tasks", "/team", "/messages", "/invoices", "/payments", "/settings"];
  
  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();

    if (publicPaths.includes(pathname)) {
      document.documentElement.classList.toggle(
        "dark-theme",
        token && user ? user.preferences?.theme === "dark" : publicTheme === "dark"
      );
      return;
    }

    if (!token || !user) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    const defaultRoute = getDefaultRouteForRole(user.role);

    if (user.role === "client" && user.isTemporaryPassword && pathname !== "/auth/change-password") {
      router.replace("/auth/change-password");
      return;
    }

    if (legacyProtectedPaths.includes(pathname)) {
      router.replace(defaultRoute);
      return;
    }

    if (pathname.startsWith("/admin") && user.role !== "admin") {
      router.replace(defaultRoute);
      return;
    }

    if (pathname.startsWith("/client") && user.role !== "client") {
      router.replace(defaultRoute);
      return;
    }

    if (pathname.startsWith("/developer") && user.role !== "developer") {
      router.replace(defaultRoute);
    }

    document.documentElement.classList.toggle("dark-theme", user.preferences?.theme === "dark");
  }, [pathname, publicTheme, router]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const shouldShowSidebar = !publicPaths.includes(pathname);
  const user = getStoredUser();

  useEffect(() => {
    if (!shouldShowSidebar) return;
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen, shouldShowSidebar]);

  return (
    <LeadFunnelProvider>
      <div style={styles.layoutShell}>
        {shouldShowSidebar && (
          <>
            <div
              className="app-mobile-overlay"
              style={{
                ...styles.mobileOverlay,
                ...(isMobileMenuOpen ? styles.mobileOverlayVisible : {}),
              }}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="app-mobile-topbar" style={styles.mobileTopbar}>
              <button
                onClick={() => setIsMobileMenuOpen((current) => !current)}
                style={styles.mobileMenuButton}
                aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div style={styles.mobileTopbarText}>
                <span style={styles.mobileTopbarTitle}>Websmith</span>
                <span style={styles.mobileTopbarSubtitle}>
                  {mounted ? (user?.role || "workspace") : "workspace"}
                </span>
              </div>
            </div>
            <Sidebar mobileOpen={isMobileMenuOpen} onNavigate={() => setIsMobileMenuOpen(false)} />
          </>
        )}
        <main className="app-main-shell" style={styles.main}>{children}</main>
        {!shouldShowSidebar && !getToken() && !getStoredUser() && (
          <button
            type="button"
            onClick={() => setPublicTheme((current) => (current === "light" ? "dark" : "light"))}
            style={styles.publicThemeButton}
            aria-label={`Switch to ${publicTheme === "light" ? "dark" : "light"} mode`}
          >
            {publicTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        )}
      </div>
      <CrispChat />
      <style>{`
        @media (max-width: 900px) {
          .app-main-shell {
            width: 100%;
            min-width: 0;
            padding: 76px 12px 20px !important;
          }
          .app-mobile-topbar {
            display: flex !important;
          }
          .app-mobile-overlay {
            display: block !important;
            top: 69px !important;
          }
        }
        @media (max-width: 480px) {
          .app-main-shell {
            padding: 72px 10px 16px !important;
          }
        }
      `}</style>
    </LeadFunnelProvider>
  );
}

const styles: any = {
  layoutShell: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "var(--bg-primary)",
  },
  main: {
    flex: 1,
    backgroundColor: "var(--bg-primary)",
    minWidth: 0,
    width: "100%",
    padding: "24px min(24px, 2vw)",
  },
  mobileTopbar: {
    display: "none",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1201,
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    minHeight: "69px",
    backgroundColor: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border-color)",
  },
  mobileMenuButton: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "#FFFFFF",
    color: "#1C1C1E",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  mobileTopbarText: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  mobileTopbarTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1C1C1E",
    lineHeight: 1.2,
  },
  mobileTopbarSubtitle: {
    fontSize: "12px",
    color: "#8E8E93",
    textTransform: "capitalize",
  },
  mobileOverlay: {
    display: "none",
    position: "fixed",
    top: "69px",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 0.25s ease",
    zIndex: 1199,
  },
  mobileOverlayVisible: {
    opacity: 1,
    pointerEvents: "auto",
  },
  publicThemeButton: {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 1250,
    width: "44px",
    height: "44px",
    borderRadius: "999px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
  },
};
