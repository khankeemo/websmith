"use client";

import { CheckCircle2 } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useLeadFunnel } from "../../app/providers/LeadFunnelProvider";
import ServiceSelectionClient from "../../app/services/components/ServiceSelectionClient";
import LeadFormClient from "../../app/lead-form/components/LeadFormClient";

type LeadFunnelWizardModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function LeadFunnelWizardModal({ isOpen, onClose }: LeadFunnelWizardModalProps) {
  const { leadWizardStep, setLeadWizardStep } = useLeadFunnel();

  const title =
    leadWizardStep === "services"
      ? "Get started with Websmith"
      : leadWizardStep === "details"
        ? "Tell us about your project"
        : "You're all set";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={leadWizardStep === "details" ? "920px" : "960px"}
      footer={
        leadWizardStep === "success" ? (
          <Button onClick={onClose}>Close</Button>
        ) : undefined
      }
    >
      <div
        style={{
          maxHeight: "min(78dvh, 820px)",
          overflowY: "auto",
          paddingRight: "4px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {leadWizardStep === "services" && (
          <ServiceSelectionClient variant="wizard" onWizardContinue={() => setLeadWizardStep("details")} />
        )}
        {leadWizardStep === "details" && (
          <LeadFormClient
            variant="wizard"
            onBack={() => setLeadWizardStep("services")}
            onSuccess={() => setLeadWizardStep("success")}
          />
        )}
        {leadWizardStep === "success" && (
          <div style={{ textAlign: "center", padding: "24px 8px 8px" }}>
            <CheckCircle2 size={56} color="#34C759" style={{ marginBottom: "16px" }} aria-hidden />
            <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.65, fontSize: "15px" }}>
              Thanks — our sales team will follow up shortly with next steps.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
