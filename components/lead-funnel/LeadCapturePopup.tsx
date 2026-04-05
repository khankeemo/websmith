"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const SESSION_KEY = "wsd_lead_popup_seen";

export default function LeadCapturePopup() {
  const router = useRouter();
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
    router.push("/services");
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
    backgroundColor: "#E8F5E9",
    color: "#1B5E20",
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "16px",
  },
  description: {
    margin: 0,
    color: "#4B5563",
    fontSize: "15px",
    lineHeight: 1.7,
  },
};
