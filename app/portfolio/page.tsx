"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Briefcase, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Search,
} from "lucide-react";
import { getPublishedProjects, Project } from "../projects/services/projectService";
import { usePublicTheme } from "../providers/PublicThemeProvider";
import { useLeadFunnel } from "../providers/LeadFunnelProvider";

export default function PortfolioPage() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    async function loadProjects() {
      try {
        setLoading(true);
        const data = await getPublishedProjects();
        if (!isCancelled) {
          setProjects(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch published projects:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    loadProjects();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Dynamically derive category pills from database projects
  const uniqueCategories = Array.from(
    new Set(projects.map((p) => p.category?.trim()).filter(Boolean))
  ) as string[];

  const categories = ["All", ...uniqueCategories];

  const filteredProjects = projects.filter((project) => {
    const projectCat = project.category || "General";
    const matchesCategory = activeCategory === "All" || projectCat.toLowerCase() === activeCategory.toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === "" ||
      project.name.toLowerCase().includes(query) ||
      (project.description && project.description.toLowerCase().includes(query)) ||
      (project.clientCompany && project.clientCompany.toLowerCase().includes(query)) ||
      (project.client && project.client.toLowerCase().includes(query)) ||
      (project.techStack && project.techStack.some((t) => t.toLowerCase().includes(query)));
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "transparent",
        color: isDark ? "#f8fafc" : "#0f172a",
        paddingTop: "40px",
        paddingBottom: "80px",
      }}
    >
      {/* Hero Header */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "0 clamp(20px, 4vw, 64px)", textAlign: "center" }}>
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
          <Sparkles size={14} /> Proven Engineering &amp; Launches
        </div>

        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 54px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: "18px",
          }}
        >
          Engineered for Scale &amp;{" "}
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
            Measurable Impact
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(15px, 2vw, 18px)",
            color: isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(100, 116, 139, 0.9)",
            maxWidth: "760px",
            margin: "0 auto 36px",
            lineHeight: 1.6,
          }}
        >
          Explore selected client launches, enterprise ERP systems, and cloud architectures built with precision, speed, and rock-solid reliability.
        </p>

        {/* Filter Bar & Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            padding: "14px 22px",
            borderRadius: "18px",
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            boxShadow: isDark ? "none" : "0 4px 20px -4px rgba(0, 0, 0, 0.05)",
            marginBottom: "48px",
            width: "100%",
          }}
        >
          {/* Category Tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {categories.map((cat) => {
              const isActive = activeCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: isActive
                      ? "#2563eb"
                      : isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.04)",
                    color: isActive
                      ? "#ffffff"
                      : isDark
                      ? "rgba(255, 255, 255, 0.7)"
                      : "rgba(15, 23, 42, 0.7)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", minWidth: "260px" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(100, 116, 139, 0.7)",
              }}
            />
            <input
              type="text"
              placeholder="Search technologies, clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: "10px",
                fontSize: "13px",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#f1f5f9",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #cbd5e1",
                color: isDark ? "#ffffff" : "#0f172a",
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "0 clamp(20px, 4vw, 64px)" }}>
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "28px",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  height: "380px",
                  borderRadius: "20px",
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#e2e8f0",
                }}
              />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              borderRadius: "20px",
              border: isDark ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed #cbd5e1",
            }}
          >
            <Briefcase size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <h3 style={{ fontSize: "18px", fontWeight: 700 }}>No projects found</h3>
            <p style={{ fontSize: "14px", color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b" }}>
              Try selecting another category or clearing your search term.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "28px",
            }}
          >
            {filteredProjects.map((project) => (
              <div
                key={project._id || project.name}
                style={{
                  borderRadius: "20px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
                className="wsd-portfolio-card wsd-unified-card"
              >
                {/* Visual Banner */}
                <div
                  style={{
                    position: "relative",
                    height: "190px",
                    width: "100%",
                    backgroundColor: isDark ? "#0f172a" : "#e2e8f0",
                    overflow: "hidden",
                  }}
                >
                  <Image
                    src={project.previewImage && (project.previewImage.startsWith("/") || project.previewImage.startsWith("http")) ? project.previewImage : "/images/websmith_original.jpg"}
                    alt={project.name}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                    style={{ objectFit: "cover" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: isDark
                        ? "linear-gradient(to top, rgba(13, 19, 34, 0.95) 0%, transparent 60%)"
                        : "linear-gradient(to top, rgba(255, 255, 255, 0.9) 0%, transparent 60%)",
                    }}
                  />
                  {project.category && (
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: "12px",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.9)",
                        backdropFilter: "blur(8px)",
                        color: "#3b82f6",
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #cbd5e1",
                      }}
                    >
                      {project.category}
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div style={{ padding: "20px 22px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: isDark ? "rgba(255, 255, 255, 0.45)" : "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "6px",
                    }}
                  >
                    {project.clientCompany || project.client || "Client Project"}
                  </div>

                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      lineHeight: 1.3,
                      marginBottom: "10px",
                      color: isDark ? "#ffffff" : "#0f172a",
                    }}
                  >
                    {project.name}
                  </h3>

                  <p
                    style={{
                      fontSize: "13.5px",
                      lineHeight: 1.5,
                      color: isDark ? "rgba(255, 255, 255, 0.65)" : "#475569",
                      marginBottom: "16px",
                      flex: 1,
                    }}
                  >
                    {project.description}
                  </p>

                  {/* Measurable ROI Metric */}
                  {project.metrics && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.06)",
                        border: isDark ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(16, 185, 129, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#10b981",
                        marginBottom: "16px",
                      }}
                    >
                      <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                      <span>{project.metrics}</span>
                    </div>
                  )}

                  {/* Tech Stack Chips */}
                  {Array.isArray(project.techStack) && project.techStack.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        marginBottom: "20px",
                      }}
                    >
                      {project.techStack.map((tech, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 500,
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#f1f5f9",
                            color: isDark ? "rgba(255, 255, 255, 0.75)" : "#334155",
                            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                          }}
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "12px",
                      borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #f1f5f9",
                    }}
                  >
                    {project.publicUrl ? (
                      <a
                        href={project.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: "#3b82f6",
                          textDecoration: "none",
                        }}
                      >
                        Visit Project <ExternalLink size={13} />
                      </a>
                    ) : (
                      <span
                        style={{
                          fontSize: "12px",
                          color: isDark ? "rgba(255, 255, 255, 0.4)" : "#94a3b8",
                        }}
                      >
                        Private Enterprise Delivery
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => openLeadServicesModal()}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "6px 12px",
                        borderRadius: "8px",
                        backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
                        color: "#3b82f6",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Build Similar <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Call to Action Card */}
        <div
          style={{
            marginTop: "80px",
            padding: "56px clamp(24px, 5vw, 64px)",
            borderRadius: "28px",
            textAlign: "center",
            background: isDark
              ? "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(13, 19, 34, 0.8) 100%)"
              : "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, #ffffff 100%)",
            border: isDark ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid rgba(37, 99, 235, 0.15)",
            boxShadow: isDark
              ? "0 24px 60px -15px rgba(0, 0, 0, 0.6)"
              : "0 20px 50px -15px rgba(37, 99, 235, 0.12)",
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
            Have a custom software or ERP project in mind?
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
            Schedule a technical architecture consultation to discuss timelines, tech stack, and deliverable specifications.
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
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            Get Started <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <style>{`
        .wsd-portfolio-card:hover {
          transform: translateY(-4px);
          border-color: rgba(37, 99, 235, 0.35) !important;
        }
      `}</style>
    </div>
  );
}
