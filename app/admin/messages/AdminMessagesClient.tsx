// app/admin/messages/AdminMessagesClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ChevronLeft,
  Clock3,
  Hash,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  addTicketReply,
  deleteTicket,
  getResolutionTemplates,
  getTicketClientAccount,
  getTicketsPaged,
  markTicketRead,
  resolveTicketFileUrl,
  resendTicketEmail,
  sendClientPortalAccess,
  sendResolutionEmail,
  syncInboundEmail,
  Ticket,
  TicketHistoryEntry,
  updateTicketStatus,
} from "@/core/services/ticketService";

type Scope = "active" | "closed";
type Notice = { type: "success" | "error" | "warn"; text: string } | null;

const QUERY_INBOX_PAGE_SIZE = 15;

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Just now";

const getStatusLabel = (status: Ticket["status"]) => status.replace("_", " ");

const getClientIdLabel = (ticket: Ticket): string | null => {
  if (ticket.clientCustomId) return ticket.clientCustomId;
  if (ticket.clientId && typeof ticket.clientId === "object" && ticket.clientId._id) return ticket.clientId._id;
  return null;
};

function hasStoredEmail(ticket: Ticket): TicketHistoryEntry | null {
  const history = Array.isArray(ticket.history) ? ticket.history : [];
  return [...history].reverse().find((entry) => entry.recipient && entry.emailSubject && entry.emailBody) || null;
}

/**
 * Dedicated-workspace CSS. This page renders as its own full-viewport Query
 * Inbox (no admin sidebar, no admin shell) — the shell elements are hidden
 * with page-scoped rules driven by the `query-inbox-workspace` class on
 * <html>. ClientLayout / Sidebar / globals.css are untouched.
 */
const workspaceCss = `
html.query-inbox-workspace .app-sidebar,
html.query-inbox-workspace .app-mobile-topbar,
html.query-inbox-workspace .app-mobile-overlay {
  display: none !important;
}
html.query-inbox-workspace .app-main-shell[data-shell="panel"],
html.query-inbox-workspace .app-main-shell {
  width: 100%;
  padding: 0 !important;
}
html.query-inbox-workspace .app-main-scroll {
  padding: 0 !important;
  overflow: hidden;
}

.query-inbox-root {
  height: 100dvh;
  display: grid;
  grid-template-columns: 385px minmax(0, 1fr);
  overflow: hidden;
  background: var(--bg-primary);
}
.query-inbox-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
}
.query-inbox-conversation {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--bg-primary);
}
.qib-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.qib-conv-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.qib-ticket-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qib-pane-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.qib-chat {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--bg-secondary);
  overflow: hidden;
}
.qib-chat-label-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.qib-chat-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.qib-chat-hint {
  font-size: 11px;
  color: var(--text-secondary);
}
.qib-chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qib-cards-grid {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.query-inbox-root button,
.query-inbox-root select,
.query-inbox-root textarea,
.query-inbox-root input {
  transition:
    background-color 0.18s ease-out,
    border-color 0.18s ease-out,
    color 0.18s ease-out,
    box-shadow 0.18s ease-out,
    filter 0.18s ease-out;
}
.query-inbox-root button:not(:disabled):hover {
  filter: brightness(1.05);
}
.query-inbox-root button:focus-visible,
.query-inbox-root select:focus-visible,
.query-inbox-root textarea:focus-visible,
.query-inbox-root input:focus-visible {
  outline: 2px solid #007aff;
  outline-offset: 2px;
}
.query-inbox-root button:disabled,
.query-inbox-root select:disabled,
.query-inbox-root textarea:disabled,
.query-inbox-root input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 899px) {
  .query-inbox-root {
    grid-template-columns: 1fr;
  }
  .query-inbox-root.query-has-thread .query-inbox-pane {
    display: none;
  }
  .query-inbox-root:not(.query-has-thread) .query-inbox-conversation {
    display: none;
  }
  .qib-cards-grid {
    grid-template-columns: 1fr;
  }
  .qib-conv-body {
    padding: 14px;
  }
}
`;

