// C:\websmith\app\ClientLayout.tsx
// Client Layout Component
// Features: Conditional sidebar rendering based on route

"use client";

import { usePathname } from "next/navigation";
import Sidebar from "../components/layout/Sidebar";
import CrispChat from "../components/ui/crispchat";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Pages that should NOT show sidebar
  // Includes: Landing page, Login, Register
  const noSidebarPaths = ["/", "/login", "/register"];
  
  // Check if current page should have sidebar
  const shouldShowSidebar = !noSidebarPaths.includes(pathname);

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