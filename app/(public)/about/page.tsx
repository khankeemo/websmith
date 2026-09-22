"use client";

import Link from "next/link";
import { 
  ShieldCheck, 
  Cpu, 
  Layers, 
  Users2, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Award, 
  Zap, 
  Globe2, 
  Lock,
  Building2 
} from "lucide-react";
import { useLeadFunnel } from "../../providers/LeadFunnelProvider";
import { usePublicTheme } from "../../providers/PublicThemeProvider";

export default function AboutPage() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();

  const metrics = [
    { value: "100+", label: "Launches & Deployments", icon: Award },
    { value: "13", label: "Runtime SDKs Supported", icon: Cpu },
    { value: "99.99%", label: "Platform Uptime SLA", icon: ShieldCheck },
    { value: "418", label: "World Timezones Supported", icon: Globe2 },
  ];

  const corePillars = [
    {
      title: "Architecture Over Templates",
      desc: "We don't sell disposable cookie-cutter themes. Every digital ecosystem, ERP system, and API pipeline is purpose-built to scale with your business logic.",
      icon: Layers,
    },
    {
      title: "Cryptographic Security at Rest & In-Transit",
      desc: "From AES-256-GCM credential vaulting to HMAC-SHA256 signed API requests and node-locking, enterprise security is baked into our foundation.",
      icon: Lock,
    },
    {
      title: "Radical Operational Transparency",
      desc: "Our clients track real-time project milestones, task queues, shared deliverables, and invoices in a dedicated, unified Client Portal workspace.",
      icon: CheckCircle2,
    },
    {
      title: "Continuous Engineering & Partnership",
      desc: "The same senior engineers who architect your platform continue maintaining, securing, and scaling it post-launch with guaranteed SLAs.",
      icon: Users2,
    },
  ];

  const milestones = [
    {
      year: "Phase 1",
      title: "Foundations & High-Scale Web Architecture",
      description: "Established WebSmith Digital delivering custom enterprise web applications and complex interactive platforms using modern Next.js and TypeScript.",
    },
    {
      year: "Phase 2",
      title: "Enterprise ERP & Automation Systems",
      description: "Engineered bespoke business management tools, inventory synchronization, and automated billing engines for high-volume logistics and retail brands.",
    },
    {
      year: "Phase 3",
      title: "Universal License Platform (ULP)",
      description: "Pioneered proprietary licensing infrastructure with an automated compiler packaging production SDKs across 13 programming languages with hardware node-locking.",
    },
    {
      year: "Phase 4",
      title: "Global 418-Timezone Scheduler & AI Workflows",
      description: "Introduced synchronized dual-time consultation scheduling across all world timezones and integrated autonomous AI agent workflows for modern enterprises.",
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
      {/* Hero Section */}
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
          <Sparkles size={14} /> Who We Are &amp; What Drives Us
        </div>

        <h1
          style={{
            fontSize: "clamp(34px, 5vw, 56px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: "20px",
          }}
        >
          Engineering Practical{" "}
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
            fontSize: "clamp(16px, 2vw, 19px)",
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
            maxWidth: "780px",
            margin: "0 auto 40px",
            lineHeight: 1.65,
          }}
        >
          At <strong>WebSmith Digital</strong>, we go beyond traditional software development. We architect resilient digital ecosystems, enterprise ERP platforms, and universal software licensing solutions that empower businesses to automate, scale, and outperform competition.
        </p>

        {/* Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "72px",
          }}
        >
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <div
                key={idx}
                style={{
                  padding: "24px 18px",
                  borderRadius: "20px",
                  backgroundColor: isDark ? "rgba(13, 19, 34, 0.8)" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  boxShadow: isDark ? "none" : "0 4px 16px -2px rgba(0, 0, 0, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
                    color: "#3b82f6",
                    marginBottom: "12px",
                  }}
                >
                  <Icon size={20} />
                </div>
                <div
                  style={{
                    fontSize: "30px",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: isDark ? "#ffffff" : "#0f172a",
                    lineHeight: 1.1,
                    marginBottom: "6px",
                  }}
                >
                  {metric.value}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: isDark ? "rgba(255, 255, 255, 0.55)" : "#64748b",
                  }}
                >
                  {metric.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Core Engineering Philosophy */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto 80px", padding: "0 clamp(20px, 4vw, 64px)" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "12px",
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            Our Engineering Principles
          </h2>
          <p style={{ fontSize: "15px", color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b" }}>
            The standards that dictate how we architect, code, and support every platform.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {corePillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                style={{
                  padding: "28px 24px",
                  borderRadius: "20px",
                  backgroundColor: isDark ? "rgba(13, 19, 34, 0.7)" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
                    color: "#3b82f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}
                >
                  <Icon size={20} />
                </div>
                <h3
                  style={{
                    fontSize: "17px",
                    fontWeight: 700,
                    marginBottom: "10px",
                    color: isDark ? "#ffffff" : "#0f172a",
                  }}
                >
                  {pillar.title}
                </h3>
                <p
                  style={{
                    fontSize: "13.5px",
                    lineHeight: 1.6,
                    color: isDark ? "rgba(255, 255, 255, 0.65)" : "#475569",
                  }}
                >
                  {pillar.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evolution Timeline */}
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
            Evolution &amp; Technical Milestones
          </h2>
          <p style={{ fontSize: "15px", color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b" }}>
            How our engineering capabilities expanded into a full-scale digital ecosystem.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
          {milestones.map((m, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr",
                gap: "24px",
                padding: "24px",
                borderRadius: "20px",
                backgroundColor: isDark ? "rgba(13, 19, 34, 0.6)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#3b82f6",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {m.year}
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "17px",
                    fontWeight: 700,
                    marginBottom: "6px",
                    color: isDark ? "#ffffff" : "#0f172a",
                  }}
                >
                  {m.title}
                </h3>
                <p
                  style={{
                    fontSize: "13.5px",
                    lineHeight: 1.6,
                    color: isDark ? "rgba(255, 255, 255, 0.65)" : "#64748b",
                    margin: 0,
                  }}
                >
                  {m.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
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
            Ready to partner with an engineering-first team?
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
            Let&apos;s discuss your upcoming software launch, ERP automation, or platform scaling requirements.
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
    </div>
  );
}
