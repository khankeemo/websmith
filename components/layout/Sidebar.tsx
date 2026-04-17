"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AuthUser, getStoredUser, clearAuthSession, getToken, setAuthSession } from "../../lib/auth";
import {
  LogOut,
  Bell,
  User,
  Sun,
  Moon,
  ChevronRight,
  LayoutDashboard,
  Briefcase,
  Users,
  CheckSquare,
  Wrench,
  Code2,
  ShieldCheck,
  MessageSquare,
  FileText,
  CreditCard,
  LifeBuoy,
} from "lucide-react";
import API from "../../core/services/apiService";
import { getUnreadCount } from "../../core/services/notificationService";

export default function Sidebar({
  mobileOpen = false,
  onNavigate,
}: {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
    if (storedUser?.preferences?.theme) {
      setTheme(storedUser.preferences.theme);
    }

    if (storedUser?.role === "admin" || storedUser?.role === "client" || storedUser?.role === "developer") {
      fetchUnreadNotifications();
      const interval = setInterval(fetchUnreadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [pathname]);

  useEffect(() => {
    const syncLiveProfile = async () => {
      try {
        const response = await API.get("/users/profile");
        const liveUser = response.data.user || response.data.data;
        if (!liveUser) return;

        const token = getToken();
        if (token) {
          setAuthSession(token, liveUser);
        }
        setUser(liveUser);
      } catch {
        // Keep the last known session snapshot if profile refresh fails.
      }
    };

    syncLiveProfile();
  }, []);

  useEffect(() => {
    const handleProfileUpdate = () => {
      const updatedUser = getStoredUser();
      setUser(updatedUser);
    };

    window.addEventListener("userProfileUpdated", handleProfileUpdate);
    return () => window.removeEventListener("userProfileUpdated", handleProfileUpdate);
  }, []);

  const fetchUnreadNotifications = async () => {
    try {
      const unread = await getUnreadCount();
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  const toggleTheme = async () => {
    if (!user) return;
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark-theme");
    } else {
      document.documentElement.classList.remove("dark-theme");
    }

    try {
      const updatedPreferences = {
        ...user.preferences,
        theme: newTheme as "light" | "dark",
      };

      const response = await API.put("/users/update", {
        preferences: updatedPreferences,
      });

      if (response.data.success) {
        const updatedUser = { ...user, preferences: updatedPreferences };
        const token = getToken();
        if (token) {
          setAuthSession(token, updatedUser);
        }
        setUser(updatedUser);
      }
    } catch (error) {
      console.error("Failed to update theme preference:", error);
    }
  };

  const role = user?.role || null;
  const basePath = role === "admin" ? "/admin" : role === "client" ? "/client" : "/developer";

  if (!role) return <div style={styles.sidebar}></div>;

  const menu =
    role === "admin"
      ? [
          {
            title: "MAIN",
            items: [{ name: "Dashboard", path: `${basePath}/dashboard`, icon: LayoutDashboard }],
          },
          {
            title: "WORK",
            items: [
              { name: "Clients", path: `${basePath}/clients`, icon: Users },
              { name: "Projects", path: `${basePath}/projects`, icon: Briefcase },
              { name: "Tasks", path: `${basePath}/tasks`, icon: CheckSquare },
              { name: "Services", path: `${basePath}/services`, icon: Wrench },
            ],
          },
          {
            title: "TEAM",
            items: [
              { name: "Developers", path: `${basePath}/team`, icon: Code2 },
              { name: "Admins", path: `${basePath}/admins`, icon: ShieldCheck },
              { name: "Queries", path: `${basePath}/messages`, icon: MessageSquare },
            ],
          },
          {
            title: "FINANCE",
            items: [
              { name: "Invoices", path: `${basePath}/invoices`, icon: FileText },
              { name: "Payments", path: `${basePath}/payments`, icon: CreditCard },
            ],
          },
          {
            title: "SYSTEM",
            items: [{ name: "Notifications", path: `${basePath}/notifications`, icon: Bell }],
          },
        ]
      : role === "client"
        ? [
            {
              title: "MAIN",
              items: [{ name: "Dashboard", path: `${basePath}/dashboard`, icon: LayoutDashboard }],
            },
            {
              title: "WORK",
              items: [
                { name: "My Projects", path: `${basePath}/projects`, icon: Briefcase },
                { name: "Payments", path: `${basePath}/payments`, icon: CreditCard },
                { name: "Query", path: `${basePath}/tickets`, icon: LifeBuoy },
                { name: "Invoices", path: `${basePath}/invoices`, icon: FileText },
              ],
            },
            {
              title: "SYSTEM",
              items: [{ name: "Notifications", path: `${basePath}/notifications`, icon: Bell }],
            },
          ]
        : [
            {
              title: "MAIN",
              items: [{ name: "Dashboard", path: `${basePath}/dashboard`, icon: LayoutDashboard }],
            },
            {
              title: "WORK",
              items: [
                { name: "Projects", path: `${basePath}/projects`, icon: Briefcase },
                { name: "Tasks", path: `${basePath}/tasks`, icon: CheckSquare },
              ],
            },
            {
              title: "SYSTEM",
              items: [{ name: "Notifications", path: `${basePath}/notifications`, icon: Bell }],
            },
          ];

  return (
    <div className={`app-sidebar ${mobileOpen ? "app-sidebar-open" : ""}`} style={styles.sidebar}>
      <div style={styles.logoContainer}>
        <div style={styles.maskCircle} className="logo-image-hover">
          <Image
            src="/images/websmith.png"
            alt="Websmith Logo"
            width={72}
            height={72}
            style={styles.logoImage}
            loading="eager"
            priority={true}
          />
        </div>
        <span style={styles.logoText} className="logo-text-hover">
          Websmith
        </span>
      </div>

      <div
        style={styles.profileSection}
        onClick={() => router.push(`${basePath}/profile`)}
        className="profile-section-hover"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`${basePath}/profile`);
          }
        }}
      >
        <div style={styles.profileAvatar}>
          {user?.avatar ? (
            <img src={user.avatar} alt="" style={styles.avatarImg} />
          ) : (
            <User size={18} color="#8e8e93" />
          )}
        </div>
        <div style={styles.profileInfo}>
          <span style={styles.profileName}>{user?.name || "User"}</span>
          <span style={styles.profileEmail}>{user?.email || "user@example.com"}</span>
        </div>
        <ChevronRight size={14} color="#8e8e93" />
      </div>

      <div style={styles.quickActions}>
        <button type="button" onClick={toggleTheme} style={styles.themeToggleButton} aria-label="Toggle theme">
          {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme === "light" ? "Dark" : "Light"}</span>
        </button>
        <button type="button" onClick={handleLogout} style={styles.logoutButton} className="logout-button-hover">
          <LogOut size={14} />
          <span>Log Out</span>
        </button>
      </div>

      {menu.map((section) => (
        <div key={section.title} style={styles.section}>
          <p style={styles.sectionTitle}>{section.title}</p>

          {section.items.map((item) => {
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.name}
                href={item.path}
                onClick={onNavigate}
                style={{
                  ...styles.link,
                  ...(isActive ? styles.activeLink : {}),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "var(--bg-primary)";
                    e.currentTarget.style.transform = "translateX(4px)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                    e.currentTarget.style.color = "var(--text-primary)";
                    e.currentTarget.style.borderLeft = "3px solid var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.color = "var(--text-secondary)";
                    e.currentTarget.style.borderLeft = "3px solid transparent";
                  }
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.98)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "translateX(4px)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {item.icon && <item.icon size={18} style={{ opacity: isActive ? 1 : 0.7 }} />}
                  <span>{item.name}</span>
                </div>
                {item.name === "Notifications" && unreadCount > 0 && (
                  <span style={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <style>{`
        .app-sidebar {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          min-height: 0;
          align-self: stretch;
        }
        .logo-image-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .logo-image-hover:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.12);
        }
        .logo-text-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          display: inline-block;
        }
        .logo-text-hover:hover {
          transform: scale(1.04) translateY(-1px);
        }
        .logout-button-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .logout-button-hover:hover {
          background: #fff5f5 !important;
          color: #ff3b30 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 59, 48, 0.1);
        }
        .profile-section-hover {
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .profile-section-hover:hover {
          background: var(--border-color);
          transform: translateY(-1px);
        }
        .profile-section-hover:active {
          transform: scale(0.98);
        }
        @media (max-width: 900px) {
          .app-sidebar {
            position: fixed;
            top: 69px;
            left: 0;
            bottom: 0;
            z-index: 1200;
            width: min(82vw, 320px) !important;
            height: calc(100dvh - 69px) !important;
            max-height: calc(100dvh - 69px) !important;
            transform: translateX(-100%);
            box-shadow: none;
            overflow-x: hidden;
            overflow-y: auto;
            border-top: 1px solid var(--border-color);
          }
          .app-sidebar.app-sidebar-open {
            transform: translateX(0);
            box-shadow: 0 18px 40px rgba(0,0,0,0.18);
          }
        }
        @media (max-width: 480px) {
          .app-sidebar {
            width: min(88vw, 320px) !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  sidebar: {
    width: "260px",
    height: "100%",
    maxHeight: "100%",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    padding: "16px 14px 20px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--border-color)",
    minWidth: "260px",
    minHeight: 0,
    boxSizing: "border-box",
    alignSelf: "stretch",
  },

  profileSection: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: "12px",
    backgroundColor: "var(--bg-primary)",
    marginBottom: "8px",
    marginTop: 0,
    gap: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    border: "1px solid var(--border-color)",
    flexShrink: 0,
  },
  profileAvatar: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    backgroundColor: "var(--bg-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  profileInfo: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  profileEmail: {
    fontSize: "10px",
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  quickActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
    marginBottom: "14px",
    flexShrink: 0,
  },

  logoutButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "7px 8px",
    background: "transparent",
    border: "1px solid rgba(255, 59, 48, 0.18)",
    borderRadius: "10px",
    color: "#ff3b30",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  themeToggleButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "7px 8px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "10px",
    color: "var(--text-primary)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },

  logoContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
    gap: "8px",
    flexShrink: 0,
  },

  maskCircle: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "var(--bg-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  },

  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "50%",
  },

  logoText: {
    fontSize: "16px",
    fontWeight: 600,
    letterSpacing: "-0.3px",
    color: "var(--text-primary)",
    textAlign: "center",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  },

  section: {
    marginBottom: "18px",
  },

  sectionTitle: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    marginBottom: "8px",
    paddingLeft: "12px",
    letterSpacing: "0.8px",
    fontWeight: 500,
  },

  link: {
    padding: "10px 12px",
    marginBottom: "4px",
    borderRadius: "10px",
    textDecoration: "none",
    color: "var(--text-secondary)",
    fontSize: "14px",
    fontWeight: 500,
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    borderLeft: "3px solid transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    backgroundColor: "#FF3B30",
    color: "#FFFFFF",
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: "10px",
    minWidth: "18px",
    textAlign: "center",
  },

  activeLink: {
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    borderLeft: "3px solid var(--text-primary)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    fontWeight: 600,
  },
};
