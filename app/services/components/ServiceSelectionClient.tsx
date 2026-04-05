"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Layers3, ArrowRight } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { getPublicServices, PublicService } from "../../../core/services/leadService";
import { useLeadFunnel } from "../../providers/LeadFunnelProvider";

export default function ServiceSelectionClient() {
  const router = useRouter();
  const { selectedServices, toggleService, setSelectedServices } = useLeadFunnel();
  const [services, setServices] = useState<PublicService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const data = await getPublicServices();
        setServices(data);
        const nextSelectedServices = selectedServices.filter((selectedService) =>
          data.some((service) => service.id === selectedService.id)
        );

        const hasSelectionChanged =
          nextSelectedServices.length !== selectedServices.length ||
          nextSelectedServices.some((service, index) => service.id !== selectedServices[index]?.id);

        if (hasSelectionChanged) {
          setSelectedServices(nextSelectedServices);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load services");
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [selectedServices, setSelectedServices]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.heroCard}>
        <p style={styles.eyebrow}>Step 1 of 3</p>
        <h1 style={styles.title}>Choose the services you want help with</h1>
        <p style={styles.subtitle}>
          Select one or more services. We&apos;ll use them to personalize the next step and qualify your lead properly.
        </p>
      </div>

      {loading && <Card><p style={styles.message}>Loading services...</p></Card>}
      {error && <Card><p style={{ ...styles.message, color: "#FF3B30" }}>{error}</p></Card>}

      {!loading && !error && (
        <>
          <div style={styles.grid}>
            {services.map((service) => {
              const selected = selectedServices.some((item) => item.id === service.id);

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService({ id: service.id, name: service.name })}
                  style={{
                    ...styles.serviceButton,
                    ...(selected ? styles.serviceButtonSelected : {}),
                  }}
                >
                  <Card>
                    <div style={styles.cardTop}>
                      <div style={styles.iconWrap}>
                        <Layers3 size={22} color={selected ? "#FFFFFF" : "#007AFF"} />
                      </div>
                      <CheckCircle2 size={20} color={selected ? "#34C759" : "#C7C7CC"} />
                    </div>
                    <h3 style={styles.serviceTitle}>{service.name}</h3>
                    <p style={styles.serviceDescription}>{service.description}</p>
                    {typeof service.price === "number" && (
                      <p style={styles.price}>Starting at ${service.price.toLocaleString()}</p>
                    )}
                  </Card>
                </button>
              );
            })}
          </div>

          <div style={styles.footerCard}>
            <div>
              <p style={styles.footerLabel}>Selected Services</p>
              <div style={styles.selectedList}>
                {selectedServices.length > 0 ? (
                  selectedServices.map((service) => (
                    <span key={service.id} style={styles.selectedChip}>{service.name}</span>
                  ))
                ) : (
                  <span style={styles.emptyText}>Choose at least one service to continue.</span>
                )}
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => router.push("/lead-form")}
              disabled={selectedServices.length === 0}
              rightIcon={<ArrowRight size={16} />}
            >
              Continue
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const styles: any = {
  wrapper: {
    maxWidth: "1120px",
    margin: "0 auto",
    padding: "32px 24px 64px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  heroCard: {
    padding: "32px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, #F8FAFC 0%, #EEF6FF 100%)",
    border: "1px solid #E5E7EB",
  },
  eyebrow: {
    margin: 0,
    color: "#007AFF",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "12px 0 10px",
    fontSize: "38px",
    fontWeight: 700,
    color: "#111827",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    maxWidth: "760px",
    color: "#6B7280",
    fontSize: "16px",
    lineHeight: 1.7,
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
  serviceButton: {
    background: "transparent",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
    borderRadius: "16px",
    transition: "transform 0.2s ease",
  },
  serviceButtonSelected: {
    transform: "translateY(-2px)",
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
    background: "linear-gradient(135deg, #007AFF 0%, #34C759 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceTitle: {
    margin: "0 0 10px",
    fontSize: "18px",
    fontWeight: 600,
    color: "#1C1C1E",
  },
  serviceDescription: {
    margin: 0,
    fontSize: "14px",
    color: "#6B7280",
    lineHeight: 1.6,
    minHeight: "68px",
  },
  price: {
    margin: "14px 0 0",
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: 600,
  },
  footerCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "24px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
    flexWrap: "wrap",
  },
  footerLabel: {
    margin: "0 0 10px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  selectedList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  selectedChip: {
    padding: "8px 14px",
    borderRadius: "999px",
    backgroundColor: "#E3F2FF",
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: 600,
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: "14px",
  },
};
