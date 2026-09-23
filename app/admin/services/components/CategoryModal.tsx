// FILE: app/admin/services/components/CategoryModal.tsx
// PURPOSE: Modal for creating and editing Service Categories

"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { CmsServiceCategory } from "@/lib/cms/types";
import LucideIcon, { COMMON_ICON_OPTIONS } from "@/components/shared/LucideIcon";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CmsServiceCategory>) => Promise<void>;
  category?: CmsServiceCategory | null;
}

export default function CategoryModal({
  isOpen,
  onClose,
  onSave,
  category,
}: CategoryModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("Code2");
  const [description, setDescription] = useState("");
  const [badge, setBadge] = useState("");
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setName(category.name || "");
      setSlug(category.slug || "");
      setIcon(category.icon || "Code2");
      setDescription(category.description || "");
      setBadge(category.badge || "");
      setDisplayOrder(category.displayOrder ?? 0);
      setIsActive(category.isActive !== false);
    } else {
      setName("");
      setSlug("");
      setIcon("Code2");
      setDescription("");
      setBadge("");
      setDisplayOrder(0);
      setIsActive(true);
    }
    setError(null);
  }, [category, isOpen]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!category) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a category name.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave({
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        icon: icon.trim() || "Code2",
        description: description.trim(),
        badge: badge.trim(),
        displayOrder: Number(displayOrder) || 0,
        isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save category");
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
          maxWidth: "540px",
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
                {category ? `Edit Category: ${category.name}` : "Create Service Category"}
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                High-level group for related software capabilities and services.
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

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px" }}>
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

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. AI Solutions & Automation"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>URL Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. ai-solutions"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Badge / Highlight</label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="e.g. Next-Gen, High-Scale"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Category Icon</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g. Bot, BrainCircuit, Code2"
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
            <label style={labelStyle}>Summary Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this capability pillar..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "center", marginBottom: "20px" }}>
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
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#2563eb" }}
                />
                <span>Active &amp; Visible in Mega Menu</span>
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
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
              {saving ? "Saving..." : category ? "Update Category" : "Create Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
