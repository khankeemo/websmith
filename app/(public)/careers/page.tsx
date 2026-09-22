"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Briefcase, 
  Sparkles, 
  MapPin, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Laptop, 
  HeartHandshake, 
  GraduationCap, 
  Send,
  Users2
} from "lucide-react";
import API from "../../../core/services/apiService";
import { usePublicTheme } from "../../providers/PublicThemeProvider";
import { useLeadFunnel } from "../../providers/LeadFunnelProvider";

type Department = "All" | "Engineering" | "Design" | "Product & Operations";

interface JobRole {
  id: string;
  title: string;
  department: Department;
  location: string;
  type: string;
  experience: string;
  description: string;
  tags: string[];
}

const OPEN_ROLES: JobRole[] = [
  {
    id: "fe-lead",
    title: "Senior Full-Stack Engineer (Next.js & TypeScript)",
    department: "Engineering",
    location: "Remote / Hybrid (Kolkata HQ)",
    type: "Full-Time",
    experience: "4+ Years",
    description: "Architect and deliver high-scale digital platforms, serverless APIs, and interactive client portals using Next.js 16, TypeScript, and Neon PostgreSQL.",
    tags: ["Next.js", "TypeScript", "PostgreSQL", "Node.js", "Tailwind CSS"],
  },
  {
    id: "erp-arch",
    title: "Enterprise ERP & Systems Architect",
    department: "Engineering",
    location: "Remote",
    type: "Full-Time",
    experience: "5+ Years",
    description: "Design custom resource planning engines, real-time inventory synchronization systems, and high-throughput background queues for global retail brands.",
    tags: ["Distributed Systems", "Redis", "Docker", "Database Optimization", "Go/Node"],
  },
  {
    id: "uiux-sr",
    title: "Lead UI/UX Product Designer",
    department: "Design",
    location: "Remote",
    type: "Full-Time",
    experience: "3+ Years",
    description: "Create state-of-the-art interactive web applications, design systems, and mobile interfaces. Turn complex enterprise workflows into intuitive, breathtaking UIs.",
    tags: ["Figma", "Design Systems", "Prototyping", "Design Ops", "Micro-interactions"],
  },
  {
    id: "devops-eng",
    title: "Cloud Infrastructure & DevOps Engineer",
    department: "Engineering",
    location: "Remote",
    type: "Full-Time",
    experience: "3+ Years",
    description: "Maintain zero-downtime deployment pipelines, edge CDN caching, Kubernetes clusters, and automated security penetration scanning.",
    tags: ["AWS / GCP", "CI/CD", "Docker", "Kubernetes", "Terraform", "Security"],
  },
  {
    id: "prod-coord",
    title: "Technical Project Manager / Client Partner",
    department: "Product & Operations",
    location: "Remote / Hybrid",
    type: "Full-Time",
    experience: "3+ Years",
    description: "Drive agile sprint cadences, client milestone roadmaps, deliverable tracking, and quality assurance alongside senior engineering leads.",
    tags: ["Agile/Scrum", "Client Success", "Technical Specs", "Sprint Planning"],
  },
];

const PERKS = [
  {
    icon: Laptop,
    title: "Remote-First Flexibility",
    description: "Work from wherever you are most productive. We focus on results, autonomy, and high-impact deliverables rather than micromanaged hours.",
  },
  {
    icon: Zap,
    title: "High-Scale Modern Stack",
    description: "Build with modern Next.js 16, TypeScript, Neon Serverless DB, Redis queues, and AI-assisted engineering workflows.",
  },
  {
    icon: HeartHandshake,
    title: "Competitive Compensation & Bonuses",
    description: "Above-market salary tiers, performance-based delivery bonuses, and transparent milestone appraisals.",
  },
  {
    icon: GraduationCap,
    title: "Continuous Learning & Subsidies",
    description: "Annual stipend for developer certifications, design courses, software tools, and technical conferences.",
  },
];

const HIRING_STEPS = [
  {
    number: "01",
    title: "Application Review",
    desc: "We review your resume, GitHub repositories, and past project architecture samples within 48 business hours.",
  },
  {
    number: "02",
    title: "Technical Conversation",
    desc: "A 45-minute discussion with a lead engineer on system design, problem solving, and architecture decisions.",
  },
  {
    number: "03",
    title: "Practical Trial Sprint",
    desc: "A paid, focused take-home challenge or collaborative pair programming session reflecting real client work.",
  },
  {
    number: "04",
    title: "Fast Offer & Onboarding",
    desc: "Transparent salary offer and onboarding package with hardware allowances to get you coding without delays.",
  },
];

