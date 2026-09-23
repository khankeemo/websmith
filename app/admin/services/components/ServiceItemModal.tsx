// FILE: app/admin/services/components/ServiceItemModal.tsx
// PURPOSE: Modal for creating and editing Service Subcategories

"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import type { CmsServiceItem } from "@/lib/cms/types";
import LucideIcon, { COMMON_ICON_OPTIONS } from "@/components/shared/LucideIcon";

interface ServiceItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CmsServiceItem>) => Promise<void>;
  serviceItem?: CmsServiceItem | null;
  categoryName?: string;
}

export default function ServiceItemModal({
  isOpen,
  onClose,
  onSave,
  serviceItem,
  categoryName,
}: ServiceItemModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("Code2");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [deliverablesText, setDeliverablesText] = useState("");
  const [techStackText, setTechStackText] = useState("");
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [showInMenu, setShowInMenu] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serviceItem) {
      setName(serviceItem.name || serviceItem.title || "");
      setSlug(serviceItem.slug || "");
      setIcon(serviceItem.icon || "Code2");
      setShortDescription(serviceItem.shortDescription || "");
      setDescription(serviceItem.description || "");
      setDeliverablesText((serviceItem.deliverables || []).join("\n"));
      setTechStackText((serviceItem.techStack || []).join(", "));
      setDisplayOrder(serviceItem.displayOrder ?? 0);
      setShowInMenu(serviceItem.showInMenu !== false);
      setIsActive(serviceItem.isActive !== false);
    } else {
      setName("");
      setSlug("");
      setIcon("Code2");
      setShortDescription("");
      setDescription("");
      setDeliverablesText("Production Next.js 16 Web Apps\nMicroservices & High-Throughput REST APIs\nCI/CD pipelines with Docker & AWS");
      setTechStackText("Next.js, TypeScript, PostgreSQL, Tailwind CSS");
      setDisplayOrder(0);
      setShowInMenu(true);
      setIsActive(true);
    }
    setError(null);
  }, [serviceItem, isOpen]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!serviceItem) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a subcategory name.");
      return;
    }
    if (!shortDescription.trim()) {
      setError("Please provide a short description for the mega menu.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({
        name: name.trim(),
        title: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        icon: icon.trim() || "Code2",
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        deliverables: deliverablesText.split("\n").map((d) => d.trim()).filter(Boolean),
        techStack: techStackText.split(",").map((t) => t.trim()).filter(Boolean),
        displayOrder: Number(displayOrder) || 0,
        showInMenu,
        isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save service subcategory");
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
          maxWidth: "680px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
      >
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
              <LucideIcon name={icon} size={20} color="#2563eb" />
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {serviceItem ? `Edit Subcategory: ${serviceItem.name}` : "Add Subcategory"}
              </h2>
              {categoryName && (
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                  Assigned under: <strong style={{ color: "#2563eb" }}>{categoryName}</strong>
                </p>
              )}
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
              <label style={labelStyle}>Subcategory Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Microservices & API Architecture"
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
                placeholder="e.g. microservices-apis"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Subcategory Icon</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g. Code2, Smartphone, Server"
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


          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Short Description (Mega Menu Subtitle) *</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="e.g. High-throughput distributed REST & GraphQL backends"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Deliverables &amp; Highlights (1 item per line)</label>
            <textarea
              rows={3}
              value={deliverablesText}
              onChange={(e) => setDeliverablesText(e.target.value)}
              placeholder="Scalable microservices with sub-50ms latency&#10;Kafka event streams with dead-letter retry"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Technology Stack (Comma-separated)</label>
            <textarea
              rows={2}
              value={techStackText}
              onChange={(e) => setTechStackText(e.target.value)}
              placeholder="Go, Node.js, Docker, Kubernetes, PostgreSQL"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: "24px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ width: "140px" }}>
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
                  checked={showInMenu}
                  onChange={(e) => setShowInMenu(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#2563eb" }}
                />
                <span>Show in Services Mega Menu</span>
              </label>
            </div>

            <div style={{ paddingTop: "18px" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#2563eb" }}
                />
                <span>Active</span>
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "20px",
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
              {saving ? "Saving..." : serviceItem ? "Update Subcategory" : "Add Subcategory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
