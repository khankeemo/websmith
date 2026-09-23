// FILE: app/admin/services/page.tsx
// PURPOSE: Admin dashboard page for managing Services (Categories & Subcategories)

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Search, Layers, Pencil, Trash2, CheckCircle2, XCircle, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import NavbarVisibilityToggle from "@/components/admin/NavbarVisibilityToggle";
import LucideIcon from "@/components/shared/LucideIcon";
import CategoryModal from "./components/CategoryModal";
import ServiceItemModal from "./components/ServiceItemModal";
import {
  getAdminServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  createServiceItem,
  updateServiceItem,
  deleteServiceItem,
} from "@/lib/cms/cmsService";
import type { CmsServiceCategory, CmsServiceItem } from "@/lib/cms/types";

export default function AdminServicesPage() {
  const [categories, setCategories] = useState<CmsServiceCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CmsServiceCategory | null>(null);

  // Subcategory Item Modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CmsServiceItem | null>(null);

  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminServiceCategories();
      setCategories(data);
      if (data.length > 0) {
        if (!activeCategoryId || !data.some((c) => c._id === activeCategoryId)) {
          setActiveCategoryId(data[0]._id || null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load services data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c._id === activeCategoryId) || categories[0] || null;
  }, [categories, activeCategoryId]);

  // CATEGORY ACTIONS
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: CmsServiceCategory) => {
    setEditingCategory(cat);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (payload: Partial<CmsServiceCategory>) => {
    try {
      if (editingCategory?._id) {
        await updateServiceCategory(editingCategory._id, payload);
        setActionMessage({ type: "success", text: `Category "${payload.name}" updated successfully.` });
      } else {
        const created = await createServiceCategory(payload);
        setActionMessage({ type: "success", text: `Category "${payload.name}" created successfully.` });
        if (created._id) setActiveCategoryId(created._id);
      }
      await loadData();
    } catch (err: any) {
      throw new Error(err.message || "Failed to save category");
    }
  };

  const handleDeleteCategory = async (cat: CmsServiceCategory) => {
    if (!cat._id) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete "${cat.name}" and all its subcategories? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      await deleteServiceCategory(cat._id);
      setActionMessage({ type: "success", text: `Category "${cat.name}" deleted.` });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to delete category." });
    }
  };

  // SUBCATEGORY ITEM ACTIONS
  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: CmsServiceItem) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (payload: Partial<CmsServiceItem>) => {
    if (!activeCategory?._id) return;
    try {
      if (editingItem?._id) {
        await updateServiceItem(editingItem._id, payload);
        setActionMessage({ type: "success", text: `Subcategory "${payload.name}" updated.` });
      } else {
        await createServiceItem({
          ...payload,
          categoryId: activeCategory._id,
        });
        setActionMessage({ type: "success", text: `Subcategory "${payload.name}" added to ${activeCategory.name}.` });
      }
      await loadData();
    } catch (err: any) {
      throw new Error(err.message || "Failed to save service subcategory");
    }
  };

  const handleDeleteItem = async (item: CmsServiceItem) => {
    if (!item._id) return;
    const confirmDelete = window.confirm(`Delete "${item.name}"?`);
    if (!confirmDelete) return;

    try {
      await deleteServiceItem(item._id);
      setActionMessage({ type: "success", text: `Subcategory "${item.name}" deleted.` });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to delete subcategory." });
    }
  };

  const handleToggleItemMenu = async (item: CmsServiceItem) => {
    if (!item._id) return;
    try {
      const nextShow = !item.showInMenu;
      await updateServiceItem(item._id, { showInMenu: nextShow });
      setActionMessage({
        type: "success",
        text: `"${item.name}" is now ${nextShow ? "visible in" : "hidden from"} Services mega menu.`,
      });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: "Failed to update menu visibility." });
    }
  };

  const handleToggleItemActive = async (item: CmsServiceItem) => {
    if (!item._id) return;
    try {
      const nextActive = !item.isActive;
      await updateServiceItem(item._id, { isActive: nextActive });
      setActionMessage({
        type: "success",
        text: `"${item.name}" is now ${nextActive ? "active" : "disabled"}.`,
      });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: "Failed to update status." });
    }
  };

  const handleReorderItem = async (item: CmsServiceItem, direction: "up" | "down") => {
    if (!item._id || !activeCategory?.services) return;
    const list = activeCategory.services;
    const currentIndex = list.findIndex((s) => s._id === item._id);
    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === list.length - 1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetItem = list[targetIndex];
    if (!targetItem._id) return;

    try {
      const tempOrder = item.displayOrder ?? currentIndex;
      const targetOrder = targetItem.displayOrder ?? targetIndex;

      await Promise.all([
        updateServiceItem(item._id, { displayOrder: targetOrder }),
        updateServiceItem(targetItem._id, { displayOrder: tempOrder }),
      ]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: "Failed to reorder subcategories." });
    }
  };

  const filteredServices = useMemo(() => {
    if (!activeCategory?.services) return [];
    if (!searchTerm.trim()) return activeCategory.services;
    const q = searchTerm.toLowerCase();
    return activeCategory.services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.shortDescription && s.shortDescription.toLowerCase().includes(q)) ||
        (s.techStack && s.techStack.some((t) => t.toLowerCase().includes(q)))
    );
  }, [activeCategory, searchTerm]);

  return (
    <div style={styles.container} className="wsd-page admin-panel-scope">
      {/* Unified Header */}
      <div style={styles.header} className="services-header wsd-page-header">
        <div style={styles.headerTitleBlock}>
          <h1 style={styles.title}>Services</h1>
          <p style={styles.subtitle}>Manage services from one place</p>
        </div>

        {/* WIDE TOP & MIDDLE SEARCH BAR */}
        <div style={styles.middleSearchWrap} className="services-middle-search">
          <div style={styles.searchBox} className="admin-search-box wsd-search-box">
            <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search subcategories by name, stack, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* RIGHT ACTION BUTTONS */}
        <div style={styles.headerButtons} className="wsd-page-actions">
          <NavbarVisibilityToggle
            sectionKey="services"
            label="Services"
            variant="compact"
          />
          <button onClick={handleOpenCreateCategory} style={styles.addBtn} className="admin-primary-btn add-btn">
            <Plus size={16} />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            backgroundColor: actionMessage.type === "success" ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
            border: actionMessage.type === "success" ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
            color: actionMessage.type === "success" ? "#16a34a" : "#ef4444",
            fontSize: "13px",
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

      {loading && (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading services from database...
        </div>
      )}

      {error && (
        <div style={{ padding: "20px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px", alignItems: "start" }}>
          {/* Left Column: Categories List */}
          <div
            style={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "16px",
              padding: "16px",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", padding: "0 4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>
                Categories ({categories.length})
              </span>
              <button
                type="button"
                onClick={handleOpenCreateCategory}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <Plus size={14} /> Add
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {categories.map((cat) => {
                const isSelected = cat._id === activeCategory?._id;
                const subCount = cat.services?.length ?? 0;

                return (
                  <div
                    key={cat._id}
                    onClick={() => cat._id && setActiveCategoryId(cat._id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      backgroundColor: isSelected
                        ? "rgba(59, 130, 246, 0.12)"
                        : "var(--surface-muted)",
                      border: isSelected
                        ? "1.5px solid rgba(59, 130, 246, 0.4)"
                        : "1px solid var(--surface-border)",
                      color: isSelected ? "#2563eb" : "var(--text-primary)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          backgroundColor: isSelected ? "#2563eb" : "rgba(59, 130, 246, 0.12)",
                          color: isSelected ? "#ffffff" : "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <LucideIcon name={cat.icon} size={16} color={isSelected ? "#ffffff" : "#2563eb"} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "13.5px",
                            fontWeight: isSelected ? 700 : 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: isSelected ? "#2563eb" : "var(--text-primary)",
                          }}
                        >
                          {cat.name}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-secondary)" }}>
                          {subCount} subcategories
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditCategory(cat)}
                        title="Edit Category"
                        style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "4px" }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        title="Delete Category"
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Subcategories for Active Category */}
          {activeCategory && (
            <div
              style={{
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "var(--card-shadow)",
              }}
            >
              {/* Category Banner */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "18px",
                  borderBottom: "1px solid var(--card-border)",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      backgroundColor: "rgba(59, 130, 246, 0.12)",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <LucideIcon name={activeCategory.icon} size={22} color="#2563eb" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                        {activeCategory.name}
                      </h2>
                      {activeCategory.badge && (
                        <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(59, 130, 246, 0.12)", color: "#2563eb" }}>
                          {activeCategory.badge}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: "3px 0 0" }}>
                      {activeCategory.description || "No category description set."}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={handleOpenCreateItem}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#2563eb",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                    }}
                  >
                    <Plus size={15} /> Add Subcategory
                  </button>
                </div>
              </div>

              {/* Subcategories Filter / Search */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: "280px" }}>
                  <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                  <input
                    type="text"
                    placeholder="Search subcategories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 32px",
                      borderRadius: "8px",
                      border: "1px solid var(--input-border)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                      fontSize: "12.5px",
                    }}
                  />
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {filteredServices.length} subcategories
                </span>
              </div>

              {/* Subcategories List / Grid */}
              {filteredServices.length === 0 ? (
                <div
                  style={{
                    padding: "48px 20px",
                    textAlign: "center",
                    borderRadius: "14px",
                    border: "1.5px dashed var(--card-border)",
                    backgroundColor: "var(--surface-muted)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <p style={{ margin: "0 0 12px", fontSize: "13.5px" }}>No subcategories found for {activeCategory.name}.</p>
                  <button
                    type="button"
                    onClick={handleOpenCreateItem}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      backgroundColor: "#2563eb",
                      color: "#fff",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Add First Subcategory
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {filteredServices.map((sub, idx) => (
                    <div
                      key={sub._id || idx}
                      style={{
                        backgroundColor: "var(--surface-muted)",
                        border: sub.isActive ? "1px solid var(--surface-border)" : "1.5px dashed var(--card-border)",
                        borderRadius: "14px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        opacity: sub.isActive ? 1 : 0.65,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Subcategory Header */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                              flexShrink: 0,
                            }}
                          >
                            <LucideIcon name={sub.icon} size={16} color="#2563eb" />
                          </div>
                          <div>
                            <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                              {sub.name}
                            </h4>
                          </div>
                        </div>

                        {/* Show In Menu Badge Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleItemMenu(sub)}
                          title={sub.showInMenu ? "Click to hide from Services mega menu" : "Click to show in Services mega menu"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: "9999px",
                            backgroundColor: sub.showInMenu ? "rgba(59, 130, 246, 0.15)" : "rgba(148, 163, 184, 0.15)",
                            color: sub.showInMenu ? "#2563eb" : "var(--text-secondary)",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          {sub.showInMenu ? <Eye size={11} /> : <EyeOff size={11} />}
                          {sub.showInMenu ? "Menu: On" : "Menu: Off"}
                        </button>
                      </div>

                      {/* Short Description */}
                      <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.45, margin: "0 0 12px", flex: 1 }}>
                        {sub.shortDescription}
                      </p>

                      {/* Tech Stack Tags */}
                      {sub.techStack && sub.techStack.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                          {sub.techStack.slice(0, 4).map((tech, tIdx) => (
                            <span
                              key={tIdx}
                              style={{
                                fontSize: "10.5px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: "var(--card-bg)",
                                border: "1px solid var(--surface-border)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Card Footer Controls */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: "10px",
                          borderTop: "1px solid var(--surface-border)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            Order: {sub.displayOrder ?? idx}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleToggleItemActive(sub)}
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              backgroundColor: sub.isActive ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                              color: sub.isActive ? "#16a34a" : "var(--text-secondary)",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {sub.isActive ? "Active" : "Disabled"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditItem(sub)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              backgroundColor: "rgba(59, 130, 246, 0.12)",
                              color: "#2563eb",
                              border: "1px solid rgba(59, 130, 246, 0.25)",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(sub)}
                            title="Delete Subcategory"
                            style={{
                              padding: "4px 6px",
                              borderRadius: "6px",
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
                              color: "#ef4444",
                              border: "1px solid rgba(239, 68, 68, 0.2)",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        category={editingCategory}
      />

      {/* Service Item Modal */}
      <ServiceItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        onSave={handleSaveItem}
        serviceItem={editingItem}
        categoryName={activeCategory?.name}
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
