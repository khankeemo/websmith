"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Landmark,
  ShoppingCart,
  HeartPulse,
  Cloud,
  Truck,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Lock,
  Cpu,
  Server,
  Layers,
  Sparkles,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { usePublicTheme } from "../../providers/PublicThemeProvider";
import { useLeadFunnel } from "../../providers/LeadFunnelProvider";

type SectorKey = "fintech" | "ecommerce" | "healthcare" | "saas" | "logistics";

interface SectorData {
  id: SectorKey;
  title: string;
  badge: string;
  headline: string;
  description: string;
  icon: any;
  stats: { label: string; value: string }[];
  challenges: { problem: string; solution: string }[];
  architecture: string[];
  techStack: string[];
  caseStudy: {
    client: string;
    metrics: string;
    summary: string;
  };
}

const SECTORS: Record<SectorKey, SectorData> = {
  fintech: {
    id: "fintech",
    title: "FinTech & Banking",
    badge: "PCI-DSS Level 1 & SOC2",
    headline: "Mission-Critical Financial Core & Low-Latency Transaction Engines",
    description:
      "We architect bulletproof banking platforms, sub-millisecond trading pipelines, and multi-currency cryptographic payment ledgers engineered for zero tolerance to downtime or data inconsistency.",
    icon: Landmark,
    stats: [
      { label: "Tx Latency SLA", value: "< 18ms" },
      { label: "Historical Uptime", value: "99.999%" },
      { label: "Daily Ledger Volume", value: "$42M+" },
      { label: "Security Compliance", value: "PCI-DSS" },
    ],
    challenges: [
      {
        problem: "Race conditions in high-concurrency wallet balance deductions",
        solution: "Pessimistic serializable locking combined with event-sourced idempotent transactions.",
      },
      {
        problem: "Regulatory auditing across multi-jurisdiction jurisdictions",
        solution: "Immutable cryptographic audit trails stamped with append-only ledger partitions.",
      },
      {
        problem: "Automated fraud detection at checkout with sub-50ms budget",
        solution: "Edge-computed rule heuristics & machine learning anomaly scoring before DB dispatch.",
      },
    ],
    architecture: [
      "Distributed Event-Sourced Ledger with Kafka & Redis Cluster",
      "AES-256-GCM Envelope Encryption for Customer Keys & Cards",
      "Hardware-Locked API Gateway with HMAC-SHA256 Request Signing",
      "Multi-region Active-Active Database Failover with Neon & PostgreSQL",
    ],
    techStack: ["Next.js 14", "PostgreSQL", "Kafka", "Redis Enterprise", "Stripe Connect", "AWS KMS", "Docker"],
    caseStudy: {
      client: "FinPulse Global Capital",
      metrics: "3.2x throughput increase, 0 duplicate charges over 14M transactions",
      summary: "Modernized a legacy core banking sync pipeline into a distributed microservice engine processing payments across 18 countries.",
    },
  },
  ecommerce: {
    id: "ecommerce",
    title: "E-Commerce & Retail",
    badge: "Sub-Second Checkout",
    headline: "High-Volume Omnichannel Marketplaces & Real-Time Inventory Engines",
    description:
      "Scalable digital storefronts and headless commerce engines designed to withstand Black Friday traffic surges, live flash sales, and complex multi-vendor commission splits without dropping carts.",
    icon: ShoppingCart,
    stats: [
      { label: "Cart Conversion Lift", value: "+34%" },
      { label: "Page Load (FCP)", value: "0.42s" },
      { label: "Flash Sale Concurrency", value: "50k/min" },
      { label: "SKU Catalog Indexing", value: "1.2M+" },
    ],
    challenges: [
      {
        problem: "Cart abandonment due to laggy checkout and slow shipping calculation",
        solution: "Pre-computed edge shipping calculators and 1-click tokenized checkout workflows.",
      },
      {
        problem: "Overselling inventory across physical stores and digital marketplaces",
        solution: "Two-phase atomic inventory reservation queues powered by Redis and transactional locks.",
      },
      {
        problem: "Multi-vendor tax reporting and instant vendor payouts",
        solution: "Automated tax nexus engines integrated with automated multi-split escrow accounts.",
      },
    ],
    architecture: [
      "Headless Next.js Frontend with ISR & Stale-While-Revalidate Caching",
      "Real-Time WebSocket Inventory Reservation & Stock Alerts",
      "ElasticSearch & Algolia Vector Product Discovery Pipeline",
      "Automated PDF Invoicing & Warehouse Barcode Packing Generation",
    ],
    techStack: ["Next.js", "TypeScript", "Algolia", "Redis", "Stripe Treasury", "Node.js", "PostgreSQL"],
    caseStudy: {
      client: "MarketCraft Multi-Vendor Hub",
      metrics: "Scaled to 850 active vendors and $18M annual GMV with 99.98% uptime",
      summary: "Replaced a monolithic platform with a headless micro-frontend ecosystem, shrinking checkout duration from 4.8s to 0.7s.",
    },
  },
  healthcare: {
    id: "healthcare",
    title: "Healthcare & MedTech",
    badge: "HIPAA & HITECH Compliant",
    headline: "Encrypted Telehealth Portals, Clinical EHR & Patient Engagement",
    description:
      "Secure patient-doctor ecosystems featuring WebRTC end-to-end encrypted video consultations, FHIR-standard medical record synchronizations, and automated appointment workflows.",
    icon: HeartPulse,
    stats: [
      { label: "Data Encryption", value: "AES-256" },
      { label: "Video Call Quality", value: "1080p HD" },
      { label: "HIPAA Compliant SLA", value: "100%" },
      { label: "Consultation Hours", value: "140k+" },
    ],
    challenges: [
      {
        problem: "Strict privacy constraints surrounding Protected Health Information (PHI)",
        solution: "Column-level encrypted databases, zero-knowledge patient storage, and automated access logs.",
      },
      {
        problem: "Unreliable video connectivity on low-bandwidth rural networks",
        solution: "Adaptive bitrate WebRTC streaming with automatic SFU fallback and failover relays.",
      },
      {
        problem: "Fragmented legacy Electronic Health Record (EHR) schemas",
        solution: "Standardized HL7/FHIR microservices normalizing medical histories across legacy hospital servers.",
      },
    ],
    architecture: [
      "Zero-Trust Identity Verification & Multi-Factor Hardware Tokens",
      "WebRTC Encrypted Peer-to-Peer & SFU Telehealth Infrastructure",
      "Automated e-Prescription & Pharmacy Dispatch Webhook Pipeline",
      "Comprehensive Audit Log Archiving with Write-Once Read-Many (WORM)",
    ],
    techStack: ["React", "WebRTC", "PostgreSQL", "FHIR API", "Docker", "AWS GovCloud", "Node.js"],
    caseStudy: {
      client: "TeleMed Direct Care",
      metrics: "Reduced patient check-in wait time by 62% across 45 clinical practices",
      summary: "Built a turnkey web and mobile telehealth portal enabling doctors to conduct secure consultations and issue digital prescriptions in minutes.",
    },
  },
  saas: {
    id: "saas",
    title: "Enterprise SaaS & B2B",
    badge: "Multi-Tenant Architecture",
    headline: "Multi-Tenant Enterprise Platforms, RBAC & Subscription Billing",
    description:
      "Full-cycle architecture for high-growth B2B SaaS applications: isolated tenant schemas, granular role-based permissions, automated seat-based billing, and self-serve developer APIs.",
    icon: Cloud,
    stats: [
      { label: "Tenant Isolation", value: "Schema-Level" },
      { label: "API Response Time", value: "< 24ms" },
      { label: "Seat License Cap", value: "Unlimited" },
      { label: "SSO Protocols", value: "SAML/OIDC" },
    ],
    challenges: [
      {
        problem: "Data leakage across multiple enterprise organizations in shared DBs",
        solution: "Row-level security (RLS) policies and separate tenant schema connection pools.",
      },
      {
        problem: "Complex enterprise billing with tier upgrades, pro-rating, and add-on seats",
        solution: "Custom usage-metering pipeline streaming event deltas into Stripe Billing webhooks.",
      },
      {
        problem: "Enterprise client requirements for custom SSO (Okta, Azure AD, Google)",
        solution: "Unified SAML 2.0 and OIDC authentication broker with automated team provisioning (SCIM).",
      },
    ],
    architecture: [
      "Dynamic Multi-Tenant Routing & Tenant-Specific Subdomains",
      "Granular RBAC with Permission Matrices & Team Scopes",
      "Metered Event Processing Pipeline for Real-Time Usage Quotas",
      "Public Developer REST & GraphQL APIs with Rate-Limiting & SDKs",
    ],
    techStack: ["Next.js App Router", "PostgreSQL", "Redis", "TailwindCSS", "Prisma", "Stripe Billing", "OAuth2"],
    caseStudy: {
      client: "ApexFlow Enterprise Suite",
      metrics: "Grew from 0 to 12,000 monthly active business seats in 8 months",
      summary: "Engineered an all-in-one operations hub with customizable workflows, automated notifications, and real-time collaborative spreadsheets.",
    },
  },
  logistics: {
    id: "logistics",
    title: "Logistics & Supply Chain",
    badge: "Real-Time Telematics",
    headline: "Fleet Tracking, Warehouse ERP & Automated Dispatch Systems",
    description:
      "Enterprise logistics command centers featuring real-time vehicle GPS telemetry, warehouse QR/barcode scanning, automated route optimization, and vendor freight reconciliation.",
    icon: Truck,
    stats: [
      { label: "Active Fleet Vehicles", value: "4,200+" },
      { label: "Fuel Cost Savings", value: "19.4%" },
      { label: "GPS Ping Frequency", value: "500ms" },
      { label: "Warehouse Scan SLA", value: "99.9%" },
    ],
    challenges: [
      {
        problem: "High data volume from thousands of continuous vehicle IoT telemetry pings",
        solution: "Time-series database partitioning with real-time geospatial indexing and compression.",
      },
      {
        problem: "Inefficient last-mile delivery routes resulting in excessive mileage and fuel",
        solution: "Algorithmic TSP routing engine factoring in traffic patterns, load limits, and delivery windows.",
      },
      {
        problem: "Discrepancies in warehouse receiving versus purchase order manifests",
        solution: "Mobile camera barcode/RFID scanning with instant PO reconciliation and discrepancy alerts.",
      },
    ],
    architecture: [
      "Geospatial Time-Series Streaming via WebSockets & MQTT",
      "Interactive Map Overlays with Vector Tiles & Real-Time Driver Markers",
      "Automated Proof-of-Delivery Digital Signatures & Photo Uploads",
      "Warehouse Inventory Bin-Location Routing & FIFO Picking Logic",
    ],
    techStack: ["Next.js", "PostgreSQL / PostGIS", "Redis", "MQTT", "WebSockets", "Mapbox GL", "Node.js"],
    caseStudy: {
      client: "TransLogix Global Fleet",
      metrics: "Reduced dispatch idle time by 44% across 8 regional distribution centers",
      summary: "Delivered a centralized logistics ERP unifying driver mobile apps, warehouse scanners, and executive route dashboards into one real-time interface.",
    },
  },
};

