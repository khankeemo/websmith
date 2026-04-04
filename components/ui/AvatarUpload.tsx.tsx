"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const menu = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Projects", path: "/projects" },
    { name: "Clients", path: "/clients" },
    { name: "Tasks", path: "/tasks" },
    { name: "Team", path: "/team" },
    { name: "Invoices", path: "/invoices" },
  ];

  return (
    <div
      style={{
        width: "250px",
        height: "100vh",
        background: "#0b0b0c",
        color: "#fff",
        padding: "30px 20px",
        borderRight: "1px solid #1a1a1a",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 🔥 Brand */}
      <h2
        style={{
          marginBottom: "35px",
          fontWeight: 600,
          letterSpacing: "0.5px",
          color: "#ffffff",
        }}
      >
        Websmith
      </h2>

      {/* 🔥 Menu */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {menu.map((item) => {
          const active = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 500,

                // TEXT
                color: active ? "#ffffff" : "#8e8e93",

                // BACKGROUND
                background: active ? "#1c1c1e" : "transparent",

                // LEFT BORDER (APPLE STYLE)
                borderLeft: active
                  ? "3px solid #ffffff"
                  : "3px solid transparent",

                // ALIGNMENT
                paddingLeft: "12px",

                // ANIMATION
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "#161617";
                  e.currentTarget.style.color = "#ffffff";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#8e8e93";
                }
              }}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}