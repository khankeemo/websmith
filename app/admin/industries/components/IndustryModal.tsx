// FILE: app/admin/industries/components/IndustryModal.tsx
// PURPOSE: Modal form for creating and editing CMS Industries

"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { CmsIndustry } from "@/lib/cms/types";
import LucideIcon, { COMMON_ICON_OPTIONS } from "@/components/shared/LucideIcon";

interface IndustryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CmsIndustry>) => Promise<void>;
  industry?: CmsIndustry | null;
}

export default function IndustryModal({
  isOpen,
  onClose,
  onSave,
  industry,
}: IndustryModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("Landmark");
  const [shortDescription, setShortDescription] = useState("");
  const [badge, setBadge] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  // Dynamic arrays
  const [stats, setStats] = useState<Array<{ label: string; value: string }>>([]);
  const [challenges, setChallenges] = useState<Array<{ problem: string; solution: string }>>([]);
  const [techStackText, setTechStackText] = useState("");
  const [architectureText, setArchitectureText] = useState("");

  // Case study
  const [caseStudyClient, setCaseStudyClient] = useState("");
  const [caseStudyMetrics, setCaseStudyMetrics] = useState("");
  const [caseStudySummary, setCaseStudySummary] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (industry) {
      setName(industry.name || "");
      setSlug(industry.slug || "");
      setIcon(industry.icon || "Landmark");
      setShortDescription(industry.shortDescription || "");
      setBadge(industry.badge || "");
      setHeadline(industry.headline || "");
      setDescription(industry.description || "");
      setDisplayOrder(industry.displayOrder ?? 0);
      setIsActive(industry.isActive !== false);
      setStats(industry.stats || []);
      setChallenges(industry.challenges || []);
      setTechStackText((industry.techStack || []).join(", "));
      setArchitectureText((industry.architecture || []).join("\n"));
      setCaseStudyClient(industry.caseStudy?.client || "");
      setCaseStudyMetrics(industry.caseStudy?.metrics || "");
      setCaseStudySummary(industry.caseStudy?.summary || "");
    } else {
      setName("");
      setSlug("");
      setIcon("Landmark");
      setShortDescription("");
      setBadge("");
      setHeadline("");
      setDescription("");
      setDisplayOrder(0);
      setIsActive(true);
      setStats([
        { label: "Uptime SLA", value: "99.99%" },
        { label: "Performance", value: "< 25ms" },
      ]);
      setChallenges([
        { problem: "High-volume peak traffic", solution: "Distributed event streaming & Redis caching." },
      ]);
      setTechStackText("Next.js, PostgreSQL, Redis, Docker");
      setArchitectureText("Distributed Event-Sourced Architecture\nRole-Based Access Control");
      setCaseStudyClient("");
      setCaseStudyMetrics("");
      setCaseStudySummary("");
    }
    setError(null);
  }, [industry, isOpen]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!industry) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    }
  };

  const handleAddStat = () => {
    setStats([...stats, { label: "", value: "" }]);
  };

  const handleStatChange = (index: number, field: "label" | "value", val: string) => {
    const next = [...stats];
    next[index][field] = val;
    setStats(next);
  };

  const handleRemoveStat = (index: number) => {
    setStats(stats.filter((_, i) => i !== index));
  };

  const handleAddChallenge = () => {
    setChallenges([...challenges, { problem: "", solution: "" }]);
  };

  const handleChallengeChange = (index: number, field: "problem" | "solution", val: string) => {
    const next = [...challenges];
    next[index][field] = val;
    setChallenges(next);
  };

  const handleRemoveChallenge = (index: number) => {
    setChallenges(challenges.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide an industry name.");
      return;
    }
    if (!shortDescription.trim()) {
      setError("Please provide a short description for the mega menu.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const techStack = techStackText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const architecture = architectureText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const caseStudy =
        caseStudyClient.trim() || caseStudyMetrics.trim() || caseStudySummary.trim()
          ? {
              client: caseStudyClient.trim(),
              metrics: caseStudyMetrics.trim(),
              summary: caseStudySummary.trim(),
            }
          : undefined;

      const payload: Partial<CmsIndustry> = {
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        icon: icon.trim() || "Landmark",
        shortDescription: shortDescription.trim(),
        badge: badge.trim(),
        headline: headline.trim(),
        description: description.trim(),
        stats: stats.filter((s) => s.label.trim() && s.value.trim()),
        challenges: challenges.filter((c) => c.problem.trim() && c.solution.trim()),
        techStack,
        architecture,
        caseStudy,
        displayOrder: Number(displayOrder) || 0,
        isActive,
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save industry");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid var(--input-border)",
    backgroundColor: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: "13px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "6px",
    color: "var(--text-primary)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "var(--card-bg)",
          color: "var(--text-primary)",
          border: "1px solid var(--card-border)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid var(--card-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LucideIcon name={icon} size={22} color="#2563eb" />
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {industry ? `Edit Industry: ${industry.name}` : "Add New Industry"}
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                Configure dropdown menu details and public sector page architecture.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px",
              borderRadius: "8px",
              backgroundColor: "var(--surface-muted)",
              border: "1px solid var(--surface-border)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          {error && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#ef4444",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Industry Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Travel & Hospitality"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>URL Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. travel-hospitality"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Icon Name or Image URL</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="e.g. Landmark, Plane, Shield"
                  style={inputStyle}
                />
                <select
                  onChange={(e) => {
                    if (e.target.value) setIcon(e.target.value);
                  }}
                  value=""
                  style={{
                    padding: "0 12px",
                    borderRadius: "8px",
                    backgroundColor: "var(--card-bg, #ffffff)",
                    color: "var(--text-primary, #0f172a)",
                    border: "1px solid var(--input-border, #cbd5e1)",
                    fontSize: "13px",
                    fontWeight: 500,
                    minWidth: "170px",
                    cursor: "pointer",
                  }}
                >
                  <option value="" disabled style={{ backgroundColor: "var(--card-bg, #ffffff)", color: "var(--text-secondary, #64748b)" }}>
                    Pick Icon...
                  </option>
                  {COMMON_ICON_OPTIONS.map((item) => (
                    <option
                      key={item.name}
                      value={item.name}
                      style={{ backgroundColor: "var(--card-bg, #ffffff)", color: "var(--text-primary, #0f172a)" }}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Badge Tag (Optional)</label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="e.g. PCI-DSS Level 1, Sub-Second"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Short Description (Mega Menu Subtitle) *</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="e.g. Real-time booking engines, flight telematics, and loyalty portals"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Page Spotlight Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. High-Volume Global Booking Core & Low-Latency Engines"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Comprehensive Sector Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain technical approach, security standards, and high-scale delivery..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Stats Builder */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Key Performance Metrics &amp; SLAs</label>
              <button
                type="button"
                onClick={handleAddStat}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Plus size={13} /> Add Stat
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {stats.map((st, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Label (e.g. Historical Uptime)"
                    value={st.label}
                    onChange={(e) => handleStatChange(i, "label", e.target.value)}
                    style={{ ...inputStyle, flex: 2 }}
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 99.999%)"
                    value={st.value}
                    onChange={(e) => handleStatChange(i, "value", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveStat(i)}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Challenges Builder */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Domain Challenges &amp; Engineered Resolutions</label>
              <button
                type="button"
                onClick={handleAddChallenge}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Plus size={13} /> Add Challenge
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {challenges.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "var(--surface-muted)",
                    border: "1px solid var(--surface-border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444" }}>Challenge #{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChallenge(i)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px" }}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Problem statement (e.g. Concurrency locking in flash seat bookings)"
                    value={c.problem}
                    onChange={(e) => handleChallengeChange(i, "problem", e.target.value)}
                    style={{ ...inputStyle, marginBottom: "8px" }}
                  />
                  <input
                    type="text"
                    placeholder="Engineered solution (e.g. Atomic reservation queues with Redis locks)"
                    value={c.solution}
                    onChange={(e) => handleChallengeChange(i, "solution", e.target.value)}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Architecture & Tech Stack */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Platform Architecture (1 per line)</label>
              <textarea
                rows={3}
                value={architectureText}
                onChange={(e) => setArchitectureText(e.target.value)}
                placeholder="Distributed event ledger with Kafka\nEnvelope encryption with KMS"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Tech Stack (Comma-separated)</label>
              <textarea
                rows={3}
                value={techStackText}
                onChange={(e) => setTechStackText(e.target.value)}
                placeholder="Next.js, PostgreSQL, Kafka, Redis, Docker"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>

          {/* Case Study */}
          <div
            style={{
              padding: "14px",
              borderRadius: "10px",
              backgroundColor: "var(--surface-muted)",
              border: "1px solid var(--surface-border)",
              marginBottom: "16px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb", marginBottom: "8px", textTransform: "uppercase" }}>
              Spotlight Case Study (Optional)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Client Name (e.g. FinPulse Capital)"
                value={caseStudyClient}
                onChange={(e) => setCaseStudyClient(e.target.value)}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Key Result Metric (e.g. 3.2x throughput increase)"
                value={caseStudyMetrics}
                onChange={(e) => setCaseStudyMetrics(e.target.value)}
                style={inputStyle}
              />
            </div>
            <textarea
              rows={2}
              placeholder="Case study summary (e.g. Migrated core transaction engine...)"
              value={caseStudySummary}
              onChange={(e) => setCaseStudySummary(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Display Controls */}
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <div style={{ width: "160px" }}>
              <label style={labelStyle}>Display Order</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                style={inputStyle}
              />
            </div>

            <div style={{ paddingTop: "18px" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#2563eb" }}
                />
                <span>Active &amp; Visible in Mega Menu</span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--card-border)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "1px solid var(--input-border)",
                backgroundColor: "var(--surface-muted)",
                color: "var(--text-primary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "9px 20px",
                borderRadius: "8px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                fontSize: "13px",
                fontWeight: 600,
                cursor: saving ? "default" : "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
              }}
            >
              {saving ? "Saving..." : industry ? "Update Industry" : "Create Industry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
