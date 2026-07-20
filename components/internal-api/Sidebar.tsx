// FILE: D:\websmith\components\internal-api\Sidebar.tsx
// PURPOSE: Websmith License Operations Center Navigation - API Center Auth Only
// RULE 02: All code stays inside /internal - no main website interference
// RULE 05: API Center Only - Uses api_center_token, NOT lib/auth.ts
// Sidebar navigation (page no longer exists)
// FIXED: Only valid routes remain in navigation

"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  KeyRound,
  BarChart3,
  LogOut,
  User,
  ChevronRight,
  Sparkles,
  Shield,
  Activity,
  Zap,
  Code2,
  FileText,
  Boxes,
  Users,
  Mail,
  Gift,
  ShoppingBag,
  HardDrive,
  Bell,
  ScrollText,
  MessageSquare,
  Store,
  CreditCard,
  Receipt,
  ShieldCheck,
} from "lucide-react";

const menu = [
  {
    title: "MAIN",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, path: "/internal/api/dashboard" },
    ],
  },
  {
    title: "LICENSES",
    items: [
      { name: "License Center", icon: KeyRound, path: "/internal/api/licenses/generate" },
      { name: "Activation", icon: ShieldCheck, path: "/internal/api/activation" },
    ],
  },
  {
    title: "CUSTOMERS",
    items: [
      { name: "All Customers", icon: Users, path: "/internal/api/customers" },
    ],
  },
  {
    title: "HARDWARE",
    items: [
      { name: "Devices", icon: HardDrive, path: "/internal/api/hardware" },
    ],
  },
  {
    title: "TRIALS",
    items: [
      { name: "Trial Dashboard", icon: Activity, path: "/internal/api/trials" },
      { name: "Trial Templates", icon: Gift, path: "/internal/api/trial/trial-templates" },
    ],
  },
  {
    title: "SALES",
    items: [
      { name: "Sales Enquiries", icon: Store, path: "/internal/api/sales/enquiries" },
      { name: "Generate License", icon: KeyRound, path: "/internal/api/sales/purchase" },
    ],
  },
  {
    title: "PAYMENT",
    items: [
      { name: "Payment Setup", icon: CreditCard, path: "/internal/api/sales/payment-config" },
    ],
  },
  {
    title: "EMAIL",
    items: [
      { name: "Email Templates", icon: Mail, path: "/internal/api/email/templates" },
    ],
  },
  {
    title: "SMS",
    items: [
      { name: "SMS Config", icon: MessageSquare, path: "/internal/api/sales/sms-config" },
      { name: "SMS Templates", icon: FileText, path: "/internal/api/sms/templates" },
    ],
  },
  {
    title: "MONITORING",
    items: [
      { name: "Audit Logs", icon: ScrollText, path: "/internal/api/audit" },
      { name: "Notifications", icon: Bell, path: "/internal/api/notifications" },
    ],
  },
  {
    title: "PRODUCTS",
    items: [
      { name: "Product Management", icon: ShoppingBag, path: "/internal/api/products" },
    ],
  },
  {
    title: "DEVELOPERS",
    items: [
      { name: "SDK Packages", icon: Boxes, path: "/internal/api/developers/integrations" },
      { name: "API Keys", icon: Code2, path: "/internal/api/public-api/keys" },
      { name: "API Docs", icon: FileText, path: "/internal/api/docs/public-api" },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { name: "Analytics", icon: BarChart3, path: "/internal/api/analytics" },
    ],
  },
];

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Fetch user from API Center auth
  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      console.log("🔄 Sidebar: Starting fetchUser");
      try {
        const token = localStorage.getItem("api_center_token");
        console.log("🔄 Sidebar: Token exists?", !!token);

        if (!token) {
          console.log("🔄 Sidebar: No token, setting loading false");
          if (isMounted) setLoading(false);
          return;
        }

        console.log("🔄 Sidebar: Calling /verify endpoint...");
        const response = await fetch("/internal/backend/api/auth/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        console.log("🔄 Sidebar: /verify response:", data);

        if (data.valid && data.user) {
          console.log("✅ Sidebar: Setting user to:", data.user);
          if (isMounted) {
            setUser(data.user);
            localStorage.setItem("api_center_user", JSON.stringify(data.user));
          }
        } else {
          console.log("❌ Sidebar: Invalid response");
        }
      } catch (error) {
        console.error("❌ Sidebar: Fetch error:", error);
      } finally {
        if (isMounted) {
          console.log("🔄 Sidebar: Setting loading false");
          setLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, []);

  // Debug: Log user state changes
  useEffect(() => {
    console.log("🔍 Sidebar: user state changed:", user);
  }, [user]);

  // ============================================================
  // LOGOUT HANDLER - Calls logout API to create notification
  // ============================================================
  const handleLogout = async () => {
    setIsLoggingOut(true);
    console.log("🔐 Logout initiated");

    try {
      const token = localStorage.getItem("api_center_token");
      console.log("🔐 Token exists:", !!token);

      if (token) {
        const response = await fetch("/internal/backend/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        console.log("🔐 Logout API response:", data);

        if (data.success) {
          console.log("✅ Logout successful - notification created");
        } else {
          console.log("⚠️ Logout API error:", data.error);
        }
      }

      localStorage.removeItem("api_center_token");
      localStorage.removeItem("api_center_remember");
      localStorage.removeItem("api_center_user");
      document.cookie = "api_center_token=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "api_center_token=; path=/internal; max-age=0; SameSite=Lax";

      router.push("/internal/api/auth/login");
    } catch (error) {
      console.error("❌ Logout error:", error);
      localStorage.removeItem("api_center_token");
      localStorage.removeItem("api_center_remember");
      localStorage.removeItem("api_center_user");
      document.cookie = "api_center_token=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "api_center_token=; path=/internal; max-age=0; SameSite=Lax";
      router.push("/internal/api/auth/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getUserInitials = () => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Loading state
  if (loading) {
    return (
      <aside className="sticky top-0 w-[280px] min-h-screen flex flex-col bg-[var(--bg-primary)] border-r border-[var(--border-color)] shadow-[0_0_40px_rgba(0,0,0,0.35)]">
        <div className="h-[72px] flex items-center px-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-[var(--border-color)] flex-shrink-0 bg-[var(--bg-tertiary)]/50 animate-pulse" />
            <div>
              <div className="h-4 w-24 bg-[var(--bg-tertiary)]/50 rounded animate-pulse" />
              <div className="h-2 w-16 bg-[var(--bg-tertiary)]/50 rounded mt-1 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 w-[280px] min-h-screen flex flex-col bg-[var(--bg-primary)] border-r border-[var(--border-color)] shadow-[0_0_40px_rgba(0,0,0,0.35)] transition-all duration-300">
      {/* Brand Section */}
      <div className="h-[72px] flex items-center px-4 border-b border-[var(--border-color)] group">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-[var(--border-color)] flex-shrink-0 transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/images/websmith_1x1.jpg"
              alt="Websmith Digital Logo"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] leading-tight flex items-center gap-1.5">
              Websmith
              <Sparkles size={12} className="text-blue-400" />
            </h2>
            <p className="text-[9px] text-[var(--text-secondary)] leading-tight flex items-center gap-1">
              <Shield size={8} className="text-emerald-400" />
              License Operations
            </p>
          </div>
        </div>
      </div>

      {/* User Card */}
      <div className="px-3 mt-6 mb-6">
        <div
          onClick={() => router.push("/internal/api/auth/profile")}
          className="group relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 p-3 cursor-pointer transition-all duration-300 hover:bg-[var(--bg-tertiary)]/80 hover:border-[var(--border-color)] hover:shadow-lg hover:shadow-blue-500/5 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20 transition-transform duration-300 group-hover:scale-105">
              {user?.name ? (
                <span className="text-sm font-bold text-white">
                  {getUserInitials()}
                </span>
              ) : (
                <User size={16} color="white" />
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-primary)] animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-blue-400 transition-colors duration-300">
                {user?.name || "Guest User"}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] truncate flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400/60" />
                {user?.email || "guest@websmith.com"}
              </p>
            </div>
            <ChevronRight
              size={14}
              className="text-[var(--text-secondary)] shrink-0 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin scrollbar-thumb-[var(--border-color)] scrollbar-track-transparent space-y-5">
        {menu.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-2 text-[11px] font-bold tracking-[0.12em] text-[var(--text-secondary)]/70 uppercase flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-blue-500/50" />
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.path || (item.path !== '/internal/api/dashboard' && pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`
                      group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5
                      transition-all duration-200 overflow-hidden
                      ${
                        isActive
                          ? "bg-blue-500/15 text-[var(--text-primary)] shadow-sm shadow-blue-500/10"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/60 hover:text-[var(--text-primary)]"
                      }
                    `}
                  >
                    {isActive && (
                      <>
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                        <span className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.04] via-transparent to-transparent" />
                      </>
                    )}

                    <item.icon
                      size={16}
                      className={`
                        shrink-0 transition-all duration-200
                        ${isActive ? "text-blue-400" : "text-[var(--text-secondary)] group-hover:text-blue-400"}
                      `}
                    />
                    <span className={`text-sm font-medium transition-colors duration-200 ${isActive ? "text-[var(--text-primary)]" : ""}`}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* System Status */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)]">
          <Activity size={10} className="text-emerald-400 animate-pulse" />
          <span className="text-[9px] text-[var(--text-secondary)]">System Online</span>
          <span className="ml-auto text-[9px] text-[var(--text-secondary)]/50 flex items-center gap-1">
            <Zap size={8} className="text-blue-400" />
            v1.0
          </span>
        </div>
      </div>

      {/* Logout Button */}
      <div className="p-3 border-t border-[var(--border-color)] mt-auto">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="group relative w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/5 transition-all duration-300 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-x-full group-hover:translate-x-0" />

          <LogOut
            size={14}
            className="transition-transform duration-300 group-hover:-translate-x-1"
          />
          <span className="relative">
            {isLoggingOut ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                Logging out...
              </span>
            ) : (
              "Log Out"
            )}
          </span>
        </button>
      </div>
    </aside>
  );
}