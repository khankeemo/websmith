"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { createPublicTicket } from "../../../core/services/ticketService";
import { Card, PublicPage, Section, TwoColumn } from "../_components/PublicPage";

export default function ContactPageClient() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("submitting");
    setFeedback("");

    try {
      await createPublicTicket({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: "Public contact request",
        message: form.message.trim(),
      });
      setStatus("success");
      setFeedback("Thanks. We usually respond within 24 hours.");
      setForm({ name: "", email: "", message: "" });
    } catch (error: any) {
      setStatus("error");
      setFeedback(error?.response?.data?.message || "We couldn't submit your message right now.");
    }
  };

  return (
    <PublicPage
      eyebrow="Contact"
      title="Tell us what you’re building and where you need support."
      description="Use the contact form for new business, project questions, or support follow-up. We aim to respond within 24 hours."
    >
      <Section title="Contact Websmith">
        <TwoColumn
          left={
            <Card>
              <h3 style={styles.heading}>Business contact</h3>
              <div style={styles.infoList}>
                <p style={styles.infoLabel}>Email</p>
                <a href="mailto:hello@websmith.dev" style={styles.link}>hello@websmith.dev</a>
                <p style={styles.infoLabel}>Phone</p>
                <p style={styles.body}>+1 (555) 014-2048</p>
                <p style={styles.infoLabel}>Location</p>
                <p style={styles.body}>Remote-first delivery with distributed collaboration.</p>
              </div>
            </Card>
          }
          right={
            <Card>
              <form onSubmit={handleSubmit} style={styles.form}>
                <label style={styles.label}>
                  <span>Name</span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  <span>Email</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  <span>Message</span>
                  <textarea
                    required
                    value={form.message}
                    onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                    style={styles.textarea}
                    rows={5}
                  />
                </label>
                <button type="submit" style={styles.button} disabled={status === "submitting"}>
                  {status === "submitting" ? "Sending..." : "Send Message"}
                </button>
                {feedback ? (
                  <p style={{ ...styles.feedback, color: status === "error" ? "#DC2626" : "#15803D" }}>{feedback}</p>
                ) : null}
              </form>
            </Card>
          }
        />
      </Section>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 },
  infoList: { display: "grid", gap: "8px" },
  infoLabel: { margin: "8px 0 0", color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  link: { color: "#007AFF", textDecoration: "none", fontWeight: 700 },
  form: { display: "grid", gap: "14px" },
  label: { display: "grid", gap: "8px", color: "var(--text-primary)", fontWeight: 600, fontSize: "14px" },
  input: { width: "100%", borderRadius: "14px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", padding: "12px 14px", fontSize: "14px" },
  textarea: { width: "100%", borderRadius: "14px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", padding: "12px 14px", fontSize: "14px", resize: "vertical" },
  button: { border: "none", borderRadius: "14px", backgroundColor: "#007AFF", color: "#FFFFFF", padding: "13px 16px", fontWeight: 700, cursor: "pointer" },
  feedback: { margin: 0, fontSize: "14px", fontWeight: 600 },
};
