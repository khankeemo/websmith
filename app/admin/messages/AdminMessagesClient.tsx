"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Mail, MessageSquare, Search, Send, ShieldCheck } from "lucide-react";
import API from "@/core/services/apiService";
import { addTicketReply, getTickets, Ticket, updateTicketStatus } from "@/core/services/ticketService";

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Just now";

export default function AdminMessagesClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTickets = async () => {
    try {
      const data = await getTickets();
      setTickets(data);
      if (!selectedId && data[0]?._id) {
        setSelectedId(data[0]._id);
        setResolution(data[0].resolution || "");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets().catch((error) => console.error("Load admin tickets error:", error));
  }, []);

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        [
          ticket.subject,
          ticket.description,
          typeof ticket.clientId === "object" ? ticket.clientId?.name : "",
          ticket.contactName || "",
          ticket.contactEmail || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ),
    [tickets, searchTerm]
  );

  const selectedTicket =
    filteredTickets.find((ticket) => ticket._id === selectedId) ||
    tickets.find((ticket) => ticket._id === selectedId) ||
    null;

  useEffect(() => {
    if (selectedTicket) {
      setResolution(selectedTicket.resolution || "");
    }
  }, [selectedTicket?._id]);

  const getRequester = (ticket: Ticket) => {
    if (ticket.source === "public_contact") {
      return {
        name: ticket.contactName || "Public inquiry",
        email: ticket.contactEmail || "",
        subtitle: ticket.contactCompany || "Website contact form",
      };
    }

    const client = typeof ticket.clientId === "object" ? ticket.clientId : null;
    return {
      name: client?.name || "Client",
      email: client?.email || "",
      subtitle: "Client portal",
    };
  };

  const handleReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setSaving(true);
    try {
      await addTicketReply(selectedTicket._id, reply.trim());
      setReply("");
      await loadTickets();
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (status: Ticket["status"]) => {
    if (!selectedTicket) return;
    setSaving(true);
    try {
      await updateTicketStatus(selectedTicket._id, {
        status,
        resolution: status === "resolved" ? resolution.trim() || "Resolved by Websmith." : undefined,
      });
      await loadTickets();
    } finally {
      setSaving(false);
    }
  };

  const handleResolutionEmail = async () => {
    if (!selectedTicket || !resolution.trim()) return;
    setSaving(true);
    try {
      await API.post(`/tickets/${selectedTicket._id}/send-resolution-email`, { resolution: resolution.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.shell}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div>
            <h1 style={styles.title}>Query Inbox</h1>
            <p style={styles.subtitle}>Client portal questions and public contact inquiries in one threaded workspace.</p>
          </div>
          <div style={styles.searchBox}>
            <Search size={16} color="var(--text-secondary)" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search queries..."
              style={styles.searchInput}
            />
          </div>
        </div>

        <div style={styles.ticketList}>
          {loading ? (
            <p style={styles.emptyText}>Loading queries...</p>
          ) : filteredTickets.length === 0 ? (
            <p style={styles.emptyText}>No queries match your search.</p>
          ) : (
            filteredTickets.map((ticket) => {
              const requester = getRequester(ticket);
              return (
                <button
                  key={ticket._id}
                  type="button"
                  onClick={() => setSelectedId(ticket._id)}
                  style={{
                    ...styles.ticketRow,
                    ...(ticket._id === selectedTicket?._id ? styles.ticketRowActive : {}),
                  }}
                >
                  <div style={styles.ticketRowTop}>
                    <strong style={styles.ticketSubject}>{ticket.subject}</strong>
                    <span style={styles.ticketStatus}>{ticket.status.replace("_", " ")}</span>
                  </div>
                  <p style={styles.ticketMeta}>{requester.name}</p>
                  <p style={styles.ticketMetaMuted}>{requester.email || requester.subtitle}</p>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={styles.threadPane}>
        {!selectedTicket ? (
          <div style={styles.emptyThread}>
            <MessageSquare size={40} color="var(--text-secondary)" />
            <p style={styles.emptyText}>Select a query to view the conversation.</p>
          </div>
        ) : (
          <>
            <div style={styles.threadHeader}>
              <div>
                <h2 style={styles.threadTitle}>{selectedTicket.subject}</h2>
                <p style={styles.threadSubtitle}>
                  {getRequester(selectedTicket).name}
                  {" · "}
                  {selectedTicket.source === "public_contact" ? "Public contact" : "Client portal"}
                </p>
              </div>
              <div style={styles.actionGroup}>
                <button type="button" onClick={() => handleStatus("open")} style={styles.secondaryBtn} disabled={saving}>
                  Open
                </button>
                <button type="button" onClick={() => handleStatus("in_progress")} style={styles.secondaryBtn} disabled={saving}>
                  In Progress
                </button>
                <button type="button" onClick={() => handleStatus("resolved")} style={styles.primaryBtn} disabled={saving}>
                  Resolve
                </button>
              </div>
            </div>

            <div style={styles.metaCard}>
              <div style={styles.metaItem}>
                <Mail size={16} color="#007AFF" />
                <span>{getRequester(selectedTicket).email || "No email available"}</span>
              </div>
              <div style={styles.metaItem}>
                <ShieldCheck size={16} color="#007AFF" />
                <span>{getRequester(selectedTicket).subtitle}</span>
              </div>
              <div style={styles.metaItem}>
                <Clock3 size={16} color="#007AFF" />
                <span>{formatDate(selectedTicket.createdAt)}</span>
              </div>
            </div>

            <div style={styles.timeline}>
              {selectedTicket.history?.map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} style={styles.timelineItem}>
                  <div style={styles.timelineDot} />
                  <div style={styles.timelineContent}>
                    <p style={styles.timelineLabel}>
                      {entry.actorRole.replace("_", " ")} · {entry.action}
                    </p>
                    <p style={styles.timelineMessage}>{entry.message || "No message provided."}</p>
                    <p style={styles.timelineTime}>{formatDate(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.composerCard}>
              <label style={styles.label}>Reply in thread</label>
              <textarea value={reply} onChange={(event) => setReply(event.target.value)} style={styles.textarea} placeholder="Write a reply to continue the conversation..." />
              <div style={styles.composerFooter}>
                <button type="button" onClick={handleReply} style={styles.primaryBtn} disabled={saving || !reply.trim()}>
                  <Send size={14} />
                  Send Reply
                </button>
              </div>
            </div>

            <div style={styles.composerCard}>
              <label style={styles.label}>Resolution summary</label>
              <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} style={styles.textarea} placeholder="Document the final answer or delivery outcome..." />
              <div style={styles.composerFooter}>
                <button type="button" onClick={handleResolutionEmail} style={styles.secondaryBtn} disabled={saving || !resolution.trim()}>
                  Send Resolution Email
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  shell: {
    display: "grid",
    gridTemplateColumns: "340px minmax(0, 1fr)",
    gap: "20px",
    padding: "24px",
    minHeight: "calc(100vh - 48px)",
  },
  sidebar: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "24px",
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "20px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  title: { margin: 0, fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" },
  subtitle: { margin: "8px 0 0 0", color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    padding: "10px 14px",
    backgroundColor: "var(--bg-secondary)",
  },
  searchInput: {
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "var(--text-primary)",
    width: "100%",
  },
  ticketList: { display: "flex", flexDirection: "column", padding: "12px" },
  ticketRow: {
    textAlign: "left",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "16px",
    padding: "14px",
    marginBottom: "10px",
    cursor: "pointer",
  },
  ticketRowActive: {
    borderColor: "#007AFF55",
    backgroundColor: "rgba(0,122,255,0.08)",
  },
  ticketRowTop: { display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "8px" },
  ticketSubject: { color: "var(--text-primary)", fontSize: "14px" },
  ticketStatus: { textTransform: "capitalize", color: "#007AFF", fontSize: "12px", fontWeight: 700 },
  ticketMeta: { margin: 0, fontSize: "13px", color: "var(--text-primary)" },
  ticketMetaMuted: { margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-secondary)" },
  threadPane: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "24px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  emptyThread: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "12px" },
  emptyText: { color: "var(--text-secondary)", fontSize: "14px" },
  threadHeader: { display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" },
  threadTitle: { margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" },
  threadSubtitle: { margin: "6px 0 0 0", color: "var(--text-secondary)", fontSize: "14px" },
  actionGroup: { display: "flex", gap: "10px", flexWrap: "wrap" },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    borderRadius: "12px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  metaCard: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    padding: "16px",
    borderRadius: "18px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  metaItem: { display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "13px" },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "4px 2px",
    maxHeight: "420px",
    overflowY: "auto",
  },
  timelineItem: { display: "flex", gap: "12px" },
  timelineDot: { width: "10px", height: "10px", borderRadius: "999px", backgroundColor: "#007AFF", marginTop: "8px", flexShrink: 0 },
  timelineContent: {
    flex: 1,
    border: "1px solid var(--border-color)",
    borderRadius: "16px",
    padding: "14px 16px",
    backgroundColor: "var(--bg-secondary)",
  },
  timelineLabel: { margin: 0, color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "capitalize" },
  timelineMessage: { margin: "8px 0", color: "var(--text-primary)", fontSize: "14px", lineHeight: 1.6 },
  timelineTime: { margin: 0, color: "var(--text-secondary)", fontSize: "12px" },
  composerCard: {
    border: "1px solid var(--border-color)",
    borderRadius: "18px",
    padding: "16px",
    backgroundColor: "var(--bg-secondary)",
  },
  label: { display: "block", marginBottom: "10px", fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" },
  textarea: {
    width: "100%",
    minHeight: "110px",
    resize: "vertical",
    borderRadius: "14px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "12px 14px",
    outline: "none",
  },
  composerFooter: { display: "flex", justifyContent: "flex-end", marginTop: "12px" },
};