export default function CareersPage() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();

  const [activeDepartment, setActiveDepartment] = useState<Department>("All");
  const [contactInfo, setContactInfo] = useState({
    email: "careers@websmithdigital.com",
    support_email: "support@websmithdigital.com",
    sales_email: "sales@websmithdigital.com",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await API.get("/settings/public/contact_info");
        if (res.data && res.data.success && res.data.data) {
          setContactInfo({
            email: res.data.data.hr_email || "careers@websmithdigital.com",
            support_email: res.data.data.email || "support@websmithdigital.com",
            sales_email: res.data.data.sales_email || "sales@websmithdigital.com",
          });
        }
      } catch {
        // Fallback to default
      }
    };
    fetchSettings();
  }, []);

  const filteredRoles = activeDepartment === "All"
    ? OPEN_ROLES
    : OPEN_ROLES.filter((r) => r.department === activeDepartment);

  const departments: Department[] = ["All", "Engineering", "Design", "Product & Operations"];

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
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "0 clamp(20px, 4vw, 64px)", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "9999px",
            backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.1)",
            border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(34, 197, 94, 0.2)",
            color: "#22c55e",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "20px",
          }}
        >
          <Sparkles size={14} /> We&apos;re Hiring Globally
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
          Build Exceptional Software With{" "}
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
            Senior Engineers
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
          Join WebSmith Digital in architecting enterprise digital ecosystems, complex ERP platforms, and universal software licensing engines for ambitious brands worldwide.
        </p>

        {/* Action Button */}
        <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap", marginBottom: "64px" }}>
          <a
            href={`mailto:${contactInfo.email}?subject=Application for Engineering Role at WebSmith Digital`}
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
              textDecoration: "none",
              boxShadow: "0 8px 24px -4px rgba(37, 99, 235, 0.4)",
            }}
          >
            Send Your Resume <Send size={15} />
          </a>

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
            }}
          >
            Explore What We Build
          </Link>
        </div>
      </div>

      {/* Perks & Benefits Section */}
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
            Why Engineers &amp; Designers Join Us
          </h2>
          <p style={{ fontSize: "15px", color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b" }}>
            A culture founded on craft, high-ownership autonomy, and zero bureaucracy.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {PERKS.map((perk, idx) => {
            const Icon = perk.icon;
            return (
              <div
                key={idx}
                style={{
                  padding: "32px 26px",
                  borderRadius: "22px",
                  backgroundColor: isDark ? "rgba(13, 19, 34, 0.7)" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  boxShadow: isDark ? "none" : "0 8px 24px -4px rgba(15, 23, 42, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
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
                    marginBottom: "18px",
                  }}
                >
                  <Icon size={22} />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: isDark ? "#ffffff" : "#0f172a" }}>
                  {perk.title}
                </h3>
                <p style={{ fontSize: "13.5px", lineHeight: 1.6, color: isDark ? "rgba(255, 255, 255, 0.65)" : "#475569" }}>
                  {perk.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Open Roles Section */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto 80px", padding: "0 clamp(20px, 4vw, 64px)" }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "12px",
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            Current Openings
          </h2>
          <p style={{ fontSize: "15px", color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b" }}>
            Explore opportunities across our engineering, design, and operations teams.
          </p>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "40px" }}>
          {departments.map((dept) => {
            const isActive = activeDepartment === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setActiveDepartment(dept)}
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
                {dept}
              </button>
            );
          })}
        </div>

        {/* Job Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              style={{
                borderRadius: "22px",
                padding: "28px clamp(20px, 3vw, 36px)",
                backgroundColor: isDark ? "rgba(13, 19, 34, 0.85)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                boxShadow: isDark ? "none" : "0 10px 30px -6px rgba(15, 23, 42, 0.06)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "24px",
                alignItems: "center",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
              className="wsd-job-card"
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
                      color: "#3b82f6",
                    }}
                  >
                    {role.department}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b" }}>
                    <MapPin size={13} /> {role.location}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b" }}>
                    <Clock size={13} /> {role.type} • {role.experience}
                  </div>
                </div>

                <h3 style={{ fontSize: "19px", fontWeight: 700, marginBottom: "10px", color: isDark ? "#ffffff" : "#0f172a" }}>
                  {role.title}
                </h3>

                <p style={{ fontSize: "13.5px", lineHeight: 1.55, color: isDark ? "rgba(255, 255, 255, 0.65)" : "#475569", marginBottom: "16px" }}>
                  {role.description}
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {role.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 500,
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#f1f5f9",
                        color: isDark ? "#94a3b8" : "#334155",
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                <a
                  href={`mailto:${contactInfo.email}?subject=Application for ${role.title}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "11px 24px",
                    borderRadius: "12px",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "#ffffff",
                    backgroundColor: "#2563eb",
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  Apply via Email <ArrowRight size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hiring Process */}
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
            Our Hiring Process
          </h2>
          <p style={{ fontSize: "15px", color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b" }}>
            Fast, transparent, and respectful of your time. No multi-month interview loops.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {HIRING_STEPS.map((step, idx) => (
            <div
              key={idx}
              style={{
                borderRadius: "20px",
                padding: "24px 20px",
                backgroundColor: isDark ? "rgba(13, 19, 34, 0.6)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "30px",
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
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA Card */}
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
            Don&apos;t see your specific role listed?
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
            We are always interested in connecting with world-class engineers, architects, and designers. Send an open application directly to our talent team.
          </p>

          <a
            href={`mailto:${contactInfo.email}?subject=General Application / Portfolio Submission`}
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
              textDecoration: "none",
              boxShadow: "0 8px 24px -4px rgba(37, 99, 235, 0.4)",
            }}
          >
            Send General Application <Send size={16} />
          </a>
        </div>
      </div>

      <style>{`
        .wsd-job-card:hover {
          border-color: rgba(37, 99, 235, 0.35) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
