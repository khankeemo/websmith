// FILE: app/admin/industries/page.tsx
// PURPOSE: Admin dashboard page for managing Industries (Mega Menu & Dedicated Pages)

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Search, Building2, Pencil, Trash2, CheckCircle2, XCircle, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { ViewModeToggle, GridListView } from "@/components/ui/ViewModeToggle";
import NavbarVisibilityToggle from "@/components/admin/NavbarVisibilityToggle";
import LucideIcon from "@/components/shared/LucideIcon";
import IndustryModal from "./components/IndustryModal";
import {
  getAdminIndustries,
  createIndustry,
  updateIndustry,
  deleteIndustry,
} from "@/lib/cms/cmsService";
import type { CmsIndustry } from "@/lib/cms/types";

export default function AdminIndustriesPage() {
  const [industries, setIndustries] = useState<CmsIndustry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<GridListView>("grid");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<CmsIndustry | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminIndustries();
      setIndustries(data);
    } catch (err: any) {
      setError(err.message || "Failed to load industries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIndustries();
  }, []);

  const handleOpenCreate = () => {
    setEditingIndustry(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (industry: CmsIndustry) => {
    setEditingIndustry(industry);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: Partial<CmsIndustry>) => {
    try {
      if (editingIndustry?._id) {
        await updateIndustry(editingIndustry._id, payload);
        setActionMessage({ type: "success", text: `Industry "${payload.name}" updated successfully.` });
      } else {
        await createIndustry(payload);
        setActionMessage({ type: "success", text: `Industry "${payload.name}" created successfully.` });
      }
      await loadIndustries();
    } catch (err: any) {
      throw new Error(err.message || "Operation failed");
    }
  };

  const handleDelete = async (industry: CmsIndustry) => {
    if (!industry._id) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete the "${industry.name}" industry? This will remove it from the mega menu and public website.`);
    if (!confirmDelete) return;

    try {
      await deleteIndustry(industry._id);
      setActionMessage({ type: "success", text: `Industry "${industry.name}" deleted.` });
      await loadIndustries();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to delete industry." });
    }
  };

  const handleToggleActive = async (industry: CmsIndustry) => {
    if (!industry._id) return;
    try {
      const nextState = !industry.isActive;
      await updateIndustry(industry._id, { isActive: nextState });
      setActionMessage({
        type: "success",
        text: `Industry "${industry.name}" is now ${nextState ? "visible in" : "hidden from"} public mega menu.`,
      });
      await loadIndustries();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update industry status." });
    }
  };

  const handleReorder = async (industry: CmsIndustry, direction: "up" | "down") => {
    if (!industry._id) return;
    const currentIndex = industries.findIndex((i) => i._id === industry._id);
    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === industries.length - 1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetItem = industries[targetIndex];
    if (!targetItem._id) return;

    try {
      const tempOrder = industry.displayOrder ?? currentIndex;
      const targetOrder = targetItem.displayOrder ?? targetIndex;

      await Promise.all([
        updateIndustry(industry._id, { displayOrder: targetOrder }),
        updateIndustry(targetItem._id, { displayOrder: tempOrder }),
      ]);

      await loadIndustries();
    } catch (err: any) {
      setActionMessage({ type: "error", text: "Failed to reorder industries." });
    }
  };

  const filteredIndustries = useMemo(() => {
    if (!searchTerm.trim()) return industries;
    const q = searchTerm.toLowerCase();
    return industries.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.shortDescription && i.shortDescription.toLowerCase().includes(q)) ||
        (i.headline && i.headline.toLowerCase().includes(q)) ||
        i.slug.toLowerCase().includes(q)
    );
  }, [industries, searchTerm]);

  return (
    <div style={styles.container} className="wsd-page admin-panel-scope">
      {/* Unified Header */}
      <div style={styles.header} className="industries-header wsd-page-header">
        <div style={styles.headerTitleBlock}>
          <h1 style={styles.title}>Industries</h1>
          <p style={styles.subtitle}>Manage industries from one place</p>
        </div>

        {/* WIDE TOP & MIDDLE SEARCH BAR */}
        <div style={styles.middleSearchWrap} className="industries-middle-search">
          <div style={styles.searchBox} className="admin-search-box wsd-search-box">
            <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search industries by name, subtitle, or headline..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* RIGHT ACTION BUTTONS */}
        <div style={styles.headerButtons} className="wsd-page-actions">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <NavbarVisibilityToggle
            sectionKey="industries"
            label="Industries"
            variant="compact"
          />
          <button onClick={handleOpenCreate} style={styles.addBtn} className="admin-primary-btn add-btn">
            <Plus size={16} />
            <span>New Industry</span>
          </button>
        </div>
      </div>

      {/* Alert notification message */}
      {actionMessage && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "12px",
            marginBottom: "20px",
            backgroundColor: actionMessage.type === "success" ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
            border: actionMessage.type === "success" ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
            color: actionMessage.type === "success" ? "#16a34a" : "#ef4444",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "16px" }}
          >
            ×
          </button>
        </div>
      )}

      {/* Loading & Error States */}
      {loading && (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading industries from database...
        </div>
      )}

      {error && (
        <div style={{ padding: "20px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          {error}
        </div>
      )}

      {!loading && !error && filteredIndustries.length === 0 && (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            borderRadius: "16px",
            border: "1.5px dashed var(--card-border)",
            backgroundColor: "var(--surface-muted)",
            color: "var(--text-secondary)",
          }}
        >
          <Building2 size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 6px", color: "var(--text-primary)" }}>No industries found</h3>
          <p style={{ fontSize: "13px", margin: "0 0 16px" }}>
            {searchTerm ? "No industries match your search criteria." : "Create your first industry to populate the mega menu."}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            + Add Industry
          </button>
        </div>
      )}

      {/* Grid View */}
      {!loading && !error && viewMode === "grid" && filteredIndustries.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "20px",
          }}
        >
          {filteredIndustries.map((ind, idx) => (
            <div
              key={ind._id || idx}
              style={{
                backgroundColor: "var(--card-bg)",
                border: ind.isActive ? "1px solid var(--card-border)" : "1.5px dashed var(--card-border)",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: "var(--card-shadow)",
                opacity: ind.isActive ? 1 : 0.7,
                transition: "all 0.2s ease",
              }}
            >
              {/* Card Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(59, 130, 246, 0.12)",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <LucideIcon name={ind.icon} size={22} color="#2563eb" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                      {ind.name}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                      <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                        /{ind.slug}
                      </span>
                      {ind.badge && (
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 600,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(59, 130, 246, 0.12)",
                            color: "#2563eb",
                          }}
                        >
                          {ind.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(ind)}
                  title={ind.isActive ? "Click to disable from mega menu" : "Click to enable in mega menu"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "9999px",
                    backgroundColor: ind.isActive ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                    color: ind.isActive ? "#16a34a" : "var(--text-secondary)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {ind.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {ind.isActive ? "Active" : "Disabled"}
                </button>
              </div>

              {/* Description */}
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  margin: "0 0 14px",
                  flex: 1,
                }}
              >
                {ind.shortDescription || "No short description provided."}
              </p>

              {/* Stats badges */}
              {ind.stats && ind.stats.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                  {ind.stats.slice(0, 3).map((st, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        backgroundColor: "var(--surface-muted)",
                        border: "1px solid var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>{st.label}:</span> <strong>{st.value}</strong>
                    </span>
                  ))}
                </div>
              )}

              {/* Card Action Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--card-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => handleReorder(ind, "up")}
                    disabled={idx === 0}
                    title="Move Up"
                    style={{
                      padding: "4px 6px",
                      borderRadius: "6px",
                      backgroundColor: "var(--surface-muted)",
                      border: "1px solid var(--surface-border)",
                      color: idx === 0 ? "var(--text-secondary)" : "var(--text-primary)",
                      cursor: idx === 0 ? "default" : "pointer",
                      opacity: idx === 0 ? 0.4 : 1,
                    }}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(ind, "down")}
                    disabled={idx === filteredIndustries.length - 1}
                    title="Move Down"
                    style={{
                      padding: "4px 6px",
                      borderRadius: "6px",
                      backgroundColor: "var(--surface-muted)",
                      border: "1px solid var(--surface-border)",
                      color: idx === filteredIndustries.length - 1 ? "var(--text-secondary)" : "var(--text-primary)",
                      cursor: idx === filteredIndustries.length - 1 ? "default" : "pointer",
                      opacity: idx === filteredIndustries.length - 1 ? 0.4 : 1,
                    }}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginLeft: "4px" }}>
                    Order: {ind.displayOrder ?? idx}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <a
                    href={`/industries?sector=${ind.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Preview on Public Website"
                    style={{
                      padding: "6px",
                      borderRadius: "6px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      backgroundColor: "var(--surface-muted)",
                      border: "1px solid var(--surface-border)",
                    }}
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ind)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(59, 130, 246, 0.12)",
                      color: "#2563eb",
                      border: "1px solid rgba(59, 130, 246, 0.25)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ind)}
                    title="Delete Industry"
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      color: "#ef4444",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && !error && viewMode === "list" && filteredIndustries.length > 0 && (
        <div
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--card-border)", color: "var(--text-secondary)", backgroundColor: "var(--surface-muted)" }}>
                <th style={{ padding: "14px 18px", width: "70px" }}>Order</th>
                <th style={{ padding: "14px 18px" }}>Industry</th>
                <th style={{ padding: "14px 18px" }}>Short Description</th>
                <th style={{ padding: "14px 18px" }}>Slug</th>
                <th style={{ padding: "14px 18px" }}>Status</th>
                <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndustries.map((ind, idx) => (
                <tr
                  key={ind._id || idx}
                  style={{
                    borderBottom: "1px solid var(--surface-border)",
                    opacity: ind.isActive ? 1 : 0.65,
                    color: "var(--text-primary)",
                  }}
                >
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                      <button
                        type="button"
                        onClick={() => handleReorder(ind, "up")}
                        disabled={idx === 0}
                        style={{ background: "none", border: "none", color: idx === 0 ? "var(--text-secondary)" : "inherit", cursor: idx === 0 ? "default" : "pointer" }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReorder(ind, "down")}
                        disabled={idx === filteredIndustries.length - 1}
                        style={{ background: "none", border: "none", color: idx === filteredIndustries.length - 1 ? "var(--text-secondary)" : "inherit", cursor: idx === filteredIndustries.length - 1 ? "default" : "pointer" }}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <span style={{ fontSize: "11px", marginLeft: "4px" }}>{ind.displayOrder ?? idx}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(59, 130, 246, 0.12)",
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <LucideIcon name={ind.icon} size={16} color="#2563eb" />
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{ind.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 18px", color: "var(--text-secondary)" }}>
                    {ind.shortDescription}
                  </td>
                  <td style={{ padding: "14px 18px", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                    /{ind.slug}
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(ind)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: ind.isActive ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                        color: ind.isActive ? "#16a34a" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {ind.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {ind.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ind)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(59, 130, 246, 0.12)",
                          color: "#2563eb",
                          border: "1px solid rgba(59, 130, 246, 0.25)",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ind)}
                        style={{
                          padding: "6px 8px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                          border: "1px solid rgba(239, 68, 68, 0.2)",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <IndustryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        industry={editingIndustry}
      />
    </div>
  );
}

const styles: any = {
  container: {
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    minHeight: '100%',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '28px',
    width: '100%',
  },
  headerTitleBlock: {
    flexShrink: 0,
    minWidth: '180px',
  },
  middleSearchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    minWidth: '220px',
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  title: {
    fontSize: '34px',
    fontWeight: 700,
    letterSpacing: '-1px',
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  addBtn: {
    padding: '9px 16px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(0,122,255,0.2)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 18px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    width: '100%',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
    transition: 'all 0.2s ease',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    width: '100%',
  },
};
