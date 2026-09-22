"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Code2, 
  Smartphone, 
  Server, 
  Database, 
  Building2, 
  Workflow, 
  PackageCheck, 
  Receipt, 
  KeyRound, 
  Cpu, 
  ShieldCheck, 
  AppWindow, 
  Bot, 
  BrainCircuit, 
  FileSearch, 
  Layers, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Terminal,
  Zap,
  Lock,
  GitBranch,
  Headphones
} from "lucide-react";
import { usePublicTheme } from "../providers/PublicThemeProvider";
import { useLeadFunnel } from "../providers/LeadFunnelProvider";

type ServiceTab = "all" | "engineering" | "erp" | "licensing" | "cloud" | "ai";

export default function ServicesPage() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();
  const [activeTab, setActiveTab] = useState<ServiceTab>("all");

  const pillars = [
    {
      id: "engineering",
      category: "Software Engineering",
      icon: Code2,
      badge: "High-Scale",
      title: "Custom Full-Stack Web & Mobile Architecture",
      summary: "Modern, high-performance web systems and mobile applications built with sub-second response times and scalable cloud infrastructure.",
      deliverables: [
        "Production Next.js 16 & React 19 web applications",
        "Cross-platform iOS & Android mobile development (React Native)",
        "Microservices & High-Throughput REST/GraphQL APIs",
        "Edge caching, image optimization & Core Web Vitals 95+",
      ],
      techStack: ["Next.js", "TypeScript", "React Native", "Node.js", "Tailwind CSS", "Go"],
    },
    {
      id: "erp",
      category: "Enterprise ERP & CRM",
      icon: Building2,
      badge: "Automation",
      title: "Custom Business Management & Workflow ERPs",
      summary: "Centralize your entire company's operations into a unified, secure dashboard with real-time inventory tracking, staff roles, and automated billing.",
      deliverables: [
        "Tailored ERP systems designed around your exact business logic",
        "Real-time inventory sync & barcode/QR warehouse operations",
        "Multi-currency billing, GST/VAT tax calculation & automated invoices",
        "Role-based portals with granular permission controls (RBAC)",
      ],
      techStack: ["PostgreSQL", "Neon Serverless", "Redis Queues", "Docker", "REST API"],
    },
    {
      id: "licensing",
      category: "Universal Licensing (ULP)",
      icon: KeyRound,
      badge: "Proprietary Tech",
      title: "Universal License Platform & 13-Language SDKs",
      summary: "End-to-end commercial software licensing infrastructure for desktop, server, and mobile software vendors with hardware node-locking.",
      deliverables: [
        "Automated SDK compilation across 13 languages (Python, Go, C++, Rust, etc.)",
        "Cryptographic hardware fingerprinting (CPU, Disk, MAC, Motherboard)",
        "Time-bombed trial periods & cryptographic offline grace periods",
        "Universal License Center (ULC) embeddable GUI client",
      ],
      techStack: ["C++", "Rust", "Go", "Python", "C#", "HMAC-SHA256", "AES-256-GCM"],
    },
    {
      id: "cloud",
      category: "Cloud Architecture & DevOps",
      icon: Server,
      badge: "High-Availability",
      title: "Resilient Cloud Infrastructure & Distributed Databases",
      summary: "Serverless architectures, automated CI/CD deployment pipelines, and zero-downtime database scaling engineered for mission-critical reliability.",
      deliverables: [
        "Serverless Neon PostgreSQL with automated branch scaling",
        "Upstash Redis caching & QStash distributed message queues",
        "Automated CI/CD workflows, containerization & edge CDN routing",
        "Security audit, AES-256 encryption at rest & 99.99% uptime SLAs",
      ],
      techStack: ["AWS", "Vercel Edge", "Docker", "Neon DB", "Redis", "Upstash"],
    },
    {
      id: "ai",
      category: "AI Solutions & Integrations",
      icon: Bot,
      badge: "Next-Gen",
      title: "Autonomous AI Workflows & Enterprise RAG",
      summary: "Harness modern Large Language Models and intelligent agent workflows to automate complex business tasks, document extraction, and customer intelligence.",
      deliverables: [
        "Autonomous multi-agent task execution pipelines",
        "Custom enterprise RAG (vector database search on private company data)",
        "Intelligent document OCR for automated invoices, receipts & contracts",
        "24/7 Context-aware client support chatbots with human escalation",
      ],
      techStack: ["LangChain", "Vector Embeddings", "OpenAI / Anthropic", "Python", "FastAPI"],
    },
  ];

  const filteredPillars = activeTab === "all" 
    ? pillars 
    : pillars.filter(p => p.id === activeTab);

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
      title: "Zero-Downtime Deployment",
      description: "We deploy onto highly available cloud infrastructure with automated database migrations, SSL provisioning, and global edge CDN caching.",
    },
    {
      number: "05",
      title: "24/7 SLA Support & Scaling",
      description: "Our core engineering team provides ongoing performance monitoring, security patches, feature iterations, and guaranteed SLA response times.",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: isDark ? "#070B14" : "#f8fafc",
        color: isDark ? "#f8fafc" : "#0f172a",
        paddingTop: "48px",
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
          <Sparkles size={14} /> Full-Spectrum Digital Engineering
        </div>

        <h1
          style={{
            fontSize: "clamp(34px, 5vw, 56px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: "18px",
          }}
        >
          Architecting High-Scale Systems &amp;{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Digital Ecosystems
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
          From bespoke enterprise ERP platforms and universal software licensing to high-speed web apps and AI automations, we build reliable technology that drives measurable growth.
        </p>

        {/* Action CTAs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", flexWrap: "wrap", marginBottom: "48px" }}>
          <button
            type="button"
            onClick={() => openLeadServicesModal()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "13px 30px",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 24px -4px rgba(37, 99, 235, 0.4)",
              transition: "all 0.15s ease",
            }}
          >
            Start Your Project <ArrowRight size={15} />
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
          {[
            { id: "all", label: "All Capabilities" },
            { id: "engineering", label: "Software Engineering" },
            { id: "erp", label: "Enterprise ERP" },
            { id: "licensing", label: "Universal Licensing" },
            { id: "cloud", label: "Cloud & DevOps" },
            { id: "ai", label: "AI Solutions" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ServiceTab)}
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
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Service Pillars Grid */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto 80px", padding: "0 clamp(20px, 4vw, 64px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {filteredPillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                style={{
                  borderRadius: "24px",
                  padding: "36px clamp(24px, 3.5vw, 44px)",
                  backgroundColor: isDark ? "rgba(13, 19, 34, 0.85)" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  boxShadow: isDark
                    ? "0 20px 40px -10px rgba(0, 0, 0, 0.4)"
                    : "0 10px 30px -6px rgba(15, 23, 42, 0.06)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                  gap: "32px",
                  alignItems: "center",
                  transition: "border-color 0.2s ease, transform 0.2s ease",
                }}
                className="wsd-service-pillar-card"
              >
                {/* Left Overview */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
                        color: "#3b82f6",
                      }}
                    >
                      <Icon size={22} />
                    </div>
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
                      {pillar.badge}
                    </span>
                  </div>

                  <h2
                    style={{
                      fontSize: "clamp(20px, 3vw, 24px)",
                      fontWeight: 700,
                      lineHeight: 1.3,
                      marginBottom: "12px",
                      color: isDark ? "#ffffff" : "#0f172a",
                    }}
                  >
                    {pillar.title}
                  </h2>

                  <p
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.6,
                      color: isDark ? "rgba(255, 255, 255, 0.65)" : "#475569",
                      marginBottom: "20px",
                    }}
                  >
                    {pillar.summary}
                  </p>

                  {/* Tech Stack Tags */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {pillar.techStack.map((tech, tIdx) => (
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
                </div>

                {/* Right Deliverables & CTA */}
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

                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {pillar.deliverables.map((item, dIdx) => (
                      <li key={dIdx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13.5px", lineHeight: 1.45 }}>
                        <CheckCircle2 size={16} style={{ color: "#10b981", flexShrink: 0, marginTop: "2px" }} />
                        <span style={{ color: isDark ? "rgba(255, 255, 255, 0.85)" : "#1e293b" }}>{item}</span>
                      </li>
                    ))}
                  </ul>

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
                    Request Consultation for this Service <ArrowRight size={14} />
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
