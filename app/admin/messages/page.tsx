"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Columns, Search, Send, Bell } from "lucide-react";
import { getTickets, Ticket, updateTicketStatus } from "../../../core/services/ticketService";
import API from "../../../core/services/apiService";

type ViewMode = "grid" | "list" | "kanban";

export default function AdminQueriesPage() {
  const [queries, setQueries] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [resolution, setResolution] = useState<Record<string, string>>({});

  const loadQueries = async () => {
    setQueries(await getTickets());
  };

  useEffect(() => {
    loadQueries().catch((error) => console.error("Queries load error:", error));
  }, []);

  const filteredQueries = useMemo(
    () =>
      queries.filter((query) =>
        [query.subject, query.description, typeof query.clientId === "object" ? query.clientId?.name : ""]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ),
    [queries, searchTerm]
  );

  const handleStatusUpdate = async (query: Ticket, status: Ticket["status"]) => {
    await updateTicketStatus(query._id, {
      status,
      resolution: status === "resolved" ? resolution[query._id] || "Resolved by the delivery team." : undefined,
    });
    await loadQueries();
  };

  const handleSendResolutionEmail = async (query: Ticket) => {
    try {
      const resMessage = resolution[query._id] || query.resolution || "Your query has been resolved.";
      await API.post(`/tickets/${query._id}/send-resolution-email`, {
        resolution: resMessage,
      });
      alert("Resolution email sent successfully!");
    } catch (error) {
      console.error("Send resolution email error:", error);
      alert("Failed to send resolution email");
    }
  };

  const handleSendNotification = async (query: Ticket) => {
    try {
      const resMessage = resolution[query._id] || query.resolution || "Your query has been resolved.";
      await updateTicketStatus(query._id, {
        status: query.status,
        resolution: resMessage,
      });
      alert("Notification sent successfully!");
      await loadQueries();
    } catch (error) {
      console.error("Send notification error:", error);
      alert("Failed to send notification");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Queries</h1>
          <p style={styles.subtitle}>Track client questions through Open, In Progress, and Resolved states.</p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.searchWrap}>
            <Search size={16} color="#8E8E93" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search queries..." style={styles.searchInput} />
          </div>
          <div style={styles.toggleWrap}>
            <button onClick={() => setViewMode("grid")} style={{ ...styles.toggleBtn, ...(viewMode === "grid" ? styles.toggleActive : {}) }}><LayoutGrid size={16} /></button>
            <button onClick={() => setViewMode("list")} style={{ ...styles.toggleBtn, ...(viewMode === "list" ? styles.toggleActive : {}) }}><List size={16} /></button>
            <button onClick={() => setViewMode("kanban")} style={{ ...styles.toggleBtn, ...(viewMode === "kanban" ? styles.toggleActive : {}) }}><Columns size={16} /></button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div style={styles.grid}>
          {filteredQueries.map((query) => (
            <div key={query._id} style={styles.card}>
              <div style={styles.cardTop}>
                <strong>{query.subject}</strong>
                <span style={styles.statusBadge}>{query.status.replace("_", " ")}</span>
              </div>
              <p style={styles.cardMeta}>
                Client: {typeof query.clientId === "object" ? query.clientId?.name : "Unknown"} • Priority: {query.priority}
              </p>
              <p style={styles.cardText}>{query.description}</p>
              <textarea
                value={resolution[query._id] || query.resolution || ""}
                onChange={(e) => setResolution((prev) => ({ ...prev, [query._id]: e.target.value }))}
                placeholder="Resolution message"
                rows={3}
                style={styles.textarea}
              />
              <div style={styles.actionRow}>
                <button onClick={() => handleStatusUpdate(query, "open")} style={styles.secondaryBtn}>Open</button>
                <button onClick={() => handleStatusUpdate(query, "in_progress")} style={styles.secondaryBtn}>In Progress</button>
                <button onClick={() => handleStatusUpdate(query, "resolved")} style={styles.primaryBtn}>Resolve</button>
              </div>
              {query.status === "resolved" && (
                <div style={styles.resolutionActions}>
                  <button onClick={() => handleSendResolutionEmail(query)} style={styles.emailBtn}>
                    <Send size={14} />
                    <span>Send Email</span>
                  </button>
                  <button onClick={() => handleSendNotification(query)} style={styles.notificationBtn}>
                    <Bell size={14} />
                    <span>Send Notification</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : viewMode === "list" ? (
        <div style={styles.list}>
          {filteredQueries.map((query) => (
            <div key={query._id} style={styles.listRow}>
              <div>
                <strong>{query.subject}</strong>
                <p style={styles.cardMeta}>{typeof query.clientId === "object" ? query.clientId?.name : "Unknown"} • {query.priority}</p>
              </div>
              <span style={styles.statusBadge}>{query.status.replace("_", " ")}</span>
              <button onClick={() => handleStatusUpdate(query, query.status === "resolved" ? "open" : "resolved")} style={styles.primaryBtn}>
                {query.status === "resolved" ? "Reopen" : "Resolve"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.kanban}>
          {["open", "in_progress", "resolved"].map((status) => {
            const statusQueries = filteredQueries.filter((q) => q.status === status);
            return (
              <div key={status} style={styles.kanbanColumn}>
                <div style={styles.kanbanColumnHeader}>
                  <h3 style={styles.kanbanColumnTitle}>
                    {status.replace("_", " ").toUpperCase()}
                  </h3>
                  <span style={styles.kanbanCount}>{statusQueries.length}</span>
                </div>
                <div style={styles.kanbanCards}>
                  {statusQueries.map((query) => (
                    <div key={query._id} style={styles.kanbanCard}>
                      <div style={styles.kanbanCardTop}>
                        <strong>{query.subject}</strong>
                        <span style={{
                          ...styles.priorityBadge,
                          backgroundColor: query.priority === "high" ? "#FEE2E2" : query.priority === "medium" ? "#FEF3C7" : "#DBEAFE",
                          color: query.priority === "high" ? "#DC2626" : query.priority === "medium" ? "#D97706" : "#2563EB",
                        }}>
                          {query.priority}
                        </span>
                      </div>
                      <p style={styles.kanbanCardMeta}>
                        {typeof query.clientId === "object" ? query.clientId?.name : "Unknown"}
                      </p>
                      <p style={styles.kanbanCardText}>{query.description.substring(0, 100)}{query.description.length > 100 ? "..." : ""}</p>
                      {query.status === "resolved" && (
                        <div style={styles.kanbanResolutionActions}>
                          <button onClick={() => handleSendResolutionEmail(query)} style={styles.smallEmailBtn} title="Send Email">
                            <Send size={12} />
                          </button>
                          <button onClick={() => handleSendNotification(query)} style={styles.smallNotificationBtn} title="Send Notification">
                            <Bell size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {statusQueries.length === 0 && (
                    <p style={styles.kanbanEmpty}>No queries</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: "24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "var(--text-primary)" },
  subtitle: { margin: "8px 0 0", color: "var(--text-secondary)" },
  headerActions: { display: "flex", alignItems: "center", gap: "12px" },
  searchWrap: { display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", borderRadius: "12px", padding: "10px 12px", minWidth: "260px" },
  searchInput: { border: "none", outline: "none", width: "100%", backgroundColor: "transparent", color: "var(--text-primary)" },
  toggleWrap: { display: "flex", background: "var(--bg-secondary)", borderRadius: "12px", padding: "4px" },
  toggleBtn: { border: "none", background: "transparent", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", color: "var(--text-secondary)" },
  toggleActive: { background: "var(--bg-primary)", color: "var(--text-primary)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" },
  card: { background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: "8px" },
  statusBadge: { padding: "6px 10px", borderRadius: "999px", background: "rgba(0, 122, 255, 0.1)", color: "#007AFF", fontSize: "12px", textTransform: "capitalize" },
  cardMeta: { margin: 0, color: "var(--text-secondary)", fontSize: "13px" },
  cardText: { margin: 0, color: "var(--text-primary)", lineHeight: 1.5 },
  textarea: { width: "100%", minHeight: "90px", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "12px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none" },
  actionRow: { display: "flex", gap: "10px" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  listRow: { display: "grid", gridTemplateColumns: "1.5fr auto auto", alignItems: "center", gap: "16px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "18px", padding: "18px" },
  primaryBtn: { border: "none", background: "#007AFF", color: "#fff", borderRadius: "12px", padding: "10px 14px", cursor: "pointer" },
  secondaryBtn: { border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", borderRadius: "12px", padding: "10px 14px", cursor: "pointer" },
  resolutionActions: { display: "flex", gap: "8px", marginTop: "8px" },
  emailBtn: { flex: 1, border: "none", background: "#10B981", color: "#fff", borderRadius: "10px", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", fontWeight: 500 },
  notificationBtn: { flex: 1, border: "none", background: "#8B5CF6", color: "#fff", borderRadius: "10px", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", fontWeight: 500 },
  kanban: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" },
  kanbanColumn: { background: "var(--bg-secondary)", borderRadius: "16px", padding: "16px" },
  kanbanColumnHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "2px solid var(--border-color)" },
  kanbanColumnTitle: { margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" },
  kanbanCount: { background: "var(--border-color)", color: "var(--text-secondary)", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 600 },
  kanbanCards: { display: "flex", flexDirection: "column", gap: "12px" },
  kanbanCard: { background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px" },
  kanbanCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" },
  priorityBadge: { padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" },
  kanbanCardMeta: { margin: "0 0 8px", color: "var(--text-secondary)", fontSize: "12px" },
  kanbanCardText: { margin: 0, color: "var(--text-primary)", fontSize: "13px", lineHeight: 1.5 },
  kanbanResolutionActions: { display: "flex", gap: "6px", marginTop: "10px" },
  smallEmailBtn: { border: "none", background: "#10B981", color: "#fff", borderRadius: "6px", padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  smallNotificationBtn: { border: "none", background: "#8B5CF6", color: "#fff", borderRadius: "6px", padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  kanbanEmpty: { color: "var(--text-secondary)", fontSize: "13px", textAlign: "center", padding: "20px 0" },
};
