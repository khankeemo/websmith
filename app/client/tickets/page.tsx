"use client";

import { useEffect, useState } from "react";
import { createTicket, getTickets, Ticket, updateTicketStatus } from "../../../core/services/ticketService";
import { getProjects, Project } from "../../projects/services/projectService";
import { LayoutGrid, List, Columns, Send, Eye, RotateCcw, X, Clock, AlertCircle, CheckCircle } from "lucide-react";

type ViewMode = "list" | "grid" | "kanban";

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
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

  const handleReopenTicket = async (ticket: Ticket) => {
    try {
      await updateTicketStatus(ticket._id!, {
        status: "open",
      });
      await loadData();
    } catch (error) {
      console.error("Reopen ticket error:", error);
    }
  };

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

      <div style={styles.toolbar}>
        <div style={styles.viewToggle}>
          <button 
            onClick={() => setViewMode("list")} 
            style={{
              ...styles.viewBtn,
              backgroundColor: viewMode === "list" ? "#007AFF" : "var(--bg-secondary)",
              color: viewMode === "list" ? "#fff" : "var(--text-secondary)"
            }}
          >
            <List size={16} />
          </button>
          <button 
            onClick={() => setViewMode("grid")} 
            style={{
              ...styles.viewBtn,
              backgroundColor: viewMode === "grid" ? "#007AFF" : "var(--bg-secondary)",
              color: viewMode === "grid" ? "#fff" : "var(--text-secondary)"
            }}
          >
            <LayoutGrid size={16} />
          </button>
          <button 
            onClick={() => setViewMode("kanban")} 
            style={{
              ...styles.viewBtn,
              backgroundColor: viewMode === "kanban" ? "#007AFF" : "var(--bg-secondary)",
              color: viewMode === "kanban" ? "#fff" : "var(--text-secondary)"
            }}
          >
            <Columns size={16} />
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div style={styles.listCard}>
          <h2 style={styles.listTitle}>Your Queries</h2>
          <div style={styles.ticketList}>
            {tickets.map((ticket) => (
              <div key={ticket._id} style={styles.ticketItem}>
                <div style={styles.ticketTop}>
                  <strong style={styles.ticketSubject}>{ticket.subject}</strong>
                  <span style={styles.ticketStatus}>{ticket.status.replace("_", " ")}</span>
                </div>
                <p style={styles.ticketDescription}>{ticket.description}</p>
                <div style={styles.ticketFooter}>
                  <span style={styles.ticketMeta}>Priority: {ticket.priority}</span>
                  <div style={styles.ticketActions}>
                    <button 
                      onClick={() => setSelectedTicket(ticket)} 
                      style={styles.viewBtn}
                    >
                      <Eye size={14} />
                      View
                    </button>
                    {ticket.status === "resolved" && (
                      <button 
                        onClick={() => handleReopenTicket(ticket)} 
                        style={styles.reopenBtn}
                      >
                        <RotateCcw size={14} />
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div style={styles.grid}>
          {tickets.map((ticket) => (
            <div key={ticket._id} style={styles.gridCard}>
              <div style={styles.gridHeader}>
                <strong style={styles.gridSubject}>{ticket.subject}</strong>
                <span style={styles.gridStatus}>{ticket.status.replace("_", " ")}</span>
              </div>
              <p style={styles.gridDescription}>{ticket.description}</p>
              <div style={styles.gridMeta}>
                <span>Priority: {ticket.priority}</span>
              </div>
              <div style={styles.gridActions}>
                <button onClick={() => setSelectedTicket(ticket)} style={styles.viewBtn}>
                  <Eye size={14} />
                  View Details
                </button>
                {ticket.status === "resolved" && (
                  <button onClick={() => handleReopenTicket(ticket)} style={styles.reopenBtn}>
                    <RotateCcw size={14} />
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.kanban}>
          {["open", "in_progress", "resolved"].map((status) => {
            const statusTickets = tickets.filter((t) => t.status === status);
            return (
              <div key={status} style={styles.kanbanColumn}>
                <div style={styles.kanbanHeader}>
                  <h3 style={styles.kanbanTitle}>
                    {status.replace("_", " ").toUpperCase()}
                  </h3>
                  <span style={styles.kanbanCount}>{statusTickets.length}</span>
                </div>
                <div style={styles.kanbanCards}>
                  {statusTickets.map((ticket) => (
                    <div key={ticket._id} style={styles.kanbanCard}>
                      <div style={styles.kanbanCardHeader}>
                        <strong style={styles.kanbanCardSubject}>{ticket.subject}</strong>
                        <span style={{
                          ...styles.priorityBadge,
                          backgroundColor: ticket.priority === "high" ? "#FF3B30" : ticket.priority === "medium" ? "#FF9500" : "#34C759"
                        }}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p style={styles.kanbanCardDesc}>{ticket.description}</p>
                      <div style={styles.kanbanCardFooter}>
                        <button onClick={() => setSelectedTicket(ticket)} style={styles.kanbanViewBtn}>
                          <Eye size={12} />
                          View
                        </button>
                        {status === "resolved" && (
                          <button onClick={() => handleReopenTicket(ticket)} style={styles.kanbanReopenBtn}>
                            <RotateCcw size={12} />
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {selectedTicket && (
        <div style={styles.modal} onClick={() => setSelectedTicket(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{selectedTicket.subject}</h2>
              <button onClick={() => setSelectedTicket(null)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status:</span>
                <span style={styles.detailValue}>{selectedTicket.status.replace("_", " ")}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Priority:</span>
                <span style={{
                  ...styles.detailValue,
                  color: selectedTicket.priority === "high" ? "#FF3B30" : selectedTicket.priority === "medium" ? "#FF9500" : "#34C759"
                }}>{selectedTicket.priority}</span>
              </div>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Description</h3>
                <p style={styles.sectionText}>{selectedTicket.description}</p>
              </div>
              {selectedTicket.resolution && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Resolution</h3>
                  <div style={styles.resolutionBox}>
                    <CheckCircle size={16} color="#10B981" />
                    <p style={styles.resolutionText}>{selectedTicket.resolution}</p>
                  </div>
                </div>
              )}
              {selectedTicket.history && selectedTicket.history.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>History</h3>
                  <div style={styles.historyList}>
                    {selectedTicket.history.map((item: any, index: number) => (
                      <div key={index} style={styles.historyItem}>
                        <Clock size={14} color="#8E8E93" />
                        <div style={styles.historyContent}>
                          <p style={styles.historyText}>{item.message || `Status changed to ${item.status}`}</p>
                          <p style={styles.historyTime}>
                            {new Date(item.timestamp).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedTicket.status === "resolved" && (
                <div style={styles.modalFooter}>
                  <button 
                    onClick={() => {
                      handleReopenTicket(selectedTicket);
                      setSelectedTicket(null);
                    }} 
                    style={styles.modalReopenBtn}
                  >
                    <RotateCcw size={16} />
                    Reopen Query
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
  toolbar: { display: "flex", justifyContent: "flex-end", marginBottom: "24px" },
  viewToggle: { display: "flex", gap: "8px", backgroundColor: "var(--bg-secondary)", padding: "4px", borderRadius: "12px" },
  viewBtn: { padding: "8px 12px", border: "none", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 500 },
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
  ticketFooter: { borderTop: "1px solid var(--border-color)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  ticketMeta: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500, textTransform: "capitalize" as const },
  ticketActions: { display: "flex", gap: "8px" },
  reopenBtn: { padding: "6px 12px", border: "1px solid #8B5CF6", backgroundColor: "transparent", color: "#8B5CF6", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" },
  gridCard: { padding: "20px", backgroundColor: "var(--bg-secondary)", borderRadius: "16px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "12px" },
  gridHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" },
  gridSubject: { fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" },
  gridStatus: { padding: "4px 10px", borderRadius: "20px", backgroundColor: "rgba(0, 122, 255, 0.1)", color: "#007AFF", fontSize: "11px", fontWeight: 700, textTransform: "capitalize" as const },
  gridDescription: { fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 },
  gridMeta: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500, textTransform: "capitalize" as const, borderTop: "1px solid var(--border-color)", paddingTop: "8px" },
  gridActions: { display: "flex", gap: "8px", marginTop: "auto" },
  kanban: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" },
  kanbanColumn: { display: "flex", flexDirection: "column" as const },
  kanbanHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "2px solid var(--border-color)" },
  kanbanTitle: { fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0, textTransform: "uppercase" as const },
  kanbanCount: { backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 },
  kanbanCards: { display: "flex", flexDirection: "column" as const, gap: "12px" },
  kanbanCard: { padding: "16px", backgroundColor: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-color)" },
  kanbanCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" },
  kanbanCardSubject: { fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" },
  priorityBadge: { padding: "2px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: 700, color: "#fff", textTransform: "capitalize" as const },
  kanbanCardDesc: { fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: 1.5 },
  kanbanCardFooter: { display: "flex", gap: "8px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" },
  kanbanViewBtn: { flex: 1, padding: "6px 10px", border: "none", backgroundColor: "#007AFF", color: "#fff", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" },
  kanbanReopenBtn: { flex: 1, padding: "6px 10px", border: "1px solid #8B5CF6", backgroundColor: "transparent", color: "#8B5CF6", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" },
  modal: { position: "fixed" as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "var(--bg-primary)", borderRadius: "20px", maxWidth: "600px", width: "100%", maxHeight: "80vh", overflow: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 24px 0", borderBottom: "1px solid var(--border-color)", paddingBottom: "16px" },
  modalTitle: { fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0 },
  closeBtn: { border: "none", backgroundColor: "transparent", cursor: "pointer", color: "var(--text-secondary)", padding: "8px" },
  modalBody: { padding: "24px" },
  detailRow: { display: "flex", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid var(--border-color)" },
  detailLabel: { fontSize: "13px", color: "var(--text-secondary)", fontWeight: 600 },
  detailValue: { fontSize: "13px", fontWeight: 600, textTransform: "capitalize" as const },
  section: { marginTop: "20px" },
  sectionTitle: { fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" },
  sectionText: { fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 },
  resolutionBox: { display: "flex", gap: "12px", padding: "16px", backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: "12px", border: "1px solid #10B981" },
  resolutionText: { fontSize: "14px", color: "#10B981", margin: 0, flex: 1 },
  historyList: { display: "flex", flexDirection: "column" as const, gap: "12px" },
  historyItem: { display: "flex", gap: "12px", alignItems: "flex-start" },
  historyContent: { flex: 1 },
  historyText: { fontSize: "13px", color: "var(--text-primary)", margin: 0, marginBottom: "4px" },
  historyTime: { fontSize: "11px", color: "var(--text-secondary)", margin: 0 },
  modalFooter: { marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" },
  modalReopenBtn: { width: "100%", padding: "12px", border: "1px solid #8B5CF6", backgroundColor: "transparent", color: "#8B5CF6", borderRadius: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
};
