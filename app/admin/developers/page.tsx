"use client";

import { useState } from "react";
import { Plus, Search, Code, UserCheck, LayoutGrid, List } from "lucide-react";
import { useDevelopers } from "./hooks/useDevelopers";
import DeveloperCard from "./components/DeveloperCard";
import DeveloperModal from "./components/DeveloperModal";
import ConfirmationModal from "../../../components/ui/ConfirmationModal";
import { RoleUser } from "../../../core/services/userService";

type ViewMode = "grid" | "list";

export default function DevelopersPage() {
  const { developers, loading, saving, error, fetchDevelopers } = useDevelopers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeveloper, setEditingDeveloper] = useState<RoleUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [developerToDelete, setDeveloperToDelete] = useState<string | null>(null);

  const handleAddDeveloper = () => {
    setFormError(null);
    setEditingDeveloper(null);
    setIsModalOpen(true);
  };

  const handleEditDeveloper = (developer: RoleUser) => {
    setFormError(null);
    setEditingDeveloper(developer);
    setIsModalOpen(true);
  };

  const handleDeleteDeveloper = (id: string) => {
    setDeveloperToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleTogglePublish = async (developer: RoleUser) => {
    try {
      const { updateDeveloper } = await import("../../../core/services/userService");
      await updateDeveloper(developer._id, { published: !developer.published });
      await fetchDevelopers();
      setSuccessMessage(`Developer ${developer.published ? "unpublished" : "published"} successfully`);
    } catch (error) {
      console.error("Toggle publish error:", error);
    }
  };

  const confirmDelete = async () => {
    if (!developerToDelete) return;
    
    try {
      const { deleteDeveloper } = await import("../../../core/services/userService");
      await deleteDeveloper(developerToDelete);
      await fetchDevelopers();
      setSuccessMessage("Developer deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
    }
    
    setIsDeleteModalOpen(false);
    setDeveloperToDelete(null);
  };

  const filteredDevelopers = developers.filter(dev =>
    dev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.customId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: developers.length,
    active: developers.filter(d => d.status === "active").length,
    published: developers.filter(d => d.published).length,
  };

  return (
    <div style={styles.container} className="wsd-page">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Developers</h1>
          <p style={styles.subtitle}>Manage your development team and their profiles</p>
        </div>
        <button onClick={handleAddDeveloper} style={styles.addBtn} className="add-btn">
          <Plus size={18} />
          <span>New Developer</span>
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <Code size={24} color="#007AFF" />
          <div>
            <p style={styles.statValue}>{stats.total}</p>
            <p style={styles.statLabel}>Total Developers</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <UserCheck size={24} color="#34C759" />
          <div>
            <p style={styles.statValue}>{stats.active}</p>
            <p style={styles.statLabel}>Active</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <UserCheck size={24} color="#AF52DE" />
          <div>
            <p style={styles.statValue}>{stats.published}</p>
            <p style={styles.statLabel}>Published</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchSection}>
        <div style={styles.searchBox}>
          <Search size={18} color="#8E8E93" />
          <input
            type="text"
            placeholder="Search developers by name, email, ID, or skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.viewToggle}>
          <button onClick={() => setViewMode("grid")} style={{ ...styles.toggleBtn, ...(viewMode === "grid" ? styles.toggleActive : {}) }}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode("list")} style={{ ...styles.toggleBtn, ...(viewMode === "list" ? styles.toggleActive : {}) }}>
            <List size={16} />
          </button>
        </div>
      </div>

      {successMessage && (
        <div style={styles.successContainer}>
          <p style={styles.successText}>{successMessage}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading developers...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredDevelopers.length === 0 && (
        <div style={styles.emptyContainer}>
          <Code size={48} color="#C6C6C8" />
          <h3 style={styles.emptyTitle}>No developers found</h3>
          <p style={styles.emptyText}>
            {searchTerm ? "Try adjusting your search" : "Add your first developer to get started"}
          </p>
          {!searchTerm && (
            <button onClick={handleAddDeveloper} style={styles.emptyBtn}>Add Developer</button>
          )}
        </div>
      )}

      {/* Developers Grid */}
      {!loading && filteredDevelopers.length > 0 && (
        <div style={viewMode === "grid" ? styles.grid : styles.list}>
          {filteredDevelopers.map((developer) => (
            <DeveloperCard
              key={developer._id}
              developer={developer}
              viewMode={viewMode}
              onEdit={handleEditDeveloper}
              onDelete={handleDeleteDeveloper}
              onTogglePublish={handleTogglePublish}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <DeveloperModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDeveloper(null);
          setFormError(null);
        }}
        onSave={async (data) => {
          try {
            const { createDeveloper, updateDeveloper } = await import("../../../core/services/userService");
            if (editingDeveloper) {
              await updateDeveloper(editingDeveloper._id, data);
              setSuccessMessage("Developer updated successfully");
            } else {
              await createDeveloper(data);
              setSuccessMessage("Developer created successfully. Credentials sent via email.");
            }
            await fetchDevelopers();
            setIsModalOpen(false);
            setEditingDeveloper(null);
          } catch (error: any) {
            setFormError(error.message || "Failed to save developer");
          }
        }}
        developer={editingDeveloper}
        isSaving={saving}
        submitError={formError || error}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Developer"
        message="Are you sure you want to delete this developer? This will permanently remove their account and all associated data."
        confirmLabel="Delete Developer"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setDeveloperToDelete(null);
        }}
        isDanger={true}
        isLoading={saving}
      />

      <style>{`
        .add-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .add-btn:hover {
          background-color: #34C759 !important;
          transform: translateX(4px) translateY(-2px);
          box-shadow: 0 4px 12px rgba(52,199,89,0.3);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: 0 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "var(--text-primary)" },
  subtitle: { margin: "8px 0 0", color: "var(--text-secondary)" },
  addBtn: { padding: "10px 20px", backgroundColor: "#007AFF", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" },
  statCard: { display: "flex", alignItems: "center", gap: "16px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "16px", padding: "20px" },
  statValue: { margin: 0, fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" },
  statLabel: { margin: "4px 0 0", fontSize: "13px", color: "var(--text-secondary)" },
  searchSection: { marginBottom: "24px", display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  searchBox: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "12px" },
  searchInput: { border: "none", outline: "none", width: "100%", fontSize: "15px", backgroundColor: "transparent", color: "var(--text-primary)" },
  viewToggle: { display: "flex", background: "var(--bg-secondary)", borderRadius: "12px", padding: "4px" },
  toggleBtn: { border: "none", background: "transparent", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" },
  toggleActive: { background: "var(--bg-primary)", color: "var(--text-primary)" },
  successContainer: { marginBottom: "20px", padding: "14px 16px", backgroundColor: "rgba(52, 199, 89, 0.1)", border: "1px solid #34C759", borderRadius: "12px" },
  successText: { color: "var(--text-primary)", margin: 0, fontSize: "14px", fontWeight: 500 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  spinner: { width: "40px", height: "40px", border: "3px solid var(--border-color)", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  emptyContainer: { textAlign: "center", padding: "60px" },
  emptyTitle: { fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginTop: "16px", marginBottom: "8px" },
  emptyText: { fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" },
  emptyBtn: { padding: "10px 24px", backgroundColor: "#007AFF", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit" },
};
