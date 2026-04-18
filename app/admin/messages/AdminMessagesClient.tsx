"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Mail, MessageSquare, Search, Send, ShieldCheck } from "lucide-react";
import API from "@/core/services/apiService";
import { addTicketReply, getTickets, resolveTicketFileUrl, Ticket, updateTicketStatus } from "@/core/services/ticketService";

type QueryGroup = {
  key: string;
  label: string;
  tickets: Ticket[];
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

export default function AdminMessagesClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");
  const [nextStatus, setNextStatus] = useState<Ticket["status"]>("open");
  const [saving, setSaving] = useState(false);

  const loadTickets = async () => {
    try {
      const data = await getTickets();
      setTickets(data);
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
          typeof ticket.projectId === "object" ? ticket.projectId?.name : "",
          ticket.contactName || "",
          ticket.contactEmail || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ),
    [tickets, searchTerm]
  );

  const groupedTickets = useMemo<QueryGroup[]>(() => {
    const groups = new Map<string, QueryGroup>();

    filteredTickets.forEach((ticket) => {
      const project = typeof ticket.projectId === "object" ? ticket.projectId : null;
      const key = project?._id || (ticket.projectId ? String(ticket.projectId) : "general");
      const label = project?.name || (ticket.projectId ? "Linked project" : "General and public queries");

      if (!groups.has(key)) {
        groups.set(key, { key, label, tickets: [] });
      }

      groups.get(key)!.tickets.push(ticket);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === "general") return 1;
      if (b.key === "general") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [filteredTickets]);

  const selectedTicket =
    filteredTickets.find((ticket) => ticket._id === selectedId) ||
    tickets.find((ticket) => ticket._id === selectedId) ||
    null;

  useEffect(() => {
    if (selectedTicket) {
      setResolution(selectedTicket.resolution || "");
      setNextStatus(selectedTicket.status);
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

  const isClosed = selectedTicket?.chatStatus === "closed" || selectedTicket?.status === "closed";
  const isResolvedOrClosed = selectedTicket?.status === "resolved" || selectedTicket?.status === "closed";
  const projectGroups = groupedTickets.filter((group) => group.key !== "general");
  const generalGroup = groupedTickets.find((group) => group.key === "general");

  const getStatusLabel = (status: Ticket["status"]) => status.replace("_", " ");

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
            <>
              {projectGroups.length > 0 && (
                <div style={styles.groupSection}>
                  <p style={styles.groupSectionTitle}>Project-based queries</p>
                  {projectGroups.map((group) => (
                    <div key={group.key} style={styles.projectGroup}>
                      <div style={styles.projectGroupHeader}>
                        <strong style={styles.projectGroupTitle}>{group.label}</strong>
                        <span style={styles.projectGroupCount}>{group.tickets.length}</span>
                      </div>
                      {group.tickets.map((ticket) => {
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
                              <span style={styles.ticketStatus}>{getStatusLabel(ticket.status)}</span>
                            </div>
                            <p style={styles.ticketMeta}>{requester.name}</p>
                            <p style={styles.ticketMetaMuted}>{requester.email || requester.subtitle}</p>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
              {generalGroup && (
                <div style={styles.groupSection}>
                  <p style={styles.groupSectionTitle}>General and public queries</p>
                  <div style={styles.projectGroup}>
                    {generalGroup.tickets.map((ticket) => {
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
                            <span style={styles.ticketStatus}>{getStatusLabel(ticket.status)}</span>
                          </div>
                          <p style={styles.ticketMeta}>{requester.name}</p>
                          <p style={styles.ticketMetaMuted}>{requester.email || requester.subtitle}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
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
                  {typeof selectedTicket.projectId === "object" && selectedTicket.projectId?.name
                    ? `${selectedTicket.projectId.name} - `
                    : ""}
                  {selectedTicket.source === "public_contact" ? "Public contact" : "Client portal"}
                </p>
              </div>
              <div style={styles.headerControls}>
                <button type="button" onClick={() => setSelectedId(null)} style={styles.secondaryBtn} disabled={saving}>
                  Close Query Panel
                </button>
                <div style={styles.statusControl}>
                  <label style={styles.statusLabel}>Status</label>
                  <select
                    value={nextStatus}
                    onChange={(event) => {
                      const status = event.target.value as Ticket["status"];
                      setNextStatus(status);
                      handleStatus(status).catch((error) => console.error("Update status error:", error));
                    }}
                    style={styles.statusSelect}
                    disabled={saving}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
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
                    {entry.message?.trim() ? (
                      <p style={styles.timelineMessage}>{entry.message}</p>
                    ) : entry.attachments?.length ? null : (
                      <p style={styles.timelineMessage}>No message provided.</p>
                    )}
                    {entry.attachments && entry.attachments.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                        {entry.attachments.map((att, ai) => (
                          <a
                            key={`${att.url}-${ai}`}
                            href={resolveTicketFileUrl(att.url)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ borderRadius: "10px", overflow: "hidden", display: "block" }}
                          >
                            <img
                              src={resolveTicketFileUrl(att.url)}
                              alt={att.name}
                              style={{ maxWidth: "180px", maxHeight: "140px", objectFit: "cover", borderRadius: "10px", border: "1px solid var(--border-color)" }}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    <p style={styles.timelineTime}>{formatDate(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.composerCard}>
              <label style={styles.label}>Reply in thread</label>
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                style={{ ...styles.textarea, ...(isClosed ? styles.textareaDisabled : {}) }}
                placeholder={isClosed ? "This query is closed and read-only." : "Write a reply to continue the conversation..."}
                disabled={isClosed}
              />
              <div style={styles.composerFooter}>
                <button type="button" onClick={handleReply} style={styles.primaryBtn} disabled={saving || !reply.trim() || isClosed}>
                  <Send size={14} />
                  Send Reply
                </button>
              </div>
            </div>

            <div style={styles.composerCard}>
              <label style={styles.label}>Resolution summary</label>
              <textarea
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                style={{ ...styles.textarea, ...(!isResolvedOrClosed ? styles.textareaDisabled : {}) }}
                placeholder={
                  isResolvedOrClosed
                    ? "Document the final answer or delivery outcome..."
                    : "Mark this query as Resolved or Closed to activate summary."
                }
                disabled={!isResolvedOrClosed}
              />
              <div style={styles.composerFooter}>
                <button
                  type="button"
                  onClick={handleResolutionEmail}
                  style={styles.secondaryBtn}
                  disabled={saving || !isResolvedOrClosed || !resolution.trim()}
                >
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
    gridTemplateColumns: "360px minmax(0, 1fr)",
    gap: "24px",
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
  ticketList: { display: "flex", flexDirection: "column", padding: "14px", gap: "14px", overflowY: "auto" },
  groupSection: { display: "flex", flexDirection: "column", gap: "10px" },
  groupSectionTitle: { margin: "0 4px", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" },
  projectGroup: {
    border: "1px solid var(--border-color)",
    borderRadius: "18px",
    padding: "12px",
    backgroundColor: "var(--bg-secondary)",
  },
  projectGroupHeader: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" },
  projectGroupTitle: { color: "var(--text-primary)", fontSize: "14px" },
  projectGroupCount: {
    minWidth: "24px",
    height: "24px",
    borderRadius: "999px",
    backgroundColor: "#007AFF",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
  },
  ticketRow: {
    textAlign: "left",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "16px",
    padding: "14px",
    marginBottom: "8px",
    width: "100%",
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
  headerControls: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" },
  statusControl: { display: "flex", flexDirection: "column", gap: "6px" },
  statusLabel: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 },
  statusSelect: {
    minWidth: "170px",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    padding: "10px 12px",
    textTransform: "capitalize",
    outline: "none",
    fontWeight: 600,
  },
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
  textareaDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  composerFooter: { display: "flex", justifyContent: "flex-end", marginTop: "12px" },
};
