"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Code2,
  Lock,
  Compass,
  Cpu,
  Server,
  Layers,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Terminal,
  HelpCircle,
  Mail,
  Headphones,
  ArrowRight,
  KeyRound,
  BookOpen,
} from "lucide-react";
import { usePublicTheme } from "../../providers/PublicThemeProvider";
import { useLeadFunnel } from "../../providers/LeadFunnelProvider";
import API from "../../../core/services/apiService";

interface DocArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  badge?: string;
  code?: {
    lang: string;
    snippet: string;
  };
  steps?: string[];
  notes?: string;
}

const DOC_CATEGORIES = [
  { id: "getting-started", label: "Getting Started & Delivery", icon: Compass },
  { id: "security", label: "Security & Cryptography", icon: Lock },
  { id: "licensing", label: "ULP Licensing SDKs & APIs", icon: KeyRound },
  { id: "portal", label: "Client Workspace & Invoicing", icon: Layers },
  { id: "troubleshooting", label: "Troubleshooting & SLAs", icon: HelpCircle },
];

const DOC_ARTICLES: Record<string, DocArticle[]> = {
  "getting-started": [
    {
      id: "engagement-lifecycle",
      category: "Getting Started & Delivery",
      title: "Project Engagement & Architecture Roadmap",
      summary: "How engagements transition from discovery consultation to milestone delivery, staging verification, and production handoff.",
      steps: [
        "Phase 1: Architecture Discovery & Technical Requirements Definition",
        "Phase 2: Milestone Agreement, Deliverables Scope & Signed SLA",
        "Phase 3: Real-Time Sprints in Dedicated Client Portal",
        "Phase 4: Staging Deployment & Automated Regression Verification",
        "Phase 5: Production Release, Zero-Downtime Migration & Handover",
      ],
      notes: "Every client is provisioned a dedicated Client Portal workspace with direct ticket channels to the engineering architects.",
    },
    {
      id: "environment-setup",
      category: "Getting Started & Delivery",
      title: "Repository Access & Staging Environments",
      summary: "How WebSmith coordinates version control, automated staging branches, and database sandbox credentials for client engineering leads.",
      code: {
        lang: "bash",
        snippet: `# Clone client private repository via SSH
git clone git@github.com:websmith-digital/client-workspace.git
cd client-workspace

# Install pinned dependencies
npm ci

# Configure environment secrets
cp .env.example .env.local
npm run dev`,
      },
    },
  ],
  security: [
    {
      id: "hmac-signing",
      category: "Security & Cryptography",
      title: "HMAC-SHA256 Request Authentication",
      badge: "Enterprise Standard",
      summary: "All high-throughput API endpoints and webhook dispatches require cryptographic HMAC-SHA256 request signing with timestamp replay protection.",
      code: {
        lang: "typescript",
        snippet: `import crypto from "crypto";

export function signPayload(body: string, secretKey: string): { timestamp: number; signature: string } {
  const timestamp = Date.now();
  const signaturePayload = \`\${timestamp}.\${body}\`;
  
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(signaturePayload)
    .digest("hex");
    
  return { timestamp, signature };
}`,
      },
      notes: "Signatures older than 300 seconds are rejected by API gateways to prevent replay vulnerabilities.",
    },
    {
      id: "envelope-encryption",
      category: "Security & Cryptography",
      title: "AES-256-GCM Credential Vaulting",
      summary: "Customer secrets, OAuth tokens, and payment credentials are encrypted using AES-256-GCM envelope encryption with distinct initialization vectors.",
      steps: [
        "Unique 96-bit Initialization Vector (IV) generated per record",
        "Encrypted with primary AES-256 vault key via hardware KMS",
        "128-bit authentication tag appended for cryptographic tamper detection",
        "Zero unencrypted credentials stored in database tables or logs",
      ],
    },
  ],
  licensing: [
    {
      id: "ulp-validation",
      category: "ULP Licensing SDKs & APIs",
      title: "Hardware Node-Locking & Offline Validation",
      badge: "13 SDK Languages",
      summary: "The Universal License Platform (ULP) binds commercial software licenses to physical hardware signatures with cryptographic offline grace allowances.",
      code: {
        lang: "python",
        snippet: `from websmith_ulp import LicenseClient

# Initialize client with public enterprise key
client = LicenseClient(
    public_key="ULP_PUB_3f94a87c12...",
    product_code="APEX_FLOW_ENTERPRISE",
    cache_directory="~/.license_cache"
)

# Validate license node-locking against current machine hardware
status = client.verify_active_session()
if not status.is_valid:
    raise PermissionError(f"License expired or node mismatch: {status.error_code}")

print(f"Verified licensed seats: {status.allowed_seats}")`,
      },
      notes: "The ULP compiler produces native static libraries for Python, C++, Go, Rust, C#, Java, Swift, Node.js, and more.",
    },
    {
      id: "license-heartbeat",
      category: "ULP Licensing SDKs & APIs",
      title: "Online Revocation & Heartbeat Protocol",
      summary: "Desktop and server installations periodically phone home over encrypted TLS to refresh cryptographic grace tokens without interrupting offline users.",
      steps: [
        "Automated background ping dispatched every 24 hours",
        "Tamper-proof response signed by WebSmith Licensing Authority",
        "7-day graceful offline tolerance before requiring network re-validation",
        "Instant remote kill-switch for blacklisted, stolen, or refunded keys",
      ],
    },
  ],
  portal: [
    {
      id: "portal-overview",
      category: "Client Workspace & Invoicing",
      title: "Client Portal Navigation & Milestones",
      summary: "Manage deliverables, approve sprint scopes, download invoices, and initiate instant chat tickets from your private workspace.",
      steps: [
        "Real-Time Milestone Board: Track sprint velocity and acceptance criteria",
        "Shared Asset Vault: Encrypted download links for builds, Figma assets, and exports",
        "Integrated Invoicing: View itemized receipts, PDF invoices, and payment histories",
        "Secure Direct Messenger: Fast-track communication directly with your assigned architects",
      ],
      notes: "Invitations are sent automatically upon project kickoff with passwordless magic link support.",
    },
  ],
  troubleshooting: [
    {
      id: "sla-escalation",
      category: "Troubleshooting & SLAs",
      title: "Production SLA & Severity Matrix",
      badge: "24/7 Monitoring",
      summary: "Our guaranteed service level agreements and emergency response timelines based on incident severity.",
      steps: [
        "Severity 1 (Critical Outage): Immediate architect response within < 15 minutes",
        "Severity 2 (Degraded Performance): Triage and mitigation within < 60 minutes",
        "Severity 3 (Feature Bug / Minor Defect): Resolution in next scheduled release sprint",
        "Severity 4 (General Inquiries & Guidance): Response within < 4 business hours",
      ],
      notes: "Direct telephone escalation lines are provided to all active Enterprise Retainer clients.",
    },
  ],
};

