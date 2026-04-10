"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { getTickets, Ticket, updateTicketStatus } from "../../../core/services/ticketService";

type ViewMode = "grid" | "list";

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
            </div>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: "24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "#1C1C1E" },
  subtitle: { margin: "8px 0 0", color: "#8E8E93" },
  headerActions: { display: "flex", alignItems: "center", gap: "12px" },
  searchWrap: { display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E5E5EA", background: "#fff", borderRadius: "12px", padding: "10px 12px", minWidth: "260px" },
  searchInput: { border: "none", outline: "none", width: "100%" },
  toggleWrap: { display: "flex", background: "#F2F2F7", borderRadius: "12px", padding: "4px" },
  toggleBtn: { border: "none", background: "transparent", padding: "8px 10px", borderRadius: "8px", cursor: "pointer" },
  toggleActive: { background: "#fff" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" },
  card: { background: "#fff", border: "1px solid #E5E5EA", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: "8px" },
  statusBadge: { padding: "6px 10px", borderRadius: "999px", background: "#E3F2FF", color: "#007AFF", fontSize: "12px", textTransform: "capitalize" },
  cardMeta: { margin: 0, color: "#8E8E93", fontSize: "13px" },
  cardText: { margin: 0, color: "#374151", lineHeight: 1.5 },
  textarea: { width: "100%", minHeight: "90px", border: "1px solid #E5E5EA", borderRadius: "12px", padding: "12px" },
  actionRow: { display: "flex", gap: "10px" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  listRow: { display: "grid", gridTemplateColumns: "1.5fr auto auto", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E5E5EA", borderRadius: "18px", padding: "18px" },
  primaryBtn: { border: "none", background: "#007AFF", color: "#fff", borderRadius: "12px", padding: "10px 14px", cursor: "pointer" },
  secondaryBtn: { border: "1px solid #D1D5DB", background: "#fff", color: "#111827", borderRadius: "12px", padding: "10px 14px", cursor: "pointer" },
};
