// C:\websmith\app\ClientLayout.tsx
// Client Layout Component
// Features: Conditional sidebar rendering based on route

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import Sidebar from "../components/layout/Sidebar";
import CrispChat from "../components/ui/crispchat";
import { clearAuthSession, getDefaultRouteForRole, getStoredUser, getToken } from "../lib/auth";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  const publicPaths = ["/", "/login", "/register", "/auth/callback"];
  const legacyProtectedPaths = ["/dashboard", "/projects", "/clients", "/tasks", "/team", "/messages", "/invoices", "/payments", "/settings"];
  
  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();

    if (publicPaths.includes(pathname)) {
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
  }, [pathname, router]);

  const shouldShowSidebar = !publicPaths.includes(pathname);

  return (
    <>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {shouldShowSidebar && <Sidebar />}
        <main style={{ flex: 1 }}>{children}</main>
      </div>
      <CrispChat />
    </>
  );
}
