"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function Sidebar() {
  const pathname = usePathname();

  const menu = [
    {
      title: "MAIN",
      items: [{ name: "Dashboard", path: "/dashboard" }],
    },
    {
      title: "WORK",
      items: [
        { name: "Projects", path: "/projects" },
        { name: "Clients", path: "/clients" },
        { name: "Tasks", path: "/tasks" },
      ],
    },
    {
      title: "TEAM",
      items: [
        { name: "Team", path: "/team" },
        { name: "Messages", path: "/messages" },
      ],
    },
    {
      title: "FINANCE",
      items: [
        { name: "Invoices", path: "/invoices" },
        { name: "Payments", path: "/payments" },
      ],
    },
    {
      title: "SYSTEM",
      items: [{ name: "Settings", path: "/settings" }],
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
              </Link>
            );
          })}
        </div>
      ))}

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
      `}</style>
    </div>
  );
}

const styles: any = {
  sidebar: {
    width: "260px",
    height: "100vh",
    background: "#f5f5f7",
    color: "#1d1d1f",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #e8e8ed",
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
    color: "#86868b",
    marginBottom: "10px",
    paddingLeft: "12px",
    letterSpacing: "0.8px",
    fontWeight: 500,
  },

  link: {
    display: "block",
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
  },

  activeLink: {
    background: "#ffffff",
    color: "#000",
    borderLeft: "3px solid #000",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    fontWeight: 600,
  },
};