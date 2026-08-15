"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Mail, MessageSquare, Search, Send, ShieldCheck } from "lucide-react";
import {
  addTicketReply,
  getResolutionTemplates,
  getTicketClientAccount,
  getTickets,
  resolveTicketFileUrl,
  sendResolutionEmail,
  Ticket,
  TicketClientAccount,
  updateTicketStatus,
} from "@/core/services/ticketService";

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
  const [notice, setNotice] = useState<{ type: "success" | "error" | "warn"; text: string } | null>(null);
  const [templates, setTemplates] = useState<Array<{ key: string; name: string; category: string; isActive: boolean }>>([]);
  const [defaultTemplateKey, setDefaultTemplateKey] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [accountState, setAccountState] = useState<TicketClientAccount | null>(null);
  const [createAccount, setCreateAccount] = useState(true);

  const showNotice = (type: "success" | "error" | "warn", text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 6000);
  };

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

  useEffect(() => {
    getResolutionTemplates()
      .then(({ data, defaultKey }) => {
        setTemplates(data);
        setDefaultTemplateKey(defaultKey);
        setSelectedTemplateKey(defaultKey);
      })
      .catch(() => showNotice("error", "Could not load resolution email templates."));
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

  useEffect(() => {
    if (!selectedTicket?._id) {
      setAccountState(null);
      return;
    }
    setAccountState(null);
    setCreateAccount(true);
    getTicketClientAccount(selectedTicket._id)
      .then(setAccountState)
      .catch(() => setAccountState(null));
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
      const result = await addTicketReply(selectedTicket._id, reply.trim());
      setReply("");
      await loadTickets();
      if (result.emailDelivered) {
        showNotice("success", "Reply sent and delivered to the customer by email.");
      } else if (result.emailError) {
        showNotice("warn", `Reply stored, but the email could not be delivered: ${result.emailError}`);
      } else {
        showNotice("success", "Reply added to the thread.");
      }
    } catch (error: any) {
      console.error("Reply error:", error);
      showNotice("error", error?.response?.data?.message || "Reply failed. Please try again.");
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
      showNotice("success", `Status updated to ${status.replace("_", " ")}.`);
    } catch (error: any) {
      console.error("Update status error:", error);
      showNotice("error", error?.response?.data?.message || "Could not update status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResolutionEmail = async () => {
    if (!selectedTicket || !resolution.trim()) return;
    setSaving(true);
    try {
      const result = await sendResolutionEmail(selectedTicket._id, {
        resolution: resolution.trim(),
        templateKey: selectedTemplateKey || defaultTemplateKey || undefined,
        createAccount,
        portalUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      await loadTickets();
      const accountNote =
        result.accountState === "created"
          ? " A new Client Portal account was created and the temporary password was emailed to the customer."
          : result.accountState === "existing"
          ? " The customer's existing Client Portal account was used."
          : "";
      if (result.emailDelivered) {
        showNotice("success", `Resolution email sent and delivered to the customer.${accountNote}`);
      } else {
        showNotice("warn", `Resolution email could not be delivered: ${result.emailError || "unknown error"}.${accountNote}`);
      }
      getTicketClientAccount(selectedTicket._id)
        .then(setAccountState)
        .catch(() => {});
    } catch (error: any) {
      console.error("Resolution email error:", error);
      const data = error?.response?.data;
      if (data?.emailDelivered === false) {
        const accountNote = data.accountState === "created" ? " A new Client Portal account was created; the temporary password was emailed to the customer." : "";
        showNotice("warn", `Resolution email could not be delivered: ${data.emailError || "unknown error"}.${accountNote}`);
      } else {
        showNotice("error", data?.message || "Failed to send resolution email. Please try again.");
      }
      getTicketClientAccount(selectedTicket._id)
        .then(setAccountState)
        .catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const getAccountLabel = (state?: TicketClientAccount | null) => {
    if (!state) return "Checking...";
    switch (state.state) {
      case "ready":
        return "Ready";
      case "existing":
        return "Existing";
      default:
        return "Not Created";
    }
  };

  const insertClientPortalGreeting = () => {
    if (!selectedTicket) return;
    if (reply.includes("Client Portal Greeting")) {
      showNotice("warn", "The Client Portal Greeting is already inserted in this reply.");
      return;
    }

    const requester = getRequester(selectedTicket);
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.websmithdigital.com";
    const name = requester.name && requester.name !== "Public inquiry" ? requester.name : "";
    const hasPortalAccount = Boolean(
      typeof selectedTicket.clientId === "object" ? selectedTicket.clientId?._id : selectedTicket.clientId
    );
    const accountLine = hasPortalAccount
      ? "Log in using the email address registered to your account and the password you set up. Websmith will never ask you to send passwords over email. If you have forgotten your password, use the \u201cForgot Password\u201d option on the login page to receive a secure reset code."
      : "If you have a Websmith Client Portal account, log in using your account email and password. Websmith will never ask you to send passwords over email. If you don't have an account yet, reply to this email and we will be happy to set one up for you.";

    const greeting = [
      "-- Client Portal Greeting --",
      `Hello ${name || "there"},`,
      "",
      "Thank you for contacting the Websmith Digital team \u2014 you have reached the right place.",
      "",
      "You can continue this conversation and keep track of your project through the Client Portal.",
      "",
      `Client Portal login: ${origin}/login`,
      "",
      accountLine,
      "",
      "Once logged in, open My Projects / Project Status to view the latest progress on your project.",
      "",
      "Best regards,",
      "The Websmith Digital Team",
      "-- End Client Portal Greeting --",
    ].join("\n");

    setReply((current) => (current.trim() ? `${current.trim()}\n\n${greeting}` : greeting));
    showNotice("success", "Client Portal Greeting inserted. Review and edit it before sending.");
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
            {notice && (
              <div
                role={notice.type === "error" ? "alert" : "status"}
                style={{
                  ...styles.notice,
                  ...(notice.type === "success" ? styles.noticeSuccess : {}),
                  ...(notice.type === "error" ? styles.noticeError : {}),
                  ...(notice.type === "warn" ? styles.noticeWarn : {}),
                }}
              >
                {notice.text}
              </div>
            )}
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
                    {entry.emailDelivered !== undefined && (
                      <p style={entry.emailDelivered ? styles.deliveryOk : styles.deliveryFail}>
                        {entry.emailDelivered ? "Email delivered to customer." : `Email delivery failed: ${entry.emailError || "unknown error"}`}
                      </p>
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
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginRight: "auto" }}>
                  <button
                    type="button"
                    onClick={insertClientPortalGreeting}
                    style={styles.secondaryBtn}
                    disabled={saving || isClosed}
                  >
                    Insert Client Portal Greeting
                  </button>
                </div>
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
              <div style={styles.resolutionRow}>
                <div style={styles.resolutionField}>
                  <label style={styles.label}>Email template</label>
                  <select
                    value={selectedTemplateKey}
                    onChange={(event) => setSelectedTemplateKey(event.target.value)}
                    style={styles.statusSelect}
                    disabled={saving || !isResolvedOrClosed}
                  >
                    {templates
                      .filter((template) => template.isActive)
                      .map((template) => (
                        <option key={template.key} value={template.key}>
                          {template.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={styles.resolutionField}>
                  <label style={styles.label}>Client account</label>
                  <span
                    style={{
                      ...styles.accountBadge,
                      ...(accountState?.state === "not_created" ? styles.accountBadgeNone : {}),
                    }}
                  >
                    {getAccountLabel(accountState)}
                  </span>
                </div>
              </div>
              {accountState?.state === "not_created" && isResolvedOrClosed && (
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={(event) => setCreateAccount(event.target.checked)}
                    disabled={saving}
                    style={styles.checkbox}
                  />
                  <span>Create a Client Portal account for this customer (a secure temporary password will be emailed)</span>
                </label>
              )}
              {accountState && accountState.state !== "not_created" && (
                <p style={styles.accountHint}>The customer's existing Client Portal account will be used — no new credentials are generated.</p>
              )}
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
  deliveryOk: { margin: "6px 0 0", color: "#34C759", fontSize: "12px", fontWeight: 600 },
  deliveryFail: { margin: "6px 0 0", color: "#FF3B30", fontSize: "12px", fontWeight: 600 },
  notice: {
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 600,
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
  },
  noticeSuccess: { color: "#0F7B3D", borderColor: "#34C75966", backgroundColor: "rgba(52,199,89,0.12)" },
  noticeError: { color: "#C21F1F", borderColor: "#FF3B3066", backgroundColor: "rgba(255,59,48,0.12)" },
  noticeWarn: { color: "#B76E00", borderColor: "#FF950066", backgroundColor: "rgba(255,149,0,0.12)" },
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
  resolutionRow: { display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "12px" },
  resolutionField: { display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "220px" },
  accountBadge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "#0F7B3D",
    fontSize: "13px",
    fontWeight: 700,
  },
  accountBadgeNone: { color: "var(--text-secondary)", fontWeight: 600 },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    marginTop: "14px",
    padding: "12px 14px",
    borderRadius: "12px",
    backgroundColor: "rgba(0,122,255,0.06)",
    border: "1px solid rgba(0,122,255,0.2)",
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.5,
    cursor: "pointer",
  },
  checkbox: { marginTop: "2px", accentColor: "#007AFF", cursor: "pointer" },
  accountHint: { margin: "12px 0 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 },
};
