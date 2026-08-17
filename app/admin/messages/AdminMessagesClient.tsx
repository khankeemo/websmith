// app/admin/messages/AdminMessagesClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
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
import { getSiteUrl } from "@/core/config/site";

// Canonical sender identity shown for every admin/outbound message in the
// Messenger Chat. Replaces any raw "Admin User" string (and the generic
// "Websmith ..." fallbacks persisted by the outgoing routes) with the single
// professional admin identity. Real admin names are preserved.
const ADMIN_SENDER_LABEL = "Websmith Digital Support";

// Never surface the raw "Admin User" placeholder or generic fallbacks as the
// admin sender — always collapse them to the canonical admin identity.
const GENERIC_ADMIN_NAMES = new Set([
  "admin user",
  "websmith team",
  "websmith support team",
  "websmith support",
  "support team",
]);
function adminDisplayName(raw?: string | null): string {
  if (!raw) return ADMIN_SENDER_LABEL;
  const t = String(raw).trim();
  if (!t || GENERIC_ADMIN_NAMES.has(t.toLowerCase())) return ADMIN_SENDER_LABEL;
  return t;
}

type Scope = "active" | "closed";
type Notice = { type: "success" | "error" | "warn"; text: string } | null;

const QUERY_INBOX_PAGE_SIZE = 15;

// Auto-poll interval for inbound email sync (R01 Phase 5 — FINAL FAST INBOUND
// CHAT: poll every 1 second so a client email lands in Messenger Chat within
// ≤1 s and never later than the 3-second maximum; no manual Sync Inbound
// button). Reuses the existing IMAP sync on /api/tickets/inbound silently;
// only refreshes the open conversation when new messages are matched. Polling
// runs ONLY while a conversation is selected AND not closed, and stops on
// unmount/deselect.
const POLL_INTERVAL_MS = 1_000;

// Display-only cleanup mirror for inbound email bodies stored BEFORE the
// server-side cleaner existed (R01 Phase 4). The chat never shows quoted
// previous emails / signatures / reply-header blocks — only the client's own
// words. Data is never mutated here.
function cleanClientBody(raw: string): string {
  let body = String(raw || "");
  if (!body.trim()) return body;
  body = body.replace(/\r\n/g, "\n");
  const lines = body.split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith(">")) {
      cut = i;
      break;
    }
    if (t === "--" || t.startsWith("-- ")) {
      cut = i;
      break;
    }
    if (/^-----+\s*(original message|forwarded message|reply message|message)\s*-----+$/i.test(t)) {
      cut = i;
      break;
    }
    if (/^sent from (my )?(iphone|ipad|android|galaxy|blackberry|windows)/i.test(t)) {
      cut = i;
      break;
    }
    if (i > 0 && lines[i - 1].trim() === "" && /^on .+ (wrote|said):\s*$/i.test(t)) {
      cut = i;
      break;
    }
    if (
      i > 0 &&
      lines[i - 1].trim() === "" &&
      /^(from|sent|to|cc|bcc|subject|date|reply-to|return-path|message-id|x-[a-z0-9-]+):/i.test(t)
    ) {
      cut = i;
      break;
    }
  }
  return lines
    .slice(0, cut)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Just now";

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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

