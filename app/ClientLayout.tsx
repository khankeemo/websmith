// C:\websmith\app\ClientLayout.tsx
"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "../components/layout/Sidebar";
import ForcedPasswordResetModal from "@/components/auth/ForcedPasswordResetModal";
import { default as dynamic } from "next/dynamic";
import { isPublicRoute } from "../core/constants/routes";
import { clearAuthSession, getDefaultRouteForRole, getStoredUser, getToken } from "../lib/auth";

const CookieConsentBanner = dynamic(() => import("../components/ui/CookieConsentBanner"), { ssr: false });
const AnalyticsTracker = dynamic(() => import("../components/ui/AnalyticsTracker"), { ssr: false });
import { LeadFunnelProvider } from "./providers/LeadFunnelProvider";
import { PublicThemeProvider, usePublicTheme } from "./providers/PublicThemeProvider";
import PublicFooter from "../components/layout/PublicFooter";
import PublicSiteNav from "../components/layout/PublicSiteNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicThemeProvider>
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </PublicThemeProvider>
  );
}

function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { publicTheme } = usePublicTheme();
  const [showForcedPasswordResetModal, setShowForcedPasswordResetModal] = useState(false);
  const [ChatComponent, setChatComponent] = useState<React.ComponentType | null>(null);
  
  const handleForcedPasswordResetCompleted = () => {
    setShowForcedPasswordResetModal(false);
  };

  const handleForcedPasswordResetLogout = () => {
    setShowForcedPasswordResetModal(false);
    clearAuthSession();
    router.replace("/login");
  };

  // Load chat widget only on public-facing pages.
  useEffect(() => {
    const isPublicFacingPage = Boolean(pathname && isPublicRoute(pathname) && !pathname.startsWith("/internal") && !isStandaloneCheckoutRoute(pathname) && !isStandaloneProductRoute(pathname));

    if (isPublicFacingPage) {
      import("../components/ui/leadconnectorchat").then((mod) => {
        setChatComponent(() => mod.default);
      });
    } else {
      setChatComponent(null);
      const existingScript = document.getElementById('leadconnector-chat-widget');
      if (existingScript) existingScript.remove();
      const headScripts = document.querySelectorAll('head script[src*="leadconnector"]');
      headScripts.forEach(el => el.remove());
    }
  }, [pathname]);

  useEffect(() => {
    const user = getStoredUser();
    const token = getToken();
    if (token && user?.isForcedPasswordReset) {
      setShowForcedPasswordResetModal(true);
    }
  }, [pathname]);
  
  useEffect(() => {
    if (pathname === null) return;

    const token = getToken();
    const user = getStoredUser();

    if (typeof window !== "undefined") {
      (window as any).__LAST_PATH__ = pathname;
    }

    if (pathname?.startsWith("/internal")) {
      return;
    }

    if (isPublicRoute(pathname)) {
      document.documentElement.classList.toggle("dark-theme", publicTheme === "dark");
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

    const legacyProtectedPaths = ["/dashboard", "/projects", "/clients", "/tasks", "/team", "/messages", "/invoices", "/payments", "/settings"];

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

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const isInternalRoute = pathname?.startsWith("/internal");
  const isCheckoutRoute = Boolean(pathname && isStandaloneCheckoutRoute(pathname));
  const isProductRoute = Boolean(pathname && isStandaloneProductRoute(pathname));
  const isFocusedStoreRoute = isCheckoutRoute || isProductRoute;
  const shouldShowSidebar = !isPublicRoute(pathname) && !isInternalRoute;

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
          <div className="app-main-scroll">
            {!shouldShowSidebar && !isInternalRoute && !isFocusedStoreRoute && (
              <PublicSiteNav variant={(pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") ? "auth" : "full"} />
            )}
            {children}
            {!shouldShowSidebar && !isInternalRoute && !isFocusedStoreRoute && pathname !== "/login" && pathname !== "/register" && pathname !== "/forgot-password" && (
              <PublicFooter />
            )}
          </div>
        </main>
      </div>

      <CookieConsentBanner />
      {!shouldShowSidebar && !isInternalRoute && <AnalyticsTracker />}

      <ForcedPasswordResetModal
        isOpen={shouldShowSidebar && showForcedPasswordResetModal}
        onCompleted={handleForcedPasswordResetCompleted}
        onLogout={handleForcedPasswordResetLogout}
      />

      {/* ✅ Chat widget only loads on non-internal pages */}
      {ChatComponent && <ChatComponent />}

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
          .app-main-shell[data-shell="panel"] {
            width: 100%;
            min-width: 0;
            padding: 76px 0 0 !important;
          }
          .app-main-shell[data-shell="public"] {
            padding: 0 !important;
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
          .app-main-shell[data-shell="panel"] {
            padding: 72px 0 16px !important;
          }
        }
      `}</style>
    </LeadFunnelProvider>
  );
}

const CHECKOUT_ROUTE_PREFIX = "/software-store/checkout";

function isStandaloneCheckoutRoute(pathname: string): boolean {
  return pathname === CHECKOUT_ROUTE_PREFIX || pathname.startsWith(`${CHECKOUT_ROUTE_PREFIX}/`);
}

const PRODUCT_ROUTE_PREFIX = "/software-store/product";

function isStandaloneProductRoute(pathname: string): boolean {
  return pathname === PRODUCT_ROUTE_PREFIX || pathname.startsWith(`${PRODUCT_ROUTE_PREFIX}/`);
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
