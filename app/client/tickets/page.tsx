"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, MessageSquarePlus, Send } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { addTicketReply, createTicket, getTickets, Ticket } from "../../../core/services/ticketService";
import { getProjects, Project } from "../../projects/services/projectService";

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState({
    projectId: "",
    subject: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
  });

  const sortedTickets = useMemo(
    () =>
      [...tickets].sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      }),
    [tickets]
  );

  const selectedTicket = useMemo(
    () => sortedTickets.find((ticket) => ticket._id === selectedId) ?? null,
    [sortedTickets, selectedId]
  );

  const isReadonly =
    selectedTicket?.status === "resolved" ||
    selectedTicket?.status === "closed" ||
    selectedTicket?.chatStatus === "closed";

  const loadData = async () => {
    const [ticketData, projectData] = await Promise.all([getTickets(), getProjects()]);
    setTickets(ticketData);
    setProjects(projectData);
    setSelectedId((prev) => prev ?? ticketData[0]?._id ?? null);
  };

  useEffect(() => {
    loadData().catch((error) => console.error("Ticket page error:", error));
  }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket?._id, selectedTicket?.history?.length]);

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim() || isReadonly) return;
    setSendingReply(true);
    try {
      await addTicketReply(selectedTicket._id, replyMessage.trim());
      setReplyMessage("");
      await loadData();
    } catch (error) {
      console.error("Reply error:", error);
    } finally {
      setSendingReply(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitMessage("");
    setSubmitError("");

    try {
      await createTicket(form);
      setForm({ projectId: "", subject: "", description: "", priority: "medium" });
      setSubmitMessage("Your query was submitted successfully.");
      await loadData();
      setIsQueryModalOpen(false);
    } catch (error: any) {
      setSubmitError(typeof error === "string" ? error : error?.message || "Failed to submit query");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Just now";

  const statusLabel = (status: Ticket["status"]) => status.replace("_", " ");

  return (
    <div style={styles.container}>
      <div style={styles.topHeader}>
        <div>
          <h1 style={styles.title}>Queries</h1>
          <p style={styles.subtitle}>Create and track your support queries in a simple thread view.</p>
        </div>
        <button type="button" onClick={() => setIsQueryModalOpen(true)} style={styles.raiseQueryBtn}>
          <MessageSquarePlus size={18} />
          Create New Query
        </button>
      </div>

      <div style={styles.layout} className="client-query-layout">
        <div style={styles.listCard}>
          <h2 style={styles.historyTitle}>Query List</h2>
          {sortedTickets.length === 0 ? (
            <p style={styles.historyEmpty}>No queries yet.</p>
          ) : (
            <div style={styles.compactHistory}>
              {sortedTickets.map((ticket) => (
                <button
                  key={ticket._id}
                  type="button"
                  onClick={() => setSelectedId(ticket._id)}
                  style={{
                    ...styles.historyRow,
                    ...(ticket._id === selectedTicket?._id ? styles.historyRowActive : {}),
                  }}
                >
                  <div style={styles.historyRowMain}>
                    <strong style={styles.historySubject}>{ticket.subject}</strong>
                    <span style={styles.historyMeta}>{statusLabel(ticket.status)}</span>
                  </div>
                  <span style={styles.historyTime}>{formatDate(ticket.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={styles.detailsCard}>
          {!selectedTicket ? (
            <div style={styles.emptyState}>
              <MessageSquare size={34} color="var(--text-secondary)" />
              <p style={styles.historyEmpty}>Select a query to view details.</p>
            </div>
          ) : (
            <>
              <div style={styles.detailsHeader}>
                <h2 style={styles.detailsTitle}>{selectedTicket.subject}</h2>
                <div style={styles.detailsHeaderActions}>
                  <span style={styles.readOnlyStatus}>{statusLabel(selectedTicket.status)}</span>
                  <button type="button" onClick={() => setSelectedId(null)} style={styles.closeChatBtn}>
                    Close Chat
                  </button>
                </div>
              </div>

              <div style={styles.thread}>
                {selectedTicket.history?.map((item, index) => (
                  <div
                    key={`${item.createdAt}-${index}`}
                    style={{
                      ...styles.messageItem,
                      ...(item.actorRole === "client" ? styles.messageClient : styles.messageAdmin),
                    }}
                  >
                    <p style={styles.messageRole}>{item.actorRole.replace("_", " ")}</p>
                    <p style={styles.messageText}>{item.message || "No message provided."}</p>
                    <p style={styles.messageTime}>{formatDate(item.createdAt)}</p>
                  </div>
                ))}
                <div ref={threadEndRef} />
              </div>

              <div style={styles.replyCard}>
                <label style={styles.label}>Reply</label>
                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  style={{ ...styles.textarea, ...(isReadonly ? styles.readonlyInput : {}) }}
                  placeholder={isReadonly ? "Replies are disabled for resolved or closed queries." : "Write your reply..."}
                  disabled={isReadonly}
                />
                <div style={styles.replyFooter}>
                  <button
                    type="button"
                    onClick={handleReply}
                    style={styles.modalPrimaryBtn}
                    disabled={isReadonly || sendingReply || !replyMessage.trim()}
                  >
                    <Send size={14} />
                    {sendingReply ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={isQueryModalOpen}
        onClose={() => setIsQueryModalOpen(false)}
        title="Create New Query"
        footer={
          <>
            <button type="button" onClick={() => setIsQueryModalOpen(false)} style={styles.modalSecondaryBtn}>
              Cancel
            </button>
            <button type="submit" form="client-query-form" style={styles.modalPrimaryBtn} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Query"}
            </button>
          </>
        }
      >
        <form id="client-query-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {submitMessage && <div style={styles.successBox}>{submitMessage}</div>}
          {submitError && <div style={styles.errorBox}>{submitError}</div>}

          <label style={styles.label}>Project</label>
          <select
            value={form.projectId}
            onChange={(event) => setForm({ ...form, projectId: event.target.value })}
            style={styles.input}
          >
            <option value="">General support</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>

          <label style={styles.label}>Subject</label>
          <input
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            style={styles.input}
            required
          />

          <label style={styles.label}>Description</label>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            style={styles.textarea}
            required
          />

          <label style={styles.label}>Priority</label>
          <select
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value as "low" | "medium" | "high" })}
            style={styles.input}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </form>
      </Modal>

      <style>{`
        @media (max-width: 980px) {
          .client-query-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: "12px 8px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    minHeight: "100vh",
  },
  topHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap" as const,
    marginBottom: "20px",
  },
  title: { fontSize: "32px", fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: "6px", letterSpacing: "-1px" },
  subtitle: { fontSize: "15px", color: "var(--text-secondary)", margin: 0, maxWidth: "560px" },
  raiseQueryBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "12px 16px",
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  layout: { display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: "20px", alignItems: "start" },
  listCard: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    padding: "14px",
  },
  historyTitle: { fontSize: "18px", fontWeight: 700, margin: "0 0 10px 0", color: "var(--text-primary)" },
  compactHistory: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    maxHeight: "70vh",
    overflowY: "auto" as const,
  },
  historyEmpty: { fontSize: "14px", color: "var(--text-secondary)", margin: 0 },
  historyRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    backgroundColor: "var(--bg-secondary)",
    textAlign: "left" as const,
    cursor: "pointer",
  },
  historyRowActive: { borderColor: "#007AFF55", backgroundColor: "rgba(0,122,255,0.08)" },
  historyRowMain: { flex: 1, minWidth: 0 },
  historySubject: { fontSize: "14px", color: "var(--text-primary)", display: "block", marginBottom: "4px" },
  historyMeta: { fontSize: "12px", color: "#007AFF", fontWeight: 600, textTransform: "capitalize" as const },
  historyTime: { fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap" as const },
  detailsCard: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    padding: "18px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    minHeight: "70vh",
  },
  detailsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    borderBottom: "1px solid var(--border-color)",
    paddingBottom: "12px",
  },
  detailsHeaderActions: { display: "flex", alignItems: "center", gap: "10px" },
  detailsTitle: { margin: 0, fontSize: "20px", color: "var(--text-primary)" },
  readOnlyStatus: {
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: "rgba(0,122,255,0.1)",
    color: "#007AFF",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "capitalize" as const,
  },
  closeChatBtn: {
    padding: "6px 10px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  thread: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    maxHeight: "46vh",
    overflowY: "auto" as const,
    paddingRight: "2px",
  },
  messageItem: { borderRadius: "12px", padding: "12px", border: "1px solid var(--border-color)" },
  messageClient: { backgroundColor: "rgba(0,122,255,0.08)", alignSelf: "flex-end", maxWidth: "85%" },
  messageAdmin: { backgroundColor: "var(--bg-secondary)", alignSelf: "flex-start", maxWidth: "85%" },
  messageRole: { margin: 0, fontSize: "11px", textTransform: "capitalize" as const, color: "#007AFF", fontWeight: 700 },
  messageText: { margin: "6px 0", fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.5 },
  messageTime: { margin: 0, fontSize: "11px", color: "var(--text-secondary)" },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    minHeight: "50vh",
  },
  replyCard: { borderTop: "1px solid var(--border-color)", paddingTop: "12px" },
  label: { fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "12px",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    padding: "12px 14px",
    border: "1.5px solid var(--border-color)",
    borderRadius: "12px",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical" as const,
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    boxSizing: "border-box" as const,
  },
  readonlyInput: { opacity: 0.65, cursor: "not-allowed" },
  replyFooter: { display: "flex", justifyContent: "flex-end", marginTop: "12px" },
  successBox: {
    padding: "10px 12px",
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    border: "1px solid #34C759",
    borderRadius: "10px",
    fontSize: "13px",
    color: "#34C759",
  },
  errorBox: {
    padding: "10px 12px",
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    border: "1px solid #FF3B30",
    borderRadius: "10px",
    fontSize: "13px",
    color: "#FF3B30",
  },
  modalPrimaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    fontWeight: 700,
    cursor: "pointer",
  },
  modalSecondaryBtn: {
    padding: "10px 16px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontWeight: 600,
    cursor: "pointer",
  },
};
