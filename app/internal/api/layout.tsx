"use client";

import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/internal-api/Sidebar";
import Topbar from "@/components/internal-api/Topbar";
import { useEffect, useRef, useState } from "react";
import { NotificationProvider } from "./auth/providers/NotificationProvider";
import { ThemeProvider } from "./auth/providers/ThemeProvider";

function ChatWidgetBlocker() {
  useEffect(() => {
    const originalHeadAppendChild = document.head.appendChild;
    document.head.appendChild = function (node: Node) {
      if (node.nodeName === "SCRIPT") {
        const script = node as HTMLScriptElement;
        if (script.src && script.src.includes("leadconnector")) {
          return node;
        }
      }
      return originalHeadAppendChild.call(this, node);
    };

    const originalBodyAppendChild = document.body.appendChild;
    document.body.appendChild = function (node: Node) {
      if (node.nodeName === "SCRIPT") {
        const script = node as HTMLScriptElement;
        if (script.src && script.src.includes("leadconnector")) {
          return node;
        }
      }
      return originalBodyAppendChild.call(this, node);
    };

    const removeScripts = () => {
      document.querySelectorAll('script[src*="leadconnector"]').forEach((el) => el.remove());
      document.querySelectorAll('[data-widget-id="6a01b0940c2994035d498791"]').forEach((el) => el.remove());
      document.getElementById("leadconnector-chat-widget")?.remove();
    };

    removeScripts();
    const interval = setInterval(removeScripts, 500);
    const observer = new MutationObserver(removeScripts);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
      document.head.appendChild = originalHeadAppendChild;
      document.body.appendChild = originalBodyAppendChild;
    };
  }, []);

  return null;
}

function ThemeGuardian() {
  const restoreTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    const applyStoredTheme = () => {
      const root = document.documentElement;
      const stored = localStorage.getItem("api_center_theme");
      const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
      const effectiveMode =
        mode === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : mode;

      root.classList.remove("dark-theme", "light-theme");
      root.classList.add(effectiveMode === "dark" ? "dark-theme" : "light-theme");
      root.style.colorScheme = effectiveMode;
    };

    const observer = new MutationObserver(() => {
      clearTimeout(restoreTimeoutRef.current);
      restoreTimeoutRef.current = setTimeout(applyStoredTheme, 50);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    applyStoredTheme();
    const interval = setInterval(applyStoredTheme, 2000);

    return () => {
      observer.disconnect();
      clearTimeout(restoreTimeoutRef.current);
      clearInterval(interval);
    };
  }, []);

  return null;
}

export default function InternalApiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname?.startsWith("/internal/api/auth") ?? false;
  // Dedicated communications workspace: the dashboard Sidebar is hidden and the
  // Communications page renders its own email-client navigation full-width.
  const isCommsPage = pathname?.startsWith("/internal/api/communications") ?? false;
  // Universal Buy & Renew Portal — standalone customer pages that MUST NOT show
  // the admin sidebar, admin navigation, or require an admin login. They are
  // customer-facing (like the Software Store checkout) and stay fully outside
  // the admin dashboard chrome, exactly like the auth pages.
  const isPortalPage =
    pathname?.startsWith("/internal/api/buy") ||
    pathname?.startsWith("/internal/api/renew");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    const verifySession = async () => {
      if (isAuthPage || isPortalPage) {
        setAuthChecked(true);
        return;
      }

      const token = localStorage.getItem("api_center_token");
      if (!token) {
        router.replace("/internal/api/auth/login");
        return;
      }

      try {
        const response = await fetch("/internal/backend/api/auth/verify", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok || !data?.valid) {
          localStorage.removeItem("api_center_token");
          document.cookie = "api_center_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.replace("/internal/api/auth/login");
          return;
        }

        if (mounted) setAuthChecked(true);
      } catch {
        localStorage.removeItem("api_center_token");
        document.cookie = "api_center_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.replace("/internal/api/auth/login");
      }
    };

    setAuthChecked(false);
    verifySession();

    return () => {
      mounted = false;
    };
  }, [pathname, isAuthPage, isPortalPage, router]);

  return (
    <ThemeProvider>
      <ChatWidgetBlocker />
      <ThemeGuardian />
      {isAuthPage ? (
        // ✅ Auth pages: NO NotificationProvider
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
          {children}
        </div>
      ) : isPortalPage ? (
        // ✅ Universal Buy & Renew Portal: standalone full-screen customer
        // pages — no sidebar, no topbar, no admin auth gate. Each portal page
        // renders its own chrome (like the Software Store checkout).
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
          {children}
        </div>
      ) : !authChecked ? (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]" />
      ) : (
        // ✅ Dashboard pages: WITH NotificationProvider
        <NotificationProvider>
          <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
            {!isCommsPage && (
              <div className="w-[280px] flex-shrink-0">
                <Sidebar />
              </div>
            )}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0">
                <Topbar />
              </div>
              <main className={`flex-1 overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 ${isCommsPage ? 'p-0' : 'p-6'}`}>
                {children}
              </main>
            </div>
          </div>
        </NotificationProvider>
      )}
    </ThemeProvider>
  );
}