"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AuthUser, getStoredUser, clearAuthSession } from "../../lib/auth";
import { LogOut, Bell } from "lucide-react";
import API from "../../core/services/apiService";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);

    if (storedUser?.role === "admin") {
      fetchUnreadNotifications();
      const interval = setInterval(fetchUnreadNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [pathname]);

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

  const role = user?.role || null;
  const basePath = role === "admin" ? "/admin" : role === "client" ? "/client" : "/developer";

  // Don't render menu until user role is resolved
  if (!role) return <div style={styles.sidebar}></div>;

  const menu =
    role === "admin"
      ? [
          {
            title: "MAIN",
            items: [{ name: "Dashboard", path: `${basePath}/dashboard` }],
          },
          {
            title: "WORK",
            items: [
              { name: "Projects", path: `${basePath}/projects` },
              { name: "Clients", path: `${basePath}/clients` },
              { name: "Tasks", path: `${basePath}/tasks` },
              { name: "Services", path: `${basePath}/services` },
            ],
          },
          {
            title: "TEAM",
            items: [
              { name: "Team", path: `${basePath}/team` },
              { name: "Messages", path: `${basePath}/messages` },
            ],
          },
          {
            title: "FINANCE",
            items: [
              { name: "Invoices", path: `${basePath}/invoices` },
              { name: "Payments", path: `${basePath}/payments` },
            ],
          },
          {
            title: "SYSTEM",
            items: [
              { name: "Notifications", path: `${basePath}/notifications` },
              { name: "Settings", path: `${basePath}/settings` }
            ],
          },
        ]
      : role === "client"
        ? [
            {
              title: "MAIN",
              items: [{ name: "Dashboard", path: `${basePath}/dashboard` }],
            },
            {
              title: "WORK",
              items: [
                { name: "My Projects", path: `${basePath}/projects` },
                { name: "Payments", path: `${basePath}/payments` },
                { name: "Query", path: `${basePath}/tickets` },
              ],
            },
            {
              title: "SYSTEM",
              items: [{ name: "Profile", path: `${basePath}/profile` }],
            },
          ]
        : [
            {
              title: "MAIN",
              items: [{ name: "Dashboard", path: `${basePath}/dashboard` }],
            },
            {
              title: "WORK",
              items: [{ name: "Projects", path: `${basePath}/projects` }],
            },
            {
              title: "SYSTEM",
              items: [{ name: "Profile", path: `${basePath}/profile` }],
            },
          ];

  return (
    <div style={styles.sidebar}>
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
                style={{
                  ...styles.link,
                  ...(isActive ? styles.activeLink : {}),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#e8e8ed";
                    e.currentTarget.style.transform = "translateX(4px)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                    e.currentTarget.style.color = "#000";
                    e.currentTarget.style.borderLeft = "3px solid #000";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.color = "#555";
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
                {item.name}
                {(item.name === "Clients" || item.name === "Notifications") && role === "admin" && unreadCount > 0 && (
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

      {/* Hover Animation Styles */}
      <style>{`
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
    background: "#f5f5f7",
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
    color: "#1d1d1f",
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
    color: "#555",
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
    background: "#ffffff",
    color: "#000",
    borderLeft: "3px solid #000",
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
};
