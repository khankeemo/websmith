"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import { usePublicTheme } from "@/app/providers/PublicThemeProvider";
import { useLeadFunnel } from "@/app/providers/LeadFunnelProvider";
import { getPublicIndustries } from "@/lib/cms/cmsService";
import type { CmsIndustry } from "@/lib/cms/types";
import LucideIcon from "@/components/shared/LucideIcon";

function IndustriesContent() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();
  const searchParams = useSearchParams();

  const [industries, setIndustries] = useState<CmsIndustry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string>("");

  const sectorParam = searchParams.get("sector")?.toLowerCase();

  useEffect(() => {
    let isCancelled = false;
    async function loadIndustries() {
      try {
        setLoading(true);
        const data = await getPublicIndustries();
        if (!isCancelled) {
          const list = Array.isArray(data) ? data : [];
          setIndustries(list);
          if (list.length > 0) {
            if (sectorParam && list.some((ind) => ind.slug === sectorParam)) {
              setActiveSlug(sectorParam);
            } else {
              setActiveSlug(list[0].slug);
            }
          }
        }
      } catch (err) {
        console.error("Error loading industries:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    loadIndustries();
    return () => {
      isCancelled = true;
    };
  }, [sectorParam]);

  const current = industries.find((i) => i.slug === activeSlug) || industries[0];

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
          <Sparkles size={14} /> Tailored Enterprise Industry Solutions
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
          Engineered for{" "}
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
            Mission-Critical
          </span>{" "}
          Industries
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 19px)",
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
            maxWidth: "760px",
            margin: "0 auto 44px",
            lineHeight: 1.65,
          }}
        >
          From high-frequency financial ledgers and HIPAA-compliant telemedicine to multi-tenant SaaS and automated supply chains, explore how WebSmith architects domain-specific software platforms.
        </p>

        {/* Sector Navigation Tabs */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "56px" }}>
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                style={{
                  width: "140px",
                  height: "46px",
                  borderRadius: "14px",
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#e2e8f0",
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "56px",
            }}
          >
            {industries.map((item) => {
              const isSelected = activeSlug === item.slug;
              return (
                <button
                  key={item._id || item.slug}
                  onClick={() => setActiveSlug(item.slug)}
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 20px",
                    borderRadius: "14px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: isSelected
                      ? "1px solid #3b82f6"
                      : isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid #e2e8f0",
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(37, 99, 235, 0.25)"
                        : "rgba(37, 99, 235, 0.1)"
                      : isDark
                      ? "rgba(13, 19, 34, 0.7)"
                      : "#ffffff",
                    color: isSelected ? "#3b82f6" : isDark ? "rgba(255, 255, 255, 0.7)" : "#64748b",
                    boxShadow: isSelected ? "0 4px 20px -4px rgba(37, 99, 235, 0.3)" : "none",
                  }}
                >
                  <LucideIcon name={item.icon || "Building2"} size={18} color={isSelected ? "#3b82f6" : "currentColor"} />
                  {item.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Sector Spotlight */}
      {current && (
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            margin: "0 auto 72px",
            padding: "0 clamp(20px, 4vw, 64px)",
          }}
        >
          <div
            style={{
              padding: "clamp(28px, 4vw, 48px)",
              borderRadius: "28px",
              backgroundColor: isDark ? "rgba(13, 19, 34, 0.85)" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              boxShadow: isDark
                ? "0 24px 60px -12px rgba(0, 0, 0, 0.7)"
                : "0 16px 40px -8px rgba(0, 0, 0, 0.06)",
            }}
          >
            {/* Header Row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "20px",
                marginBottom: "28px",
                paddingBottom: "24px",
                borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    flexShrink: 0,
                    boxShadow: "0 8px 20px -4px rgba(37, 99, 235, 0.4)",
                  }}
                >
                  <LucideIcon name={current.icon || "Building2"} size={28} color="#ffffff" />
                </div>
                <div>
                  {current.badge && (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        backgroundColor: isDark ? "rgba(37, 99, 235, 0.2)" : "rgba(37, 99, 235, 0.1)",
                        color: "#3b82f6",
                        marginBottom: "6px",
                      }}
                    >
                      {current.badge}
                    </span>
                  )}
                  <h2
                    style={{
                      fontSize: "clamp(22px, 3.5vw, 32px)",
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      margin: 0,
                      color: isDark ? "#ffffff" : "#0f172a",
                    }}
                  >
                    {current.headline || current.name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openLeadServicesModal()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 24px",
                  borderRadius: "9999px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px -2px rgba(37, 99, 235, 0.35)",
                }}
              >
                Consult Industry Lead <ArrowRight size={15} />
              </button>
            </div>

            <p
              style={{
                fontSize: "16px",
                lineHeight: 1.7,
                color: isDark ? "rgba(255, 255, 255, 0.75)" : "#475569",
                maxWidth: "960px",
                marginBottom: "36px",
              }}
            >
              {current.description || current.shortDescription}
            </p>

            {/* Performance Stats Cards */}
            {Array.isArray(current.stats) && current.stats.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginBottom: "48px",
                }}
              >
                {current.stats.map((stat, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "20px 16px",
                      borderRadius: "16px",
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#f8fafc",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #e2e8f0",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "26px",
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: isDark ? "#ffffff" : "#0f172a",
                        marginBottom: "4px",
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b",
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Two-Column Detail Grid: Architecture & Challenges */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "36px",
                marginBottom: "48px",
              }}
            >
              {/* Architecture Highlights */}
              {Array.isArray(current.architecture) && current.architecture.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
                    <Layers size={20} color="#3b82f6" />
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        margin: 0,
                        color: isDark ? "#ffffff" : "#0f172a",
                      }}
                    >
                      Platform Architecture
                    </h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {current.architecture.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          padding: "14px 16px",
                          borderRadius: "14px",
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "#f8fafc",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid #e2e8f0",
                        }}
                      >
                        <CheckCircle2 size={18} color="#10b981" style={{ marginTop: "2px", flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: "13.5px",
                            lineHeight: 1.5,
                            color: isDark ? "rgba(255, 255, 255, 0.75)" : "#334155",
                          }}
                        >
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Core Challenges Solved */}
              {Array.isArray(current.challenges) && current.challenges.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
                    <ShieldCheck size={20} color="#3b82f6" />
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        margin: 0,
                        color: isDark ? "#ffffff" : "#0f172a",
                      }}
                    >
                      Domain Challenges Solved
                    </h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {current.challenges.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "14px",
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "#f8fafc",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#ef4444",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.8 }}>Challenge:</span>
                          {c.problem}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
                            lineHeight: 1.45,
                          }}
                        >
                          <strong style={{ color: "#10b981", fontWeight: 600 }}>Engineered Resolution: </strong>
                          {c.solution}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Case Study & Tech Stack Strip */}
            {(current.caseStudy || (Array.isArray(current.techStack) && current.techStack.length > 0)) && (
              <div
                style={{
                  padding: "24px",
                  borderRadius: "18px",
                  backgroundColor: isDark ? "rgba(37, 99, 235, 0.08)" : "rgba(37, 99, 235, 0.04)",
                  border: isDark ? "1px solid rgba(37, 99, 235, 0.2)" : "1px solid rgba(37, 99, 235, 0.15)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "24px",
                  alignItems: "center",
                }}
              >
                {current.caseStudy && (
                  <div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#3b82f6",
                        marginBottom: "4px",
                      }}
                    >
                      Production Case Study
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: isDark ? "#ffffff" : "#0f172a",
                        marginBottom: "4px",
                      }}
                    >
                      {current.caseStudy.client}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
                        lineHeight: 1.5,
                        marginBottom: "8px",
                      }}
                    >
                      {current.caseStudy.summary}
                    </div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: "#10b981",
                      }}
                    >
                      Result: {current.caseStudy.metrics}
                    </div>
                  </div>
                )}

                {Array.isArray(current.techStack) && current.techStack.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b",
                        marginBottom: "10px",
                      }}
                    >
                      Primary Technology Stack
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {current.techStack.map((tech, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: "4px 12px",
                            borderRadius: "9999px",
                            fontSize: "12px",
                            fontWeight: 600,
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#ffffff",
                            border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #cbd5e1",
                            color: isDark ? "#f8fafc" : "#1e293b",
                          }}
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Consultation CTA Banner */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 64px)",
        }}
      >
        <div
          style={{
            padding: "52px clamp(24px, 5vw, 64px)",
            borderRadius: "28px",
            textAlign: "center",
            background: isDark
              ? "linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(13, 19, 34, 0.85) 100%)"
              : "linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, #ffffff 100%)",
            border: isDark ? "1px solid rgba(37, 99, 235, 0.35)" : "1px solid rgba(37, 99, 235, 0.2)",
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
            Have a specialized industry challenge?
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
            Book a direct consultation with our principal domain architects to evaluate your architecture, compliance requirements, and delivery milestones.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => openLeadServicesModal()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "13px 30px",
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
              Start Architecture Consultation <ArrowRight size={16} />
            </button>
            <Link
              href="/portfolio"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "13px 26px",
                borderRadius: "9999px",
                fontSize: "14.5px",
                fontWeight: 600,
                color: isDark ? "#ffffff" : "#0f172a",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                textDecoration: "none",
              }}
            >
              Browse Case Studies
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IndustriesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#3b82f6", fontWeight: 600 }}>Loading Industries...</div>
        </div>
      }
    >
      <IndustriesContent />
    </Suspense>
  );
}
