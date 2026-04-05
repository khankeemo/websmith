"use client";

import { useEffect, useState } from "react";
import { createTicket, getTickets, Ticket } from "../../../core/services/ticketService";
import { getProjects, Project } from "../../projects/services/projectService";

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
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
    await createTicket(form);
    setForm({ projectId: "", subject: "", description: "", priority: "medium" });
    await loadData();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Raise Ticket</h1>
        <p style={styles.subtitle}>Contact your delivery team and track resolution status</p>
      </div>

      <div style={styles.layout}>
        <form onSubmit={handleSubmit} style={styles.formCard}>
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

          <button type="submit" style={styles.button}>Submit Ticket</button>
        </form>

        <div style={styles.listCard}>
          <h2 style={styles.listTitle}>Your Tickets</h2>
          <div style={styles.ticketList}>
            {tickets.map((ticket) => (
              <div key={ticket._id} style={styles.ticketItem}>
                <div style={styles.ticketTop}>
                  <strong style={styles.ticketSubject}>{ticket.subject}</strong>
                  <span style={styles.ticketStatus}>{ticket.status}</span>
                </div>
                <p style={styles.ticketDescription}>{ticket.description}</p>
                <p style={styles.ticketMeta}>Priority: {ticket.priority}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  container: { padding: "8px 4px" },
  header: { marginBottom: "24px" },
  title: { fontSize: "34px", fontWeight: 600, color: "#1C1C1E", margin: 0, marginBottom: "8px", letterSpacing: "-0.5px" },
  subtitle: { fontSize: "15px", color: "#8E8E93", margin: 0 },
  layout: { display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: "20px" },
  formCard: { backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E5E5EA", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" },
  label: { fontSize: "13px", fontWeight: 500, color: "#1C1C1E" },
  input: { width: "100%", padding: "12px 14px", border: "1.5px solid #E5E5EA", borderRadius: "12px", fontSize: "14px", fontFamily: "inherit", outline: "none" },
  textarea: { width: "100%", minHeight: "140px", padding: "12px 14px", border: "1.5px solid #E5E5EA", borderRadius: "12px", fontSize: "14px", fontFamily: "inherit", outline: "none", resize: "vertical" as const },
  button: { marginTop: "8px", padding: "12px 16px", backgroundColor: "#007AFF", color: "#FFFFFF", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  listCard: { backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E5E5EA", padding: "20px" },
  listTitle: { fontSize: "20px", fontWeight: 600, color: "#1C1C1E", margin: 0, marginBottom: "16px" },
  ticketList: { display: "flex", flexDirection: "column" as const, gap: "14px" },
  ticketItem: { padding: "16px", backgroundColor: "#F9F9FB", borderRadius: "14px" },
  ticketTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "8px" },
  ticketSubject: { fontSize: "15px", color: "#1C1C1E" },
  ticketStatus: { padding: "4px 10px", borderRadius: "20px", backgroundColor: "#E3F2FF", color: "#007AFF", fontSize: "12px", textTransform: "capitalize" as const },
  ticketDescription: { fontSize: "14px", color: "#6C6C70", margin: 0, marginBottom: "8px", lineHeight: 1.5 },
  ticketMeta: { fontSize: "12px", color: "#8E8E93", margin: 0, textTransform: "capitalize" as const },
};