export default function DocumentationPage() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();

  const [activeCategory, setActiveCategory] = useState<string>("getting-started");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const [contactInfo, setContactInfo] = useState({
    email: "support@websmithdigital.com",
    sales_email: "sales@websmithdigital.com",
  });

  useEffect(() => {
    API.get("/settings/public/contact_info")
      .then((res) => {
        if (res.data?.success && res.data.data) {
          setContactInfo({
            email: res.data.data.email || "support@websmithdigital.com",
            sales_email: res.data.data.sales_email || "sales@websmithdigital.com",
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  // Filter articles based on category and search query
  const displayedArticles = React.useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const all: DocArticle[] = [];
      Object.values(DOC_ARTICLES).forEach((list) => {
        list.forEach((art) => {
          if (
            art.title.toLowerCase().includes(q) ||
            art.summary.toLowerCase().includes(q) ||
            art.category.toLowerCase().includes(q)
          ) {
            all.push(art);
          }
        });
      });
      return all;
    }
    return DOC_ARTICLES[activeCategory] || [];
  }, [activeCategory, searchQuery]);

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
      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto 48px",
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
          <BookOpen size={14} /> Knowledge Base &amp; Technical Specs
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
          WebSmith{" "}
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
            Documentation Center
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 19px)",
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
            maxWidth: "740px",
            margin: "0 auto 36px",
            lineHeight: 1.65,
          }}
        >
          Comprehensive architectural specifications, HMAC security guides, Universal License Platform SDK integrations, and client workspace workflows.
        </p>

        {/* Live Search Input */}
        <div style={{ maxWidth: "560px", margin: "0 auto", position: "relative" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "18px",
              top: "50%",
              transform: "translateY(-50%)",
              color: isDark ? "rgba(255, 255, 255, 0.4)" : "#94a3b8",
            }}
          />
          <input
            type="text"
            placeholder="Search guides, HMAC signing, SDK functions, or SLAs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "13px 18px 13px 48px",
              borderRadius: "9999px",
              backgroundColor: isDark ? "rgba(13, 19, 34, 0.85)" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
              color: isDark ? "#ffffff" : "#0f172a",
              fontSize: "14.5px",
              outline: "none",
              boxShadow: isDark ? "none" : "0 4px 16px rgba(0, 0, 0, 0.05)",
            }}
          />
        </div>
      </div>

      {/* Main Documentation Interactive Layout */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 64px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "36px",
          alignItems: "start",
        }}
      >
        {/* Left Navigation Sidebar */}
        <aside
          style={{
            position: "sticky",
            top: "100px",
            borderRadius: "22px",
            padding: "16px",
            backgroundColor: isDark ? "rgba(13, 19, 34, 0.8)" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            boxShadow: isDark ? "none" : "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div
            style={{
              fontSize: "11.5px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: isDark ? "rgba(255, 255, 255, 0.4)" : "#94a3b8",
              padding: "8px 12px 4px",
            }}
          >
            Documentation Topics
          </div>

          {DOC_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = !searchQuery && activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory(cat.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "none",
                  backgroundColor: isSelected
                    ? isDark
                      ? "rgba(37, 99, 235, 0.25)"
                      : "rgba(37, 99, 235, 0.1)"
                    : "transparent",
                  color: isSelected ? "#3b82f6" : isDark ? "rgba(255, 255, 255, 0.75)" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={18} color={isSelected ? "#3b82f6" : "currentColor"} />
                <span style={{ flex: 1 }}>{cat.label}</span>
                {isSelected && <ChevronRight size={14} color="#3b82f6" />}
              </button>
            );
          })}

          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b",
                marginBottom: "8px",
                padding: "0 8px",
              }}
            >
              Support Channels
            </div>
            <a
              href={`mailto:${contactInfo.email}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                borderRadius: "10px",
                fontSize: "12.5px",
                color: "#3b82f6",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              <Mail size={15} /> {contactInfo.email}
            </a>
          </div>
        </aside>

        {/* Right Content Area: Articles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "28px", gridColumn: "span 2" }}>
          {searchQuery && (
            <div style={{ fontSize: "14px", color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b" }}>
              Showing results for: <strong>"{searchQuery}"</strong> ({displayedArticles.length} articles)
            </div>
          )}

          {displayedArticles.length === 0 ? (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                borderRadius: "20px",
                backgroundColor: isDark ? "rgba(13, 19, 34, 0.6)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              }}
            >
              <HelpCircle size={32} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>No matching documentation found</div>
              <p style={{ fontSize: "14px", color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b" }}>
                Try searching for broader keywords like "security", "SDK", "HMAC", or "milestones".
              </p>
            </div>
          ) : (
            displayedArticles.map((art) => (
              <article
                key={art.id}
                id={art.id}
                style={{
                  borderRadius: "24px",
                  padding: "36px clamp(20px, 3.5vw, 40px)",
                  backgroundColor: isDark ? "rgba(13, 19, 34, 0.8)" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  boxShadow: isDark
                    ? "0 16px 40px -10px rgba(0, 0, 0, 0.5)"
                    : "0 8px 24px -4px rgba(0, 0, 0, 0.04)",
                }}
              >
                {/* Article Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#3b82f6",
                    }}
                  >
                    {art.category}
                  </span>
                  {art.badge && (
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
                        color: "#10b981",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      {art.badge}
                    </span>
                  )}
                </div>

                <h2
                  style={{
                    fontSize: "clamp(20px, 2.5vw, 26px)",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    marginBottom: "12px",
                    color: isDark ? "#ffffff" : "#0f172a",
                  }}
                >
                  {art.title}
                </h2>

                <p
                  style={{
                    fontSize: "15px",
                    lineHeight: 1.65,
                    color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
                    marginBottom: "24px",
                  }}
                >
                  {art.summary}
                </p>

                {/* Steps Section */}
                {art.steps && (
                  <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {art.steps.map((step, sIdx) => (
                      <div
                        key={sIdx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          padding: "12px 16px",
                          borderRadius: "12px",
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#f8fafc",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid #e2e8f0",
                        }}
                      >
                        <CheckCircle2 size={16} color="#3b82f6" style={{ marginTop: "2px", flexShrink: 0 }} />
                        <span style={{ fontSize: "13.5px", lineHeight: 1.5, color: isDark ? "#f8fafc" : "#1e293b" }}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Code Block Snippet */}
                {art.code && (
                  <div
                    style={{
                      borderRadius: "16px",
                      backgroundColor: "#030712",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      overflow: "hidden",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 16px",
                        backgroundColor: "rgba(255, 255, 255, 0.04)",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Terminal size={14} color="#3b82f6" />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255, 255, 255, 0.6)", textTransform: "uppercase" }}>
                          {art.code.lang}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(art.code!.snippet, art.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          border: "none",
                          color: "#ffffff",
                          fontSize: "11.5px",
                          cursor: "pointer",
                        }}
                      >
                        {copiedSnippet === art.id ? (
                          <>
                            <Check size={12} color="#10b981" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy Code
                          </>
                        )}
                      </button>
                    </div>

                    <pre
                      style={{
                        margin: 0,
                        padding: "18px",
                        fontSize: "13px",
                        lineHeight: 1.6,
                        color: "#38bdf8",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        overflowX: "auto",
                      }}
                    >
                      <code>{art.code.snippet}</code>
                    </pre>
                  </div>
                )}

                {/* Important Notes */}
                {art.notes && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      backgroundColor: isDark ? "rgba(37, 99, 235, 0.1)" : "rgba(37, 99, 235, 0.06)",
                      border: isDark ? "1px solid rgba(37, 99, 235, 0.25)" : "1px solid rgba(37, 99, 235, 0.15)",
                      fontSize: "13px",
                      color: isDark ? "rgba(255, 255, 255, 0.75)" : "#334155",
                      lineHeight: 1.5,
                    }}
                  >
                    <Sparkles size={16} color="#3b82f6" style={{ marginTop: "2px", flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: "#3b82f6" }}>Architect Note: </strong>
                      {art.notes}
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>

      {/* Bottom Technical Support Callout */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "80px auto 0",
          padding: "0 clamp(20px, 4vw, 64px)",
        }}
      >
        <div
          style={{
            padding: "48px clamp(24px, 5vw, 64px)",
            borderRadius: "28px",
            textAlign: "center",
            background: isDark
              ? "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(13, 19, 34, 0.85) 100%)"
              : "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, #ffffff 100%)",
            border: isDark ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid rgba(37, 99, 235, 0.15)",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(22px, 3.5vw, 34px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "12px",
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            Require direct architectural assistance or API onboarding?
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
            Our principal engineers provide one-on-one integration reviews, compliance audits, and custom SDK deployment pipelines.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => openLeadServicesModal()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 28px",
                borderRadius: "9999px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#ffffff",
                background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 20px -4px rgba(37, 99, 235, 0.4)",
              }}
            >
              Request Integration Review <ArrowRight size={15} />
            </button>
            <Link
              href="/contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                borderRadius: "9999px",
                fontSize: "14px",
                fontWeight: 600,
                color: isDark ? "#ffffff" : "#0f172a",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                textDecoration: "none",
              }}
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