function IndustriesContent() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();
  const searchParams = useSearchParams();

  const sectorParam = searchParams.get("sector")?.toLowerCase() as SectorKey | undefined;
  const [activeSector, setActiveSector] = useState<SectorKey>(
    sectorParam && SECTORS[sectorParam] ? sectorParam : "fintech"
  );

  useEffect(() => {
    if (sectorParam && SECTORS[sectorParam]) {
      setActiveSector(sectorParam);
    }
  }, [sectorParam]);

  const current = SECTORS[activeSector];
  const CurrentIcon = current.icon;

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
          {(Object.keys(SECTORS) as SectorKey[]).map((key) => {
            const item = SECTORS[key];
            const Icon = item.icon;
            const isSelected = activeSector === key;
            return (
              <button
                key={key}
                onClick={() => setActiveSector(key)}
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
                <Icon size={18} color={isSelected ? "#3b82f6" : "currentColor"} />
                {item.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Sector Spotlight */}
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
                <CurrentIcon size={28} />
              </div>
              <div>
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
                <h2
                  style={{
                    fontSize: "clamp(22px, 3.5vw, 32px)",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    margin: 0,
                    color: isDark ? "#ffffff" : "#0f172a",
                  }}
                >
                  {current.headline}
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
            {current.description}
          </p>

          {/* Performance Stats Cards */}
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

            {/* Core Challenges Solved */}
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
          </div>

          {/* Case Study & Tech Stack Strip */}
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
          </div>
        </div>
      </div>

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
