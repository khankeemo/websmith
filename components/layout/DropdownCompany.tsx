"use client";

import Link from "next/link";
import { Info, Briefcase, Users2, BookOpen, FileText, ArrowRight, type LucideIcon } from "lucide-react";

type CompanyItem = {
  title: string;
  description: string;
  badge?: string;
  icon: LucideIcon;
  href: string;
};

const COMPANY_ITEMS: CompanyItem[] = [
  {
    title: "About WebSmith",
    description: "Our engineering philosophy & operational transparency",
    icon: Info,
    href: "/about",
  },
  {
    title: "Careers & Culture",
    description: "Join our global distributed engineering team",
    badge: "Hiring",
    icon: Briefcase,
    href: "/careers",
  },
  {
    title: "Core Team & Developers",
    description: "Meet the technical architects behind our products",
    icon: Users2,
    href: "/about#team",
  },
  {
    title: "Engineering Blog",
    description: "Deep-dives into cloud architecture & system design",
    icon: BookOpen,
    href: "/blog",
  },
  {
    title: "Documentation",
    description: "Platform APIs, SDK guides, and reference specs",
    icon: FileText,
    href: "/documentation",
  },
];

export default function DropdownCompany({
  isDark,
  onClose,
}: {
  isDark: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="wsd-mega-menu"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        width: "410px",
        maxWidth: "92vw",
        backgroundColor: isDark ? "rgba(13, 19, 34, 0.92)" : "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(226, 232, 240, 0.9)",
        borderRadius: "18px",
        boxShadow: isDark
          ? "0 28px 70px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)"
          : "0 24px 60px -12px rgba(0, 0, 0, 0.15), 0 8px 24px -6px rgba(0, 0, 0, 0.06)",
        padding: "10px",
        zIndex: 1400,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {COMPANY_ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={index}
              href={item.href}
              onClick={onClose}
              className="wsd-nav-menu-row"
            >
              <div
                className="wsd-nav-icon-box"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
                  color: "#3b82f6",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: isDark ? "#f8fafc" : "#0f172a",
                    lineHeight: 1.25,
                  }}
                >
                  <span className="wsd-nav-row-title">{item.title}</span>
                  {item.badge && (
                    <span
                      style={{
                        padding: "1px 7px",
                        borderRadius: "9999px",
                        fontSize: "10px",
                        fontWeight: 700,
                        backgroundColor: "#10b981",
                        color: "#ffffff",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(100, 116, 139, 0.9)",
                    lineHeight: 1.3,
                    marginTop: "2px",
                  }}
                >
                  {item.description}
                </div>
              </div>
              <ArrowRight size={14} className="wsd-nav-arrow" style={{ opacity: 0.4, color: isDark ? "#ffffff" : "#0f172a" }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
