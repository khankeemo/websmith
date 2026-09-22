"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Code2, 
  Smartphone, 
  Server, 
  Database, 
  GitMerge, 
  Zap, 
  Building2, 
  Workflow, 
  PackageCheck, 
  Receipt, 
  Users, 
  RefreshCw, 
  KeyRound, 
  Cpu, 
  ShieldCheck, 
  AppWindow, 
  BarChart3, 
  Lock, 
  Palette, 
  Layers, 
  Component, 
  Sparkles, 
  Layout, 
  Brush, 
  Bot, 
  BrainCircuit, 
  FileSearch, 
  MessageSquareCode, 
  TrendingUp, 
  ArrowRight,
  Lightbulb,
  type LucideIcon 
} from "lucide-react";

type ServiceItem = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  href: string;
};

type ServiceCategory = {
  id: string;
  label: string;
  badge?: string;
  services: ServiceItem[];
};

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "software-engineering",
    label: "Software Engineering",
    services: [
      {
        title: "Web App Development",
        subtitle: "Scalable Next.js & React architectures",
        icon: Code2,
        href: "/services",
      },
      {
        title: "Mobile App Development",
        subtitle: "Cross-platform iOS & Android experiences",
        icon: Smartphone,
        href: "/services",
      },
      {
        title: "Microservices & APIs",
        subtitle: "High-throughput backend architectures",
        icon: Server,
        href: "/services",
      },
      {
        title: "Database & Cloud Cache",
        subtitle: "Neon Serverless PostgreSQL & Redis",
        icon: Database,
        href: "/services",
      },
      {
        title: "DevOps & CI/CD Pipelines",
        subtitle: "Automated containerization & deployments",
        icon: GitMerge,
        href: "/services",
      },
      {
        title: "Software Modernization",
        subtitle: "Legacy system refactoring & optimization",
        icon: Zap,
        href: "/services",
      },
    ],
  },
  {
    id: "erp-crm",
    label: "Enterprise ERP & CRM",
    services: [
      {
        title: "Custom Enterprise ERP",
        subtitle: "Tailored operations & reporting systems",
        icon: Building2,
        href: "/services",
      },
      {
        title: "CRM Workflow Automation",
        subtitle: "Intelligent lead pipeline & deal tracking",
        icon: Workflow,
        href: "/services",
      },
      {
        title: "Inventory & Supply Chain",
        subtitle: "Real-time stock tracking & barcode systems",
        icon: PackageCheck,
        href: "/services",
      },
      {
        title: "Billing & Invoicing Engine",
        subtitle: "Multi-currency tax & subscription billing",
        icon: Receipt,
        href: "/services",
      },
      {
        title: "Role-Based Client Portals",
        subtitle: "Secure enterprise workspaces for clients",
        icon: Users,
        href: "/services",
      },
      {
        title: "Third-Party Data Sync",
        subtitle: "ERP, SAP, and accounting integrations",
        icon: RefreshCw,
        href: "/services",
      },
    ],
  },
  {
    id: "licensing-ulp",
    label: "Universal Licensing (ULP)",
    services: [
      {
        title: "Multi-Runtime SDK Publisher",
        subtitle: "Compiled SDKs across 13 languages",
        icon: KeyRound,
        href: "/services",
      },
      {
        title: "Hardware Node-Locking",
        subtitle: "CPU, Disk, MAC, and BIOS binding",
        icon: Cpu,
        href: "/services",
      },
      {
        title: "Trial & Offline Grace Periods",
        subtitle: "Cryptographic offline validation",
        icon: ShieldCheck,
        href: "/services",
      },
      {
        title: "Universal License Center (ULC)",
        subtitle: "In-app embeddable activation GUI",
        icon: AppWindow,
        href: "/services",
      },
      {
        title: "Activation & Revocation Dashboard",
        subtitle: "Real-time device tracking & blacklists",
        icon: BarChart3,
        href: "/services",
      },
      {
        title: "HMAC-SHA256 API Gate",
        subtitle: "Tamper-proof encrypted API channels",
        icon: Lock,
        href: "/services",
      },
    ],
  },
  {
    id: "design",
    label: "UI/UX & Product Design",
    services: [
      {
        title: "UI/UX System Design",
        subtitle: "Intuitive, high-conversion interfaces",
        icon: Palette,
        href: "/services",
      },
      {
        title: "Design Systems & Tokens",
        subtitle: "Figma and Tailwind component libraries",
        icon: Component,
        href: "/services",
      },
      {
        title: "UX Research & Wireframes",
        subtitle: "Data-backed frictionless user flows",
        icon: Layers,
        href: "/services",
      },
      {
        title: "Interactive Prototyping",
        subtitle: "High-fidelity clickable prototypes",
        icon: Sparkles,
        href: "/services",
      },
      {
        title: "Responsive Web Layouts",
        subtitle: "Pixel-perfect mobile & desktop views",
        icon: Layout,
        href: "/services",
      },
      {
        title: "Brand Identity Design",
        subtitle: "Digital brand systems, icons, & assets",
        icon: Brush,
        href: "/services",
      },
    ],
  },
  {
    id: "ai-solutions",
    label: "AI Solutions",
    badge: "New",
    services: [
      {
        title: "Autonomous AI Agents",
        subtitle: "Multi-agent workflows & task automation",
        icon: Bot,
        href: "/services",
      },
      {
        title: "Custom LLM & Vector RAG",
        subtitle: "Enterprise knowledge base integration",
        icon: BrainCircuit,
        href: "/services",
      },
      {
        title: "Intelligent Document OCR",
        subtitle: "Automated invoice & PDF data extraction",
        icon: FileSearch,
        href: "/services",
      },
      {
        title: "Support AI Assistants",
        subtitle: "Context-aware automated client support",
        icon: MessageSquareCode,
        href: "/services",
      },
      {
        title: "Predictive Analytics",
        subtitle: "Data-driven forecasting & insights",
        icon: TrendingUp,
        href: "/services",
      },
      {
        title: "High-Speed API Gateways",
        subtitle: "Optimized LLM inference & caching",
        icon: Zap,
        href: "/services",
      },
    ],
  },
];

