"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, MessageSquare, Globe, Clock, ChevronDown } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { PhoneInputWithCountry } from "@/components/ui/PhoneInputWithCountry";
import { validatePhoneNumber } from "@/core/utils/phoneValidation";
import {
  CONTACT_TIME_SLOT_GROUPS,
  ALL_WORLD_TIMEZONE_GROUPS,
  getSlotISTRange,
  getBookingDateLimits,
} from "@/core/utils/contactScheduling";
import { createPublicTicket } from "../../../core/services/ticketService";
import { useLeadFunnel } from "../../providers/LeadFunnelProvider";



type LeadFormClientProps = {
  variant?: "page" | "wizard";
  onBack?: () => void;
  onSuccess?: () => void;
};

interface FormState {
  name: string;
  email: string;
  callingPhone: string;
  callingCountry: string;
  callingDial: string;
  whatsappPhone: string;
  whatsappCountry: string;
  whatsappDial: string;
  sameAsCalling: boolean;
  company: string;
  budget: string;
  timeline: string;
  preferredContactDate: string;
  preferredContactTime: string;
  userTimeZone: string;
  notes: string;
  cmsRequirement: string;
  appPlatform: "" | "iOS" | "Android" | "Both";
}

const initialState: FormState = {
  name: "",
  email: "",
  callingPhone: "",
  callingCountry: "",
  callingDial: "+91",
  whatsappPhone: "",
  whatsappCountry: "",
  whatsappDial: "+91",
  sameAsCalling: false,
  company: "",
  budget: "",
  timeline: "",
  preferredContactDate: "",
  preferredContactTime: "",
  userTimeZone: "",
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

export default function LeadFormClient({ variant = "page", onBack, onSuccess }: LeadFormClientProps) {
  const router = useRouter();
  const { selectedServices, clearSelectedServices, openLeadServicesModal } = useLeadFunnel();
  const isWizard = variant === "wizard";
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [userTimeZoneInfo, setUserTimeZoneInfo] = useState<{ zone: string; badge: string }>({
    zone: "",
    badge: "",
  });

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      let shortCode = "";
      try {
        const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
        const tzPart = parts.find((p) => p.type === "timeZoneName");
        if (tzPart?.value) shortCode = tzPart.value;
      } catch {
        // fallback
      }
      const badge = shortCode ? `${tz} (${shortCode})` : tz;
      setUserTimeZoneInfo({ zone: tz, badge });
      setForm((prev) => ({
        ...prev,
        userTimeZone: prev.userTimeZone || tz,
      }));
    } catch (err) {
      console.error("Timezone detection error:", err);
    }
  }, []);

  const selectedNames = useMemo(
    () => selectedServices.map((service) => service.name),
    [selectedServices]
  );

  const needsCms = selectedNames.includes("Web Development");
  const needsPlatform = selectedNames.includes("Mobile App Development");

  const bookingDateLimits = useMemo(() => {
    return getBookingDateLimits(7);
  }, []);

  const isUserIST = useMemo(() => {
    const tz = form.userTimeZone || userTimeZoneInfo.zone || "";
    return tz === "Asia/Kolkata" || tz === "Asia/Calcutta";
  }, [form.userTimeZone, userTimeZoneInfo.zone]);

  const calculatedISTRange = useMemo(() => {
    if (!form.preferredContactTime) return "";
    return getSlotISTRange(
      form.preferredContactDate,
      form.preferredContactTime,
      form.userTimeZone || userTimeZoneInfo.zone || "Asia/Kolkata"
    );
  }, [form.preferredContactDate, form.preferredContactTime, form.userTimeZone, userTimeZoneInfo.zone]);


  const setField = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setSubmitError(null);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Valid email is required";

    const callingFull = form.callingPhone.trim()
      ? `${form.callingDial || "+91"} ${form.callingPhone.trim()}`
      : "";
    const whatsappFull = form.sameAsCalling
      ? callingFull
      : form.whatsappPhone.trim()
      ? `${form.whatsappDial || "+91"} ${form.whatsappPhone.trim()}`
      : "";

    if (!form.callingPhone.trim()) {
      nextErrors.callingPhone = "Calling phone number is required";
    } else {
      const callCheck = validatePhoneNumber(callingFull);
      if (!callCheck.valid) {
        nextErrors.callingPhone = callCheck.error || "Invalid calling phone number";
      }
    }

    if (form.whatsappPhone.trim() && !form.sameAsCalling) {
      const waCheck = validatePhoneNumber(whatsappFull);
      if (!waCheck.valid) {
        nextErrors.whatsappPhone = waCheck.error || "Invalid WhatsApp phone number";
      }
    }

    if (form.preferredContactDate) {
      if (form.preferredContactDate < bookingDateLimits.minDate) {
        nextErrors.preferredContactDate = "Please choose a date from today onwards.";
      } else if (form.preferredContactDate > bookingDateLimits.maxDate) {
        nextErrors.preferredContactDate = "Please select a date within the next 7 days.";
      }
    }

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

      const callingNumberFull = form.callingPhone.trim()
        ? `${form.callingDial || "+91"} ${form.callingPhone.trim()}`
        : "";
      const whatsappNumberFull = form.sameAsCalling
        ? callingNumberFull
        : form.whatsappPhone.trim()
        ? `${form.whatsappDial || "+91"} ${form.whatsappPhone.trim()}`
        : "";

      const activeTz = form.userTimeZone || userTimeZoneInfo.zone || "Asia/Kolkata";
      const istConverted = calculatedISTRange || "";

      const servicesSummary = selectedServices.map((s) => s.name).join(", ");
      const subject = `Project Inquiry: ${servicesSummary || "Custom Services"}`;

      const messageLines = [
        servicesSummary ? `Selected Services: ${servicesSummary}` : null,
        form.budget ? `Estimated Budget: $${Number(form.budget).toLocaleString()}` : null,
        form.timeline ? `Target Timeline: ${form.timeline}` : null,
        needsCms && form.cmsRequirement ? `CMS Requirement: ${form.cmsRequirement}` : null,
        needsPlatform && form.appPlatform ? `Preferred Platform: ${form.appPlatform}` : null,
        form.notes.trim() ? `Project Notes & Scope:\n${form.notes.trim()}` : null,
      ].filter(Boolean);

      const fullMessage = messageLines.join("\n\n");

      const scheduleParts = [
        form.preferredContactDate.trim(),
        form.preferredContactTime.trim()
          ? `${form.preferredContactTime} (${userTimeZoneInfo.badge || activeTz})`
          : "",
        istConverted && !isUserIST ? `[Call at IST: ${istConverted}]` : "",
      ].filter(Boolean);
      const formattedSchedule = scheduleParts.join(" · ");

      const ticket = await createPublicTicket({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        callingPhone: callingNumberFull,
        whatsappPhone: whatsappNumberFull,
        preferredContactDate: formattedSchedule || form.preferredContactDate.trim(),
        preferredContactTime: form.preferredContactTime.trim(),
        timeZone: activeTz,
        clientTimeZone: activeTz,
        adminCallTimeIST: istConverted,
        company: form.company.trim(),
        subject,
        message: fullMessage || `Project inquiry for ${servicesSummary}`,
        source: "lead_funnel",
        budget: form.budget ? Number(form.budget) : null,
        timeline: form.timeline.trim() || undefined,
        services: selectedServices.map((s) => s.name || s.id),
        cmsRequirement: needsCms ? form.cmsRequirement.trim() || undefined : undefined,
        appPlatform: needsPlatform ? form.appPlatform : undefined,
      });

      clearSelectedServices();
      if (isWizard && onSuccess) {
        onSuccess();
      } else {
        const refParam = ticket?.requestId ? `?ref=${encodeURIComponent(ticket.requestId)}` : "";
        router.push(`/success${refParam}`);
      }

    } catch (error: any) {
      setSubmitError(error.message || "Failed to submit lead");
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedServices.length === 0) {
    return (
      <div style={isWizard ? { ...styles.wrapper, ...styles.wrapperWizard } : styles.wrapper}>
        <Card>
          <h1 style={styles.emptyTitle}>Select services before filling the form</h1>
          <p style={styles.emptyText}>
            We need your selected services to adapt the questions and submit a qualified lead to the sales team.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" as const }}>
            {isWizard && onBack && (
              <Button variant="secondary" type="button" onClick={onBack} leftIcon={<ArrowLeft size={16} />}>
                Back
              </Button>
            )}
            <Button onClick={() => openLeadServicesModal()}>Choose services</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={isWizard ? { ...styles.wrapper, ...styles.wrapperWizard } : styles.wrapper}>
      {isWizard && onBack && (
        <div style={{ marginBottom: "8px" }}>
          <Button variant="secondary" type="button" size="sm" onClick={onBack} leftIcon={<ArrowLeft size={16} />}>
            Back to services
          </Button>
        </div>
      )}
      <div style={isWizard ? { ...styles.header, ...styles.headerWizard } : styles.header}>
        <p style={styles.eyebrow}>Step 2 of 3</p>
        <h1 style={styles.title}>Share a few details and we&apos;ll take it from there</h1>
        <p style={styles.subtitle}>
          Your answers help our sales team respond with the right scope, timeline, and consultation scheduling.
        </p>
      </div>

      <Card>
        <div style={styles.selectedWrap}>
          {selectedServices.map((service) => (
            <span key={service.id} style={styles.selectedChip}>{service.name}</span>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name, Email, Company */}
          <div style={styles.grid}>
            <Input
              label="Full Name *"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              error={errors.name}
            />
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              error={errors.email}
            />
            <Input
              label="Company Name"
              value={form.company}
              onChange={(e) => setField("company", e.target.value)}
              error={errors.company}
            />
          </div>

          {/* Dual Phone: Calling Number & WhatsApp Number */}
          <div style={{ ...styles.grid, marginTop: "16px" }}>
            <div style={styles.field}>
              <label style={styles.label}>Calling Number *</label>
              <PhoneInputWithCountry
                id="lead-calling-phone"
                name="callingPhone"
                value={form.callingPhone}
                countryCode={form.callingCountry}
                onCountryChange={(country) => {
                  setForm((prev) => ({ ...prev, callingCountry: country.code, callingDial: country.dial }));
                }}
                onChange={(digits) => {
                  setForm((prev) => ({ ...prev, callingPhone: digits }));
                  setErrors((prev) => ({ ...prev, callingPhone: "" }));
                }}
                placeholder="Phone number"
                error={errors.callingPhone}
                icon={<Phone size={15} />}
              />
              {errors.callingPhone && <p style={styles.error}>{errors.callingPhone}</p>}
            </div>

            <div style={styles.field}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "22px", marginBottom: "8px" }}>
                <label style={{ ...styles.label, marginBottom: 0 }}>WhatsApp Number</label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={form.sameAsCalling}
                    onChange={(e) => setForm((prev) => ({ ...prev, sameAsCalling: e.target.checked }))}
                    style={{ cursor: "pointer" }}
                  />
                  Same as calling
                </label>
              </div>
              <PhoneInputWithCountry
                id="lead-whatsapp-phone"
                name="whatsappPhone"
                value={form.whatsappPhone}
                countryCode={form.whatsappCountry}
                disabled={form.sameAsCalling}
                onCountryChange={(country) => {
                  setForm((prev) => ({ ...prev, whatsappCountry: country.code, whatsappDial: country.dial }));
                }}
                onChange={(digits) => {
                  setForm((prev) => ({ ...prev, whatsappPhone: digits }));
                  setErrors((prev) => ({ ...prev, whatsappPhone: "" }));
                }}
                placeholder="WhatsApp number"
                error={errors.whatsappPhone}
                icon={<MessageSquare size={15} />}
              />
              {errors.whatsappPhone && <p style={styles.error}>{errors.whatsappPhone}</p>}
            </div>
          </div>

          {/* Consultation Scheduling: Date, Time Slot & Timezone */}
          <div style={{ ...styles.grid3, marginTop: "16px" }}>
            <div style={styles.field}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <label style={{ ...styles.label, marginBottom: 0 }}>Preferred Date</label>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Next 7 days</span>
              </div>
              <input
                type="date"
                min={bookingDateLimits.minDate}
                max={bookingDateLimits.maxDate}
                value={form.preferredContactDate}
                onChange={(e) => setField("preferredContactDate", e.target.value)}
                style={{
                  ...styles.select,
                  borderColor: errors.preferredContactDate ? "#FF3B30" : "var(--border-color)",
                }}
              />
              {errors.preferredContactDate && <p style={styles.error}>{errors.preferredContactDate}</p>}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Preferred Time Slot</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={form.preferredContactTime}
                  onChange={(e) => setField("preferredContactTime", e.target.value)}
                  style={{
                    ...styles.select,
                    paddingRight: "36px",
                    color: form.preferredContactTime ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  <option value="">Select preferred slot...</option>
                  {CONTACT_TIME_SLOT_GROUPS.map((grp) => (
                    <optgroup key={grp.group} label={grp.group} style={{ fontWeight: 700, color: "var(--text-secondary)", backgroundColor: "var(--bg-secondary)" }}>
                      {grp.slots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  style={{
                    position: "absolute",
                    right: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "var(--text-secondary)",
                  }}
                />
              </div>
            </div>

            <div style={styles.field}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", minHeight: "22px", marginBottom: "8px" }}>
                <label style={{ ...styles.label, marginBottom: 0 }}>Your Timezone</label>
                {userTimeZoneInfo.badge && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--accent-primary, #007AFF)",
                      fontWeight: 500,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    title={`Detected system timezone: ${userTimeZoneInfo.zone}`}
                  >
                    <Globe size={11} /> Detected
                  </span>
                )}
              </div>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={form.userTimeZone}
                  onChange={(e) => setField("userTimeZone", e.target.value)}
                  style={{
                    ...styles.select,
                    paddingRight: "36px",
                    color: form.userTimeZone ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {ALL_WORLD_TIMEZONE_GROUPS.map((grp) => (
                    <optgroup key={grp.group} label={grp.group} style={{ fontWeight: 700, color: "var(--text-secondary)", backgroundColor: "var(--bg-secondary)" }}>
                      {grp.zones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  style={{
                    position: "absolute",
                    right: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "var(--text-secondary)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Dual-Time IST Preview Banner */}
          {calculatedISTRange && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 16px",
                borderRadius: "12px",
                background: "color-mix(in srgb, #007AFF 8%, var(--bg-secondary))",
                border: "1px solid color-mix(in srgb, #007AFF 22%, transparent)",
                marginTop: "12px",
                marginBottom: "18px",
                fontSize: "13px",
                color: "var(--text-primary)",
              }}
            >
              <Clock size={16} color="#007AFF" />
              <div>
                <strong>Dual-Time Sync:</strong> Your selected slot corresponds to{" "}
                <span style={{ color: "#007AFF", fontWeight: 600 }}>{calculatedISTRange}</span> for our agency team.
              </div>
            </div>
          )}

          {/* Budget & Timeline */}
          <div style={{ ...styles.grid, marginTop: "16px" }}>
            <Input
              label="Estimated Budget ($)"
              value={form.budget}
              onChange={(e) => setField("budget", e.target.value)}
              error={errors.budget}
              placeholder="e.g. 5000"
            />
            <div style={styles.field}>
              <label style={styles.label}>Timeline</label>
              <select
                value={form.timeline}
                onChange={(e) => setField("timeline", e.target.value)}
                style={{
                  ...styles.select,
                  borderColor: errors.timeline ? "#FF3B30" : "var(--border-color)",
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
            <div style={{ marginTop: "16px" }}>
              <Input
                label="CMS Requirement"
                value={form.cmsRequirement}
                onChange={(e) => setField("cmsRequirement", e.target.value)}
                error={errors.cmsRequirement}
                placeholder="e.g. WordPress, Strapi, Custom Headless, None"
              />
            </div>
          )}

          {needsPlatform && (
            <div style={{ ...styles.field, marginTop: "16px" }}>
              <label style={styles.label}>Preferred Platform</label>
              <select
                value={form.appPlatform}
                onChange={(e) => setField("appPlatform", e.target.value)}
                style={{
                  ...styles.select,
                  borderColor: errors.appPlatform ? "#FF3B30" : "var(--border-color)",
                }}
              >
                <option value="">Select platform</option>
                <option value="iOS">iOS</option>
                <option value="Android">Android</option>
                <option value="Both">Both (Cross-Platform)</option>
              </select>
              {errors.appPlatform && <p style={styles.error}>{errors.appPlatform}</p>}
            </div>
          )}

          <div style={{ ...styles.field, marginTop: "16px" }}>
            <label style={styles.label}>Project Scope & Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              style={styles.textarea}
              placeholder="Goals, deadlines, integrations, current pain points, or any context you'd like to share."
              rows={4}
            />
          </div>

          {errors.services && <p style={styles.error}>{errors.services}</p>}
          {submitError && <p style={{ ...styles.error, marginBottom: "16px" }}>{submitError}</p>}

          <div style={styles.footer}>
            <p style={styles.footerText}>
              Your consultation schedule and inquiry will be dispatched immediately to our agency team.
            </p>
            <Button type="submit" size="lg" isLoading={submitting}>
              Schedule & Submit Lead
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
  wrapperWizard: {
    padding: "0 0 12px",
    gap: "16px",
  },
  header: {
    padding: "32px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, color-mix(in srgb, #7C3AED 12%, var(--bg-secondary)) 0%, var(--bg-primary) 100%)",
    border: "1px solid var(--border-color)",
  },
  headerWizard: {
    padding: "20px 22px",
    borderRadius: "18px",
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
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    color: "var(--text-secondary)",
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
    backgroundColor: "color-mix(in srgb, #007AFF 14%, var(--bg-secondary))",
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: 600,
    border: "1px solid color-mix(in srgb, #007AFF 25%, transparent)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  field: {
    marginBottom: "8px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-primary)",
    marginBottom: "8px",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "14px",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "14px",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    minHeight: "110px",
  },
  error: {
    fontSize: "12px",
    color: "#FF3B30",
    marginTop: "6px",
    marginBottom: 0,
  },
  footer: {
    marginTop: "16px",
    paddingTop: "20px",
    borderTop: "1px solid var(--border-color)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  footerText: {
    margin: 0,
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  emptyTitle: {
    margin: "0 0 12px",
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  emptyText: {
    margin: "0 0 20px",
    fontSize: "15px",
    color: "var(--text-secondary)",
    lineHeight: 1.7,
  },
};