// Client-safe mirror of lib/tickets/email.ts `renderResolutionTemplate`. Kept local
// (never imported from the server module) so the client bundle does not pull in
// bcrypt/crypto/mongodb. One reusable resolver for the whole Internal API email
// system's template preview. Mirrors the server block-token grammar exactly:
//   {{var}}        -> literal value (empty string when absent)
//   {{#if var}}...{{/if}}      -> kept when value is non-empty
//   {{#unless var}}...{{/unless}} -> kept when value is empty
const BLOCK_RE = /\{\{#(if|unless) ([a-z_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

function fillTemplate(template: { subject?: string; body?: string }, data: Record<string, string>): { subject: string; body: string } {
  const t = { subject: template.subject ?? "", body: template.body ?? "" };
  const fill = (value: string) => {
    let out = value.replace(BLOCK_RE, (_match, kind: string, key: string, inner: string) => {
      const val = data[key] ?? "";
      return kind === "if" ? (val !== "" ? inner : "") : val === "" ? inner : "";
    });
    for (const [key, val] of Object.entries(data)) {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val ?? "");
    }
    return out;
  };
  return { subject: fill(t.subject), body: fill(t.body) };
}

// Resolves a Ticket's real contact data into the placeholder map the seeded
// templates expect (must match the keys resolved server-side in
// app/api/tickets/[id]/send-resolution-email/route.ts so the preview matches the
// sent email).
function ticketPlaceholders(ticket: Ticket | null): Record<string, string> {
  if (!ticket) return {};
  const client = typeof ticket.clientId === "object" && ticket.clientId ? ticket.clientId : null;
  const recipient = String(ticket.contactEmail || ticket.clientEmail || client?.email || "").trim();
  const clientName = String(ticket.contactName || client?.name || "Valued Customer").trim();
  let projectName = "";
  if (ticket.projectId && typeof ticket.projectId === "object" && (ticket.projectId as any).name) {
    projectName = String((ticket.projectId as any).name);
  }
  const clientId = getClientIdLabel(ticket) ?? "";
  // portal_url is resolved from the EXISTING application/config source
  // (core/config/site.ts -> NEXT_PUBLIC_APP_URL, same origin the server route
  // uses). Never empty / never a raw token: when no origin is resolvable, fall
  // back to the prescribed customer-facing sentence.
  const origin = getSiteUrl().replace(/\/$/, "");
  const portalUrl = origin ? `${origin}/login` : "";
  return {
    request_id: ticket._id,
    client_name: clientName,
    client_email: recipient,
    client_id: clientId,
    query_subject: String(ticket.subject ?? ""),
    query_message: String(ticket.description ?? ""),
    resolution_summary: String(ticket.resolution ?? ""),
    portal_url: portalUrl || "We will send your Client Portal access details to your email after the conversation is completed.",
    company_name: "Websmith Digital",
    query_status: String(ticket.status ?? ""),
  };
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
.qib-conv-subhead {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
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
  const [notice, setNotice] = useState<Notice>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const menuEstimatedHeight = 170;

  const closeMenu = () => {
    setMenuFor(null);
    setMenuRect(null);
  };

  const openCardMenu = (event: React.MouseEvent<HTMLButtonElement>, ticketId: string) => {
    event.stopPropagation();
    if (menuFor === ticketId) {
      closeMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const openUp = rect.bottom + menuEstimatedHeight > window.innerHeight;
    setMenuRect({
      right: window.innerWidth - rect.right,
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
    });
    setMenuFor(ticketId);
  };
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
  // Guards the auto-poll against overlapping IMAP sweeps (a poll in flight is
  // never re-entered; the next interval tick picks up the result).
  const pollInFlight = useRef(false);

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

  // Lightweight refresh of ONLY the open ticket (no loading-state flicker).
  // Used by the inbound-email auto-poll to surface new client messages in the
  // Messenger Chat without touching the list's loading state.
  const refreshOpenTicket = useCallback(async () => {
    if (!selectedTicket) return;
    try {
      const res = await getTicketsPaged({
        scope,
        page,
        pageSize: QUERY_INBOX_PAGE_SIZE,
        search: searchTerm,
      });
      const fresh = res.data.find((t) => t._id === selectedTicket._id);
      if (fresh) {
        setTickets((prev) => prev.map((t) => (t._id === fresh._id ? fresh : t)));
        setSelectedTicket(fresh);
      }
    } catch {
      // Best-effort; the next poll re-attempts automatically.
    }
  }, [selectedTicket, scope, page, searchTerm]);

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

  // Auto-poll inbound email (R01 Phase 5 — FINAL FAST INBOUND CHAT: live
  // client email → chat within ≤1 s, never beyond the 3-second maximum,
  // background only). While a conversation is selected AND not closed, the
  // existing IMAP sync is polled silently every 1 second (first poll shortly
  // after open); when new client messages were matched the open thread is
  // refreshed so the reply appears in Messenger Chat immediately. Polling is
  // fully silent — no toasts, no loaders, no manual Sync button — and stops
  // when the conversation is closed or unmounted.
  useEffect(() => {
    if (!selectedTicket || selectedTicket.status === "closed") return;

    let cancelled = false;
    const poll = async () => {
      if (cancelled || pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const result = await syncInboundEmail();
        if (result?.matched > 0 && !cancelled) {
          await refreshOpenTicket();
        }
      } catch {
        // Silent: auto-poll never disrupts the admin session on transient errors.
      } finally {
        pollInFlight.current = false;
      }
    };

    const first = setTimeout(poll, 800);
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [selectedTicket, refreshOpenTicket]);

  // Canonical two-way conversation thread (`messages[]`). Pre-R01 tickets have
  // no messages array — those fall back to the legacy history timeline below.
  const threadMessages = useMemo(() => {
    const list = Array.isArray(selectedTicket?.messages) ? selectedTicket.messages : [];
    if (list.length === 0) return null;
    const sorted = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // Deduplicate by message id: the same inbound reply must never render twice
    // in the Messenger Chat (requirement: one chronological timeline).
    const seen = new Set<string>();
    return sorted.filter((m) => {
      const key = m.id || m.providerMessageId || `${(m.senderType ?? "unknown")}-${m.createdAt}-${m.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
       setGreetingKey("");
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

  const handleGreetingChange = (key: string) => {
    setGreetingKey(key);
    const template = templates.find((t) => t.key === key);
    if (template?.body) {
      const rendered = fillTemplate(template, ticketPlaceholders(selectedTicket));
      // Editable resolved text (placeholders replaced with real ticket data) —
      // sent as the reply body, so the customer never sees raw {{tokens}}.
      setReply(rendered.body);
    }
  };

  const replyPreview = useMemo(() => {
    const template = templates.find((t) => t.key === greetingKey);
    if (!template?.body) return "";
    return fillTemplate(template, ticketPlaceholders(selectedTicket)).body;
  }, [greetingKey, templates, selectedTicket]);

  const handleResolutionTemplateChange = (key: string) => {
    setResolutionTemplateKey(key);
    const template = templates.find((t) => t.key === key);
    if (template?.body) {
      // Pre-fill the editable summary area with the template's resolution text
      // so the admin reviews/edits the professional wording before sending.
      const rendered = fillTemplate(template, ticketPlaceholders(selectedTicket));
      setResolution(rendered.body);
    } else if (!key) {
      setResolution("");
    }
  };

  const resolutionPreview = useMemo(() => {
    const template = templates.find((t) => t.key === resolutionTemplateKey);
    if (!template?.body) return "";
    const rendered = fillTemplate(template, ticketPlaceholders(selectedTicket));
    return rendered.body;
  }, [resolutionTemplateKey, templates, selectedTicket]);

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
      // templateKey routes the server-side render + send through the SAME global
      // template (getResolutionTemplates) — no new backend/template API.
      const result = await sendResolutionEmail(selectedTicket._id, {
        resolution: resolution.trim(),
        templateKey: resolutionTemplateKey || undefined,
      });
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
    if (menuFor !== ticket._id || !menuRect) return null;
    const isTicketClosed = ticket.status === "closed";
    return (
      <>
        <div style={styles.menuBackdrop} onClick={closeMenu} />
        <div
          style={{
            ...styles.menuDropdown,
            position: "fixed",
            right: menuRect.right,
            top: menuRect.top,
            bottom: menuRect.bottom,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" style={styles.menuItem} onClick={() => handleCardAction(ticket)} disabled={busyId === ticket._id || saving}>
            {isTicketClosed ? "Open" : "Close"}
          </button>
          <button type="button" style={{ ...styles.menuItem, ...styles.menuItemDanger }} onClick={() => handleDelete(ticket)} disabled={busyId === ticket._id}>
            <Trash2 size={13} /> Delete
          </button>
          {hasStoredEmail(ticket) && (
            <button type="button" style={styles.menuItem} onClick={() => { handleResend(ticket); }} disabled={busyId === ticket._id}>
              <RotateCcw size={13} /> Resend
            </button>
          )}
        </div>
      </>
    );
  };

  const ticketStatusChip = (ticket: Ticket) => {
    const isTicketClosed = ticket.status === "closed";
    return (
      <span style={isTicketClosed ? styles.ticketStatusClosed : styles.ticketStatusOpen}>
        <span style={isTicketClosed ? styles.statusDotClosed : styles.statusDotOpen} />
        {isTicketClosed ? "Closed" : ticket.status === "open" ? "Open" : getStatusLabel(ticket.status)}
      </span>
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

        <div className="qib-ticket-list" onScroll={closeMenu}>
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
                  <div style={styles.cardHeader}>
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
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
                    <div style={styles.cardActions}>
                      {ticketStatusChip(ticket)}
                      <button
                        type="button"
                        aria-label="More actions"
                        onClick={(event) => openCardMenu(event, ticket._id)}
                        style={{
                          ...styles.menuButton,
                          ...(menuFor === ticket._id ? styles.menuButtonActive : {}),
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>
                  {renderConversationMenu(ticket)}
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
           {selectedTicket && (
             <>
               <div style={styles.topbarSpacer} />
               <span style={selectedTicket.status === "closed" ? styles.topbarDotClosed : styles.topbarDotOpen} />
               <span style={styles.topbarClient} title={getRequester(selectedTicket).name}>
                 {getRequester(selectedTicket).name} · {getRequester(selectedTicket).email || getRequester(selectedTicket).subtitle}
               </span>
             </>
           )}
         </header>

         {!selectedTicket ? (
           <div style={styles.emptyThread}>
             <MessageSquare size={40} color="var(--text-secondary)" />
             <p style={styles.emptyText}>Select a conversation to view the thread.</p>
           </div>
         ) : (
           <div className="qib-conv-body" onScroll={closeMenu}>
              <div className="qib-conv-subhead">
                <h3 style={styles.convSubject}>{selectedTicket.subject}</h3>
                <div style={styles.convActions}>
                  <button
                   type="button"
                   aria-label="Conversation actions"
                   onClick={(event) => openCardMenu(event, selectedTicket._id)}
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
                              {isClient ? (m.senderName || "Client") : adminDisplayName(m.senderName)}
                            </p>
                            <p style={styles.bubbleText}>
                              {isClient && m.source === "email" ? cleanClientBody(m.message) : m.message}
                            </p>
                            {m.attachments && m.attachments.length > 0 && (
                              <div style={styles.bubbleAttachments}>
                                {m.attachments.map((att) => (
                                  <a
                                    key={att.url}
                                    href={resolveTicketFileUrl(att.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={styles.attachmentLink}
                                    title={att.name}
                                  >
                                    {att.name}
                                    {att.size ? ` (${formatFileSize(att.size)})` : ""}
                                  </a>
                                ))}
                              </div>
                            )}
                            <div style={styles.bubbleMeta}>
                              <span style={styles.bubbleTime}>{formatDate(m.createdAt)}</span>
                              {!isClient && m.direction === "outbound" && m.deliveryStatus === "sent" && (
                                <span style={styles.deliverySent}>Sent via email</span>
                              )}
                              {!isClient && m.direction === "outbound" && m.deliveryStatus === "failed" && (
                                <span style={styles.deliveryFailed} title={m.deliveryError || "Email delivery failed"}>
                                  Email failed
                                </span>
                              )}
                              {!isClient &&
                                m.direction === "outbound" &&
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
                {greetingKey && replyPreview && (
                  <div style={styles.previewCard}>
                    <div style={styles.previewHeader}>
                      <span style={styles.previewLabel}>Resolved preview</span>
                      <span style={styles.previewHint}>Template placeholders are auto-filled with real client data.</span>
                    </div>
                    <pre style={styles.previewBody}>{replyPreview}</pre>
                  </div>
                )}
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
                <select value={resolutionTemplateKey} onChange={(event) => handleResolutionTemplateChange(event.target.value)} style={styles.greetingSelect} disabled={templates.length === 0} title="Use Template">
                  <option value="">Use Template...</option>
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {resolutionTemplateKey && (
                  <span style={styles.activeTemplatePill}>
                    Active: {templates.find((t) => t.key === resolutionTemplateKey)?.name || resolutionTemplateKey}
                  </span>
                )}
              </div>
              <textarea
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                style={styles.resolutionTextarea}
                placeholder="Document the final answer or delivery outcome..."
              />
              {resolutionTemplateKey && resolutionPreview && (
                <div style={styles.previewCard}>
                  <div style={styles.previewHeader}>
                    <span style={styles.previewLabel}>Resolved preview</span>
                    <span style={styles.previewHint}>This is how the customer will receive the selected email template.</span>
                  </div>
                  <pre style={styles.previewBody}>{resolutionPreview}</pre>
                </div>
              )}
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
  topbarSpacer: { flex: 1, minWidth: 0 },
  topbarDotOpen: {
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    backgroundColor: "#34c759",
    flexShrink: 0,
  },
  topbarDotClosed: {
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    backgroundColor: "#ff3b30",
    flexShrink: 0,
  },
  topbarClient: {
    fontSize: "13px",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  },
  convSubject: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  convActions: { display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 },
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
  cardWrap: { flexShrink: 0 },
  cardHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: "10px",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
    paddingTop: "10px",
  },
  ticketRow: {
    textAlign: "left",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "14px",
    padding: "10px 12px",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: "100px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  ticketRowTop: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" },
  ticketSubject: {
    flex: 1,
    minWidth: 0,
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
  ticketStatusOpen: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    color: "#1d7a31",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  ticketStatusClosed: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    color: "#c81e12",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  statusDotOpen: { width: "8px", height: "8px", borderRadius: "999px", backgroundColor: "#34c759", flexShrink: 0 },
  statusDotClosed: { width: "8px", height: "8px", borderRadius: "999px", backgroundColor: "#ff3b30", flexShrink: 0 },
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
  menuBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 20,
  },
  menuDropdown: {
    minWidth: "170px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    boxShadow: "var(--card-shadow)",
    padding: "6px",
    display: "flex",
    flexDirection: "column",
    zIndex: 30,
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
  bubbleAttachments: { display: "flex", flexWrap: "wrap", gap: "6px 8px", marginTop: "6px" },
  attachmentLink: {
    fontSize: "11px",
    color: "#007AFF",
    textDecoration: "underline",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
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
  activeTemplatePill: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#007AFF",
    backgroundColor: "rgba(0,122,255,0.08)",
    border: "1px solid #007aff33",
    borderRadius: "999px",
    padding: "3px 9px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  previewCard: {
    marginTop: "10px",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    backgroundColor: "var(--bg-primary)",
    overflow: "hidden",
  },
  previewHeader: { display: "flex", flexDirection: "column", gap: "2px", padding: "8px 12px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-secondary)" },
  previewLabel: { fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" },
  previewHint: { fontSize: "10px", color: "var(--text-secondary)" },
  previewBody: {
    margin: 0,
    padding: "10px 12px",
    fontSize: "11px",
    lineHeight: 1.5,
    color: "var(--text-primary)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    backgroundColor: "var(--bg-primary)",
    maxHeight: "140px",
    overflow: "auto",
  },
};