export default function MegaMenuServices({
  isDark,
  onClose,
}: {
  isDark: boolean;
  onClose: () => void;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState("software-engineering");
  const activeCategory =
    SERVICE_CATEGORIES.find((cat) => cat.id === activeCategoryId) || SERVICE_CATEGORIES[0];

  return (
    <div
      className="wsd-mega-menu"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(960px, calc(100vw - 32px))",
        backgroundColor: isDark ? "#0d1322" : "#ffffff",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
        borderRadius: "20px",
        boxShadow: isDark
          ? "0 28px 70px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)"
          : "0 24px 60px -12px rgba(0, 0, 0, 0.15), 0 8px 24px -6px rgba(0, 0, 0, 0.06)",
        overflow: "hidden",
        zIndex: 1400,
      }}
    >
      {/* Main 2-Column Area */}
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
          {SERVICE_CATEGORIES.map((category) => {
            const isActive = category.id === activeCategoryId;
            return (
              <button
                key={category.id}
                type="button"
                onMouseEnter={() => setActiveCategoryId(category.id)}
                onClick={() => setActiveCategoryId(category.id)}
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
                  backgroundColor: isActive
                    ? "#2563eb"
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.16s ease",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {category.label}
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
          {activeCategory.services.map((service, idx) => {
            const Icon = service.icon;
            return (
              <Link
                key={idx}
                href={service.href}
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  textDecoration: "none",
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.04)",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                className="wsd-mega-service-card"
              >
                <div
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
                  <Icon size={19} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "13.5px",
                      fontWeight: 600,
                      color: isDark ? "#f8fafc" : "#0f172a",
                      lineHeight: 1.3,
                      marginBottom: "3px",
                    }}
                  >
                    {service.title}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(100, 116, 139, 0.9)",
                      lineHeight: 1.35,
                    }}
                  >
                    {service.subtitle}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

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

      <style>{`
        .wsd-mega-service-card:hover {
          background-color: ${isDark ? "rgba(37, 99, 235, 0.12)" : "rgba(37, 99, 235, 0.06)"} !important;
          border-color: rgba(37, 99, 235, 0.3) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
