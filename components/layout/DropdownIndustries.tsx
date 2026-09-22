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
    href: "/industries?sector=fintech",
  },
  {
    title: "E-Commerce & Retail",
    description: "Multi-vendor marketplaces & high-speed checkout",
    icon: ShoppingCart,
    href: "/industries?sector=ecommerce",
  },
  {
    title: "Healthcare & MedTech",
    description: "Compliant patient portals & telehealth systems",
    icon: HeartPulse,
    href: "/industries?sector=healthcare",
  },
  {
    title: "Enterprise SaaS & B2B",
    description: "Multi-tenant platforms & subscription billing",
    icon: Cloud,
    href: "/industries?sector=saas",
  },
  {
    title: "Logistics & Supply Chain",
    description: "Fleet tracking & automated warehouse ERP",
    icon: Truck,
    href: "/industries?sector=logistics",
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
        {INDUSTRIES.map((industry, index) => {
          const Icon = industry.icon;
          return (
            <Link
              key={index}
              href={industry.href}
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
                  className="wsd-nav-row-title"
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
              <ArrowRight size={14} className="wsd-nav-arrow" style={{ opacity: 0.4, color: isDark ? "#ffffff" : "#0f172a" }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
