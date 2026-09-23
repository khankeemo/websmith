// FILE: components/layout/DropdownIndustries.tsx
// PURPOSE: Dynamic Industries dropdown mega menu connected to CMS API

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import LucideIcon from "@/components/shared/LucideIcon";
import { getPublicIndustries } from "@/lib/cms/cmsService";
import type { CmsIndustry } from "@/lib/cms/types";

export default function DropdownIndustries({
  isDark,
  onClose,
}: {
  isDark: boolean;
  onClose: () => void;
}) {
  const [industries, setIndustries] = useState<CmsIndustry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicIndustries()
      .then((data) => {
        setIndustries(data || []);
      })
      .catch((err) => {
        console.warn("DropdownIndustries fetch error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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
        {loading && (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b" }}>
            Loading sectors...
          </div>
        )}

        {!loading && industries.length === 0 && (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b" }}>
            No industries configured yet.
          </div>
        )}

        {industries.map((industry, index) => {
          const href = `/industries?sector=${industry.slug}`;
          return (
            <Link
              key={industry._id || index}
              href={href}
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
                <LucideIcon name={industry.icon} size={18} fallback={Landmark} />
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
                  {industry.name}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(100, 116, 139, 0.9)",
                    lineHeight: 1.3,
                    marginTop: "2px",
                  }}
                >
                  {industry.shortDescription}
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
