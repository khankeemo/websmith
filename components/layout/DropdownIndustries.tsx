"use client";

import Link from "next/link";
import { Landmark, ShoppingCart, HeartPulse, Cloud, Truck, ArrowRight, type LucideIcon } from "lucide-react";

type IndustryItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
};

const INDUSTRIES: IndustryItem[] = [
  {
    title: "FinTech & Banking",
    description: "High-security payment gateways & wallet systems",
    icon: Landmark,
    href: "/services",
  },
  {
    title: "E-Commerce & Retail",
    description: "Multi-vendor marketplaces & high-speed checkout",
    icon: ShoppingCart,
    href: "/services",
  },
  {
    title: "Healthcare & MedTech",
    description: "Compliant patient portals & telehealth systems",
    icon: HeartPulse,
    href: "/services",
  },
  {
    title: "Enterprise SaaS & B2B",
    description: "Multi-tenant platforms & subscription billing",
    icon: Cloud,
    href: "/services",
  },
  {
    title: "Logistics & Supply Chain",
    description: "Fleet tracking & automated warehouse ERP",
    icon: Truck,
    href: "/services",
  },
];

export default function DropdownIndustries({
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
        width: "420px",
        maxWidth: "92vw",
        backgroundColor: isDark ? "#0d1322" : "#ffffff",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
        borderRadius: "18px",
        boxShadow: isDark
          ? "0 28px 70px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)"
          : "0 24px 60px -12px rgba(0, 0, 0, 0.15), 0 8px 24px -6px rgba(0, 0, 0, 0.06)",
        padding: "10px",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {INDUSTRIES.map((industry, index) => {
          const Icon = industry.icon;
          return (
            <Link
              key={index}
              href={industry.href}
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "12px",
                textDecoration: "none",
                backgroundColor: "transparent",
                transition: "all 0.15s ease",
              }}
              className="wsd-industry-row"
            >
              <div
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
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: isDark ? "#f8fafc" : "#0f172a",
                    lineHeight: 1.25,
                  }}
                >
                  {industry.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(100, 116, 139, 0.9)",
                    lineHeight: 1.3,
                    marginTop: "2px",
                  }}
                >
                  {industry.description}
                </div>
              </div>
              <ArrowRight size={14} style={{ opacity: 0.4, color: isDark ? "#ffffff" : "#0f172a" }} />
            </Link>
          );
        })}
      </div>
      <style>{`
        .wsd-industry-row:hover {
          background-color: ${isDark ? "rgba(37, 99, 235, 0.12)" : "rgba(37, 99, 235, 0.06)"} !important;
          transform: translateX(2px);
        }
      `}</style>
    </div>
  );
}
