// FILE: components/layout/MegaMenuServices.tsx
// PURPOSE: Dynamic Services mega menu connected to CMS API

"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Lightbulb, Code2 } from "lucide-react";
import LucideIcon from "@/components/shared/LucideIcon";
import { getPublicServiceCategories } from "@/lib/cms/cmsService";
import type { CmsServiceCategory } from "@/lib/cms/types";

export default function MegaMenuServices({
  isDark,
  onClose,
}: {
  isDark: boolean;
  onClose: () => void;
}) {
  const [categories, setCategories] = useState<CmsServiceCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);
  const [offsetStyle, setOffsetStyle] = useState<{ left?: string }>({ left: "0px" });

  useEffect(() => {
    getPublicServiceCategories({ menuOnly: true })
      .then((data) => {
        setCategories(data || []);
        if (data && data.length > 0) {
          setActiveCategoryId(data[0]._id || data[0].slug || "");
        }
      })
      .catch((err) => {
        console.warn("Failed to load mega menu services:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const activeCategory =
    categories.find((c) => c._id === activeCategoryId || c.slug === activeCategoryId) ||
    categories[0] ||
    null;

  useEffect(() => {
    const adjustPosition = () => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const margin = 16;

      if (rect.right > viewportWidth - margin) {
        const overflow = rect.right - (viewportWidth - margin);
        setOffsetStyle({ left: `-${overflow}px` });
      } else if (rect.left < margin) {
        const deltaX = margin - rect.left;
        setOffsetStyle({ left: `${deltaX}px` });
      }
    };

    adjustPosition();
    window.addEventListener("resize", adjustPosition);
    return () => window.removeEventListener("resize", adjustPosition);
  }, [categories]);

  return (
    <div
      ref={menuRef}
      className="wsd-mega-menu"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        ...offsetStyle,
        width: "min(860px, calc(100vw - 32px))",
        backgroundColor: isDark ? "rgba(13, 19, 34, 0.94)" : "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(226, 232, 240, 0.9)",
        borderRadius: "20px",
        boxShadow: isDark
          ? "0 28px 70px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)"
          : "0 24px 60px -12px rgba(0, 0, 0, 0.15), 0 8px 24px -6px rgba(0, 0, 0, 0.06)",
        overflow: "hidden",
        zIndex: 1400,
      }}
    >
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: isDark ? "#94a3b8" : "#64748b" }}>
          Loading capabilities...
        </div>
      ) : categories.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: isDark ? "#94a3b8" : "#64748b" }}>
          No services configured yet.
        </div>
      ) : (
        /* Main 2-Column Area */
        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", minHeight: "340px" }}>
          {/* Left Category Tabs */}
          <div
            style={{
              padding: "16px 12px",
              borderRight: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.01)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {categories.map((category) => {
              const currentId = category._id || category.slug;
              const isActive = currentId === activeCategoryId || category.slug === activeCategoryId;
              return (
                <button
                  key={currentId}
                  type="button"
                  onMouseEnter={() => setActiveCategoryId(currentId || "")}
                  onClick={() => setActiveCategoryId(currentId || "")}
                  className={`wsd-nav-category-tab ${isActive ? "wsd-nav-category-tab-active" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    fontSize: "13.5px",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive
                      ? "#ffffff"
                      : isDark
                      ? "rgba(255, 255, 255, 0.75)"
                      : "rgba(15, 23, 42, 0.8)",
                    backgroundColor: isActive ? "#2563eb" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <LucideIcon name={category.icon} size={15} />
                    {category.name}
                    {category.badge && (
                      <span
                        style={{
                          display: "inline-block",
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          backgroundColor: "#10b981",
                          boxShadow: "0 0 8px #10b981",
                        }}
                      />
                    )}
                  </span>
                  {isActive && <ArrowRight size={14} style={{ opacity: 0.9 }} />}
                </button>
              );
            })}
          </div>

          {/* Right Service Cards Grid */}
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignContent: "start" }}>
            {activeCategory && activeCategory.services && activeCategory.services.length > 0 ? (
              activeCategory.services.map((service, idx) => {
                const href = `/services?tab=${activeCategory.slug || "engineering"}#${service.slug || ""}`;
                return (
                  <Link
                    key={service._id || idx}
                    href={href}
                    onClick={onClose}
                    className="wsd-nav-service-card"
                    style={{
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.04)",
                    }}
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
                      <LucideIcon name={service.icon} size={19} fallback={Code2} />
                    </div>
                    <div>
                      <div
                        className="wsd-nav-card-title"
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 600,
                          color: isDark ? "#f8fafc" : "#0f172a",
                          lineHeight: 1.3,
                          marginBottom: "3px",
                        }}
                      >
                        {service.name}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(100, 116, 139, 0.9)",
                          lineHeight: 1.35,
                        }}
                      >
                        {service.shortDescription}
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div style={{ gridColumn: "1 / -1", padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                No active subcategories configured for this category.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Bar: Explore all services */}
      <div
        style={{
          padding: "12px 24px",
          borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
          backgroundColor: isDark ? "rgba(0, 0, 0, 0.25)" : "rgba(248, 250, 252, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.18)" : "rgba(245, 158, 11, 0.12)",
              color: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lightbulb size={16} />
          </div>
          <div>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: isDark ? "#ffffff" : "#0f172a",
                marginRight: "6px",
              }}
            >
              Explore all capabilities
            </span>
            <span
              style={{
                fontSize: "12px",
                color: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(100, 116, 139, 0.8)",
              }}
            >
              — Custom software engineering, enterprise ERP, and universal licensing.
            </span>
          </div>
        </div>

        <Link
          href="/services"
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            borderRadius: "9999px",
            fontSize: "12.5px",
            fontWeight: 600,
            textDecoration: "none",
            color: isDark ? "#ffffff" : "#0f172a",
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.12)",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
            transition: "all 0.15s ease",
          }}
        >
          View All Services <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
