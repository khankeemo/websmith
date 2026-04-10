// PATH: C:\websmith\app\admin\services\page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Layers3 } from "lucide-react";
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
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Services</h1>
          <p style={styles.subtitle}>Manage the service cards displayed in the lead funnel.</p>
        </div>
        <Button onClick={handleOpenCreate} leftIcon={<Plus size={18} />}>
          New Service
        </Button>
      </div>

      <div style={styles.summary}>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Total Services</p>
          <p style={styles.summaryValue}>{services.length}</p>
        </div>
        <div style={styles.summaryCard}>
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

      {!loading && !error && (
        <div style={styles.grid}>
          {services.map((service) => (
            <div key={service._id || service.name} style={styles.serviceCard} className="admin-service-card">
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
                <p style={styles.cardPrice}>
                  {typeof service.price === "number" ? `Starting at $${service.price.toLocaleString()}` : "Price TBD"}
                </p>
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
    padding: "8px 4px",
    backgroundColor: 'var(--bg-primary)',
    minHeight: '100vh',
    color: 'var(--text-primary)',
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "8px",
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
    backgroundColor: "var(--bg-primary)",
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
