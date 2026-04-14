"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { createLead } from "../../../core/services/leadService";
import { useLeadFunnel } from "../../providers/LeadFunnelProvider";

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  budget: string;
  timeline: string;
  notes: string;
  cmsRequirement: string;
  appPlatform: "" | "iOS" | "Android" | "Both";
}

const initialState: FormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  budget: "",
  timeline: "",
  notes: "",
  cmsRequirement: "",
  appPlatform: "",
};

const timelineOptions = [
  "1 Week",
  "2 Weeks",
  "3 Weeks",
  "1 Month",
  "2 Months",
  "3 Months",
  "4 Months",
  "5 Months",
  "6 Months",
  "1 Year",
];

export default function LeadFormClient() {
  const router = useRouter();
  const { selectedServices, clearSelectedServices } = useLeadFunnel();
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedNames = useMemo(
    () => selectedServices.map((service) => service.name),
    [selectedServices]
  );

  const needsCms = selectedNames.includes("Web Development");
  const needsPlatform = selectedNames.includes("Mobile App Development");

  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setSubmitError(null);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Valid email is required";
    if (!/^\+?[0-9\s\-()]{8,20}$/.test(form.phone.trim())) nextErrors.phone = "Valid phone number is required";
    if (form.budget && Number.isNaN(Number(form.budget))) nextErrors.budget = "Budget must be numeric";
    if (selectedServices.length === 0) nextErrors.services = "Choose at least one service";
    if (needsPlatform && !form.appPlatform) nextErrors.appPlatform = "Select a platform";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || submitting) return;

    try {
      setSubmitting(true);

      await createLead({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim() || undefined,
        budget: form.budget ? Number(form.budget) : null,
        timeline: form.timeline.trim() || undefined,
        notes: form.notes.trim() || undefined,
        cmsRequirement: needsCms ? form.cmsRequirement.trim() || undefined : undefined,
        appPlatform: needsPlatform ? form.appPlatform : "",
        services: selectedServices.map((service) => service.id),
      });

      clearSelectedServices();
      router.push("/success");
    } catch (error: any) {
      setSubmitError(error.message || "Failed to submit lead");
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedServices.length === 0) {
    return (
      <div style={styles.wrapper}>
        <Card>
          <h1 style={styles.emptyTitle}>Select services before filling the form</h1>
          <p style={styles.emptyText}>
            We need your selected services to adapt the questions and submit a qualified lead to the sales team.
          </p>
          <Button onClick={() => router.push("/services")}>Go to Services</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Step 2 of 3</p>
        <h1 style={styles.title}>Share a few details and we&apos;ll take it from there</h1>
        <p style={styles.subtitle}>
          Your answers help our sales team respond with the right scope, timeline, and next-step recommendation.
        </p>
      </div>

      <Card>
        <div style={styles.selectedWrap}>
          {selectedServices.map((service) => (
            <span key={service.id} style={styles.selectedChip}>{service.name}</span>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.grid}>
            <Input label="Full Name" value={form.name} onChange={(e) => setField("name", e.target.value)} error={errors.name} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} error={errors.email} />
            <Input label="Phone Number" value={form.phone} onChange={(e) => setField("phone", e.target.value)} error={errors.phone} />
            <Input label="Company Name" value={form.company} onChange={(e) => setField("company", e.target.value)} error={errors.company} />
            <Input label="Budget" value={form.budget} onChange={(e) => setField("budget", e.target.value)} error={errors.budget} />
            <div style={styles.field}>
              <label style={styles.label}>Timeline</label>
              <select
                value={form.timeline}
                onChange={(e) => setField("timeline", e.target.value)}
                style={{
                  ...styles.select,
                  borderColor: errors.timeline ? "#FF3B30" : "#E5E5EA",
                }}
              >
                <option value="">Select timeline</option>
                {timelineOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.timeline && <p style={styles.error}>{errors.timeline}</p>}
            </div>
          </div>

          {needsCms && (
            <Input
              label="CMS Requirement"
              value={form.cmsRequirement}
              onChange={(e) => setField("cmsRequirement", e.target.value)}
              error={errors.cmsRequirement}
            />
          )}

          {needsPlatform && (
            <div style={styles.field}>
              <label style={styles.label}>Preferred Platform</label>
              <select
                value={form.appPlatform}
                onChange={(e) => setField("appPlatform", e.target.value)}
                style={{
                  ...styles.select,
                  borderColor: errors.appPlatform ? "#FF3B30" : "#E5E5EA",
                }}
              >
                <option value="">Select platform</option>
                <option value="iOS">iOS</option>
                <option value="Android">Android</option>
                <option value="Both">Both</option>
              </select>
              {errors.appPlatform && <p style={styles.error}>{errors.appPlatform}</p>}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              style={styles.textarea}
              placeholder="Goals, deadlines, integrations, current pain points, or any context you'd like to share."
              rows={5}
            />
          </div>

          {errors.services && <p style={styles.error}>{errors.services}</p>}
          {submitError && <p style={{ ...styles.error, marginBottom: "16px" }}>{submitError}</p>}

          <div style={styles.footer}>
            <p style={styles.footerText}>Your request goes directly to the sales team.</p>
            <Button type="submit" size="lg" isLoading={submitting}>
              Submit Lead
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const styles: any = {
  wrapper: {
    maxWidth: "100%",
    margin: "0",
    padding: "32px 24px 64px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  header: {
    padding: "32px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%)",
    border: "1px solid #F3E8FF",
  },
  eyebrow: {
    margin: 0,
    color: "#7C3AED",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "12px 0 10px",
    fontSize: "34px",
    fontWeight: 700,
    color: "#111827",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    color: "#6B7280",
    fontSize: "16px",
    lineHeight: 1.7,
  },
  selectedWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "24px",
  },
  selectedChip: {
    padding: "8px 14px",
    borderRadius: "999px",
    backgroundColor: "#EEF6FF",
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  field: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#1C1C1E",
    marginBottom: "8px",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "14px",
    background: "#FFFFFF",
    border: "1px solid #E5E5EA",
    borderRadius: "12px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "14px",
    background: "#FFFFFF",
    border: "1px solid #E5E5EA",
    borderRadius: "12px",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    minHeight: "140px",
  },
  error: {
    fontSize: "12px",
    color: "#FF3B30",
    marginTop: "6px",
    marginBottom: 0,
  },
  footer: {
    marginTop: "8px",
    paddingTop: "20px",
    borderTop: "1px solid #F2F2F7",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  footerText: {
    margin: 0,
    fontSize: "13px",
    color: "#8E8E93",
  },
  emptyTitle: {
    margin: "0 0 12px",
    fontSize: "28px",
    fontWeight: 700,
    color: "#1C1C1E",
  },
  emptyText: {
    margin: "0 0 20px",
    fontSize: "15px",
    color: "#6B7280",
    lineHeight: 1.7,
  },
};
