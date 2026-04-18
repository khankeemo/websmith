// C:\websmith\app\ClientLayout.tsx
// Client Layout Component
// Features: Conditional sidebar rendering based on route

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "../components/layout/Sidebar";
import CrispChat from "../components/ui/crispchat";
import ForcedPasswordResetModal from "../components/auth/ForcedPasswordResetModal";
import { isPublicRoute } from "../core/constants/routes";
import { clearAuthSession, getDefaultRouteForRole, getStoredUser, getToken, setAuthSession } from "../lib/auth";
import { LeadFunnelProvider } from "./providers/LeadFunnelProvider";
import { PublicThemeProvider, usePublicTheme } from "./providers/PublicThemeProvider";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicThemeProvider>
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </PublicThemeProvider>
  );
}

function ClientLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { publicTheme } = usePublicTheme();
  const [showForcedPasswordResetModal, setShowForcedPasswordResetModal] = useState(false);
  
  const legacyProtectedPaths = ["/dashboard", "/projects", "/clients", "/tasks", "/team", "/messages", "/invoices", "/payments", "/settings"];
  
  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();

    if (isPublicRoute(pathname)) {
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
    setShowForcedPasswordResetModal(Boolean(user.isTemporaryPassword));
  }, [pathname, publicTheme, router]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const shouldShowSidebar = !isPublicRoute(pathname);
  const user = getStoredUser();

  const handleForcedPasswordResetCompleted = () => {
    const latestUser = getStoredUser();
    if (!latestUser) {
      setShowForcedPasswordResetModal(false);
      return;
    }
    const updatedUser = { ...latestUser, isTemporaryPassword: false, setupCompleted: true, isApproved: true };
    const token = getToken();
    if (token) {
      setAuthSession(token, updatedUser);
    } else {
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
    setShowForcedPasswordResetModal(false);
  };

  const handleForcedPasswordResetLogout = () => {
    clearAuthSession();
    setShowForcedPasswordResetModal(false);
    router.replace("/login?reason=password-update-required");
  };

  useEffect(() => {
    if (!shouldShowSidebar) return;
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen, shouldShowSidebar]);

  return (
    <LeadFunnelProvider>
      <div className="app-layout-shell" style={styles.layoutShell}>
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
        <main className="app-main-shell" style={styles.main} data-shell={shouldShowSidebar ? "panel" : "public"}>
          <div className="app-main-scroll">{children}</div>
        </main>
      </div>
      <ForcedPasswordResetModal
        isOpen={shouldShowSidebar && showForcedPasswordResetModal}
        onCompleted={handleForcedPasswordResetCompleted}
        onLogout={handleForcedPasswordResetLogout}
      />
      {!shouldShowSidebar && <CrispChat />}
      <style>{`
        .app-layout-shell {
          height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
          box-sizing: border-box;
        }
        .app-main-shell {
          display: flex;
          flex-direction: column;
          min-height: 0;
          flex: 1;
          overflow: hidden;
          box-sizing: border-box;
        }
        .app-main-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          box-sizing: border-box;
        }
        @media (max-width: 900px) {
          .app-main-shell {
            width: 100%;
            min-width: 0;
            padding: 76px 0 0 !important;
          }
          .app-main-shell[data-shell="panel"] .app-main-scroll {
            padding-top: 12px;
            padding-bottom: 20px;
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
            padding: 72px 0 16px !important;
          }
        }
      `}</style>
    </LeadFunnelProvider>
  );
}

const styles: any = {
  layoutShell: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "var(--bg-primary)",
  },
  main: {
    flex: 1,
    backgroundColor: "var(--bg-primary)",
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    padding: "0",
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
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
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
    color: "var(--text-primary)",
    lineHeight: 1.2,
  },
  mobileTopbarSubtitle: {
    fontSize: "12px",
    color: "var(--text-secondary)",
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
};
