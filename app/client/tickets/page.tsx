"use client";

import { useEffect, useState } from "react";
import { createTicket, getTickets, Ticket } from "../../../core/services/ticketService";
import { getProjects, Project } from "../../projects/services/projectService";

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({
    projectId: "",
    subject: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
  });

  const loadData = async () => {
    const [ticketData, projectData] = await Promise.all([getTickets(), getProjects()]);
    setTickets(ticketData);
    setProjects(projectData);
  };

  useEffect(() => {
    loadData().catch((error) => console.error("Ticket page error:", error));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage("");
    setSubmitError("");

    try {
      await createTicket(form);
      setForm({ projectId: "", subject: "", description: "", priority: "medium" });
      setSubmitMessage("Your query was submitted successfully. It has been emailed to admin and added to the admin inbox.");
      await loadData();
    } catch (error: any) {
      setSubmitError(typeof error === "string" ? error : error?.message || "Failed to submit query");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Query</h1>
        <p style={styles.subtitle}>Send a query to admin and keep track of your previous submissions</p>
      </div>

      <div style={styles.layout} className="client-query-layout">
        <form onSubmit={handleSubmit} style={styles.formCard}>
          {submitMessage && <div style={styles.successBox}>{submitMessage}</div>}
          {submitError && <div style={styles.errorBox}>{submitError}</div>}

          <label style={styles.label}>Project</label>
          <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} style={styles.input}>
            <option value="">General support</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>

          <label style={styles.label}>Subject</label>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={styles.input} required />

          <label style={styles.label}>Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={styles.textarea} required />

          <label style={styles.label}>Priority</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })} style={styles.input}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <button type="submit" style={styles.button} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Query"}
          </button>
        </form>

        <div style={styles.listCard}>
          <h2 style={styles.listTitle}>Your Queries</h2>
          <div style={styles.ticketList}>
            {tickets.map((ticket) => (
              <div key={ticket._id} style={styles.ticketItem}>
                <div style={styles.ticketTop}>
                  <strong style={styles.ticketSubject}>{ticket.subject}</strong>
                  <span style={styles.ticketStatus}>{ticket.status}</span>
                </div>
                <p style={styles.ticketDescription}>{ticket.description}</p>
                <div style={styles.ticketFooter}>
                  <span style={styles.ticketMeta}>Priority: {ticket.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .client-query-layout {
            grid-template-columns: 1fr !important;
          }
        }
        .input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 4px rgba(0,122,255,0.1) !important;
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: { 
    padding: "8px 4px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    minHeight: "100vh",
  },
  header: { marginBottom: "32px" },
  title: { fontSize: "34px", fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: "8px", letterSpacing: "-1px" },
  subtitle: { fontSize: "16px", color: "var(--text-secondary)", margin: 0 },
  layout: { display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: "24px" },
  formCard: { backgroundColor: "var(--bg-primary)", borderRadius: "20px", border: "1px solid var(--border-color)", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" },
  successBox: { padding: "12px 14px", backgroundColor: "rgba(52, 199, 89, 0.1)", border: "1px solid #34C759", borderRadius: "12px", fontSize: "13px", color: "#34C759" },
  errorBox: { padding: "12px 14px", backgroundColor: "rgba(255, 59, 48, 0.1)", border: "1px solid #FF3B30", borderRadius: "12px", fontSize: "13px", color: "#FF3B30" },
  label: { fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" },
  input: { width: "100%", padding: "12px 14px", border: "1.5px solid var(--border-color)", borderRadius: "12px", fontSize: "14px", fontFamily: "inherit", outline: "none", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" },
  textarea: { width: "100%", minHeight: "140px", padding: "12px 14px", border: "1.5px solid var(--border-color)", borderRadius: "12px", fontSize: "14px", fontFamily: "inherit", outline: "none", resize: "vertical" as const, backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" },
  button: { marginTop: "8px", padding: "12px 16px", backgroundColor: "#007AFF", color: "#FFFFFF", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer" },
  listCard: { backgroundColor: "var(--bg-primary)", borderRadius: "20px", border: "1px solid var(--border-color)", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" },
  listTitle: { fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: "20px" },
  ticketList: { display: "flex", flexDirection: "column" as const, gap: "16px" },
  ticketItem: { padding: "16px", backgroundColor: "var(--bg-secondary)", borderRadius: "16px", border: "1px solid var(--border-color)" },
  ticketTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "8px" },
  ticketSubject: { fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" },
  ticketStatus: { padding: "4px 12px", borderRadius: "20px", backgroundColor: "rgba(0, 122, 255, 0.1)", color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "capitalize" as const },
  ticketDescription: { fontSize: "14px", color: "var(--text-secondary)", margin: 0, marginBottom: "12px", lineHeight: 1.6 },
  ticketFooter: { borderTop: "1px solid var(--border-color)", paddingTop: "8px" },
  ticketMeta: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500, textTransform: "capitalize" as const },
};