export default function AdminMessagesClient() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scope, setScope] = useState<Scope>("active");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ key: string; name: string; body?: string; isDefault?: boolean }>>([]);
  const [greetingKey, setGreetingKey] = useState("");
  const [resolutionTemplateKey, setResolutionTemplateKey] = useState("");
  const [account, setAccount] = useState<{ state: string; email: string; name: string; clientId?: string; clientCustomId?: string } | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dedicated workspace: hide the admin shell chrome for this page only.
  useEffect(() => {
    document.documentElement.classList.add("query-inbox-workspace");
    return () => {
      document.documentElement.classList.remove("query-inbox-workspace");
    };
  }, []);

  const showNotice = useCallback((type: Notice["type"], text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 5000);
  }, []);

  const loadTickets = useCallback(
    async (opts?: { scope?: Scope; page?: number; search?: string; append?: boolean }) => {
      const effectiveScope = opts?.scope ?? scope;
      const effectivePage = opts?.page ?? (opts?.append ? page + 1 : 1);
      const effectiveSearch = opts?.search ?? searchTerm;
      try {
        const res = await getTicketsPaged({
          scope: effectiveScope,
          page: effectivePage,
          pageSize: QUERY_INBOX_PAGE_SIZE,
          search: effectiveSearch,
        });
        setTickets((prev) => (opts?.append ? [...prev, ...res.data] : res.data));
        setTotal(res.total);
        setPage(res.page);
        setHasMore(res.hasMore);
        // Keep the open conversation fresh if it is part of this page, and
        // never blank an already-open conversation when it scrolls off-page.
        setSelectedTicket((prev) => {
          if (!prev) return prev;
          const fresh = res.data.find((ticket) => ticket._id === prev._id);
          return fresh ?? prev;
        });
      } catch (error: any) {
        console.error("Load admin tickets error:", error);
        showNotice("error", error?.response?.data?.message || "Could not load conversations.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [scope, page, searchTerm, showNotice]
  );

  useEffect(() => {
    loadTickets();
    getResolutionTemplates()
      .then(({ data, defaultKey }) => {
        setTemplates(data.filter((template) => template.isActive !== false));
        setGreetingKey(defaultKey);
      })
      .catch(() => showNotice("warn", "Could not load greeting templates."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    await loadTickets({ page });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadTickets({ page: 1, search: value }), 300);
  };

  const handleScopeChange = (next: Scope) => {
    setScope(next);
    loadTickets({ scope: next, page: 1 });
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadTickets({ page: page + 1, append: true });
  };

  // Auto-mark read on open (best-effort, never page-lifeline — quietFetch).
  // Clears the unread dot locally so the next render reflects the read state.
  useEffect(() => {
    if (!selectedTicket?._id || !selectedTicket.hasNewClientReply) return;
    markTicketRead(selectedTicket._id)
      .then(() => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket._id === selectedTicket._id
              ? { ...ticket, hasNewClientReply: false, adminReadAt: new Date().toISOString() }
              : ticket
          )
        );
        setSelectedTicket((prev) =>
          prev && prev._id === selectedTicket._id
            ? { ...prev, hasNewClientReply: false, adminReadAt: new Date().toISOString() }
            : prev
        );
      })
      .catch(() => {
        // Unread dot stays; the next open of the conversation re-attempts.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicket?._id]);

  // Canonical two-way conversation thread (`messages[]`). Pre-R01 tickets have
  // no messages array — those fall back to the legacy history timeline below.
  const threadMessages = useMemo(() => {
    const list = Array.isArray(selectedTicket?.messages) ? selectedTicket.messages : [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicket]);

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

  // Rule 8 — `status` is the single authoritative UI source. `chatStatus` is
  // kept in sync server-side but is never consulted by the UI, so the two
  // fields can never disagree in the rendered state.
  const isClosed = selectedTicket?.status === "closed";

  const handleReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setSaving(true);
    try {
      await addTicketReply(selectedTicket._id, reply.trim());
      setReply("");
      await refresh();
      showNotice("success", "Reply sent.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Reply failed.");
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
      await refresh();
      showNotice("success", `Status updated to ${getStatusLabel(status)}.`);
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Could not update status.");
    } finally {
      setSaving(false);
    }
  };

  const handleCardAction = async (ticket: Ticket) => {
    if (busyId) return;
    setBusyId(ticket._id);
    try {
      const target = ticket.status === "closed" ? "open" : "closed";
      await updateTicketStatus(ticket._id, { status: target });
      await refresh();
      showNotice("success", ticket.status === "closed" ? "Query reopened." : "Query closed.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Could not update the query.");
    } finally {
      setBusyId(null);
    }
  };

  const handleResend = async (ticket: Ticket) => {
    setBusyId(ticket._id);
    try {
      const result = await resendTicketEmail(ticket._id);
      if (result.emailDelivered) showNotice("success", "Email resent.");
      else showNotice("warn", result.emailError || "Email queued but not confirmed delivered.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Resend failed.");
    } finally {
      setBusyId(null);
      setMenuFor(null);
    }
  };

  const handleDelete = async (ticket: Ticket) => {
    if (!window.confirm(`Delete the conversation "${ticket.subject}"? This cannot be undone.`)) return;
    setBusyId(ticket._id);
    try {
      await deleteTicket(ticket._id);
      if (selectedTicket?._id === ticket._id) setSelectedTicket(null);
      await refresh();
      showNotice("success", "Conversation deleted.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Delete failed.");
    } finally {
      setBusyId(null);
      setMenuFor(null);
    }
  };

  const handleSyncInbound = async () => {
    setSyncing(true);
    try {
      const result = await syncInboundEmail();
      if (result.noMailboxes) showNotice("warn", result.message || "No mailboxes configured.");
      else showNotice("success", `Inbound sync: ${result.processed} processed, ${result.matched} matched, ${result.unmatched} unmatched.`);
      await refresh();
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Inbound sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleGreetingChange = (key: string) => {
    setGreetingKey(key);
    const template = templates.find((t) => t.key === key);
    if (template?.body) setReply(template.body);
  };

  const handleResolutionTemplateChange = (key: string) => {
    setResolutionTemplateKey(key);
    const template = templates.find((t) => t.key === key);
    if (template?.body) setResolution(template.body);
  };

  const handlePortalAccess = async () => {
    if (!selectedTicket) return;
    setOnboardingBusy(true);
    try {
      const result = await sendClientPortalAccess(selectedTicket._id, { portalUrl: window.location.origin });
      if (result.createdAccount) showNotice("success", "Client account created. Credentials sent.");
      else showNotice("success", "Credentials sent.");
      const accountData = await getTicketClientAccount(selectedTicket._id);
      setAccount(accountData);
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Could not send portal access.");
    } finally {
      setOnboardingBusy(false);
    }
  };

  const handleResolutionEmail = async () => {
    if (!selectedTicket || !resolution.trim()) return;
    setSaving(true);
    try {
      const result = await sendResolutionEmail(selectedTicket._id, { resolution: resolution.trim() });
      setResolution("");
      if (result.emailDelivered) showNotice("success", "Resolution email sent.");
      else showNotice("warn", result.emailError || "Resolution email could not be confirmed delivered.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Could not send resolution email.");
    } finally {
      setSaving(false);
    }
  };

  const accountStateLabel = (state: string) => {
    if (state === "created") return "Account created";
    if (state === "ready") return "Account ready";
    if (state === "existing") return "Existing account";
    return "No client account yet";
  };

  const renderConversationMenu = (ticket: Ticket) => {
    if (menuFor !== ticket._id) return null;
    return (
      <div style={styles.menuHost} onClick={() => setMenuFor(null)}>
        <div style={styles.menuDropdown} onClick={(event) => event.stopPropagation()}>
          {hasStoredEmail(ticket) && (
            <button type="button" style={styles.menuItem} onClick={() => handleResend(ticket)} disabled={busyId === ticket._id}>
              <RotateCcw size={13} /> Resend
            </button>
          )}
          <button type="button" style={styles.menuItem} onClick={() => setSelectedTicket(null)}>
            <X size={13} /> Close Panel
          </button>
          <button type="button" style={{ ...styles.menuItem, ...styles.menuItemDanger }} onClick={() => handleDelete(ticket)} disabled={busyId === ticket._id}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`query-inbox-root${selectedTicket ? " query-has-thread" : ""}`}>
      <style>{workspaceCss}</style>

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

      <aside className="query-inbox-pane">
        <div style={styles.paneHeader}>
          <div>
            <h1 style={styles.paneTitle}>Query Inbox</h1>
            <p style={styles.paneSubtitle}>Client portal questions and public contact inquiries in one threaded workspace.</p>
          </div>
          <div style={styles.searchBox}>
            <Search size={15} color="var(--text-secondary)" />
            <input
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search queries..."
              style={styles.searchInput}
            />
          </div>
          <div style={styles.scopeTabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={scope === "active"}
              onClick={() => handleScopeChange("active")}
              style={{
                ...styles.scopeTab,
                ...(scope === "active" ? styles.scopeTabActive : {}),
              }}
            >
              Active
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "closed"}
              onClick={() => handleScopeChange("closed")}
              style={{
                ...styles.scopeTab,
                ...(scope === "closed" ? styles.scopeTabActive : {}),
              }}
            >
              Closed
            </button>
          </div>
        </div>

        <div className="qib-ticket-list">
          {loading ? (
            <p style={styles.emptyText}>Loading queries...</p>
          ) : tickets.length === 0 ? (
            <p style={styles.emptyText}>No {scope} queries match.</p>
          ) : (
            tickets.map((ticket) => {
              const requester = getRequester(ticket);
              const selected = ticket._id === selectedTicket?._id;
              const isTicketClosed = ticket.status === "closed";
              return (
                <div key={ticket._id} style={styles.cardWrap}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuFor(null);
                      setSelectedTicket(ticket);
                    }}
                    className={`query-ticket-row${selected ? " query-ticket-active" : ""}`}
                    style={styles.ticketRow}
                  >
                    <div style={styles.ticketRowTop}>
                      <strong style={styles.ticketSubject} title={ticket.subject}>
                        {ticket.subject}
                      </strong>
                      {ticket.hasNewClientReply && (
                        <span style={styles.unreadDot} title="New client reply" aria-label="New client reply" />
                      )}
                      <span style={isTicketClosed ? styles.ticketStatusClosed : styles.ticketStatusOpen}>
                        {getStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <p style={styles.ticketMeta} title={requester.name}>
                      {requester.name}
                    </p>
                    <p style={styles.ticketMetaMuted} title={requester.email}>
                      {requester.email || requester.subtitle}
                    </p>
                    <div style={styles.ticketRowBottom}>
                      <span style={styles.ticketTime}>{formatDate(ticket.createdAt)}</span>
                      <span style={styles.ticketTime}>{getClientIdLabel(ticket) ? `ID: ${getClientIdLabel(ticket)}` : ""}</span>
                    </div>
                  </button>
                  <div style={styles.cardControls}>
                    <button
                      type="button"
                      onClick={() => handleCardAction(ticket)}
                      disabled={busyId === ticket._id || saving}
                      style={isTicketClosed ? styles.chatActionOpen : styles.chatActionClose}
                    >
                      {busyId === ticket._id ? <Loader2 size={13} className="admin-messages-spin" /> : isTicketClosed ? "Open" : "Close"}
                    </button>
                    <button
                      type="button"
                      aria-label="More actions"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuFor((current) => (current === ticket._id ? null : ticket._id));
                      }}
                      style={{
                        ...styles.menuButton,
                        ...(menuFor === ticket._id ? styles.menuButtonActive : {}),
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {renderConversationMenu(ticket)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="qib-pane-footer">
          <span style={styles.pagerInfo}>{loading ? "Loading..." : `Showing ${tickets.length} of ${total}`}</span>
          {hasMore && (
            <button type="button" onClick={handleLoadMore} disabled={loadingMore} style={styles.loadMoreBtn}>
              {loadingMore && <Loader2 size={13} className="admin-messages-spin" />}
              Load More
            </button>
          )}
        </div>
      </aside>

      <section className="query-inbox-conversation">
        <header className="qib-topbar">
          <button type="button" onClick={() => router.push("/admin/dashboard")} style={styles.backBtn} title="Back to Messages">
            <ChevronLeft size={16} />
            Back to Messages
          </button>
          <h2 style={styles.topbarTitle}>Query Conversation</h2>
        </header>

        {!selectedTicket ? (
          <div style={styles.emptyThread}>
            <MessageSquare size={40} color="var(--text-secondary)" />
            <p style={styles.emptyText}>Select a conversation to view the thread.</p>
          </div>
        ) : (
          <div className="qib-conv-body">
            <div style={styles.chatHeader}>
              <div style={styles.chatTitleBlock}>
                <h2 style={styles.threadTitle}>{selectedTicket.subject}</h2>
                <p style={styles.threadSubtitle}>
                  {getRequester(selectedTicket).name}
                  {" · "}
                  {getRequester(selectedTicket).email || getRequester(selectedTicket).subtitle}
                </p>
              </div>
              <div style={styles.chatActions}>
                <span style={selectedTicket.status === "closed" ? styles.statusChipClosed : styles.statusChipOpen}>
                  {getStatusLabel(selectedTicket.status)}
                </span>
                <button type="button" onClick={handleSyncInbound} disabled={syncing || saving} style={styles.iconBtn} title="Sync inbound email">
                  {syncing ? <Loader2 size={15} className="admin-messages-spin" /> : <Mail size={15} />}
                  <span style={styles.iconBtnLabel}>Sync Inbound</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus(selectedTicket.status === "closed" ? "open" : "closed")}
                  disabled={saving}
                  style={selectedTicket.status === "closed" ? styles.chatActionOpen : styles.chatActionClose}
                >
                  {selectedTicket.status === "closed" ? "Open" : "Close"}
                </button>
                <button
                  type="button"
                  aria-label="Conversation actions"
                  onClick={() => setMenuFor((current) => (current === selectedTicket._id ? null : selectedTicket._id))}
                  style={{
                    ...styles.menuButton,
                    ...(menuFor === selectedTicket._id ? styles.menuButtonActive : {}),
                  }}
                >
                  <MoreVertical size={16} />
                </button>
                {renderConversationMenu(selectedTicket)}
              </div>
            </div>

            <div style={styles.chatCard}>
              <div className="qib-chat-label-row">
                <span className="qib-chat-label">Messenger Chat</span>
                <span className="qib-chat-hint">Client messages · Admin messages</span>
              </div>
              <div className="qib-chat-scroll">
                {threadMessages ? (
                  <>
                    {threadMessages.map((m) => {
                      const isClient = m.senderType === "client";
                      return (
                        <div
                          key={m.id}
                          style={{
                            ...styles.bubbleRow,
                            ...(isClient ? styles.bubbleRowClient : styles.bubbleRowAdmin),
                          }}
                        >
                          <div style={isClient ? styles.bubbleClient : styles.bubbleAdmin}>
                            <p style={styles.bubbleSender}>
                              {m.senderName || (isClient ? "Client" : "Websmith Team")}
                              {m.senderEmail ? ` · ${m.senderEmail}` : ""}
                            </p>
                            <p style={styles.bubbleText}>{m.message}</p>
                            <div style={styles.bubbleMeta}>
                              <span style={styles.bubbleTime}>{formatDate(m.createdAt)}</span>
                              {m.source === "email" && (
                                <span style={styles.bubbleViaEmail}>
                                  <Mail size={11} /> via email
                                </span>
                              )}
                              {m.direction === "outbound" && m.deliveryStatus === "sent" && (
                                <span style={styles.deliverySent}>Sent via email</span>
                              )}
                              {m.direction === "outbound" && m.deliveryStatus === "failed" && (
                                <span style={styles.deliveryFailed} title={m.deliveryError || "Email delivery failed"}>
                                  Email failed
                                </span>
                              )}
                              {m.direction === "outbound" &&
                                (!m.deliveryStatus || m.deliveryStatus === "not_sent") && (
                                  <span style={styles.deliveryStored}>Stored, not emailed</span>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div style={styles.timeline}>
                    {(Array.isArray(selectedTicket.history) ? selectedTicket.history : []).map((entry, index) => (
                      <div key={`${entry.createdAt}-${index}`} style={styles.timelineItem}>
                        <div style={styles.timelineDot} />
                        <div style={styles.timelineContent}>
                          <p style={styles.timelineLabel}>
                            {String(entry?.actorRole || "system").replace("_", " ")} · {String(entry?.action || "update").replace("_", " ")}
                          </p>
                          {entry.message?.trim() ? (
                            <p style={styles.timelineMessage}>{entry.message}</p>
                          ) : Array.isArray(entry.attachments) && entry.attachments.length ? null : (
                            <p style={styles.timelineMessage}>No message provided.</p>
                          )}
                          {entry.recipient && <p style={styles.timelineRecipient}>To: {entry.recipient}</p>}
                          {Array.isArray(entry.attachments) && entry.attachments.length > 0 && (
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
                )}
              </div>
            </div>

            <div style={styles.metaCard}>
              <span style={styles.sectionLabel}>Client Details</span>
              <div style={styles.metaItems}>
                <div style={styles.metaItem}>
                  <Mail size={14} color="#007AFF" />
                  <span>{getRequester(selectedTicket).email || "No email available"}</span>
                </div>
                <div style={styles.metaItem}>
                  <Briefcase size={14} color="#007AFF" />
                  <span>{getRequester(selectedTicket).subtitle}</span>
                </div>
                {getClientIdLabel(selectedTicket) && (
                  <div style={styles.metaItem}>
                    <Hash size={14} color="#007AFF" />
                    <span>Client ID: {getClientIdLabel(selectedTicket)}</span>
                  </div>
                )}
                <div style={styles.metaItem}>
                  <ShieldCheck size={14} color="#007AFF" />
                  <span>{getRequester(selectedTicket).name}</span>
                </div>
                <div style={styles.metaItem}>
                  <Clock3 size={14} color="#007AFF" />
                  <span>{formatDate(selectedTicket.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="qib-cards-grid">
              <div style={styles.composerCard}>
                <div style={styles.composerTop}>
                  <label style={styles.sectionLabel}>Reply Thread</label>
                  <select value={greetingKey} onChange={(event) => handleGreetingChange(event.target.value)} style={styles.greetingSelect} disabled={templates.length === 0} title="Greeting Template">
                    {templates.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                <div style={styles.composerTop}>
                  <label style={styles.sectionLabel}>Client Onboarding</label>
                  <span style={styles.portalChip}>{accountStateLabel(account?.state || "not_created")}</span>
                </div>
                {accountLoading ? (
                  <p style={styles.portalLine}>
                    <Loader2 size={13} className="admin-messages-spin" /> Checking account...
                  </p>
                ) : (
                  <>
                    <div style={styles.portalRow}>
                      {account?.email && (
                        <span style={styles.portalLine}>
                          <Mail size={12} /> {account.email}
                        </span>
                      )}
                      {account?.clientId && <span style={styles.portalLine}>Client ID: {account.clientId}</span>}
                      {account?.clientCustomId && <span style={styles.portalLine}>Custom ID: {account.clientCustomId}</span>}
                      {!account && <span style={styles.portalLine}>No client account linked yet.</span>}
                    </div>
                    <p style={styles.portalMaskedLine}>
                      Temporary credentials: <strong>••••••••</strong> (masked — delivered by email only, never displayed)
                    </p>
                    <p style={styles.portalHint}>
                      Credentials are emailed only when you click Send Credentials — never automatically.
                    </p>
                    <div style={styles.composerFooter}>
                      <button
                        type="button"
                        onClick={handlePortalAccess}
                        style={styles.secondaryBtn}
                        disabled={saving || onboardingBusy}
                      >
                        <UserPlus size={14} />
                        {onboardingBusy
                          ? "Sending..."
                          : account?.state === "ready" || account?.state === "existing"
                            ? "Send Credentials Email"
                            : "Create Account & Send Credentials"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={styles.composerCard}>
              <div style={styles.composerTop}>
                <label style={styles.sectionLabel}>Resolution Summary</label>
                <select
                  value={resolutionTemplateKey}
                  onChange={(event) => handleResolutionTemplateChange(event.target.value)}
                  style={styles.greetingSelect}
                  disabled={templates.length === 0}
                  title="Use Template"
                >
                  <option value="">Use Template...</option>
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                style={styles.resolutionTextarea}
                placeholder="Document the final answer or delivery outcome..."
              />
              <div style={styles.composerFooter}>
                <button
                  type="button"
                  onClick={handleResolutionEmail}
                  style={styles.secondaryBtn}
                  disabled={saving || !resolution.trim()}
                >
                  Send Resolution Email
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, any> = {
  notice: {
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: 100,
    maxWidth: "360px",
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: 600,
    boxShadow: "var(--card-shadow)",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  noticeSuccess: { borderColor: "#34c759", color: "#1d7a31", backgroundColor: "#f2fbf4" },
  noticeError: { borderColor: "#ff3b30", color: "#c81e12", backgroundColor: "#fff5f4" },
  noticeWarn: { borderColor: "#ff9f0a", color: "#8a5700", backgroundColor: "#fffaf0" },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  topbarTitle: { margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" },
  paneHeader: {
    flexShrink: 0,
    padding: "18px 18px 14px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  paneTitle: { margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" },
  paneSubtitle: { margin: "6px 0 0 0", color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5 },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    padding: "9px 12px",
    backgroundColor: "var(--bg-secondary)",
  },
  searchInput: {
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "var(--text-primary)",
    width: "100%",
    fontSize: "13px",
  },
  scopeTabs: {
    display: "flex",
    gap: "6px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    padding: "3px",
  },
  scopeTab: {
    flex: 1,
    border: "none",
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
    borderRadius: "9px",
    padding: "7px 10px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  scopeTabActive: {
    backgroundColor: "var(--bg-primary)",
    color: "#007AFF",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  emptyText: { color: "var(--text-secondary)", fontSize: "14px", textAlign: "center", padding: "20px 8px" },
  emptyThread: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" },
  pagerInfo: { fontSize: "11px", color: "var(--text-secondary)" },
  loadMoreBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  cardWrap: { position: "relative", flexShrink: 0 },
  ticketRow: {
    textAlign: "left",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "14px",
    padding: "10px 12px",
    width: "100%",
    minHeight: "100px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  ticketRowTop: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" },
  ticketSubject: {
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.35,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 1,
    WebkitBoxOrient: "vertical",
  },
  ticketStatusOpen: { textTransform: "capitalize", color: "#007AFF", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" },
  ticketStatusClosed: { textTransform: "capitalize", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" },
  ticketMeta: { margin: 0, fontSize: "12px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  ticketMetaMuted: { margin: 0, fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  ticketRowBottom: { display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "auto", paddingTop: "2px" },
  ticketTime: { fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" },
  unreadDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    backgroundColor: "#ff3b30",
    flexShrink: 0,
    marginTop: "4px",
  },
  cardControls: {
    position: "absolute",
    top: "10px",
    right: "8px",
    display: "flex",
    gap: "4px",
    zIndex: 2,
  },
  chatActionClose: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "1px solid #007aff33",
    backgroundColor: "rgba(0,122,255,0.08)",
    color: "#007AFF",
    borderRadius: "8px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  chatActionOpen: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderRadius: "8px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  menuButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "26px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-secondary)",
    borderRadius: "8px",
    cursor: "pointer",
  },
  menuButtonActive: {
    borderColor: "#007aff",
    color: "#007AFF",
    backgroundColor: "rgba(0,122,255,0.06)",
  },
  menuHost: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  menuDropdown: {
    position: "absolute",
    top: "8px",
    right: "8px",
    minWidth: "170px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    boxShadow: "var(--card-shadow)",
    padding: "6px",
    display: "flex",
    flexDirection: "column",
    zIndex: 60,
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--text-primary)",
    padding: "9px 10px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  },
  menuItemDanger: { color: "#ff3b30" },
  chatHeader: { display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-start", flexShrink: 0 },
  chatTitleBlock: { minWidth: 0 },
  threadTitle: { margin: 0, fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word" },
  threadSubtitle: { margin: "6px 0 0 0", color: "var(--text-secondary)", fontSize: "13px", wordBreak: "break-word" },
  chatActions: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" },
  statusChipOpen: {
    textTransform: "capitalize",
    fontSize: "11px",
    fontWeight: 700,
    color: "#007AFF",
    backgroundColor: "rgba(0,122,255,0.08)",
    border: "1px solid #007aff33",
    borderRadius: "999px",
    padding: "4px 10px",
  },
  statusChipClosed: {
    textTransform: "capitalize",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "999px",
    padding: "4px 10px",
  },
  iconBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderRadius: "10px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  iconBtnLabel: { whiteSpace: "nowrap" },
  chatCard: {
    flexShrink: 0,
    height: "clamp(300px, 50dvh, 640px)",
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--border-color)",
    borderRadius: "16px",
    backgroundColor: "var(--bg-secondary)",
    overflow: "hidden",
  },
  bubbleRow: { display: "flex", flexShrink: 0 },
  bubbleRowClient: { justifyContent: "flex-start" },
  bubbleRowAdmin: { justifyContent: "flex-end" },
  bubbleClient: {
    maxWidth: "78%",
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    borderTopLeftRadius: "4px",
    padding: "10px 12px",
    backgroundColor: "var(--bg-primary)",
  },
  bubbleAdmin: {
    maxWidth: "78%",
    border: "1px solid #007aff33",
    borderRadius: "14px",
    borderTopRightRadius: "4px",
    padding: "10px 12px",
    backgroundColor: "rgba(0,122,255,0.07)",
  },
  bubbleSender: { margin: 0, fontSize: "11px", fontWeight: 700, color: "#007AFF" },
  bubbleText: {
    margin: "6px 0",
    fontSize: "13px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--text-primary)",
  },
  bubbleMeta: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "4px" },
  bubbleTime: { fontSize: "10px", color: "var(--text-muted)" },
  bubbleViaEmail: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--text-secondary)" },
  deliverySent: { fontSize: "10px", fontWeight: 700, color: "#1d7a31" },
  deliveryFailed: { fontSize: "10px", fontWeight: 700, color: "#c81e12", cursor: "help" },
  deliveryStored: { fontSize: "10px", fontWeight: 700, color: "#8a5700" },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "4px 2px",
  },
  timelineItem: { display: "flex", gap: "12px" },
  timelineDot: { width: "9px", height: "9px", borderRadius: "999px", backgroundColor: "#007AFF", marginTop: "9px", flexShrink: 0 },
  timelineContent: {
    flex: 1,
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    padding: "12px 14px",
    backgroundColor: "var(--bg-primary)",
  },
  timelineLabel: { margin: 0, color: "#007AFF", fontSize: "11px", fontWeight: 700, textTransform: "capitalize" },
  timelineMessage: { margin: "6px 0", color: "var(--text-primary)", fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  timelineRecipient: { margin: "0 0 6px 0", color: "var(--text-secondary)", fontSize: "12px" },
  timelineTime: { margin: 0, color: "var(--text-secondary)", fontSize: "11px" },
  metaCard: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "14px",
    borderRadius: "14px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  metaItems: { display: "flex", gap: "12px 18px", flexWrap: "wrap" },
  metaItem: { display: "flex", alignItems: "center", gap: "7px", color: "var(--text-primary)", fontSize: "12px", minWidth: 0 },
  sectionLabel: { fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" },
  composerCard: {
    flexShrink: 0,
    border: "1px solid var(--border-color)",
    borderRadius: "16px",
    padding: "14px",
    backgroundColor: "var(--bg-secondary)",
  },
  composerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" },
  greetingSelect: {
    border: "1px solid var(--border-color)",
    borderRadius: "10px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: 600,
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: "96px",
    resize: "vertical",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "10px 12px",
    outline: "none",
    fontSize: "13px",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  resolutionTextarea: {
    width: "100%",
    minHeight: "110px",
    resize: "vertical",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "10px 12px",
    outline: "none",
    fontSize: "13px",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  textareaDisabled: { opacity: 0.6, cursor: "not-allowed" },
  composerFooter: { display: "flex", justifyContent: "flex-end", marginTop: "10px", gap: "8px" },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    borderRadius: "10px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    borderRadius: "10px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  portalRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  portalChip: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#007AFF",
    backgroundColor: "rgba(0,122,255,0.08)",
    border: "1px solid #007aff33",
    borderRadius: "999px",
    padding: "3px 9px",
    whiteSpace: "nowrap",
  },
  portalLine: { fontSize: "12px", color: "var(--text-primary)", margin: 0, display: "inline-flex", alignItems: "center", gap: "6px" },
  portalMaskedLine: { fontSize: "11px", color: "var(--text-secondary)", margin: "6px 0 0 0", lineHeight: 1.5 },
  portalHint: { fontSize: "11px", color: "var(--text-secondary)", margin: "6px 0 0 0", lineHeight: 1.5 },
};