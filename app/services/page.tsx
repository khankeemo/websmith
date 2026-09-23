"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Check,
  ChevronRight,
  Layers,
} from "lucide-react";
import { usePublicTheme } from "../providers/PublicThemeProvider";
import { useLeadFunnel } from "../providers/LeadFunnelProvider";
import { getPublicServiceCategories } from "@/lib/cms/cmsService";
import type { CmsServiceCategory, CmsServiceItem } from "@/lib/cms/types";
import LucideIcon from "@/components/shared/LucideIcon";

function ServicesContent() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || searchParams.get("category");

  const [categories, setCategories] = useState<CmsServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    let isCancelled = false;
    async function loadServices() {
      try {
        setLoading(true);
        const data = await getPublicServiceCategories();
        if (!isCancelled) {
          const list = Array.isArray(data) ? data : [];
          setCategories(list);
          if (tabParam && (tabParam === "all" || list.some((c) => c.slug === tabParam))) {
            setActiveTab(tabParam);
          }
        }
      } catch (err) {
        console.error("Failed to load CMS service categories:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    loadServices();
    return () => {
      isCancelled = true;
    };
  }, [tabParam]);

  const filteredCategories = activeTab === "all"
    ? categories
    : categories.filter((c) => c.slug === activeTab);

  const processSteps = [
    {
      number: "01",
      title: "Discovery & Architecture Blueprint",
      description: "We analyze your exact business model, data flows, and technical constraints to draft a comprehensive architecture blueprint and project roadmap.",
    },
    {
      number: "02",
      title: "Milestone-Based Agile Sprints",
      description: "We work in transparent two-week sprints with staging demo builds, giving you complete visibility into progress, code quality, and deliverables.",
    },
    {
      number: "03",
      title: "Automated QA & Security Hardening",
      description: "Every codebase undergoes rigorous automated unit tests, end-to-end integration tests, and security penetration checks before release.",
    },
    {
      number: "04",
      title: "Turnkey Deployment & SLA Operations",
      description: "Zero-downtime production deployment, telemetry observability, and 24/7 technical monitoring backed by formal enterprise uptime SLAs.",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "transparent",
        color: isDark ? "#f8fafc" : "#0f172a",
        paddingTop: "48px",
        paddingBottom: "80px",
      }}
    >
      {/* Hero Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 64px)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "9999px",
            backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
            border: isDark ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid rgba(37, 99, 235, 0.2)",
            color: "#3b82f6",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "20px",
          }}
        >
          <Sparkles size={14} /> Full-Cycle Engineering &amp; Architecture
        </div>

        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 54px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: "20px",
          }}
        >
          High-Velocity Software{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              textShadow: "none",
            }}
          >
            Capabilities
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 19px)",
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
            maxWidth: "760px",
            margin: "0 auto 36px",
            lineHeight: 1.65,
          }}
        >
          From bespoke enterprise ERP platforms and node-locked licensing SDKs to autonomous AI agents and low-latency cloud infrastructure, our senior engineering studio builds software designed to dominate.
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "52px",
          }}
        >
          <button
            type="button"
            onClick={() => openLeadServicesModal()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "13px 28px",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 20px -4px rgba(37, 99, 235, 0.4)",
              transition: "all 0.15s ease",
            }}
          >
            Request Architecture Scope <ArrowRight size={16} />
          </button>

          <Link
            href="/portfolio"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "13px 26px",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 600,
              color: isDark ? "#ffffff" : "#0f172a",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
              textDecoration: "none",
              transition: "all 0.15s ease",
            }}
          >
            Explore Case Studies
          </Link>
        </div>

        {/* Filter Tabs */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "52px" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  width: "120px",
                  height: "36px",
                  borderRadius: "9999px",
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#e2e8f0",
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px",
              borderRadius: "9999px",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              boxShadow: isDark ? "none" : "0 4px 16px -2px rgba(0, 0, 0, 0.04)",
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: "52px",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              style={{
                padding: "8px 18px",
                borderRadius: "9999px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                backgroundColor: activeTab === "all" ? "#2563eb" : "transparent",
                color: activeTab === "all"
                  ? "#ffffff"
                  : isDark
                  ? "rgba(255, 255, 255, 0.7)"
                  : "rgba(15, 23, 42, 0.7)",
                transition: "all 0.15s ease",
              }}
            >
              All Capabilities
            </button>
            {categories.map((cat) => {
              const isActive = activeTab === cat.slug;
              return (
                <button
                  key={cat._id || cat.slug}
                  type="button"
                  onClick={() => setActiveTab(cat.slug)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: isActive ? "#2563eb" : "transparent",
                    color: isActive
                      ? "#ffffff"
                      : isDark
                      ? "rgba(255, 255, 255, 0.7)"
                      : "rgba(15, 23, 42, 0.7)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Service Categories Grid */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto 80px", padding: "0 clamp(20px, 4vw, 64px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {filteredCategories.map((category) => {
            const subServices = category.services || [];
            // Extract unique tech stack tags across subservices
            const allTech: string[] = Array.from(
              new Set(subServices.flatMap((s) => s.techStack || []))
            ).slice(0, 8);

            return (
              <div
                key={category._id || category.slug}
                id={category.slug}
                style={{
                  scrollMarginTop: "120px",
                  borderRadius: "24px",
                  padding: "36px clamp(24px, 3.5vw, 44px)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                  gap: "32px",
                  alignItems: "flex-start",
                }}
                className="wsd-service-pillar-card wsd-unified-card"
              >
                {/* Left Overview */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
                        color: "#3b82f6",
                      }}
                    >
                      <LucideIcon name={category.icon || "Layers"} size={22} color="#3b82f6" />
                    </div>
                    {category.badge && (
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "9999px",
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.03em",
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
                          color: isDark ? "rgba(255, 255, 255, 0.8)" : "#334155",
                        }}
                      >
                        {category.badge}
                      </span>
                    )}
                  </div>

                  <h2
                    style={{
                      fontSize: "clamp(22px, 3vw, 26px)",
                      fontWeight: 700,
                      lineHeight: 1.3,
                      marginBottom: "12px",
                      color: isDark ? "#ffffff" : "#0f172a",
                    }}
                  >
                    {category.name}
                  </h2>

                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: 1.6,
                      color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
                      marginBottom: "24px",
                    }}
                  >
                    {category.description}
                  </p>

                  {/* Subservices Badges */}
                  {subServices.length > 0 && (
                    <div style={{ marginBottom: "20px" }}>
                      <div
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: isDark ? "rgba(255, 255, 255, 0.45)" : "#64748b",
                          marginBottom: "10px",
                        }}
                      >
                        Specialized Solutions ({subServices.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {subServices.map((sub, sIdx) => (
                          <span
                            key={sIdx}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "5px 12px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor: isDark ? "rgba(37, 99, 235, 0.12)" : "rgba(37, 99, 235, 0.06)",
                              color: "#3b82f6",
                              border: isDark ? "1px solid rgba(37, 99, 235, 0.25)" : "1px solid rgba(37, 99, 235, 0.15)",
                            }}
                          >
                            <LucideIcon name={sub.icon || "Check"} size={13} color="#3b82f6" />
                            {sub.name || sub.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tech Stack Tags */}
                  {allTech.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {allTech.map((tech, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 500,
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#f1f5f9",
                            color: isDark ? "#94a3b8" : "#475569",
                            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                          }}
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Deliverables & Subservices Breakdown */}
                <div
                  style={{
                    padding: "24px",
                    borderRadius: "18px",
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(248, 250, 252, 0.8)",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #e2e8f0",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: isDark ? "rgba(255, 255, 255, 0.45)" : "#64748b",
                      marginBottom: "16px",
                    }}
                  >
                    Key Architecture &amp; Deliverables
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
                    {subServices.length > 0 ? (
                      subServices.slice(0, 5).map((sub, dIdx) => (
                        <div key={dIdx} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <CheckCircle2 size={16} style={{ color: "#10b981", flexShrink: 0, marginTop: "2px" }} />
                          <div>
                            <div style={{ fontSize: "13.5px", fontWeight: 600, color: isDark ? "#ffffff" : "#0f172a" }}>
                              {sub.name || sub.title}
                            </div>
                            <div style={{ fontSize: "12.5px", color: isDark ? "rgba(255, 255, 255, 0.65)" : "#64748b", lineHeight: 1.4 }}>
                              {sub.shortDescription}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: "13px", color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b" }}>
                        Custom enterprise engineering specifications configured to your business roadmap.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openLeadServicesModal()}
                    style={{
                      width: "100%",
                      padding: "11px 18px",
                      borderRadius: "12px",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      color: "#ffffff",
                      backgroundColor: "#2563eb",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Request Consultation for {category.name} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engineering Delivery Process Section */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto 80px", padding: "0 clamp(20px, 4vw, 64px)" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "12px",
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            Our Engineering Methodology
          </h2>
          <p style={{ fontSize: "15px", color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b", maxWidth: "600px", margin: "0 auto" }}>
            A disciplined, transparent delivery framework from technical discovery through continuous cloud operations.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {processSteps.map((step, sIdx) => (
            <div
              key={sIdx}
              style={{
                borderRadius: "20px",
                padding: "24px 20px",
                backgroundColor: isDark ? "rgba(13, 19, 34, 0.6)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                position: "relative",
              }}
            >
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: 900,
                  color: isDark ? "rgba(37, 99, 235, 0.3)" : "rgba(37, 99, 235, 0.2)",
                  lineHeight: 1,
                  marginBottom: "12px",
                }}
              >
                {step.number}
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: isDark ? "#ffffff" : "#0f172a" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: "13px", lineHeight: 1.55, color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b" }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA Banner */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "0 clamp(20px, 4vw, 64px)" }}>
        <div
          style={{
            padding: "56px clamp(24px, 5vw, 64px)",
            borderRadius: "28px",
            textAlign: "center",
            background: isDark
              ? "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(13, 19, 34, 0.8) 100%)"
              : "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, #ffffff 100%)",
            border: isDark ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid rgba(37, 99, 235, 0.15)",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(24px, 3.5vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "14px",
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            Ready to build your next digital platform?
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
              maxWidth: "600px",
              margin: "0 auto 28px",
              lineHeight: 1.6,
            }}
          >
            Tell us about your requirements and our senior engineering team will provide a tailored scope and architecture plan.
          </p>

          <button
            type="button"
            onClick={() => openLeadServicesModal()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "13px 32px",
              borderRadius: "9999px",
              fontSize: "14.5px",
              fontWeight: 700,
              color: "#ffffff",
              background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 24px -4px rgba(37, 99, 235, 0.4)",
            }}
          >
            Get Started <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <style>{`
        .wsd-service-pillar-card:hover {
          border-color: rgba(37, 99, 235, 0.35) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#3b82f6", fontWeight: 600 }}>Loading Services...</div>
        </div>
      }
    >
      <ServicesContent />
    </Suspense>
  );
}
