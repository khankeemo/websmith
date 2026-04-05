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
          <p style={styles.subtitle}>Manage the cards visitors see in Step 1 of the lead funnel.</p>
        </div>
        <Button onClick={handleOpenCreate} leftIcon={<Plus size={16} />}>
          New Service
        </Button>
      </div>

      <div style={styles.summary}>
        <Card>
          <p style={styles.summaryLabel}>Total Services</p>
          <p style={styles.summaryValue}>{services.length}</p>
        </Card>
        <Card>
          <p style={styles.summaryLabel}>Active in Funnel</p>
          <p style={styles.summaryValue}>{activeCount}</p>
        </Card>
      </div>

      {loading && <Card><p style={styles.message}>Loading services...</p></Card>}
      {error && <Card><p style={{ ...styles.message, color: "#FF3B30" }}>{error}</p></Card>}

      {!loading && !error && (
        <div style={styles.grid}>
          {services.map((service) => (
            <Card key={service._id || service.name}>
              <div style={styles.cardTop}>
                <div style={styles.iconWrap}>
                  <Layers3 size={22} color="#007AFF" />
                </div>
                <span style={{ ...styles.statusBadge, ...(service.isActive ? styles.activeBadge : styles.inactiveBadge) }}>
                  {service.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <h3 style={styles.cardTitle}>{service.name}</h3>
              <p style={styles.cardDescription}>{service.description}</p>
              <p style={styles.cardPrice}>
                {typeof service.price === "number" ? `Starting at $${service.price.toLocaleString()}` : "No starting price"}
              </p>

              <div style={styles.cardActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Pencil size={14} />}
                  onClick={() => handleOpenEdit(service)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 size={14} />}
                  onClick={() => handleDelete(service)}
                  isLoading={deletingId === service._id}
                >
                  Delete
                </Button>
              </div>
            </Card>
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
    </div>
  );
}

const styles: any = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "8px 4px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 600,
    letterSpacing: "-0.5px",
    color: "#1C1C1E",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#8E8E93",
    fontSize: "15px",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  summaryLabel: {
    margin: 0,
    color: "#8E8E93",
    fontSize: "13px",
    fontWeight: 500,
  },
  summaryValue: {
    margin: "8px 0 0",
    color: "#1C1C1E",
    fontSize: "30px",
    fontWeight: 700,
  },
  message: {
    margin: 0,
    fontSize: "15px",
    color: "#6B7280",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  iconWrap: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    backgroundColor: "#E3F2FF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
  },
  activeBadge: {
    backgroundColor: "#E8F5E9",
    color: "#34C759",
  },
  inactiveBadge: {
    backgroundColor: "#F2F2F7",
    color: "#8E8E93",
  },
  cardTitle: {
    margin: "0 0 10px",
    fontSize: "18px",
    fontWeight: 600,
    color: "#1C1C1E",
  },
  cardDescription: {
    margin: 0,
    minHeight: "72px",
    color: "#6B7280",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  cardPrice: {
    margin: "14px 0 0",
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: 600,
  },
  cardActions: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  },
};
