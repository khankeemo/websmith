// C:\websmith\app\services\components\ServiceSelectionClient.tsx
// Features: List available services, select/deselect, navigate to lead form

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

      {loading && (
        <div style={styles.messageCard}>
          <div style={styles.spinner}></div>
          <p style={styles.message}>Loading available services...</p>
        </div>
      )}
      
      {error && (
        <div style={{ ...styles.messageCard, borderLeft: '6px solid #FF3B30' }}>
          <p style={{ ...styles.message, color: "#FF3B30", fontWeight: 700 }}>{error}</p>
        </div>
      )}

      {!loading && !error && services.length === 0 && (
        <div style={styles.messageCard}>
          <p style={styles.message}>No services are currently available. Please check back later.</p>
        </div>
      )}

      {!loading && !error && services.length > 0 && (
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
                  <Card style={{ 
                    borderColor: selected ? '#007AFF' : 'var(--border-color)',
                    backgroundColor: selected ? 'rgba(0, 122, 255, 0.05)' : 'var(--bg-primary)',
                    boxShadow: selected ? '0 12px 32px rgba(0,122,255,0.12)' : '0 4px 12px rgba(0,0,0,0.02)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}>
                    <div style={styles.cardTop}>
                      <div style={{
                        ...styles.iconWrap,
                        background: selected ? 'linear-gradient(135deg, #007AFF 0%, #34C759 100%)' : 'var(--bg-secondary)',
                        border: selected ? 'none' : '1px solid var(--border-color)'
                      }}>
                        <Layers3 size={24} color={selected ? "#FFFFFF" : "#007AFF"} />
                      </div>
                      <CheckCircle2 size={26} color={selected ? "#34C759" : "var(--border-color)"} fill={selected ? "#34C75922" : "transparent"} />
                    </div>
                    <h3 style={styles.serviceTitle}>{service.name}</h3>
                    <p style={styles.serviceDescription}>{service.description}</p>
                  </Card>
                </button>
              );
            })}
          </div>

          <div style={styles.footerCard}>
            <div style={styles.footerInfo}>
              <p style={styles.footerLabel}>Selected Services</p>
              <div style={styles.selectedList}>
                {selectedServices.length > 0 ? (
                  selectedServices.map((service) => (
                    <span key={service.id} style={styles.selectedChip}>{service.name}</span>
                  ))
                ) : (
                  <span style={styles.emptyText}>Select one or more services to proceed to the next step.</span>
                )}
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => router.push("/lead-form")}
              disabled={selectedServices.length === 0}
              rightIcon={<ArrowRight size={20} />}
              style={{ padding: '0 36px', height: '58px', borderRadius: '16px', fontSize: '16px', fontWeight: 700 }}
            >
              Continue to Details
            </Button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  wrapper: {
    maxWidth: "100%",
    margin: "0",
    padding: "40px 24px 80px",
    display: "flex",
    flexDirection: "column",
    gap: "40px",
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  heroCard: {
    padding: "56px 48px",
    maxWidth: "1200px",
    margin: "0 auto",
    width: "100%",
    borderRadius: "32px",
    background: "var(--bg-secondary)",
    border: "1.5px solid var(--border-color)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.02)",
  },
  eyebrow: {
    margin: "0 0 20px 0",
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
  },
  title: {
    margin: "0 0 20px",
    fontSize: "46px",
    fontWeight: 800,
    color: "var(--text-primary)",
    letterSpacing: "-0.04em",
    lineHeight: 1.05,
  },
  subtitle: {
    margin: 0,
    maxWidth: "840px",
    color: "var(--text-secondary)",
    fontSize: "19px",
    lineHeight: 1.5,
    fontWeight: 500,
  },
  messageCard: {
    padding: "64px",
    borderRadius: "28px",
    backgroundColor: 'var(--bg-secondary)',
    border: "1.5px solid var(--border-color)",
    textAlign: "center",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--border-color)',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  message: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "28px",
  },
  serviceButton: {
    background: "transparent",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
    borderRadius: "24px",
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  serviceButtonSelected: {
    transform: "translateY(-6px)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: '24px',
  },
  iconWrap: {
    width: "56px",
    height: "56px",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceTitle: {
    margin: "0 0 12px",
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: '-0.5px',
  },
  serviceDescription: {
    margin: 0,
    fontSize: "16px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    minHeight: "80px",
  },
  price: {
    margin: "24px 0 0",
    color: "#007AFF",
    fontSize: "15px",
    fontWeight: 800,
    letterSpacing: '-0.2px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px'
  },
  footerCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "32px",
    padding: "36px 40px",
    backgroundColor: "var(--bg-primary)",
    border: "1.5px solid var(--border-color)",
    borderRadius: "28px",
    boxShadow: "0 18px 48px rgba(0,0,0,0.12)",
    flexWrap: "wrap",
    position: 'sticky',
    bottom: '32px',
    zIndex: 100,
    backdropFilter: 'blur(20px)',
  },
  footerInfo: {
    flex: 1,
    minWidth: '240px',
  },
  footerLabel: {
    margin: "0 0 16px",
    fontSize: "13px",
    fontWeight: 800,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
  },
  selectedList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  selectedChip: {
    padding: "10px 20px",
    borderRadius: "14px",
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    color: "#007AFF",
    fontSize: "14px",
    fontWeight: 700,
    border: '1.5px solid rgba(0, 122, 255, 0.15)',
  },
  emptyText: {
    color: "var(--text-secondary)",
    fontSize: "15px",
    fontStyle: 'italic',
    fontWeight: 500,
  },
};
