// FILE: D:\websmith\components\internal-api\Sidebar.tsx
// PURPOSE: Websmith License Operations Center Navigation - API Center Auth Only
// RULE 02: All code stays inside /internal - no main website interference
// RULE 05: API Center Only - Uses api_center_token, NOT lib/auth.ts
// Sidebar navigation (page no longer exists)
// FIXED: Only valid routes remain in navigation
// NOTE: UI/UX redesign (presentation only). Routes, icons, permissions and
//       navigation logic are unchanged — items are regrouped into logical
//       sections and styled with the reusable .ia-nav-* classes in globals.css.

"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { type LucideIcon } from "lucide-react";
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
  RefreshCw,
  Repeat,
  Store,
  CreditCard,
  Receipt,
  ShieldCheck,
  Inbox,
  Settings,
  MessageCircle,
  AtSign,
} from "lucide-react";

interface NavLeaf {
  name: string;
  icon: LucideIcon;
  path: string;
}

interface NavSubgroup {
  label: string;
  items: NavLeaf[];
}

interface NavSection {
  title: string;
  icon?: LucideIcon;
  expandable?: boolean;
  items?: NavLeaf[];
  groups?: NavSubgroup[];
}

// All existing pages, regrouped into logical sections. No route, name or icon changed.
const menu: NavSection[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { name: "Dashboard", icon: LayoutDashboard, path: "/internal/api/dashboard" },
      { name: "Analytics", icon: BarChart3, path: "/internal/api/analytics" },
    ],
  },
  {
    title: "License Management",
    icon: KeyRound,
    expandable: true,
    groups: [
      {
        label: "Licenses",
        items: [
          { name: "License Center", icon: KeyRound, path: "/internal/api/licenses/generate" },
          { name: "Generate License", icon: KeyRound, path: "/internal/api/sales/purchase" },
        ],
      },
      {
        label: "Device & Lifecycle",
        items: [
          { name: "Hardware", icon: HardDrive, path: "/internal/api/hardware" },
          { name: "Activations", icon: ShieldCheck, path: "/internal/api/activation" },
          { name: "Renewals", icon: Repeat, path: "/internal/api/licenses/renewals" },
          { name: "Reactivations", icon: RefreshCw, path: "/internal/api/reactivation-requests" },
        ],
      },
      {
        label: "Trials",
        items: [
          { name: "Trial Dashboard", icon: Activity, path: "/internal/api/trials" },
          { name: "Trial Templates", icon: Gift, path: "/internal/api/trial/trial-templates" },
        ],
      },
    ],
  },
  {
    title: "Customer Management",
    icon: Users,
    items: [
      { name: "All Customers", icon: Users, path: "/internal/api/customers" },
    ],
  },
  {
    title: "Sales & Payments",
    icon: ShoppingBag,
    expandable: true,
    groups: [
      {
        label: "Sales",
        items: [
          { name: "Sales Enquiries", icon: Store, path: "/internal/api/sales/enquiries" },
          { name: "Sales Orders", icon: ShoppingBag, path: "/internal/api/sales/orders" },
          { name: "Sales Invoices", icon: Receipt, path: "/internal/api/sales/invoices" },
        ],
      },
      {
        label: "Payments",
        items: [
          { name: "Payment Setup", icon: CreditCard, path: "/internal/api/sales/payment-config" },
        ],
      },
    ],
  },
  {
    title: "Communications",
    icon: MessageCircle,
    expandable: true,
    groups: [
      {
        label: "Broadcast",
        items: [
          { name: "Communications", icon: MessageCircle, path: "/internal/api/communications" },
        ],
      },
      {
        label: "Email",
        items: [
          { name: "Manage Mails", icon: AtSign, path: "/internal/api/communications/manage-mails" },
          { name: "Email Templates", icon: Mail, path: "/internal/api/email/templates" },
        ],
      },
      {
        label: "SMS",
        items: [
          { name: "SMS Configuration", icon: MessageSquare, path: "/internal/api/sales/sms-config" },
          { name: "SMS Templates", icon: FileText, path: "/internal/api/sms/templates" },
        ],
      },
    ],
  },
  {
    title: "Product Management",
    icon: Boxes,
    items: [
      { name: "Product Management", icon: ShoppingBag, path: "/internal/api/products" },
    ],
  },
  {
    title: "Developer Center",
    icon: Code2,
    expandable: true,
    items: [
      { name: "SDK Packages", icon: Boxes, path: "/internal/api/developers/integrations" },
      { name: "API Keys", icon: Code2, path: "/internal/api/public-api/keys" },
      { name: "API Docs", icon: FileText, path: "/internal/api/docs/public-api" },
    ],
  },
  {
    title: "Monitoring",
    icon: Activity,
    items: [
      { name: "Request Center", icon: Inbox, path: "/internal/api/requests" },
      { name: "Audit Logs", icon: ScrollText, path: "/internal/api/audit" },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    items: [
      { name: "Notifications", icon: Bell, path: "/internal/api/notifications" },
    ],
  },
  {
    title: "System",
    icon: Settings,
    items: [
      { name: "Settings", icon: Settings, path: "/internal/api/settings" },
    ],
  },
];

