// PATH: C:\websmith\app\admin\services\page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Layers3, Search } from "lucide-react";
import { ViewModeToggle, GridListView } from "@/components/ui/ViewModeToggle";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ServiceModal from "./components/ServiceModal";
import {
  createManagedService,
  deleteManagedService,
  getManagedServices,
  ManagedService,
  ManagedServicePayload,
  updateManagedService,
} from "@/app/services/services/adminService";

export default function AdminServicesPage() {
  const [services, setServices] = useState<ManagedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ManagedService | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<GridListView>("grid");
  const [searchTerm, setSearchTerm] = useState("");

    const filteredServices = useMemo(
    () =>
      services.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.description || "").toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [services, searchTerm]
  );

  const activeCount = useMemo(() => services.filter((service) => service.isActive).length, [services]);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getManagedServices();
      setServices(data);
    } catch (err: any) {
      setError(err.message || "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleOpenCreate = () => {
    setEditingService(null);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service: ManagedService) => {
    setEditingService(service);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: ManagedServicePayload) => {
    try {
      setIsSaving(true);
      setSubmitError(null);

      if (editingService?._id) {
        await updateManagedService(editingService._id, payload);
      } else {
        await createManagedService(payload);
      }

      setIsModalOpen(false);
      setEditingService(null);
      await loadServices();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save service");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (service: ManagedService) => {
    if (!service._id) return;

    if (!confirm(`Delete "${service.name}"? This removes it from the Step 1 service cards.`)) {
      return;
    }

    try {
      setDeletingId(service._id);
      await deleteManagedService(service._id);
      await loadServices();
    } catch (err: any) {
      setError(err.message || "Failed to delete service");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={styles.container} className="wsd-page admin-panel-scope">
      <div style={styles.header} className="wsd-page-header">
        <div style={styles.headerTitleBlock}>
          <h1 style={styles.title}>Services</h1>
          <p style={styles.subtitle}>Manage the service cards displayed in the lead funnel.</p>
        </div>

        {/* Top & Middle Search */}
        <div style={styles.middleSearchWrap} className="services-middle-search">
          <div style={styles.searchBox} className="admin-search-box wsd-search-box">
            <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* Right Actions */}
        <div style={styles.headerActions} className="wsd-page-actions">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button onClick={handleOpenCreate} leftIcon={<Plus size={16} />}>
            New Service
          </Button>
        </div>
      </div>

      <div style={styles.summary}>
        <div style={styles.summaryCard} className="admin-card">
          <p style={styles.summaryLabel}>Total Services</p>
          <p style={styles.summaryValue}>{services.length}</p>
        </div>
        <div style={styles.summaryCard} className="admin-card">
          <p style={styles.summaryLabel}>Active in Funnel</p>
          <p style={styles.summaryValue}>{activeCount}</p>
        </div>
      </div>

      {loading && (
        <Card>
          <div style={styles.loadingBox}>
            <div style={styles.spinner}></div>
            <p style={styles.message}>Loading services...</p>
          </div>
        </Card>
      )}
      
      {error && <Card><p style={{ ...styles.message, color: "#FF3B30", fontWeight: 700 }}>{error}</p></Card>}

      {!loading && !error && viewMode === "grid" && (
        <div style={styles.grid}>
          {filteredServices.map((service) => (
            <div key={service._id || service.name} style={styles.serviceCard} className="admin-service-card admin-card">
              <div style={styles.cardTop}>
                <div style={styles.iconWrap}>
                  <Layers3 size={22} color="#007AFF" />
                </div>
                <span style={{ 
                  ...styles.statusBadge, 
                  backgroundColor: service.isActive ? 'rgba(52, 199, 89, 0.1)' : 'var(--bg-secondary)',
                  color: service.isActive ? '#34C759' : 'var(--text-secondary)'
                }}>
                  {service.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <h3 style={styles.cardTitle}>{service.name}</h3>
              <p style={styles.cardDescription}>{service.description}</p>
              <div style={styles.cardFooter}>
                <p style={styles.cardPrice}>{service.isActive ? "Visible in lead funnel" : "Hidden from lead funnel"}</p>
                <div style={styles.cardActions}>
                  <button onClick={() => handleOpenEdit(service)} style={styles.iconBtn} title="Edit">
                    <Pencil size={16} color="var(--text-secondary)" />
                  </button>
                  <button onClick={() => handleDelete(service)} style={{...styles.iconBtn, color: '#FF3B30'}} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && viewMode === "list" && (
        <div style={styles.listWrap}>
          {filteredServices.map((service) => (
            <div key={service._id || service.name} style={styles.listRow}>
              <div style={styles.listRowMain}>
                <strong style={styles.listRowTitle}>{service.name}</strong>
                <p style={styles.listRowDesc}>{service.description}</p>
                <span style={styles.listRowPrice}>
                  {typeof service.price === "number" ? `$${service.price.toLocaleString()}` : "Price TBD"} ·{" "}
                  {service.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={styles.listRowActions}>
                <button type="button" onClick={() => handleOpenEdit(service)} style={styles.listActBtn}>
                  <Pencil size={16} />
                </button>
                <button type="button" onClick={() => handleDelete(service)} style={{ ...styles.listActBtn, color: "#FF3B30" }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingService(null);
          setSubmitError(null);
        }}
        onSave={handleSave}
        service={editingService}
        isSaving={isSaving}
        submitError={submitError}
      />

      <style>{`
        .admin-service-card { transition: all 0.3s ease; }
        .admin-service-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); border-color: #007AFF55 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    backgroundColor: 'transparent',
    minHeight: '100%',
    width: '100%',
    color: 'var(--text-primary)',
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  listWrap: { display: "flex", flexDirection: "column", gap: "10px" },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "16px 18px",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    flexWrap: "wrap",
  },
  listRowMain: { flex: 1, minWidth: 0 },
  listRowTitle: { fontSize: "16px", color: "var(--text-primary)", display: "block", marginBottom: "6px" },
  listRowDesc: { fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 6px 0", lineHeight: 1.5 },
  listRowPrice: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 },
  listRowActions: { display: "flex", gap: "8px", flexShrink: 0 },
  listActBtn: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 700,
    letterSpacing: "-1px",
    color: "var(--text-primary)",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "var(--text-secondary)",
    fontSize: "15px",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
  },
  summaryCard: {
    padding: '24px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '20px',
    border: '1.5px solid var(--border-color)',
  },
  summaryLabel: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  summaryValue: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: '-1px',
  },
  message: {
    margin: 0,
    fontSize: "15px",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '40px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border-color)',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "24px",
  },
  serviceCard: {
    backgroundColor: 'transparent',
    borderRadius: "24px",
    padding: "24px",
    border: "1.5px solid var(--border-color)",
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  iconWrap: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    backgroundColor: "var(--bg-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: '1px solid var(--border-color)',
  },
  statusBadge: {
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardTitle: {
    margin: "0 0 10px",
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: '-0.3px',
  },
  cardDescription: {
    margin: 0,
    minHeight: "72px",
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.6,
    flex: 1,
    marginBottom: '20px',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '16px',
  },
  cardPrice: {
    margin: 0,
    color: "#007AFF",
    fontSize: "14px",
    fontWeight: 700,
  },
  cardActions: {
    display: "flex",
    gap: "8px",
  },
  iconBtn: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  }
};
