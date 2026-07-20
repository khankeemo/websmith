"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useLeadFunnel } from "../../app/providers/LeadFunnelProvider";

const SESSION_KEY = "wsd_lead_popup_seen";

export default function LeadCapturePopup() {
  const { openLeadServicesModal } = useLeadFunnel();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sessionStorage.getItem(SESSION_KEY)) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsOpen(true);
      sessionStorage.setItem(SESSION_KEY, "true");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, []);

  const handleClose = () => setIsOpen(false);

  const handleStart = () => {
    setIsOpen(false);
    openLeadServicesModal();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Launch the right build, faster"
      maxWidth="640px"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Maybe Later
          </Button>
          <Button onClick={handleStart} rightIcon={<ArrowRight size={16} />}>
            Get Started
          </Button>
        </>
      }
    >
      <div style={styles.badge}>
        <Sparkles size={16} />
        <span>Free project discovery</span>
      </div>
      <p style={styles.description}>
        Tell us which services you need and we&apos;ll guide you through a short
        qualification flow so our sales team can follow up with a tailored plan.
      </p>
    </Modal>
  );
}

const styles: any = {
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    borderRadius: "999px",
    backgroundColor: "color-mix(in srgb, #22C55E 18%, var(--bg-secondary))",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "16px",
    border: "1px solid var(--border-color)",
  },
  description: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "15px",
    lineHeight: 1.7,
  },
};
