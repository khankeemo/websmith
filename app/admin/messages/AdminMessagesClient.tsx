"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock3,
  FileCheck2,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
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
  OnboardingResult,
  resendTicketEmail,
  resolveTicketFileUrl,
  sendClientPortalAccess,
  sendResolutionEmail,
  Ticket,
  TicketClientAccount,
  TicketHistoryEntry,
  TicketStatus,
  updateTicket,
  updateTicketStatus,
} from "@/core/services/ticketService";
import { buildClientPortalGreeting } from "@/core/services/clientPortalGreeting";

const QUERY_INBOX_PAGE_SIZE = 15;

type Scope = "active" | "closed";
type Notice = { type: "success" | "error" | "warn"; text: string } | null;

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Just now";

const getStatusLabel = (status: TicketStatus) => status.replace("_", " ");

function hasStoredEmail(ticket: Ticket): TicketHistoryEntry | null {
  const history = ticket.history ?? [];
  return [...history].reverse().find((entry) => entry.recipient && entry.emailSubject && entry.emailBody) || null;
}

export default function AdminMessagesClient() {
  // ---- Query Inbox list state (Phase 10: 15 at a time + Load More) ----
  const [scope, setScope] = useState<Scope>("active");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const listSeq = useRef(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");
  const [nextStatus, setNextStatus] = useState<TicketStatus>("open");
  const [saving, setSaving] = useState(false);
  const [busyTicket, setBusyTicket] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // ---- Resolution templates (database-backed, Phase 9) ----
  const [templates, setTemplates] = useState<Array<{ key: string; name: string; category: string; isActive: boolean }>>([]);
  const [defaultTemplateKey, setDefaultTemplateKey] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");

  // ---- Client account state (Phase 6) ----
  const [accountState, setAccountState] = useState<TicketClientAccount | null>(null);

  // ---- ⋮ conversation menu + modals (Phase 11/12/13) ----
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [closeTicket, setCloseTicket] = useState<Ticket | null>(null);
  const [resendTicket, setResendTicket] = useState<Ticket | null>(null);
  const [onboardingTicket, setOnboardingTicket] = useState<Ticket | null>(null);
  const [credentials, setCredentials] = useState<OnboardingResult | null>(null);

  const showNotice = useCallback((type: Notice["type"], text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 6000);
  }, []);

  // ---- Loading (server-side pagination + search) ----
  const loadPage = useCallback(
    async (targetPage: number, opts: { append?: boolean } = {}) => {
      const seq = ++listSeq.current;
      try {
        if (opts.append) setLoadingMore(true);
        else setLoadingList(true);
        const result = await getTicketsPaged({ scope, page: targetPage, pageSize: QUERY_INBOX_PAGE_SIZE, search });
        if (seq !== listSeq.current) return;
        setTotal(result.total);
        setPage(result.page);
        setHasMore(result.hasMore);
        setTickets((current) => (opts.append ? [...current, ...result.data] : result.data));
      } catch (error: any) {
        if (seq !== listSeq.current) return;
        console.error("Load admin tickets error:", error);
        showNotice("error", error?.response?.data?.message || "Could not load conversations. Please try again.");
      } finally {
        if (seq === listSeq.current) {
          setLoadingList(false);
          setLoadingMore(false);
        }
      }
    },
    [scope, search, showNotice]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loadingList) return;
    loadPage(page + 1, { append: true });
  }, [hasMore, loadingMore, loadingList, page, loadPage]);

  // Debounced server-side search.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSelectedId(null);
    setMenuFor(null);
    setAccountState(null);
    loadPage(1);
  }, [scope, search, loadPage]);

  useEffect(() => {
    getResolutionTemplates()
      .then(({ data, defaultKey }) => {
        setTemplates(data);
        setDefaultTemplateKey(defaultKey);
        setSelectedTemplateKey(defaultKey);
      })
      .catch(() => showNotice("error", "Could not load resolution email templates."));
  }, [showNotice]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket._id === selectedId) || null,
    [tickets, selectedId]
  );

  useEffect(() => {
    if (!selectedTicket?._id) {
      setAccountState(null);
      return;
    }
    setAccountState(null);
    getTicketClientAccount(selectedTicket._id)
      .then(setAccountState)
      .catch(() => setAccountState(null));
  }, [selectedTicket?._id]);

  useEffect(() => {
    if (selectedTicket) {
      setResolution(selectedTicket.resolution || "");
      setNextStatus(selectedTicket.status);
      setCredentials(null);
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
      email: client?.email || ticket.contactEmail || "",
      subtitle: "Client portal",
    };
  };

  const refreshList = useCallback(() => loadPage(1), [loadPage]);

  // ---- Phase 4: Reply in Thread ----
  const handleReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setSaving(true);
    try {
      const result = await addTicketReply(selectedTicket._id, reply.trim());
      setReply("");
      await refreshList();
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

  // ---- Phase 5: Insert professional greeting (no internal markers) ----
  const insertClientPortalGreeting = () => {
    if (!selectedTicket) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.websmithdigital.com";
    const requester = getRequester(selectedTicket);
    const name = requester.name && requester.name !== "Public inquiry" ? requester.name : "";
    const hasPortalAccount = Boolean(
      typeof selectedTicket.clientId === "object" ? selectedTicket.clientId?._id : selectedTicket.clientId
    );
    const greeting = buildClientPortalGreeting({ name, hasPortalAccount, portalUrl: origin });
    setReply((current) => (current.trim() ? `${current.trim()}\n\n${greeting}` : greeting));
    showNotice("success", "Professional Client Portal greeting inserted. Review and edit it before sending.");
  };

  // ---- Status updates ----
  const handleStatus = async (status: TicketStatus) => {
    if (!selectedTicket) return;
    setSaving(true);
    try {
      await updateTicketStatus(selectedTicket._id, {
        status,
        resolution: status === "resolved" ? resolution.trim() || "Resolved by Websmith." : undefined,
      });
      await refreshList();
      if (status === "closed") setSelectedId(null);
      showNotice("success", `Status updated to ${getStatusLabel(status)}.`);
    } catch (error: any) {
      console.error("Update status error:", error);
      showNotice("error", error?.response?.data?.message || "Could not update status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Phase 12: Close Conversation ----
  const confirmClose = async () => {
    if (!closeTicket) return;
    setBusyTicket(closeTicket._id);
    try {
      await updateTicketStatus(closeTicket._id, { status: "closed" });
      if (selectedId === closeTicket._id) setSelectedId(null);
      setCloseTicket(null);
      await refreshList();
      showNotice("success", "Conversation closed. It remains available under the Closed tab with its full history.");
    } catch (error: any) {
      console.error("Close error:", error);
      showNotice("error", error?.response?.data?.message || "Could not close the conversation. Please try again.");
    } finally {
      setBusyTicket(null);
    }
  };

  // ---- Phase 11: Edit ----
  const confirmEdit = async (changes: { subject: string; contactName: string; contactEmail: string; contactCompany: string }) => {
    if (!editTicket) return;
    setBusyTicket(editTicket._id);
    try {
      const result = await updateTicket(editTicket._id, changes);
      setEditTicket(null);
      await refreshList();
      if (result.changed?.length) {
        showNotice("success", `Conversation updated: ${result.changed.join("; ")}`);
      } else {
        showNotice("success", "No changes were made.");
      }
    } catch (error: any) {
      console.error("Edit error:", error);
      showNotice("error", error?.response?.data?.message || "Could not update the conversation. Please try again.");
    } finally {
      setBusyTicket(null);
    }
  };

  // ---- Phase 11: Delete (soft delete via backend) ----
  const confirmDelete = async () => {
    if (!ticketToDelete) return;
    setBusyTicket(ticketToDelete._id);
    try {
      await deleteTicket(ticketToDelete._id);
      if (selectedId === ticketToDelete._id) setSelectedId(null);
      setTicketToDelete(null);
      await refreshList();
      showNotice("success", "Conversation deleted from the Query Inbox.");
    } catch (error: any) {
      console.error("Delete error:", error);
      showNotice("error", error?.response?.data?.message || "Could not delete the conversation. Please try again.");
    } finally {
      setBusyTicket(null);
    }
  };

  // ---- Phase 13: Resend (uses the stored email snapshot) ----
  const confirmResend = async () => {
    if (!resendTicket) return;
    setBusyTicket(resendTicket._id);
    try {
      const result = await resendTicketEmail(resendTicket._id);
      setResendTicket(null);
      await refreshList();
      if (result.emailDelivered) {
        showNotice("success", "Email resent successfully.");
      } else {
        showNotice("warn", `Email could not be resent: ${result.emailError || "unknown error"}`);
      }
    } catch (error: any) {
      console.error("Resend error:", error);
      const data = error?.response?.data;
      if (data?.emailDelivered === false) {
        showNotice("warn", `Email could not be resent: ${data.emailError || "unknown error"}`);
      } else {
        showNotice("error", data?.message || "Failed to resend the email. Please try again.");
      }
    } finally {
      setBusyTicket(null);
    }
  };

  // ---- Phase 3 + 6: Client onboarding credential delivery ----
  const confirmOnboarding = async () => {
    if (!onboardingTicket) return;
    setBusyTicket(onboardingTicket._id);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const result = await sendClientPortalAccess(onboardingTicket._id, { portalUrl: origin });
      setCredentials(result);
      setOnboardingTicket(null);
      await refreshList();
      getTicketClientAccount(onboardingTicket._id)
        .then(setAccountState)
        .catch(() => {});
      if (result.emailDelivered) {
        const createdNote = result.createdAccount ? " A new Client Portal account was created and the temporary password was sent by email." : " The customer's existing Client Portal account was used.";
        showNotice("success", `Client Portal access sent and delivered by email.${createdNote}`);
      } else {
        showNotice("warn", `Client Portal access could not be delivered by email: ${result.emailError || "unknown error"}. The temporary password (if newly created) is shown below once — save it before leaving.`);
      }
    } catch (error: any) {
      console.error("Onboarding error:", error);
      const data = error?.response?.data;
      if (data?.emailDelivered === false) {
        setCredentials(data);
        showNotice("warn", `Client Portal access could not be delivered by email: ${data.emailError || "unknown error"}.`);
      } else {
        showNotice("error", data?.message || "Failed to send Client Portal access. Please try again.");
      }
      await refreshList();
      if (onboardingTicket) {
        getTicketClientAccount(onboardingTicket._id)
          .then(setAccountState)
          .catch(() => {});
      }
    } finally {
      setBusyTicket(null);
    }
  };

  // ---- Phase 8: Resolution Email ----
  const handleResolutionEmail = async () => {
    if (!selectedTicket || !resolution.trim()) return;
    setSaving(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const result = await sendResolutionEmail(selectedTicket._id, {
        resolution: resolution.trim(),
        templateKey: selectedTemplateKey || defaultTemplateKey || undefined,
        portalUrl: origin,
      });
      await refreshList();
      if (result.emailDelivered) {
        showNotice("success", "Resolution email sent and delivered to the customer.");
      } else {
        showNotice("warn", `Resolution email could not be delivered: ${result.emailError || "unknown error"}.`);
      }
      getTicketClientAccount(selectedTicket._id)
        .then(setAccountState)
        .catch(() => {});
    } catch (error: any) {
      console.error("Resolution email error:", error);
      const data = error?.response?.data;
      if (data?.emailDelivered === false) {
        showNotice("warn", `Resolution email could not be delivered: ${data.emailError || "unknown error"}.`);
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
        return "Active";
      default:
        return "Not Created";
    }
  };

  const isClosed = selectedTicket?.chatStatus === "closed" || selectedTicket?.status === "closed";
  const isResolvedOrClosed = selectedTicket?.status === "resolved" || selectedTicket?.status === "closed";

  return (
    <div style={styles.shell}>
      {/* ============================ SIDEBAR / QUERY INBOX ============================ */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div>
            <h1 style={styles.title}>Query Inbox</h1>
            <p style={styles.subtitle}>Client portal questions and public contact inquiries in one threaded workspace.</p>
          </div>
          <div style={styles.searchBox}>
            <Search size={16} color="var(--text-secondary)" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search conversations..."
              style={styles.searchInput}
            />
          </div>
          <div style={styles.scopeTabs}>
            <button type="button" style={{ ...styles.scopeTab, ...(scope === "active" ? styles.scopeTabActive : {}) }} onClick={() => setScope("active")}>
              Active
            </button>
            <button type="button" style={{ ...styles.scopeTab, ...(scope === "closed" ? styles.scopeTabActive : {}) }} onClick={() => setScope("closed")}>
              Closed
            </button>
          </div>
        </div>

        <div style={styles.ticketList}>
          {loadingList ? (
            <p style={styles.emptyText}>Loading conversations...</p>
          ) : tickets.length === 0 ? (
            <p style={styles.emptyText}>
              {search ? "No conversations match your search." : scope === "closed" ? "No closed conversations." : "No active conversations. New Get in Touch submissions appear here."}
            </p>
          ) : (
            <>
              {tickets.map((ticket) => {
                const requester = getRequester(ticket);
                const storedEmail = hasStoredEmail(ticket);
                return (
                  <div key={ticket._id} style={styles.ticketRowWrap}>
                    <button
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
                    <div style={styles.menuHost}>
                      <button
                        type="button"
                        aria-label="Conversation actions"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuFor((current) => (current === ticket._id ? null : ticket._id));
                        }}
                        style={{ ...styles.menuButton, ...(menuFor === ticket._id ? styles.menuButtonActive : {}) }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuFor === ticket._id && (
                        <>
                          <div style={styles.menuBackdrop} onClick={() => setMenuFor(null)} />
                          <div style={styles.menuDropdown} onClick={() => setMenuFor(null)}>
                            <button type="button" style={styles.menuItem} onClick={() => setEditTicket(ticket)}>
                              <Pencil size={14} /> Edit
                            </button>
                            {storedEmail ? (
                              <button type="button" style={styles.menuItem} onClick={() => setResendTicket(ticket)}>
                                <RotateCcw size={14} /> Resend
                              </button>
                            ) : null}
                            {scope === "active" ? (
                              <button type="button" style={styles.menuItem} onClick={() => setCloseTicket(ticket)}>
                                <Lock size={14} /> Close Conversation
                              </button>
                            ) : null}
                            <button type="button" style={{ ...styles.menuItem, ...styles.menuItemDanger }} onClick={() => setTicketToDelete(ticket)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <button type="button" onClick={loadMore} style={styles.loadMoreBtn} disabled={loadingMore}>
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="admin-messages-spin" /> Loading...
                    </>
                  ) : (
                    <>Load More ({tickets.length} of {total})</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ============================ THREAD PANE ============================ */}
      <div style={styles.threadPane}>
        {!selectedTicket ? (
          <div style={styles.emptyThread}>
            <MessageSquare size={40} color="var(--text-secondary)" />
            <p style={styles.emptyText}>Select a conversation to view the thread.</p>
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
                  Close Panel
                </button>
                <div style={styles.statusControl}>
                  <label style={styles.statusLabel}>Status</label>
                  <select
                    value={nextStatus}
                    onChange={(event) => {
                      const status = event.target.value as TicketStatus;
                      setNextStatus(status);
                      if (status === "closed") {
                        setCloseTicket(selectedTicket);
                      } else {
                        handleStatus(status).catch((error) => console.error("Update status error:", error));
                      }
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

            {/* History / timeline (Phase 14) */}
            <div style={styles.timeline}>
              {(selectedTicket.history || []).map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} style={styles.timelineItem}>
                  <div style={styles.timelineDot} />
                  <div style={styles.timelineContent}>
                    <p style={styles.timelineLabel}>
                      {entry.actorRole.replace("_", " ")} · {entry.action.replace("_", " ")}
                    </p>
                    {entry.emailSubject && (
                      <p style={styles.timelineEmailSubject}>
                        {entry.action === "resend" && entry.originalAction ? `Resent (${entry.originalAction.replace("_", " ")})` : "Email"} — {entry.emailSubject}
                      </p>
                    )}
                    {entry.message?.trim() ? (
                      <p style={styles.timelineMessage}>{entry.message}</p>
                    ) : entry.attachments?.length ? null : (
                      <p style={styles.timelineMessage}>No message provided.</p>
                    )}
                    {entry.recipient && (
                      <p style={styles.timelineRecipient}>To: {entry.recipient}</p>
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

            {/* Phase 4: Reply in Thread */}
            <div style={styles.composerCard}>
              <label style={styles.label}>Reply in Thread</label>
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                style={{ ...styles.textarea, ...(isClosed ? styles.textareaDisabled : {}) }}
                placeholder={isClosed ? "This conversation is closed and read-only." : "Write a reply to continue the business conversation..."}
                disabled={isClosed}
              />
              <div style={styles.composerFooter}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginRight: "auto" }}>
                  <button type="button" onClick={insertClientPortalGreeting} style={styles.secondaryBtn} disabled={saving || isClosed}>
                    Insert Client Portal Greeting
                  </button>
                </div>
                <button type="button" onClick={handleReply} style={styles.primaryBtn} disabled={saving || !reply.trim() || isClosed}>
                  <Send size={14} />
                  Send Reply
                </button>
              </div>
            </div>

            {/* Phase 6: Client Portal Access (onboarding) — separate from Resolution */}
            <div style={styles.onboardingCard}>
              <div style={styles.cardHeaderRow}>
                <label style={styles.cardHeaderTitle}>
                  <UserPlus size={15} color="#007AFF" /> Client Portal Access
                </label>
                <span
                  style={{
                    ...styles.accountBadge,
                    ...(accountState?.state === "not_created" ? styles.accountBadgeNone : {}),
                  }}
                >
                  Client Account · {getAccountLabel(accountState)}
                </span>
              </div>
              <p style={styles.cardHint}>
                Send the business-onboarding credentials (Client ID, login email, temporary password, portal login URL and
                first-login password-change instruction) when the business relationship is confirmed. This is separate from the
                Resolution Email and is never triggered by the public Get in Touch form.
              </p>
              {accountState && accountState.state !== "not_created" && accountState.clientCustomId && (
                <p style={styles.accountHint}>
                  Linked Client ID: <strong>{accountState.clientCustomId}</strong> — the customer's existing Client Portal
                  account will be used; no new credentials are generated.
                </p>
              )}
              <div style={styles.composerFooter}>
                <button
                  type="button"
                  onClick={() => setOnboardingTicket(selectedTicket)}
                  style={styles.onboardingBtn}
                  disabled={saving || busyTicket === selectedTicket._id}
                >
                  <UserPlus size={14} />
                  Send Client Portal Access
                </button>
              </div>
              {credentials && (
                <div style={styles.credentialsBox}>
                  <div style={styles.credentialsHeader}>
                    <strong>Client Portal access sent</strong>
                    <button type="button" onClick={() => setCredentials(null)} style={styles.credentialsClose} aria-label="Dismiss">
                      <X size={14} />
                    </button>
                  </div>
                  <p style={styles.credentialsRow}>Client ID: <strong>{credentials.clientCustomId || "—"}</strong></p>
                  <p style={styles.credentialsRow}>Login Email: <strong>{accountState?.email || "—"}</strong></p>
                  {credentials.temporaryPassword ? (
                    <>
                      <p style={styles.credentialsRow}>
                        Temporary Password: <strong style={styles.credentialsPassword}>{credentials.temporaryPassword}</strong>
                      </p>
                      <p style={styles.credentialsWarning}>
                        Shown once. The password was hashed in the database and is never stored in the conversation. On first
                        login the customer must create a new password.
                      </p>
                    </>
                  ) : (
                    <p style={styles.credentialsRow}>No new credentials — an existing Client Portal account was used.</p>
                  )}
                </div>
              )}
            </div>

            {/* Phase 7 + 8: Resolution Summary + Resolution Email */}
            <div style={styles.composerCard}>
              <label style={styles.label}>Resolution Summary</label>
              <textarea
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                style={{ ...styles.textarea, ...(!isResolvedOrClosed ? styles.textareaDisabled : {}) }}
                placeholder={
                  isResolvedOrClosed
                    ? "Document the final outcome: what was completed, the final project result, relevant final information and any next/final instructions..."
                    : "Mark this conversation as Resolved or Closed to activate the Resolution workflow."
                }
                disabled={!isResolvedOrClosed}
              />
              <div style={styles.resolutionRow}>
                <div style={styles.resolutionField}>
                  <label style={styles.label}>Email Template</label>
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
                  <label style={styles.label}>Client Account</label>
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
                <p style={styles.accountHint}>
                  This customer has no Client Portal account yet. The Resolution Email is the final completion message and will
                  not deliver credentials — if this is a project client, send <strong>Client Portal Access</strong> first.
                </p>
              )}
              <div style={styles.composerFooter}>
                <button
                  type="button"
                  onClick={handleResolutionEmail}
                  style={styles.secondaryBtn}
                  disabled={saving || !isResolvedOrClosed || !resolution.trim()}
                >
                  <FileCheck2 size={14} />
                  Send Resolution Email
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ============================ MODALS ============================ */}
      {editTicket && (
        <EditModal
          ticket={editTicket}
          busy={busyTicket === editTicket._id}
          onCancel={() => setEditTicket(null)}
          onSave={confirmEdit}
        />
      )}
      {ticketToDelete && (
        <ConfirmModal
          title="Delete Conversation"
          tone="danger"
          busy={busyTicket === ticketToDelete._id}
          onCancel={() => setTicketToDelete(null)}
          onConfirm={confirmDelete}
        >
          <p style={styles.modalText}>
            Delete <strong>{ticketToDelete.subject}</strong> from the Query Inbox? The conversation is removed from the active
            Inbox while its full history is retained in the database (soft delete). Real customer history is never permanently destroyed.
          </p>
        </ConfirmModal>
      )}
      {closeTicket && (
        <ConfirmModal
          title="Close Conversation"
          tone="primary"
          busy={busyTicket === closeTicket._id}
          onCancel={() => setCloseTicket(null)}
          onConfirm={confirmClose}
        >
          <p style={styles.modalText}>
            Close <strong>{closeTicket.subject}</strong>? Closed conversations no longer appear in the active Inbox and keep
            their complete history under the Closed tab.
          </p>
        </ConfirmModal>
      )}
      {resendTicket && (
        <ResendModal
          ticket={resendTicket}
          busy={busyTicket === resendTicket._id}
          onCancel={() => setResendTicket(null)}
          onConfirm={confirmResend}
        />
      )}
      {onboardingTicket && (
        <OnboardingModal
          ticket={onboardingTicket}
          accountState={accountState}
          busy={busyTicket === onboardingTicket._id}
          onCancel={() => setOnboardingTicket(null)}
          onConfirm={confirmOnboarding}
        />
      )}
    </div>
  );
}

/* ============================ MODAL COMPONENTS ============================ */

function EditModal({
  ticket,
  busy,
  onCancel,
  onSave,
}: {
  ticket: Ticket;
  busy: boolean;
  onCancel: () => void;
  onSave: (changes: { subject: string; contactName: string; contactEmail: string; contactCompany: string }) => void;
}) {
  const [subject, setSubject] = useState(ticket.subject);
  const [contactName, setContactName] = useState(ticket.contactName || "");
  const [contactEmail, setContactEmail] = useState(ticket.contactEmail || "");
  const [contactCompany, setContactCompany] = useState(ticket.contactCompany || "");

  return (
    <div style={styles.modalBackdrop} onClick={busy ? undefined : onCancel}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <strong>Edit Conversation</strong>
          <button type="button" onClick={onCancel} style={styles.modalClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <label style={styles.modalLabel}>Subject</label>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.modalInput} />
          <label style={styles.modalLabel}>Contact Name</label>
          <input value={contactName} onChange={(event) => setContactName(event.target.value)} style={styles.modalInput} />
          <label style={styles.modalLabel}>Contact Email</label>
          <input value={contactEmail} type="email" onChange={(event) => setContactEmail(event.target.value)} style={styles.modalInput} />
          <label style={styles.modalLabel}>Company</label>
          <input value={contactCompany} onChange={(event) => setContactCompany(event.target.value)} style={styles.modalInput} />
        </div>
        <div style={styles.modalFooter}>
          <button type="button" onClick={onCancel} style={styles.secondaryBtn} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ subject, contactName, contactEmail, contactCompany })}
            style={styles.primaryBtn}
            disabled={busy || !subject.trim()}
          >
            {busy ? <Loader2 size={14} className="admin-messages-spin" /> : <Check size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ResendModal({
  ticket,
  busy,
  onCancel,
  onConfirm,
}: {
  ticket: Ticket;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const entry = hasStoredEmail(ticket);
  return (
    <div style={styles.modalBackdrop} onClick={busy ? undefined : onCancel}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <strong>Resend Email</strong>
          <button type="button" onClick={onCancel} style={styles.modalClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <p style={styles.modalText}>
            Resend the last stored email for <strong>{ticket.subject}</strong> exactly as it was sent:
          </p>
          <div style={styles.resendPreview}>
            <p style={styles.resendPreviewRow}>
              <strong>Recipient:</strong> {entry?.recipient || "—"}
            </p>
            <p style={styles.resendPreviewRow}>
              <strong>Subject:</strong> {entry?.emailSubject || "—"}
            </p>
            <p style={styles.resendPreviewRow}>
              <strong>Type:</strong> {entry?.originalAction || entry?.action || "email"} · {formatDate(entry?.createdAt)}
            </p>
            <p style={styles.resendPreviewBody}>
              <strong>Message:</strong>
            </p>
            <p style={styles.resendPreviewBodyText}>{entry?.emailBody || "—"}</p>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button type="button" onClick={onCancel} style={styles.secondaryBtn} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} style={styles.primaryBtn} disabled={busy || !entry}>
            {busy ? <Loader2 size={14} className="admin-messages-spin" /> : <RotateCcw size={14} />}
            Resend
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingModal({
  ticket,
  accountState,
  busy,
  onCancel,
  onConfirm,
}: {
  ticket: Ticket;
  accountState: TicketClientAccount | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const creating = !accountState || accountState.state === "not_created";
  return (
    <div style={styles.modalBackdrop} onClick={busy ? undefined : onCancel}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <strong>Send Client Portal Access</strong>
          <button type="button" onClick={onCancel} style={styles.modalClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <p style={styles.modalText}>
            Business onboarding for <strong>{ticket.contactName || "this client"}</strong> ({ticket.contactEmail || "no email"}).
            The customer will receive:
          </p>
          <ul style={styles.onboardingList}>
            <li>Client ID</li>
            <li>Client login / email</li>
            {creating && <li>Secure temporary password (hashed in the database, never stored in this conversation)</li>}
            <li>Client Portal login URL</li>
            <li>First-login password-change instruction</li>
          </ul>
          {creating ? (
            <p style={styles.accountHint}>
              A new Client Portal account will be created. The temporary password is shown once after sending — save it if you
              need to relay it. It must be changed on first login.
            </p>
          ) : (
            <p style={styles.accountHint}>
              The customer already has a Client Portal account (<strong>{accountState?.clientCustomId || "Client ID"}</strong>). No
              new credentials will be generated and their existing password is never overwritten.
            </p>
          )}
          <p style={styles.modalNote}>
            This is the business-onboarding credential email — separate from the Resolution Email, and never sent automatically
            by the Get in Touch form.
          </p>
        </div>
        <div style={styles.modalFooter}>
          <button type="button" onClick={onCancel} style={styles.secondaryBtn} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} style={styles.onboardingBtn} disabled={busy}>
            {busy ? <Loader2 size={14} className="admin-messages-spin" /> : <UserPlus size={14} />}
            Send Client Portal Access
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  tone,
  busy,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  tone: "primary" | "danger";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.modalBackdrop} onClick={busy ? undefined : onCancel}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <strong>{title}</strong>
          <button type="button" onClick={onCancel} style={styles.modalClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div style={styles.modalBody}>{children}</div>
        <div style={styles.modalFooter}>
          <button type="button" onClick={onCancel} style={styles.secondaryBtn} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={tone === "danger" ? styles.dangerBtn : styles.primaryBtn}
            disabled={busy}
          >
            {busy ? <Loader2 size={14} className="admin-messages-spin" /> : <Check size={14} />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ STYLES ============================ */

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
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 48px)",
  },
  sidebarHeader: {
    padding: "20px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
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
  scopeTabs: {
    display: "flex",
    gap: "8px",
    padding: "4px",
    borderRadius: "14px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  scopeTab: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  scopeTabActive: {
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
  },
  ticketList: {
    display: "flex",
    flexDirection: "column",
    padding: "14px",
    gap: "10px",
    overflowY: "auto",
    flex: 1,
  },
  ticketRowWrap: { position: "relative" },
  ticketRow: {
    textAlign: "left",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "16px",
    padding: "14px",
    width: "100%",
    cursor: "pointer",
    display: "block",
    marginRight: "34px",
  },
  ticketRowActive: {
    borderColor: "#007AFF55",
    backgroundColor: "rgba(0,122,255,0.08)",
  },
  ticketRowTop: { display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "8px", paddingRight: "6px" },
  ticketSubject: { color: "var(--text-primary)", fontSize: "14px" },
  ticketStatus: { textTransform: "capitalize", color: "#007AFF", fontSize: "12px", fontWeight: 700 },
  ticketMeta: { margin: 0, fontSize: "13px", color: "var(--text-primary)" },
  ticketMetaMuted: { margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-secondary)" },
  menuHost: { position: "absolute", top: "10px", right: "12px" },
  menuButton: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-secondary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  menuButtonActive: { color: "#007AFF", borderColor: "#007AFF55" },
  menuBackdrop: { position: "fixed", inset: 0, zIndex: 40 },
  menuDropdown: {
    position: "absolute",
    top: "34px",
    right: "0",
    zIndex: 50,
    minWidth: "190px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
    padding: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    textAlign: "left",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--text-primary)",
    padding: "9px 10px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  menuItemDanger: { color: "#FF3B30" },
  loadMoreBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "#007AFF",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  threadPane: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "24px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxHeight: "calc(100vh - 48px)",
    overflowY: "auto",
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
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  dangerBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
    backgroundColor: "#FF3B30",
    color: "#FFFFFF",
    borderRadius: "12px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  onboardingBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
    backgroundColor: "#34C759",
    color: "#FFFFFF",
    borderRadius: "12px",
    padding: "10px 14px",
    fontWeight: 700,
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
  timelineEmailSubject: { margin: "6px 0 0", color: "var(--text-primary)", fontSize: "13px", fontWeight: 600 },
  timelineMessage: { margin: "8px 0", color: "var(--text-primary)", fontSize: "14px", lineHeight: 1.6, whiteSpace: "pre-wrap" },
  timelineRecipient: { margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "12px" },
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
  onboardingCard: {
    border: "1px solid rgba(52,199,89,0.3)",
    borderRadius: "18px",
    padding: "16px",
    backgroundColor: "rgba(52,199,89,0.06)",
  },
  cardHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  cardHeaderTitle: { display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" },
  cardHint: { margin: "10px 0 0", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 },
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
  textareaDisabled: { opacity: 0.65, cursor: "not-allowed" },
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
  accountHint: { margin: "12px 0 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 },
  credentialsBox: {
    marginTop: "14px",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid rgba(52,199,89,0.4)",
    backgroundColor: "var(--bg-primary)",
  },
  credentialsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  credentialsClose: { border: "none", backgroundColor: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex" },
  credentialsRow: { margin: "4px 0", fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5 },
  credentialsPassword: { fontFamily: "monospace", fontSize: "15px", color: "#0F7B3D" },
  credentialsWarning: { margin: "8px 0 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: "20px",
  },
  modal: {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "90vh",
    overflowY: "auto",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "20px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border-color)",
    fontSize: "16px",
    color: "var(--text-primary)",
  },
  modalClose: { border: "none", backgroundColor: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex" },
  modalBody: { padding: "20px" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "16px 20px", borderTop: "1px solid var(--border-color)" },
  modalText: { margin: 0, fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6 },
  modalLabel: { display: "block", margin: "0 0 6px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" },
  modalInput: {
    width: "100%",
    boxSizing: "border-box",
    marginBottom: "14px",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    outline: "none",
    fontSize: "14px",
  },
  resendPreview: {
    marginTop: "14px",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  resendPreviewRow: { margin: "4px 0", fontSize: "13px", color: "var(--text-primary)" },
  resendPreviewBody: { margin: "10px 0 4px", fontSize: "13px", color: "var(--text-primary)" },
  resendPreviewBodyText: {
    margin: 0,
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    maxHeight: "160px",
    overflowY: "auto",
  },
  onboardingList: { margin: "10px 0", paddingLeft: "20px", fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.8 },
  modalNote: { margin: "14px 0 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 },
};
