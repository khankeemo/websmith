"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Briefcase, 
  ExternalLink, 
  Code2, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  Search,
  Globe
} from "lucide-react";
import { getPublishedProjects, Project } from "../projects/services/projectService";
import { usePublicTheme } from "../providers/PublicThemeProvider";
import { useLeadFunnel } from "../providers/LeadFunnelProvider";

type PortfolioCategory = "All" | "Web Apps" | "Enterprise ERP" | "Mobile Apps" | "Cloud & APIs";

interface ShowcaseItem {
  id: string;
  title: string;
  category: PortfolioCategory;
  client: string;
  description: string;
  metrics: string;
  techStack: string[];
  publicUrl?: string;
  previewImage?: string;
}

const CURATED_PORTFOLIO: ShowcaseItem[] = [
  {
    id: "curated-1",
    title: "ApexFlow Enterprise ERP",
    category: "Enterprise ERP",
    client: "Logix Global Supply Chain",
    description: "End-to-end enterprise resource planning system with real-time inventory synchronization, role-based portals, and automated tax invoicing.",
    metrics: "Reduced inventory discrepancy by 94% across 8 warehouses",
    techStack: ["Next.js 16", "PostgreSQL", "Tailwind CSS", "Redis", "Docker"],
    publicUrl: "https://websmithdigital.com",
    previewImage: "/images/websmith_original.jpg",
  },
  {
    id: "curated-2",
    title: "OmniLicense Universal Hub",
    category: "Cloud & APIs",
    client: "Desktop & Mobile Software Vendors",
    description: "Multi-runtime software licensing engine supporting 13 programming languages, cryptographic hardware binding, and trial grace periods.",
    metrics: "Over 25,000+ active device licenses managed with 99.99% uptime",
    techStack: ["Go", "Node.js", "Neon DB", "HMAC-SHA256", "C++ SDK"],
    publicUrl: "https://websmithdigital.com/license",
    previewImage: "/images/websmith_1x1.jpg",
  },
  {
    id: "curated-3",
    title: "FinPulse High-Speed Wealth Platform",
    category: "Web Apps",
    client: "Aura Capital Partners",
    description: "Real-time algorithmic trading dashboard with interactive charts, sub-50ms market data streaming, and automated portfolio rebalancing.",
    metrics: "3.2x faster page load and 65% lower server memory footprint",
    techStack: ["React 19", "Next.js", "WebSockets", "Recharts", "TypeScript"],
    publicUrl: "https://websmithdigital.com",
    previewImage: "/images/websmith_original.jpg",
  },
  {
    id: "curated-4",
    title: "PulseHealth Telemedicine App",
    category: "Mobile Apps",
    client: "MedCare Health Network",
    description: "HIPAA-compliant cross-platform mobile application enabling secure encrypted video doctor consultations, e-prescriptions, and appointment queues.",
    metrics: "4.9-star rating with over 40,000 monthly patient consultations",
    techStack: ["React Native", "WebRTC", "Node.js", "AES-256", "iOS / Android"],
    publicUrl: "https://websmithdigital.com",
    previewImage: "/images/websmith_1x1.jpg",
  },
  {
    id: "curated-5",
    title: "TradeSphere B2B Wholesale Marketplace",
    category: "Web Apps",
    client: "Global Sourcing Hub",
    description: "High-volume wholesale marketplace featuring tiered bulk pricing, multi-currency settlement, custom RFQ workflows, and automated vendor payout.",
    metrics: "Handled $4.8M+ in quarterly bulk volume seamlessly",
    techStack: ["Next.js", "Stripe API", "Neon PostgreSQL", "Tailwind CSS"],
    publicUrl: "https://websmithdigital.com/software-store",
    previewImage: "/images/websmith_original.jpg",
  },
  {
    id: "curated-6",
    title: "CloudMatrix Fleet & Dispatch AI",
    category: "Enterprise ERP",
    client: "TransLogix Express",
    description: "Automated route optimization and telematics tracking platform connecting 600+ fleet vehicles with dynamic dispatch scheduling.",
    metrics: "18% reduction in total fuel consumption and zero lost shipments",
    techStack: ["TypeScript", "Mapbox GL", "PostGIS", "Redis Queue", "Python"],
    publicUrl: "https://websmithdigital.com",
    previewImage: "/images/websmith_1x1.jpg",
  },
];

export default function PortfolioPage() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();

  const [activeCategory, setActiveCategory] = useState<PortfolioCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [dbProjects, setDbProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublishedProjects()
      .then((projects) => {
        setDbProjects(projects || []);
      })
      .catch(() => {
        setDbProjects([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Merge database published projects with curated projects
  const allProjects: ShowcaseItem[] = [
    ...dbProjects.map((p) => ({
      id: p._id || p.name,
      title: p.name,
      category: "Web Apps" as PortfolioCategory,
      client: p.clientCompany || p.client || "Client Project",
      description: p.description,
      metrics: "Delivered on schedule with 100% quality score",
      techStack: ["Next.js", "TypeScript", "Tailwind CSS"],
      publicUrl: p.publicUrl,
      previewImage: p.previewImage || "/images/websmith_original.jpg",
    })),
    ...CURATED_PORTFOLIO,
  ];

  const filteredProjects = allProjects.filter((project) => {
    const matchesCategory = activeCategory === "All" || project.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.techStack.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories: PortfolioCategory[] = [
    "All",
    "Web Apps",
    "Enterprise ERP",
    "Mobile Apps",
    "Cloud & APIs",
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: isDark ? "#070B14" : "#f8fafc",
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
          <Sparkles size={14} /> Proven Engineering & Launches
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
              WebkitTextFillColor: "transparent",
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
              const isActive = activeCategory === cat;
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
        {filteredProjects.length === 0 ? (
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
                key={project.id}
                style={{
                  borderRadius: "20px",
                  overflow: "hidden",
                  backgroundColor: isDark ? "rgba(13, 19, 34, 0.9)" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  boxShadow: isDark
                    ? "0 18px 40px -10px rgba(0, 0, 0, 0.5)"
                    : "0 12px 32px -8px rgba(15, 23, 42, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease",
                }}
                className="wsd-portfolio-card"
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
                    alt={project.title}
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
                    {project.client}
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
                    {project.title}
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

                  {/* Tech Stack Chips */}
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
