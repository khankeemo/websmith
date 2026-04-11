"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AuthUser, getStoredUser, clearAuthSession, getToken, setAuthSession } from "../../lib/auth";
import { 
  LogOut, Bell, User, Settings, Sun, Moon, ChevronRight,
  LayoutDashboard, Briefcase, Users, CheckSquare, Wrench,
  Code2, ShieldCheck, MessageSquare, FileText, CreditCard, LifeBuoy
} from "lucide-react";
import API from "../../core/services/apiService";
import ProfileModal from "./ProfileModal";

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
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
    if (storedUser?.preferences?.theme) {
      setTheme(storedUser.preferences.theme);
    }

    if (storedUser?.role === "admin") {
      fetchUnreadNotifications();
      const interval = setInterval(fetchUnreadNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [pathname]);

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
      const response = await API.get("/admin/notifications");
      const unread = response.data.data.filter((n: any) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (error) {
      // Silently ignore — non-admins will hit 403, which is expected
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

    // Apply theme immediately
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
        preferences: updatedPreferences
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

  // Don't render menu until user role is resolved
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
              { name: "Projects", path: `${basePath}/projects`, icon: Briefcase },
              { name: "Clients", path: `${basePath}/clients`, icon: Users },
              { name: "Tasks", path: `${basePath}/tasks`, icon: CheckSquare },
              { name: "Services", path: `${basePath}/services`, icon: Wrench },
            ],
          },
          {
            title: "TEAM",
            items: [
              { name: "Developers", path: `${basePath}/team`, icon: Code2 },
              { name: "Admins", path: `${basePath}/admins`, icon: ShieldCheck },
              { name: "Messages", path: `${basePath}/messages`, icon: MessageSquare },
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
            items: [
              { name: "Notifications", path: `${basePath}/notifications`, icon: Bell },
              { name: "Settings", path: `${basePath}/settings`, icon: Settings }
            ],
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
              items: [
                { name: "Notifications", path: `${basePath}/notifications`, icon: Bell },
                { name: "Settings", path: `${basePath}/settings`, icon: Settings }
              ],
            },
          ]
        : [
            {
              title: "MAIN",
              items: [{ name: "Dashboard", path: `${basePath}/dashboard`, icon: LayoutDashboard }],
            },
            {
              title: "WORK",
              items: [{ name: "Projects", path: `${basePath}/projects`, icon: Briefcase }],
            },
            {
              title: "SYSTEM",
              items: [
                { name: "Notifications", path: `${basePath}/notifications`, icon: Bell },
                { name: "Settings", path: `${basePath}/settings`, icon: Settings }
              ],
            },
          ];

  return (
    <div
      className={`app-sidebar ${mobileOpen ? "app-sidebar-open" : ""}`}
      style={styles.sidebar}
    >
      {/* LOGO CONTAINER */}
      <div style={styles.logoContainer}>
        {/* MASK CIRCLE - Separate hover */}
        <div 
          style={styles.maskCircle}
          className="logo-image-hover"
        >
          <Image
            src="/images/websmith.png"
            alt="Websmith Logo"
            width={80}
            height={80}
            style={styles.logoImage}
            loading="eager"
            priority={true}
          />
        </div>
        
        {/* WEBSMITH TEXT - Separate hover */}
        <span 
          style={styles.logoText}
          className="logo-text-hover"
        >
          Websmith
        </span>
      </div>

      {/* PROFILE SECTION */}
      <div 
        style={styles.profileSection} 
        onClick={() => router.push(`${basePath}/profile`)}
        className="profile-section-hover"
      >
        <div style={styles.profileAvatar}>
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" style={styles.avatarImg} />
          ) : (
            <User size={20} color="#8e8e93" />
          )}
        </div>
        <div style={styles.profileInfo}>
          <span style={styles.profileName}>{user?.name || "User"}</span>
          <span style={styles.profileEmail}>{user?.email || "user@example.com"}</span>
        </div>
        <ChevronRight size={14} color="#8e8e93" />
      </div>

      {/* MENU */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {item.icon && <item.icon size={18} style={{ opacity: isActive ? 1 : 0.7 }} />}
                  <span>{item.name}</span>
                </div>
                {(item.name === "Clients" || item.name === "Developers" || item.name === "Admins" || item.name === "Notifications") && role === "admin" && unreadCount > 0 && (
                  <span style={styles.badge}>{unreadCount}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <div style={styles.footer}>
        <button 
          onClick={handleLogout} 
          style={styles.logoutButton}
          className="logout-button-hover"
        >
          <LogOut size={16} />
          <span>Log Out</span>
        </button>
      </div>

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdate={(updatedUser) => setUser(updatedUser)}
      />

      {/* Hover Animation Styles */}
      <style>{`
        .app-sidebar {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        /* Image hover - ZOOM IN on enter, ZOOM OUT on leave */
        .logo-image-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        
        .logo-image-hover:hover {
          transform: scale(1.1) translateY(-3px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.12);
        }
        
        /* Text hover - ZOOM IN on enter, ZOOM OUT on leave */
        .logo-text-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          display: inline-block;
        }
        
        .logo-text-hover:hover {
          transform: scale(1.05) translateY(-2px);
        }
 
        .logout-button-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
 
        .logout-button-hover:hover {
          background: #fff5f5 !important;
          color: #ff3b30 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 59, 48, 0.1);
        }

        .profile-section-hover {
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .profile-section-hover:hover {
          background: var(--border-color);
          transform: translateY(-2px);
        }
        .profile-section-hover:active {
          transform: scale(0.98);
        }

        .settings-item-hover {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .settings-item-hover:hover, .settings-link-hover:hover {
          background: var(--border-color);
        }
        @media (max-width: 900px) {
          .app-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 1200;
            width: min(82vw, 320px) !important;
            height: 100dvh !important;
            transform: translateX(-100%);
            box-shadow: none;
          }
          .app-sidebar.app-sidebar-open {
            transform: translateX(0);
            box-shadow: 0 18px 40px rgba(0,0,0,0.18);
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  sidebar: {
    width: "260px",
    height: "100vh",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--border-color)",
  },

  logoContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "40px",
    gap: "12px",
  },

  maskCircle: {
    width: "96px",
    height: "96px",
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
    fontSize: "18px",
    fontWeight: 600,
    letterSpacing: "-0.3px",
    color: "var(--text-primary)",
    textAlign: "center",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  },

  section: {
    marginBottom: "24px",
  },

  sectionTitle: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    marginBottom: "10px",
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
 
  footer: {
    marginTop: "auto",
    paddingTop: "20px",
    borderTop: "1px solid var(--border-color)",
  },
 
  logoutButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "transparent",
    border: "none",
    borderRadius: "12px",
    color: "#ff3b30",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s ease",
  },

  profileSection: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    borderRadius: "16px",
    backgroundColor: "var(--bg-primary)",
    marginBottom: "24px",
    gap: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    border: "1px solid var(--border-color)",
  },
  profileAvatar: {
    width: "40px",
    height: "40px",
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
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  profileEmail: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  settingsItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: "12px",
    marginBottom: "4px",
    color: "var(--text-primary)",
    transition: "all 0.2s",
  },
  settingsLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    fontWeight: 500,
  },
  toggleSwitch: {
    width: "32px",
    height: "18px",
    borderRadius: "10px",
    padding: "2px",
    transition: "background-color 0.3s",
    display: "flex",
    alignItems: "center",
  },
  toggleThumb: {
    width: "14px",
    height: "14px",
    backgroundColor: "#ffffff",
    borderRadius: "50%",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 0.3s",
  },
};