// Preserved active-route logic with deepest-prefix resolution: an EXACT path
// match always wins, otherwise the LONGEST matching prefix is active. This keeps
// existing single-level routes unchanged while a child page (e.g.
// /internal/api/communications/manage-mails) highlights only its own leaf and
// never the parent overview (/internal/api/communications).
function deepestMatch(leaves: NavLeaf[], pathname: string): NavLeaf | null {
  const exact = leaves.find(l => pathname === l.path);
  if (exact) return exact;
  const prefixes = leaves
    .filter(l => l.path !== "/internal/api/dashboard" && pathname.startsWith(l.path))
    .sort((a, b) => b.path.length - a.path.length);
  return prefixes[0] || null;
}

function isPathActive(pathname: string, item: NavLeaf, leaves: NavLeaf[]): boolean {
  return deepestMatch(leaves, pathname)?.path === item.path;
}

function sectionHasActive(section: NavSection, pathname: string): boolean {
  const leaves = [...(section.items || []), ...(section.groups || []).flatMap(g => g.items)];
  return leaves.some(leaf => isPathActive(pathname, leaf, leaves));
}

function NavRow({ item, pathname, leaves }: { item: NavLeaf; pathname: string; leaves: NavLeaf[] }) {
  const isActive = isPathActive(pathname, item, leaves);
  return (
    <Link
      href={item.path}
      className={`ia-nav-item${isActive ? " ia-nav-item--active" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && <span className="ia-nav-accent" />}
      <item.icon size={16} className="ia-nav-icon" />
      <span>{item.name}</span>
    </Link>
  );
}

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
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());

  // Auto-open the section containing the current page (presentation only).
  useEffect(() => {
    setOpenSections(prev => {
      const next = new Set(prev);
      menu.forEach(section => {
        if (section.expandable && sectionHasActive(section, pathname)) {
          next.add(section.title);
        }
      });
      return next;
    });
  }, [pathname]);

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

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
    <aside className="ia-sidebar sticky top-0 w-[280px] min-h-screen flex flex-col bg-[var(--bg-primary)] border-r border-[var(--border-color)] shadow-[0_0_40px_rgba(0,0,0,0.35)] transition-all duration-300">
      {/* Brand Section */}
      <div className="h-[72px] flex items-center px-4 border-b border-[var(--border-color)] group">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden ring-1 ring-[var(--border-color)] flex-shrink-0 transition-transform duration-300 group-hover:scale-105 p-0.5 bg-[var(--bg-secondary)] flex items-center justify-center">
            <Image
              src="/images/icon.png"
              alt="Websmith Digital Icon"
              width={36}
              height={36}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Image
                src="/images/wordmark1.png"
                alt="Websmith Digital"
                width={150}
                height={26}
                className="h-[26px] w-auto object-contain"
              />
              <Sparkles size={12} className="text-blue-400" />
            </div>
            <p className="text-[9px] text-[var(--text-secondary)] leading-tight flex items-center gap-1 mt-0.5">
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
      <div className="ia-sidebar-scroll">
        {menu.map((section) => {
          const active = sectionHasActive(section, pathname);
          const open = openSections.has(section.title);

          return (
            <div
              key={section.title}
              className={`ia-nav-section${active ? " ia-nav-section--active" : ""}`}
            >
              {section.expandable ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    aria-expanded={open}
                    className={`ia-nav-accordion-header${active ? " ia-nav-accordion--active" : ""}`}
                  >
                    {section.icon && <section.icon size={16} className="ia-nav-icon" />}
                    <span className="flex-1 min-w-0 truncate">{section.title}</span>
                    <ChevronRight size={15} className="ia-nav-chevron" />
                  </button>

                  <div className={`ia-nav-collapse${open ? " ia-nav-collapse--open" : ""}`}>
                    <div className="ia-nav-collapse-inner">
                      {section.groups?.map((group) => (
                        <div key={group.label}>
                          <p className="ia-nav-subgroup">{group.label}</p>
                          <div className="ia-nav-children">
                            {group.items.map((item) => (
                              <NavRow key={item.name} item={item} pathname={pathname} leaves={group.items} />
                            ))}
                          </div>
                        </div>
                      ))}
                      {section.items?.map((item) => (
                        <NavRow key={item.name} item={item} pathname={pathname} leaves={section.items!} />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="ia-nav-section-title">
                    {section.icon && <section.icon size={13} className="ia-nav-icon" />}
                    <span>{section.title}</span>
                  </p>
                  {section.items?.map((item) => (
                    <NavRow key={item.name} item={item} pathname={pathname} leaves={section.items!} />
                  ))}
                </>
              )}
            </div>
          );
        })}
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
