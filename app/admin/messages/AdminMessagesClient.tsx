// app/admin/messages/AdminMessagesClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Hash,
  Link2,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Phone,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
  Copy,
} from "lucide-react";
import {
  addTicketReply,
  createTicketChatLink,
  deleteTicket,
  getResolutionTemplates,
  getTicketClientAccount,
  getTicketMessages,
  getTicketQuiet,
  getTicketsPaged,
  getTicketsQuiet,
  markTicketRead,
  resolveTicketFileUrl,
  resendTicketEmail,
  revealClientPassword,
  sendClientPortalAccess,
  sendResolutionEmail,
  syncInboundEmail,
  Ticket,
  TicketHistoryEntry,
  ThreadMessage,
  updateTicketStatus,
} from "@/core/services/ticketService";
import { getToken } from "@/lib/auth";
import { getSiteUrl } from "@/core/config/site";
import { renderMessageHtml } from "@/core/services/messageRender";
import { cleanInboundBody } from "@/core/services/inboundBodyCleanup";
import { useMediaAsset } from "@/hooks/useMediaAsset";
// Shared 10-skin system (single source of truth: app/chat/[id]/chatSkins.ts)
// + the ONE shared skin-changer UI also used by /chat/[id]. Presentation only:
// selecting a skin swaps CSS custom properties on the Messenger pane — never
// tickets, messages, polling, sending, or any admin logic.
import { ChatSkinPicker } from "@/components/shared/ChatSkinPicker";
import { CHAT_SURFACE_CSS } from "@/components/shared/chatSurfaceCss";
import { DEFAULT_SKIN_ID, getChatSkin, readStoredSkinId, storeSkinId } from "@/app/chat/[id]/chatSkins";

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

// Lean-card fields returned by the list endpoint (`fields=card`). Used to merge
// refreshed card metadata onto the open conversation without ever dropping its
// full thread (messages/history are never part of the card payload).
const CARD_FIELDS: readonly string[] = [
  "source",
  "requestId",
  "clientId",
  "clientCustomId",
  "clientEmail",
  "contactName",
  "contactEmail",
  "contactCompany",
  "subject",
  "priority",
  "status",
  "chatStatus",
  "lastClientReplyAt",
  "adminReadAt",
  "createdAt",
  "updatedAt",
  "hasNewClientReply",
  "hasStoredEmail",
];

// Custom chevron for the priority dropdown (appearance: none kills the native
// arrow). Websmith brand blue, consistent with the existing UI accents.
const PRIORITY_SELECT_ARROW =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#149CEA' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>"
  );

// Auto-poll interval for the Query Ticket bridge (R01 PHASE 2 FINAL: poll
// every 1 second so a client email reply — processed by the UNIVERSAL email
// system and bridged into the ticket — lands in Messenger Chat within ≤1 s and
// never later than the 3-second maximum; no manual Sync Inbound button).
//
// R02 LIVE SYNC — ONE mechanism, ALWAYS on: the single interval runs the SAME
// silent sync in EVERY UI state (idle AND open conversation):
//   1. bridge pass on /api/tickets/inbound (email → tickets, cheap when
//      nothing is new thanks to the server-side seen-set fast path),
//   2. incremental thread deltas for the OPEN conversation (Secure Chat +
//      bridged Email messages, `?after=` cursor with a small overlap window),
//   3. lean card-list refresh EVERY tick so a brand-new Get in Touch request
//      drops into the inbox live whether or not a conversation is open.
// There are no secondary timers, no state-dependent gating and no manual
// buttons. Polling stops only on unmount.
const POLL_INTERVAL_MS = 1_000;

// Clock-skew safety window for the incremental `?after=` cursor: deltas are
// re-fetched from slightly BEFORE the last known message time (browser clock
// vs server clock can differ by seconds). The idempotent merge absorbs any
// overlap — existing message ids never append twice.
const CURSOR_OVERLAP_MS = 2_000;

// Display-only cleanup mirror for inbound email bodies stored BEFORE a cleaner
// fix shipped (legacy rows). R02: this is now the SAME canonical pure cleaner
// the server bridge uses (`core/services/inboundBodyCleanup.ts`) — one rule
// set for stored rows and new bridges, zero drift, data never mutated here.
const cleanClientBody = cleanInboundBody;

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Just now";

// Time-only formatter for the message bottom metadata (`9:46 PM · From Email`).
// The date is already available in the conversation/details panel — it is never
// repeated inside every message bubble.
const formatTimeOnly = (value?: string) =>
  value
    ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "Just now";

// Ticket-generated client FIRST name (the ONLY identity shown at the top of a
// client message bubble). Derived from the existing ticket fields — Get in Touch
// `contactName` or the linked client account name — never a new source. Strips
// a leading title token so "Dr. Jane Doe" renders "Jane".
const TITLE_PREFIX_RE = /^(mr|mrs|ms|miss|dr|prof|sir|lady|lord|rev|fr)\.\s*/i;
function clientFirstName(ticket: Ticket | null): string {
  if (!ticket) return "Client";
  const client = typeof ticket.clientId === "object" && ticket.clientId ? ticket.clientId : null;
  const raw = String(ticket.contactName || client?.name || "").trim();
  if (!raw) return "Client";
  const withoutTitle = raw.replace(TITLE_PREFIX_RE, "").trim();
  const first = withoutTitle.split(/\s+/)[0] || "Client";
  return first;
}

// Bottom metadata for client messages — exactly ONE of two labels, derived from
// the EXISTING backend message `source` field (never guessed from the text):
//   chat -> "From Chat" (Secure Messenger Chat)
//   everything else -> "From Email" (Get in Touch form, bridged email, portal)
function clientSourceLabel(source?: ThreadMessage["source"]): string {
  return source === "chat" ? "From Chat" : "From Email";
}

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getStatusLabel = (status: Ticket["status"]) => status.replace("_", " ");

const getSourceLabel = (ticket: Ticket) => (ticket.source === "client_portal" ? "Client Portal" : "Get in Touch");

const getPriorityLabel = (priority: Ticket["priority"]) =>
  priority === "high" ? "High" : priority === "low" ? "Low" : "Medium";

const getClientIdLabel = (ticket: Ticket): string | null => {
  if (ticket.clientCustomId) return ticket.clientCustomId;
  if (ticket.clientId && typeof ticket.clientId === "object" && ticket.clientId._id) return ticket.clientId._id;
  return null;
};

// Customer-facing request reference (WSD-XXXXXX). Pre-WSD tickets have no
// stored requestId — they keep rendering their legacy id so nothing is invented.
const getRequestLabel = (ticket: Ticket): string =>
  ticket.requestId || ticket._id;

function hasStoredEmail(ticket: Ticket): boolean {
  // Lean card list items (`fields=card`) carry the server-computed flag — the
  // full history array (email bodies) is NOT downloaded with the card. Full
  // tickets (open conversation) fall back to scanning their history array.
  if (typeof ticket.hasStoredEmail === "boolean") return ticket.hasStoredEmail;
  const history = Array.isArray(ticket.history) ? ticket.history : [];
  return Boolean([...history].reverse().find((entry) => entry.recipient && entry.emailSubject && entry.emailBody));
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
// sent email). `chatUrl` is the REAL signed secure Messenger Chat link for THIS
// conversation (resolved via the admin chat-link endpoint, cached per ticket);
// when unavailable it degrades to the prescribed customer-facing sentence —
// NEVER the Client Portal login URL (Continue Chat must open the Messenger Chat
// directly, without login).
function ticketPlaceholders(ticket: Ticket | null, chatUrl = ""): Record<string, string> {
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
  const portalFallback = "We will send your Client Portal access details to your email after the conversation is completed.";
  return {
    request_id: ticket._id,
    client_name: clientName,
    client_email: recipient,
    client_id: clientId,
    query_subject: String(ticket.subject ?? ""),
    query_message: String(ticket.description ?? ""),
    resolution_summary: String(ticket.resolution ?? ""),
    portal_url: portalUrl || portalFallback,
    // The Continue Chat link must NEVER point to /login: the customer opens
    // the Messenger Chat directly from the signed /chat/<id>?token= link. When
    // the secure chat link cannot be resolved, the placeholder degrades to the
    // prescribed customer-facing sentence (never the portal login URL).
    chat_url: chatUrl || portalFallback,
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
  gap: 10px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.qib-conv-subhead {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 20px;
  margin: 15px 0;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.qib-conv-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  border-radius: 12px;
  background: var(--bg-secondary);
  overflow: hidden;
}
.qib-chat-label-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--sk-header-border);
  background: var(--sk-header-bg);
}
.qib-chat-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--sk-title);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.qib-chat-hint {
  font-size: 10px;
  color: var(--sk-subtitle);
}
.qib-chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* Stored message text may contain "[label](url)" link tokens (First Welcome's
   Client Portal / Direct Secure Chat links). Labels render as clickable links
   (the URL, incl. the signed chat JWT, lives only in the href — never as
   visible text). */
.qib-chat-scroll .qib-msg-text a {
  color: var(--sk-link);
  text-decoration: underline;
  word-break: break-all;
}
.qib-cards-grid {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

/* ONE ticket = ONE self-contained card: base border/background/shadow live on
   the .query-ticket-row class (hover + active highlight are already defined in
   globals.css) so the unified card keeps the same selected/hover states the
   old two-part row had. */
.query-ticket-row {
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
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

/* ---- Reply Thread — unified messenger skin scope (R04 FINAL) ------------- */
/* The Reply Thread card carries the SAME active chat-skin token scope as the
   Messenger Chat above it (ws-chat-surface + data-ws-skin + --sk-* vars), so
   every surface here follows the selected skin like one messenger system.
   Only this card is scoped — Client Onboarding / Resolution Summary keep their
   own admin-theme styles untouched. */
.qib-reply-thread {
  transition:
    background-color 0.35s ease,
    border-color 0.35s ease,
    box-shadow 0.35s ease;
}
.qib-reply-thread select,
.qib-reply-thread textarea {
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    box-shadow 0.3s ease;
}
/* Themed dropdown control (closed state): token-driven chevron, no native chrome */
.qib-reply-thread .qib-reply-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.qib-reply-thread .qib-reply-select-wrap > svg {
  position: absolute;
  right: 8px;
  pointer-events: none;
  color: var(--sk-accent);
}
.qib-reply-thread select.qib-reply-select {
  appearance: none;
  -webkit-appearance: none;
}
/* Skin-synced focus rings inside the Reply Thread (beats the generic page rule) */
.qib-reply-thread.ws-chat-surface select:focus-visible,
.qib-reply-thread.ws-chat-surface textarea:focus-visible {
  outline: none;
  border-color: var(--sk-focus-border) !important;
  box-shadow: var(--sk-focus-ring);
}
`;

export default function AdminMessagesClient() {
  const router = useRouter();
  const chatLogo = useMediaAsset("chat_messenger_logo");

  // ---- SKIN STATE (presentation only — swaps CSS variables, never logic) ----
  // Same shared system as the Direct Secure Client Chat: one list, one picker,
  // one localStorage key (`ws_chat_skin_id`), instant switching without reload.
  const [skinId, setSkinId] = useState<string>(DEFAULT_SKIN_ID);
  const activeSkin = getChatSkin(skinId);
  useEffect(() => {
    const stored = readStoredSkinId();
    if (stored) setSkinId(stored);
  }, []);
  const handleSkinSelect = useCallback((id: string) => {
    setSkinId(id);
    storeSkinId(id);
  }, []);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // One-time full-thread loader for the OPEN conversation: the card list is
  // lean (fields=card), so the thread (messages[]) is fetched once on select.
  // Never touched by the 1-second auto-poll — the poll is fully silent.
  const [threadLoading, setThreadLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scope, setScope] = useState<Scope>("active");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  // Per-action local loading state for the ⋮ menu (Ticket → Resend / Open /
  // Close / Delete / Copy Chat Link). Only the in-flight action shows a spinner
  // on its own menu item; the Query Inbox list and the conversation are never
  // blocked by it.
  const [busyAction, setBusyAction] = useState<{ ticketId: string; action: "open" | "close" | "delete" | "resend" | "chat" } | null>(null);
  const busyTicketId = busyAction?.ticketId ?? null;
  const [notice, setNotice] = useState<Notice>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const menuEstimatedHeight = 215;

  const closeMenu = () => {
    setMenuFor(null);
    setMenuRect(null);
    setInfoFor(null);
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
  const [account, setAccount] = useState<{ state: string; email: string; name: string; clientId?: string; clientCustomId?: string; hasTemporaryPassword?: boolean } | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  // Phase 3 — Client Onboarding: the temporary password is NEVER shown
  // automatically. It is revealed ONLY after the logged-in admin enters their
  // own password (verify on the reveal-password route), displayed temporarily
  // with an auto-hide timer, and never stored in component state beyond the
  // brief reveal.
  const [chatUrl, setChatUrl] = useState("");
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealPrompt, setRevealPrompt] = useState(false);
  const [revealPasswordInput, setRevealPasswordInput] = useState("");
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  // Phase 3 — the "Get in Touch" / priority chips on a ticket card are now
  // interactive: clicking opens a small info popover with the ticket's existing
  // source / priority information (no new backend, no duplicate data).
  const [infoFor, setInfoFor] = useState<{ ticketId: string; kind: "source" | "priority" } | null>(null);
  // Priority editing rule: priority is LOCKED on the card until the query
  // enters Edit mode (⋮ menu → Edit). editModeFor tracks the ticket whose
  // priority select is enabled; every other card stays read-only.
  const [editModeFor, setEditModeFor] = useState<string | null>(null);
  const chatUrlCache = useRef(new Map<string, string>());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the auto-poll against overlapping bridge passes (a poll in flight is
  // never re-entered; the next interval tick picks up the result).
  const pollInFlight = useRef(false);
  // The poll is the ONE Messenger real-time mechanism: a single interval created
  // on mount that reads the CURRENT selection through refs (never restarted by
  // state updates, never duplicated) and incrementally fetches only delta
  // messages. `selectedRef` mirrors the open conversation (id + status),
  // `cursorRef` is the last-seen message timestamp for that conversation, and
  // `cancelledRef` stops a pending tick on unmount.
  const selectedRef = useRef<{ id: string; status: Ticket["status"] } | null>(null);
  const cursorRef = useRef(0);
  const cancelledRef = useRef(false);
  // Mirror of the current list state for the silent card refresh (kept in a ref
  // so the poll effect itself never depends on scope/page/search state).
  const listStateRef = useRef({ scope, page, searchTerm });
  useEffect(() => {
    listStateRef.current = { scope, page, searchTerm };
  }, [scope, page, searchTerm]);
  // Mirror the open conversation (id + status) for the single auto-poll
  // interval. The cursor is NOT reset here on message appends (same id) — the
  // append path advances it; only an actual conversation switch resets it.
  useEffect(() => {
    selectedRef.current = selectedTicket
      ? { id: selectedTicket._id, status: selectedTicket.status }
      : null;
  }, [selectedTicket?._id, selectedTicket?.status]);
  // Scroll preservation for the Messenger Chat: `chatScrollRef` is the scroll
  // container and `nearBottomRef` tracks whether the admin is at/near the
  // bottom (updated on user scroll). Background 1-second updates never jump the
  // view — a near-bottom reader stays pinned to the bottom; a reader browsing
  // older messages is left exactly where they are.
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const CHAT_NEAR_BOTTOM_PX = 120;

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < CHAT_NEAR_BOTTOM_PX;
  };

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
          fields: "card",
        });
        setTickets((prev) => (opts?.append ? [...prev, ...res.data] : res.data));
        setTotal(res.total);
        setPage(res.page);
        setHasMore(res.hasMore);
        // Keep the open conversation fresh if it is part of this page, and
        // never blank an already-open conversation when it scrolls off-page.
        // The list is LEAN (fields=card): merge only the card fields onto the
        // open conversation so its full thread (messages/history) is never lost.
        setSelectedTicket((prev) => {
          if (!prev) return prev;
          const fresh = res.data.find((ticket) => ticket._id === prev._id);
          if (!fresh) return prev;
          const merged: any = { ...prev };
          for (const key of CARD_FIELDS) {
            if (key in fresh) merged[key] = (fresh as any)[key];
          }
          return merged;
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
      .then(({ data }) => {
        setTemplates(data.filter((template) => template.isActive !== false));
        // Phase 3 — the Resolved Preview starts BLANK. No template is
        // pre-selected and the previous conversation's reply/template is never
        // carried over; the Reply Thread only fills when the admin picks a
        // template themselves.
        setGreetingKey("");
      })
      .catch(() => showNotice("warn", "Could not load greeting templates."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    await loadTickets({ page });
  };

  // Lightweight refresh of ONLY the open ticket (no loading-state flicker).
  // Used by the inbound-email auto-poll to surface new client messages in the
  // Messenger Chat without touching the list's loading state. Diff-based: the
  // poll runs every 1 s, so state is only touched when the ticket actually
  // changed (new inbound client message bridged from the universal email
  // system, an admin reply, a status change, ...) — unchanged tickets never
  // trigger a re-render.
  const maxMessageTime = (messages?: ThreadMessage[]): number =>
    (Array.isArray(messages) ? messages : []).reduce(
      (max, m) => Math.max(max, new Date(m.createdAt || 0).getTime()),
      0
    );

  // Append ONLY newly-fetched messages to the open conversation. Idempotent by
  // the EXISTING message `id`: a new id is appended once, an existing id is
  // never re-appended, a changed existing message is updated in place. Also
  // refreshes the matching card's metadata without touching other cards.
  const applyIncremental = useCallback(
    (
      ticketId: string,
      newMessages: ThreadMessage[],
      meta: {
        updatedAt?: string;
        lastClientReplyAt?: string | null;
        hasNewClientReply?: boolean;
        status?: Ticket["status"];
      }
    ) => {
      if (!Array.isArray(newMessages) || newMessages.length === 0) return;
      const newest = newMessages.reduce(
        (max, m) => Math.max(max, new Date(m.createdAt || 0).getTime()),
        cursorRef.current
      );
      cursorRef.current = Math.max(cursorRef.current, newest);
      setSelectedTicket((prev) => {
        if (!prev || prev._id !== ticketId) return prev;
        const known = new Map<string, ThreadMessage>((prev.messages || []).map((m) => [m.id, m]));
        let changed = false;
        for (const msg of newMessages) {
          if (!msg.id) continue;
          const existing = known.get(msg.id);
          if (!existing) {
            known.set(msg.id, msg);
            changed = true;
          } else if (JSON.stringify(existing) !== JSON.stringify(msg)) {
            known.set(msg.id, msg);
            changed = true;
          }
        }
        if (!changed) return prev;
        const messages = Array.from(known.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return {
          ...prev,
          messages,
          ...(meta.updatedAt !== undefined ? { updatedAt: meta.updatedAt } : {}),
          ...(meta.lastClientReplyAt !== undefined ? { lastClientReplyAt: meta.lastClientReplyAt } : {}),
          ...(meta.hasNewClientReply !== undefined ? { hasNewClientReply: meta.hasNewClientReply } : {}),
          ...(meta.status !== undefined ? { status: meta.status } : {}),
        };
      });
      setTickets((prev) => {
        const target = prev.find((t) => t._id === ticketId);
        if (!target) return prev;
        // Churn guard: identical card metadata keeps the exact previous state
        // object so React skips the re-render entirely.
        const nextUpdatedAt = meta.updatedAt !== undefined ? meta.updatedAt : target.updatedAt;
        const nextLastReply =
          meta.lastClientReplyAt !== undefined ? meta.lastClientReplyAt : target.lastClientReplyAt;
        const nextUnread =
          meta.hasNewClientReply !== undefined ? meta.hasNewClientReply : target.hasNewClientReply;
        const nextStatus = meta.status !== undefined ? meta.status : target.status;
        if (
          nextUpdatedAt === target.updatedAt &&
          nextLastReply === target.lastClientReplyAt &&
          nextUnread === target.hasNewClientReply &&
          nextStatus === target.status
        ) {
          return prev;
        }
        return prev.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                ...(meta.updatedAt !== undefined ? { updatedAt: meta.updatedAt } : {}),
                ...(meta.lastClientReplyAt !== undefined ? { lastClientReplyAt: meta.lastClientReplyAt } : {}),
                ...(meta.hasNewClientReply !== undefined ? { hasNewClientReply: meta.hasNewClientReply } : {}),
                ...(meta.status !== undefined ? { status: meta.status } : {}),
              }
            : t
        );
      });
    },
    []
  );

  // The admin is viewing the open conversation: a newly arrived client message
  // is read by definition. Mark it read best-effort (quietFetch, never
  // page-lifeline) and clear the unread dot locally.
  const markReadSelected = useCallback((ticketId: string) => {
    markTicketRead(ticketId).catch(() => {});
    setTickets((prev) =>
      prev.map((t) =>
        t._id === ticketId ? { ...t, hasNewClientReply: false, adminReadAt: new Date().toISOString() } : t
      )
    );
    setSelectedTicket((prev) =>
      prev && prev._id === ticketId
        ? { ...prev, hasNewClientReply: false, adminReadAt: new Date().toISOString() }
        : prev
    );
  }, []);

  // Silent lean-card list sync — runs EVERY poll tick (~1 s) in EVERY UI state
  // (R02): refreshes the OTHER conversations' metadata (unread dot, status,
  // lastClientReplyAt), INSERTS brand-new tickets (a Get in Touch request lands
  // live without any manual refresh) and merges card fields onto the open
  // conversation without ever touching its thread. Reads the current list state
  // from a ref so the poll effect stays stable (never restarted by state
  // updates). Churn-free: when the fresh page carries nothing new, the exact
  // previous state objects are returned so React skips the re-render entirely
  // (no flicker, no scroll movement). Quiet transport: a session expiry mid-poll
  // can never page-replace the admin with /login.
  const refreshCardsSilently = useCallback(async () => {
    try {
      const { scope: s, page: p, searchTerm: q } = listStateRef.current;
      const res = await getTicketsQuiet({
        scope: s,
        page: p,
        pageSize: QUERY_INBOX_PAGE_SIZE,
        search: q,
        fields: "card",
      });
      const fresh = Array.isArray(res.data) ? res.data : [];
      if (fresh.length === 0) return;
      const byId = new Map(fresh.map((t) => [t._id, t]));
      const cardSignature = (arr: Ticket[]) =>
        arr
          .map((t) => `${t._id}:${t.updatedAt || ""}:${t.status || ""}:${t.hasNewClientReply ? 1 : 0}`)
          .join("|");
      setTickets((prev) => {
        // Position-preserving refresh of existing rows + prepend genuinely-new
        // tickets (the server sorts by updatedAt DESC, so a brand-new ticket
        // belongs at the top — same place a manual reload would put it).
        const prevIds = new Set(prev.map((t) => t._id));
        const inserted = fresh.filter((t) => !prevIds.has(t._id));
        const merged = prev.map((t) => byId.get(t._id) ?? t);
        const next = inserted.length ? [...inserted, ...merged] : merged;
        return cardSignature(next) === cardSignature(prev) ? prev : next;
      });
      setTotal(res.total);
      setPage(res.page);
      setHasMore(res.hasMore);
      setSelectedTicket((prev) => {
        if (!prev) return prev;
        const freshCard = byId.get(prev._id);
        if (!freshCard) return prev;
        let changed = false;
        const merged: any = { ...prev };
        for (const key of CARD_FIELDS) {
          if (!(key in freshCard)) continue;
          const nextValue = (freshCard as any)[key];
          if (JSON.stringify(merged[key]) !== JSON.stringify(nextValue)) {
            merged[key] = nextValue;
            changed = true;
          }
        }
        return changed ? merged : prev;
      });
    } catch {
      // Silent: the next poll re-attempts automatically.
    }
  }, []);

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

  // AUTO-POLL — the ONE Messenger real-time update mechanism (R02 LIVE SYNC).
  // The interval is created ONCE on mount and reads the current selection
  // through refs, so it NEVER restarts on state updates and never creates
  // duplicate intervals. There are NO secondary timers and NO state-dependent
  // gating: EVERY 1-second tick (first run ~800ms after mount) runs the same
  // silent sync in every UI state:
  //   1. Bridge pass (/api/tickets/inbound): processed universal email is
  //      copied into its ticket — ALWAYS, idle or not (unread dots stay live;
  //      the server-side seen-set fast path makes a no-op pass nearly free).
  //   2. Open conversation: incremental fetch of ONLY messages newer than the
  //      last-seen cursor (Secure Chat + bridged Email), with a small overlap
  //      window to absorb browser/server clock skew — the idempotent merge
  //      never duplicates. The full thread is fetched once on open, never
  //      re-downloaded every second.
  //   3. Catch-up fetch right after a bridge tick that appended something, so a
  //      just-bridged email lands in the open thread in the SAME cycle.
  //   4. Lean card-list sync EVERY tick: inserts brand-new Get in Touch tickets
  //      live and refreshes unread/status metadata — never threads, never the
  //      draft, never the scroll.
  // Fully silent (quietFetch transport): no reload, no remount, no spinner.
  // Stops only on unmount.
  useEffect(() => {
    cancelledRef.current = false;
    const tick = async () => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const sel = selectedRef.current;
        const openId = sel?.id && sel.status !== "closed" ? sel.id : null;

        let bridgeMatched = 0;
        if (openId) {
          const cursorIso =
            cursorRef.current > 0
              ? new Date(cursorRef.current - CURSOR_OVERLAP_MS).toISOString()
              : "";
          const [bridge, first] = await Promise.all([
            syncInboundEmail().catch(() => null),
            getTicketMessages(openId, cursorIso).catch(() => null),
          ]);
          if (cancelledRef.current) return;
          bridgeMatched = (bridge as { matched?: number } | null)?.matched || 0;
          if (first?.messages && first.messages.length > 0) {
            applyIncremental(openId, first.messages, first);
            if (first.hasNewClientReply) markReadSelected(openId);
          }
        } else {
          // Idle (or a closed conversation selected): email must STILL reach
          // its ticket live — the bridge runs here too.
          const bridge = await syncInboundEmail().catch(() => null);
          if (cancelledRef.current) return;
          bridgeMatched = (bridge as { matched?: number } | null)?.matched || 0;
        }

        if (bridgeMatched > 0 && openId && selectedRef.current?.id === openId) {
          const catchCursor =
            cursorRef.current > 0
              ? new Date(cursorRef.current - CURSOR_OVERLAP_MS).toISOString()
              : "";
          const catchUp = await getTicketMessages(openId, catchCursor).catch(() => null);
          if (cancelledRef.current) return;
          if (catchUp?.messages && catchUp.messages.length > 0) {
            applyIncremental(openId, catchUp.messages, catchUp);
            if (catchUp.hasNewClientReply) markReadSelected(openId);
          }
        }

        // Every tick: brand-new Get in Touch tickets + metadata stay live.
        await refreshCardsSilently();
      } finally {
        pollInFlight.current = false;
      }
    };

    const first = setTimeout(tick, 800);
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [applyIncremental, markReadSelected, refreshCardsSilently]);

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

  // ---- Messenger Chat scroll behavior (background 1-second updates) ----
  // The auto-poll appends messages into the open conversation but must NEVER
  // disorient the reader: a fresh open jumps to the bottom (new thread), and a
  // background append pins a near-bottom reader to the bottom while leaving a
  // reader inspecting older messages exactly where they are.
  const scrollToBottom = () => {
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true;
    }
  };

  // Opening a conversation (or switching between conversations): scroll to the
  // bottom so the latest message is visible immediately.
  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicket?._id]);

  // Background message append (auto-poll detected a new Email/Chat message):
  // only re-pin to the bottom if the admin was already near it. `threadMessages`
  // is the deduped, sorted thread; its length is the only signal needed.
  useEffect(() => {
    if (nearBottomRef.current) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadMessages?.length]);

  const getRequester = (ticket: Ticket) => {
    if (ticket.source === "public_contact") {
      return {
        name: ticket.contactName || "Public inquiry",
        email: ticket.contactEmail || "",
        callingPhone: ticket.contactCallingPhone || ticket.contactPhone || "",
        whatsappPhone: ticket.contactWhatsappPhone || "",
        preferredContactDate: ticket.preferredContactDate || "",
        preferredContactTime: ticket.preferredContactTime || "",
        timeZone: ticket.timeZone || ticket.clientTimeZone || "",
        adminCallTimeIST: ticket.adminCallTimeIST || "",
        subtitle: ticket.contactCompany || "Website contact form",
      };
    }

    const client = typeof ticket.clientId === "object" ? ticket.clientId : null;
    return {
      name: client?.name || "Client",
      email: client?.email || "",
      callingPhone: (client as any)?.phone || "",
      whatsappPhone: "",
      preferredContactDate: "",
      preferredContactTime: "",
      timeZone: "",
      adminCallTimeIST: "",
      subtitle: "Client portal",
    };
  };

  // Rule 8 — `status` is the single authoritative UI source. `chatStatus` is
  // kept in sync server-side but is never consulted by the UI, so the two
  // fields can never disagree in the rendered state.
  const isClosed = selectedTicket?.status === "closed";

  // In-place card update after an action: replaces ONLY the affected ticket in
  // the Query Inbox list and (when it is the open one) the conversation — never
  // reloads the whole list, never resets scroll or layout.
  const applyTicketUpdate = useCallback((updated: Ticket) => {
    setTickets((prev) => prev.map((ticket) => (ticket._id === updated._id ? updated : ticket)));
    setSelectedTicket((prev) => (prev && prev._id === updated._id ? updated : prev));
  }, []);

  const handleReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setSaving(true);
    try {
      const updated = await addTicketReply(selectedTicket._id, reply.trim());
      setReply("");
      setGreetingKey("");
      applyTicketUpdate(updated);
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
    if (busyAction) return;
    const target: "open" | "close" = ticket.status === "closed" ? "open" : "close";
    const payloadStatus: Ticket["status"] = target === "open" ? "open" : "closed";
    setBusyAction({ ticketId: ticket._id, action: target });
    try {
      const updated = await updateTicketStatus(ticket._id, { status: payloadStatus });
      applyTicketUpdate(updated);
      showNotice("success", target === "open" ? "Query reopened." : "Query closed.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Could not update the query.");
    } finally {
      setBusyAction(null);
      setMenuFor(null);
    }
  };

  const handleResend = async (ticket: Ticket) => {
    setBusyAction({ ticketId: ticket._id, action: "resend" });
    try {
      const result = await resendTicketEmail(ticket._id);
      if (result.emailDelivered) showNotice("success", "Email resent.");
      else showNotice("warn", result.emailError || "Email queued but not confirmed delivered.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Resend failed.");
    } finally {
      setBusyAction(null);
      setMenuFor(null);
    }
  };

  // Secure Public Client Messenger Chat — generates the signed chat link for
  // THIS ticket (bound to the ticket id + the customer's email) and copies it
  // to the clipboard so the admin can hand it to the customer. The customer
  // opens their own conversation directly — no login, no other data exposed.
  const handleCopyChatLink = async (ticket: Ticket) => {
    setBusyAction({ ticketId: ticket._id, action: "chat" });
    try {
      const result = await createTicketChatLink(ticket._id, window.location.origin);
      await navigator.clipboard.writeText(result.url);
      showNotice("success", "Secure chat link copied.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Could not create the chat link.");
    } finally {
      setBusyAction(null);
      setMenuFor(null);
    }
  };

  const handleDelete = async (ticket: Ticket) => {
    if (!window.confirm(`Delete the conversation "${ticket.subject}"? This cannot be undone.`)) return;
    setBusyAction({ ticketId: ticket._id, action: "delete" });
    try {
      await deleteTicket(ticket._id);
      if (selectedTicket?._id === ticket._id) setSelectedTicket(null);
      // Remove ONLY this card — the Query Inbox is never reloaded for a single
      // action (no re-fetch, no scroll reset, no layout/width change).
      setTickets((prev) => prev.filter((t) => t._id !== ticket._id));
      setTotal((prev) => Math.max(0, prev - 1));
      showNotice("success", "Conversation deleted.");
    } catch (error: any) {
      showNotice("error", error?.response?.data?.message || "Delete failed.");
    } finally {
      setBusyAction(null);
      setMenuFor(null);
    }
  };

  // Phase 3 — Resolve (and cache per-ticket) the REAL signed secure Messenger
  // Chat link used to fill the {{chat_url}} placeholder of the First Welcome
  // / reply templates. The client has no JWT_SECRET, so it asks the admin
  // chat-link endpoint once per ticket. Falls back to "" so the caller's
  // placeholder fallback (Client Portal login URL) takes over — never a bare
  // token.
  const ensureChatUrl = useCallback(async (ticket: Ticket | null): Promise<string> => {
    if (!ticket?._id) return "";
    const cached = chatUrlCache.current.get(ticket._id);
    if (cached) return cached;
    try {
      const result = await createTicketChatLink(ticket._id, window.location.origin);
      chatUrlCache.current.set(ticket._id, result.url);
      setChatUrl(result.url);
      return result.url;
    } catch {
      return "";
    }
  }, []);

  // Phase 3 — Client Onboarding: load the account state (which now exists the
  // moment the Get in Touch submission created it) for the OPEN conversation.
  const loadClientAccount = useCallback(async (ticket: Ticket | null) => {
    if (!ticket?._id) {
      setAccount(null);
      setAccountLoading(false);
      return;
    }
    setAccountLoading(true);
    try {
      const accountData = await getTicketClientAccount(ticket._id);
      setAccount(accountData);
    } catch {
      setAccount(null);
    } finally {
      setAccountLoading(false);
    }
  }, []);

  // Phase 3 — opening a conversation always starts BLANK. The Resolved Preview
  // never preloads the previous conversation's reply/template/resolution, and
  // the Client Onboarding reveal state is cleared so a credential can never
  // linger from another conversation.
  // The card list is LEAN (fields=card), so the full thread (messages[]) is
  // fetched once from the existing single-ticket endpoint on open; the 1-second
  // auto-poll then only fetches delta messages. Re-clicking the SAME already
  // open card keeps the in-progress draft untouched and does not re-fetch.
  const handleSelectTicket = async (ticket: Ticket) => {
    closeMenu();
    const sameTicket = selectedTicket?._id === ticket._id;
    const needsFullThread = !sameTicket || !Array.isArray(selectedTicket?.messages);
    if (!sameTicket) {
      // Phase 3 — opening a conversation always starts BLANK. The Resolved
      // Preview never preloads the previous conversation's reply/template/
      // resolution, and the Client Onboarding reveal state is cleared so a
      // credential can never linger from another conversation. Re-clicking the
      // SAME already-open card keeps the in-progress draft untouched.
      setReply("");
      setGreetingKey("");
      setResolution("");
      setResolutionTemplateKey("");
      setChatUrl("");
      setRevealedPassword(null);
      setRevealPrompt(false);
      setRevealPasswordInput("");
      setRevealError(null);
    }
    if (needsFullThread) {
      setThreadLoading(true);
      // Cursor starts at "now" so the auto-poll only picks up genuinely NEW
      // messages while the full thread is loading (and after); all existing
      // messages arrive with the full fetch below.
      cursorRef.current = Date.now();
    }
    setSelectedTicket(ticket);
    loadClientAccount(ticket);
    if (needsFullThread) {
      try {
        const full = await getTicketQuiet(ticket._id);
        if (!cancelledRef.current && selectedRef.current?.id === ticket._id) {
          if (full) {
            setSelectedTicket(full);
            cursorRef.current = Math.max(maxMessageTime(full.messages), cursorRef.current);
          }
        }
      } catch {
        // Keep the card data; the next auto-poll/refresh re-attempts the thread.
      } finally {
        if (selectedRef.current?.id === ticket._id) setThreadLoading(false);
      }
    }
  };

  const handleGreetingChange = async (key: string) => {
    setGreetingKey(key);
    if (!key) {
      setReply("");
      return;
    }
    const template = templates.find((t) => t.key === key);
    if (!template?.body) {
      setReply("");
      return;
    }
    // Resolve the secure chat link BEFORE filling the reply so the filled text
    // (which is what gets sent) carries a real signed link.
    const url = await ensureChatUrl(selectedTicket);
    setChatUrl(url);
    const rendered = fillTemplate(template, ticketPlaceholders(selectedTicket, url));
    // Editable resolved text (placeholders replaced with real ticket data) —
    // sent as the reply body, so the customer never sees raw {{tokens}}.
    setReply(rendered.body);
  };

  const replyPreview = useMemo(() => {
    const template = templates.find((t) => t.key === greetingKey);
    if (!template?.body) return "";
    return fillTemplate(template, ticketPlaceholders(selectedTicket, chatUrl)).body;
  }, [greetingKey, templates, selectedTicket, chatUrl]);

  const handleResolutionTemplateChange = async (key: string) => {
    setResolutionTemplateKey(key);
    if (!key) {
      setResolution("");
      return;
    }
    const template = templates.find((t) => t.key === key);
    if (template?.body) {
      // Pre-fill the editable summary area with the template's resolution text
      // so the admin reviews/edits the professional wording before sending.
      const url = await ensureChatUrl(selectedTicket);
      setChatUrl(url);
      const rendered = fillTemplate(template, ticketPlaceholders(selectedTicket, url));
      setResolution(rendered.body);
    } else {
      setResolution("");
    }
  };

  const resolutionPreview = useMemo(() => {
    const template = templates.find((t) => t.key === resolutionTemplateKey);
    if (!template?.body) return "";
    const rendered = fillTemplate(template, ticketPlaceholders(selectedTicket, chatUrl));
    return rendered.body;
  }, [resolutionTemplateKey, templates, selectedTicket, chatUrl]);

  // Phase 3 — reveal the client's temporary password ONLY after the logged-in
  // admin enters their own password (verified server-side on the reveal-password
  // route). The password is shown temporarily with an auto-hide timer and can be
  // copied; it is never shown automatically and never stored beyond the reveal.
  const handleRevealPassword = async () => {
    if (!selectedTicket || !revealPasswordInput.trim()) return;
    setRevealBusy(true);
    setRevealError(null);
    try {
      const result = await revealClientPassword(selectedTicket._id, revealPasswordInput.trim());
      if (result.temporaryPassword) {
        setRevealedPassword(result.temporaryPassword);
        setRevealPasswordInput("");
        setRevealPrompt(false);
        window.setTimeout(
          (current) => setRevealedPassword((value) => (value === current ? null : value)),
          30000,
          result.temporaryPassword
        );
      } else {
        setRevealError("No temporary password is available for this client.");
      }
    } catch (error: any) {
      setRevealError(error?.response?.data?.message || "Could not reveal the temporary password.");
    } finally {
      setRevealBusy(false);
    }
  };

  // Phase 3 — the "Get in Touch" and priority chips open a small info panel
  // with the ticket's EXISTING source / priority information (never new data,
  // never a second source of truth). The panel is rendered CENTERED relative to
  // the viewport (never clipped / off-screen), so the chip's position is no
  // longer needed.
  const openInfoMenu = (
    event: { stopPropagation: () => void },
    ticketId: string,
    kind: "source" | "priority"
  ) => {
    event.stopPropagation();
    if (infoFor?.ticketId === ticketId && infoFor.kind === kind) {
      setInfoFor(null);
      return;
    }
    setInfoFor({ ticketId, kind });
  };

  // Priority editing rule: clicking Edit in the ⋮ menu toggles edit mode for
  // that query. While a card is in edit mode its priority select is enabled;
  // every other card shows a read-only priority chip. No separate priority
  // flow — the changed value saves through the EXISTING PATCH update.
  const toggleEditMode = (ticket: Ticket) => {
    const next = editModeFor === ticket._id ? null : ticket._id;
    setEditModeFor(next);
    setMenuFor(null);
    setInfoFor(null);
    showNotice(
      "success",
      next ? "Edit mode enabled — priority is now editable." : "Edit mode disabled — priority is locked."
    );
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
      // templateKey routes the server-side render + send through the SAME global
      // template (getResolutionTemplates) — no new backend/template API.
      const result = await sendResolutionEmail(selectedTicket._id, {
        resolution: resolution.trim(),
        templateKey: resolutionTemplateKey || undefined,
      });
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

  // Phase 3 — the First Welcome Message is the primary Reply Thread template:
  // it sorts FIRST in the Reply Thread dropdown (always, regardless of the
  // database sort). The Resolution Summary select keeps the plain name order.
  const replyTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      if (a.key === "first-welcome") return -1;
      if (b.key === "first-welcome") return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [templates]);

  // Phase 3 — the "Get in Touch" / priority chip info panel (FIXED, centered
  // relative to the viewport so it can never be clipped or pushed off-screen;
  // width + height constrained on small screens with internal scroll). Shows
  // ONLY existing ticket data — never new data, never a second source of
  // truth, never a duplicate.
  const renderInfoPopover = (ticket: Ticket) => {
    if (infoFor?.ticketId !== ticket._id) return null;
    const sourceLabels: Record<string, string> = {
      public_contact: "Public website Get in Touch form",
      client_portal: "Client Portal query",
    };
    const priorityInfo: Record<string, string> = {
      high: "High priority — urgent attention required; handled first.",
      medium: "Medium priority — standard handling within the normal 24-hour response window.",
      low: "Low priority — routine handling; can wait.",
    };
    const requester = getRequester(ticket);
    const isSource = infoFor.kind === "source";
    return (
      <>
        <div style={styles.menuBackdrop} onClick={() => setInfoFor(null)} />
        <div style={styles.infoPanel} onClick={(event) => event.stopPropagation()}>
          <div style={styles.infoPanelTitle}>{isSource ? "Source information" : "Priority information"}</div>
          {isSource ? (
            <>
              <div style={styles.infoPopRow}>
                <span style={styles.infoPopLabel}>Channel</span>
                <span style={styles.infoPopValue}>{sourceLabels[ticket.source] || getSourceLabel(ticket)}</span>
              </div>
              <div style={styles.infoPopRow}>
                <span style={styles.infoPopLabel}>Email</span>
                <span style={styles.infoPopValue}>{requester.email || "—"}</span>
              </div>
              {requester.subtitle && (
                <div style={styles.infoPopRow}>
                  <span style={styles.infoPopLabel}>Company</span>
                  <span style={styles.infoPopValue}>{requester.subtitle}</span>
                </div>
              )}
              <div style={styles.infoPopRow}>
                <span style={styles.infoPopLabel}>Submitted</span>
                <span style={styles.infoPopValue}>{formatDate(ticket.createdAt)}</span>
              </div>
              <div style={styles.infoPopRow}>
                <span style={styles.infoPopLabel}>Subject</span>
                <span style={styles.infoPopValue}>{ticket.subject}</span>
              </div>
            </>
          ) : (
            <>
              <div style={styles.infoPopRow}>
                <span style={styles.infoPopLabel}>Priority</span>
                <span style={styles.infoPopValue}>{getPriorityLabel(ticket.priority)}</span>
              </div>
              <div style={styles.infoPopText}>{priorityInfo[ticket.priority] || ""}</div>
            </>
          )}
        </div>
      </>
    );
  };

  const renderConversationMenu = (ticket: Ticket) => {
    if (menuFor !== ticket._id || !menuRect) return null;
    const isTicketClosed = ticket.status === "closed";
    const busyHere = busyTicketId === ticket._id;
    const closeAction: "open" | "close" = isTicketClosed ? "open" : "close";
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
          <button type="button" style={styles.menuItem} onClick={() => handleCardAction(ticket)} disabled={busyHere || saving}>
            {busyHere && busyAction?.action === closeAction ? (
              <Loader2 size={13} className="admin-messages-spin" />
            ) : null}
            {isTicketClosed ? "Open" : "Close"}
          </button>
          <button
            type="button"
            style={{
              ...styles.menuItem,
              ...(editModeFor === ticket._id ? styles.menuItemActive : {}),
            }}
            onClick={() => toggleEditMode(ticket)}
            disabled={busyHere}
          >
            <Pencil size={13} />
            {editModeFor === ticket._id ? "Exit Edit" : "Edit"}
          </button>
          <button
            type="button"
            style={{ ...styles.menuItem, ...styles.menuItemDanger }}
            onClick={() => handleDelete(ticket)}
            disabled={busyHere}
          >
            {busyHere && busyAction?.action === "delete" ? <Loader2 size={13} className="admin-messages-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
          {hasStoredEmail(ticket) && (
            <button type="button" style={styles.menuItem} onClick={() => { handleResend(ticket); }} disabled={busyHere}>
              {busyHere && busyAction?.action === "resend" ? <Loader2 size={13} className="admin-messages-spin" /> : <RotateCcw size={13} />}
              Resend
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
              const busyHere = busyTicketId === ticket._id;
              const quickTarget: "open" | "close" = isTicketClosed ? "open" : "close";
              return (
                <div key={ticket._id} style={styles.cardWrap}>
                  {/* ONE ticket = ONE self-contained compact card: status, source,
                      customer name, subject, created date/time + ⋮ menu only.
                      Full client details live in the Client Details section (no
                      duplicate info). Body/company/email/phone/Client-ID are NOT
                      in the card. */}
                  <div
                    className={`query-ticket-row${selected ? " query-ticket-active" : ""}`}
                    style={styles.ticketCard}
                  >
                    <div style={styles.cardHeaderRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                        <span style={styles.cardCategory}>Query</span>
                        {ticket.requestId && (
                          <span style={styles.cardRequestId} title="Request ID">
                            {getRequestLabel(ticket)}
                          </span>
                        )}
                      </div>
                      <div style={styles.cardHeaderRight}>
                        {ticket.hasNewClientReply && (
                          <span style={styles.unreadDot} title="New client reply" aria-label="New client reply" />
                        )}
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

                    <button
                      type="button"
                      onClick={() => handleSelectTicket(ticket)}
                      style={styles.cardBody}
                      aria-label={`Open conversation: ${ticket.subject}`}
                    >
                      <div style={styles.cardStatusRow}>
                        {ticketStatusChip(ticket)}
                        <span
                          style={styles.cardChip}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => openInfoMenu(event, ticket._id, "source")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              openInfoMenu(event, ticket._id, "source");
                            }
                          }}
                          title="View source information"
                        >
                          {getSourceLabel(ticket)}
                        </span>
                        {editModeFor === ticket._id ? (
                          <select
                            style={styles.prioritySelect}
                            value={ticket.priority || "medium"}
                            onChange={(event) => {
                              const newPriority = (event.target.value ?? "").trim().toLowerCase();
                              const priorityValues = ["low", "medium", "high", "urgent"];
                              if (!priorityValues.includes(newPriority)) return;
                              const storedValue = newPriority === "urgent" ? "high" : newPriority;
                              if (storedValue === String(ticket.priority)) return;
                              setSaving(true);
                              const token = typeof window !== "undefined" ? getToken() : "";
                              fetch(`/api/tickets/${ticket._id}`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                },
                                body: JSON.stringify({ priority: storedValue }),
                              })
                                .then(async (res) => {
                                  if (!res.ok) {
                                    return res.json().then((data) => {
                                      throw new Error(data.message || "Priority update failed");
                                    });
                                  }
                                  showNotice("success", `Priority updated to ${newPriority === "urgent" ? "High" : newPriority}.`);
                                  // Start 3-second auto-lock timer
                                  const timer = setTimeout(() => {
                                    setEditModeFor(null); // Exit edit mode after 3 seconds
                                  }, 3000);
                                  await refresh();
                                  // Cleanup timer on unmount
                                  return () => clearTimeout(timer);
                                })
                                .catch((error: any) => {
                                  showNotice("error", error?.message || "Priority update failed.");
                                })
                                .finally(() => setSaving(false));
                            }}
                            title="Change priority (Edit mode)"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        ) : (
                          <span
                            style={styles.cardChip}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => openInfoMenu(event, ticket._id, "priority")}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                openInfoMenu(event, ticket._id, "priority");
                              }
                            }}
                            title="Priority is locked — use Edit in the ⋮ menu to change it"
                          >
                            <Lock size={9} style={{ marginRight: 3, flexShrink: 0 }} />
                            {getPriorityLabel(ticket.priority)}
                          </span>
                        )}
                      </div>
                      <strong style={styles.cardName} title={requester.name}>
                        {requester.name}
                      </strong>
                      <div style={styles.cardTitle} title={ticket.subject}>
                        {ticket.subject}
                      </div>
                      <div style={styles.cardTimeRow}>
                        <Clock3 size={11} color="var(--text-muted)" />
                        <span style={styles.cardTime}>{formatDate(ticket.createdAt)}</span>
                      </div>
                    </button>
                  </div>
                  {renderConversationMenu(ticket)}
                  {renderInfoPopover(ticket)}
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
  {/* R01 skin-scope fix: the section NO LONGER carries the chat-skin tokens —
      the active skin is scoped to the Messenger Chat card ONLY, so the rest of
      the Query Inbox keeps its own admin theme (pre-R04 values). The shared
      CHAT_SURFACE_CSS stays injected here; its rules are all scoped under
      `.ws-chat-surface`, which now lives on the messenger card below. */}
  <style dangerouslySetInnerHTML={{ __html: CHAT_SURFACE_CSS }} />
<header className="qib-topbar">
               <button type="button" onClick={() => router.push("/admin/dashboard")} style={styles.backBtn} title="Back to Messages">
                 <ChevronLeft size={16} />
                 Back to Messages
               </button>
               <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<img
                  src={chatLogo.url}
                  alt="Websmith"
                   style={{
                     height: "28px",
                     width: "auto",
                     display: "block",
                   }}
                 />
                 <h2 style={styles.topbarTitle}>Query Conversation</h2>
               </div>
               {selectedTicket && (
                 <>
                   <div style={styles.topbarSpacer} />
                   <span style={selectedTicket.status === "closed" ? styles.topbarDotClosed : styles.topbarDotOpen} />
                   <span style={styles.topbarStatusText}>{selectedTicket.status === "closed" ? "Closed" : "Open"}</span>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flexWrap: "wrap" }}>
                    <h3 style={styles.convSubject}>{selectedTicket.subject}</h3>
                    <span
                      style={styles.convRequestId}
                      title="Request ID (customer-facing reference)"
                    >
                      {getRequestLabel(selectedTicket)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span>{getRequester(selectedTicket).name}</span>
                    <span>·</span>
                    <span>{getRequester(selectedTicket).email || getRequester(selectedTicket).subtitle}</span>
                    {getRequester(selectedTicket).callingPhone && (
                      <>
                        <span>·</span>
                        <a href={`tel:${getRequester(selectedTicket).callingPhone.replace(/[^\d+]/g, "")}`} style={{ color: "#007AFF", textDecoration: "none", fontWeight: 500 }}>
                          📞 {getRequester(selectedTicket).callingPhone}
                        </a>
                      </>
                    )}
                    {getRequester(selectedTicket).whatsappPhone && (
                      <>
                        <span>·</span>
                        <a href={`https://wa.me/${getRequester(selectedTicket).whatsappPhone.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#128C7E", textDecoration: "none", fontWeight: 500 }}>
                          💬 WhatsApp
                        </a>
                      </>
                    )}
                    {getRequester(selectedTicket).preferredContactDate && (
                      <>
                        <span>·</span>
                        <span style={{ color: "#FF9500", fontWeight: 600 }}>
                          📅 {getRequester(selectedTicket).preferredContactDate}
                        </span>
                      </>
                    )}
                    {getRequester(selectedTicket).adminCallTimeIST && (
                      <>
                        <span>·</span>
                        <span style={{ color: "#34C759", fontWeight: 700, backgroundColor: "rgba(52, 199, 89, 0.1)", padding: "2px 8px", borderRadius: "6px" }}>
                          📞 Call at (IST): {getRequester(selectedTicket).adminCallTimeIST}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div style={styles.convActions}>
                  {/* Shared skin changer (same 10 skins as /chat/[id]) */}
                  <ChatSkinPicker activeSkinId={skinId} onSelect={handleSkinSelect} />
                  <button
                    type="button"
                    aria-label="Copy chat link"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCopyChatLink(selectedTicket);
                    }}
                    disabled={busyAction?.ticketId === selectedTicket._id && busyAction?.action === "chat"}
                    style={styles.copyLinkBtn}
                  >
                    <Copy size={14} /> Copy Chat Link
                  </button>
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


            {/* R01 skin scope: the Messenger Chat card is the ONLY area themed
                by the active chat skin (class + data-ws-skin + --sk-* vars).
                Everything outside this div stays on the admin theme. */}
            <div
              className="ws-chat-card ws-chat-surface"
              data-ws-skin={activeSkin.id}
              style={{ ...styles.chatCard, ...(activeSkin.vars as React.CSSProperties) }}
            >
              <div className="qib-chat-label-row">
                <span className="qib-chat-label">Messenger Chat</span>
                <span className="qib-chat-hint">Client messages · Admin messages</span>
              </div>
              <div className="qib-chat-scroll ws-chat-scroll" ref={chatScrollRef} onScroll={() => { closeMenu(); handleChatScroll(); }}>
                {threadLoading && !threadMessages ? (
                  <p style={{ ...styles.emptyText, color: "var(--sk-subtitle)" }}>
                    <Loader2 size={13} className="admin-messages-spin" /> Loading messages...
                  </p>
                ) : threadMessages ? (
                  <>
                    {threadMessages.map((m) => {
                      const isClient = m.senderType === "client";
                      return (
                        <div
                          key={m.id}
                          className="ws-msg"
                          style={{
                            ...styles.bubbleRow,
                            ...(isClient ? styles.bubbleRowClient : styles.bubbleRowAdmin),
                          }}
                        >
                          <div
                            className={isClient ? "ws-bubble-in" : "ws-bubble-out"}
                            style={isClient ? styles.bubbleClient : styles.bubbleAdmin}
                          >
                              <p style={styles.bubbleSender}>
                               {isClient ? clientFirstName(selectedTicket) : adminDisplayName(m.senderName)}
                              </p>
                            <p
                              className="qib-msg-text"
                              style={styles.bubbleText}
                              dangerouslySetInnerHTML={{
                                __html: renderMessageHtml(isClient && m.source === "email" ? cleanClientBody(m.message) : m.message),
                              }}
                            />
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
                            {isClient ? (
                              <div style={styles.bubbleMeta}>
                                <span style={styles.bubbleTime}>
                                  {formatTimeOnly(m.createdAt)} · {clientSourceLabel(m.source)}
                                </span>
                              </div>
                            ) : (
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
                            )}
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
                {getRequester(selectedTicket).callingPhone && (
                  <div style={styles.metaItem}>
                    <Phone size={14} color="#007AFF" />
                    <a
                      href={`tel:${getRequester(selectedTicket).callingPhone.replace(/[^\d+]/g, "")}`}
                      style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      title="Call client"
                    >
                      <span style={{ fontWeight: 600 }}>{getRequester(selectedTicket).callingPhone}</span>
                      <span style={{ fontSize: "11px", color: "#007AFF" }}>(Call)</span>
                    </a>
                  </div>
                )}
                {getRequester(selectedTicket).whatsappPhone && (
                  <div style={styles.metaItem}>
                    <MessageSquare size={14} color="#25D366" />
                    <a
                      href={`https://wa.me/${getRequester(selectedTicket).whatsappPhone.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#128C7E", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
                      title="Open WhatsApp chat"
                    >
                      <span>{getRequester(selectedTicket).whatsappPhone}</span>
                      <span style={{ fontSize: "11px", backgroundColor: "rgba(37, 211, 102, 0.12)", color: "#128C7E", padding: "1px 6px", borderRadius: "4px" }}>WhatsApp</span>
                    </a>
                  </div>
                )}
                {getRequester(selectedTicket).preferredContactDate && (
                  <div style={styles.metaItem}>
                    <Calendar size={14} color="#FF9500" />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <span>Preferred Contact:</span>
                      <strong style={{ color: "var(--text-primary)" }}>{getRequester(selectedTicket).preferredContactDate}</strong>
                    </span>
                  </div>
                )}
                {getRequester(selectedTicket).adminCallTimeIST && (
                  <div style={styles.metaItem}>
                    <Clock3 size={14} color="#34C759" />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <span>Call at (IST):</span>
                      <strong style={{ color: "#34C759" }}>{getRequester(selectedTicket).adminCallTimeIST}</strong>
                    </span>
                  </div>
                )}
                <div style={styles.metaItem}>
                  <Briefcase size={14} color="#007AFF" />
                  <span>{getRequester(selectedTicket).subtitle}</span>
                </div>
                <div style={styles.metaItem}>
                  <Hash size={14} color="#007AFF" />
                  <span>Request ID: {getRequestLabel(selectedTicket)}</span>
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
              {/* R04 FINAL — Reply Thread: carries the SAME active chat-skin
                  token scope as the Messenger Chat above (ws-chat-surface +
                  data-ws-skin + --sk-* vars), so it re-themes live with every
                  skin change — one unified messenger system. Presentation
                  only; the composer logic/options are unchanged. */}
              <div
                className="ws-chat-surface qib-reply-thread"
                data-ws-skin={activeSkin.id}
                style={{ ...styles.replyCard, ...(activeSkin.vars as React.CSSProperties) }}
              >
                <div style={styles.replyTop}>
                  <label style={styles.replyLabel}>Reply Thread</label>
                  <span style={styles.replySelectWrap}>
                    <select value={greetingKey} onChange={(event) => handleGreetingChange(event.target.value)} className="qib-reply-select" style={styles.replySelect} disabled={templates.length === 0} title="Greeting Template">
                      <option value="">Select a template...</option>
                      {replyTemplates.map((template) => (
                        <option key={template.key} value={template.key}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} aria-hidden="true" />
                  </span>
                </div>
                <div style={styles.replyBody}>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    style={{ ...styles.replyTextarea, ...(isClosed ? styles.textareaDisabled : {}) }}
                    placeholder={isClosed ? "This query is closed and read-only." : "Write a reply to continue the conversation..."}
                    disabled={isClosed}
                  />
                  {greetingKey && replyPreview && (
                    <div style={styles.replyPreview}>
                      <div style={styles.replyPreviewHead}>
                        <span style={styles.replyPreviewLabel}>Resolved preview</span>
                        <span style={styles.replyPreviewHint}>Template placeholders are auto-filled with real client data.</span>
                      </div>
                      <pre className="ws-chat-scroll" style={styles.replyPreviewBody}>{replyPreview}</pre>
                    </div>
                  )}
                  <div style={styles.replyFooter}>
                    <button type="button" onClick={handleReply} style={styles.replySendBtn} disabled={saving || !reply.trim() || isClosed}>
                      <Send size={14} />
                      Send Reply
                    </button>
                  </div>
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
                      Temporary credentials: <strong>••••••••</strong> (masked — revealed only after your password is verified, never automatically)
                    </p>
                    <p style={styles.portalHint}>
                      Credentials are emailed only when you click Send Credentials — never automatically.
                    </p>
                    {account?.hasTemporaryPassword && (
                      <div style={styles.portalRevealBox}>
                        {revealedPassword ? (
                          <div style={styles.revealResult}>
                            <span style={styles.revealPasswordText} title="Temporary password">
                              {revealedPassword}
                            </span>
                            <button
                              type="button"
                              style={styles.revealCopyBtn}
                              onClick={() => {
                                navigator.clipboard
                                  .writeText(revealedPassword)
                                  .then(() => showNotice("success", "Temporary password copied."))
                                  .catch(() => showNotice("error", "Could not copy the temporary password."));
                              }}
                            >
                              Copy
                            </button>
                            <button type="button" style={styles.revealCancelBtn} onClick={() => setRevealedPassword(null)}>
                              Hide
                            </button>
                          </div>
                        ) : revealPrompt ? (
                          <div style={styles.revealPromptBox}>
                            <input
                              type="password"
                              value={revealPasswordInput}
                              onChange={(event) => setRevealPasswordInput(event.target.value)}
                              placeholder="Enter your password to reveal"
                              style={styles.revealInput}
                              autoComplete="current-password"
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleRevealPassword();
                                }
                              }}
                            />
                            <button
                              type="button"
                              style={styles.revealGoBtn}
                              onClick={handleRevealPassword}
                              disabled={revealBusy || !revealPasswordInput.trim()}
                            >
                              {revealBusy ? <Loader2 size={12} className="admin-messages-spin" /> : null}
                              Reveal
                            </button>
                            <button type="button" style={styles.revealCancelBtn} onClick={() => { setRevealPrompt(false); setRevealPasswordInput(""); setRevealError(null); }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button type="button" style={styles.revealLinkBtn} onClick={() => { setRevealPrompt(true); setRevealError(null); }}>
                            <ShieldCheck size={12} />
                            Reveal Temporary Password
                          </button>
                        )}
                        {revealError && <p style={styles.revealError}>{revealError}</p>}
                      </div>
                    )}
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
  copyLinkBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
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
  // ONE ticket = ONE self-contained card. Everything — query label, ⋮ menu,
  // identity, date/time, status, category/details, existing info and actions —
  // is inside this single bordered container (Active and Closed share it).
  ticketCard: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "14px",
  },
  cardHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "8px 10px 6px 12px",
    borderBottom: "1px solid var(--border-color)",
  },
  cardCategory: {
    fontSize: "10px",
    fontWeight: 800,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  cardRequestId: {
    fontSize: "9px",
    fontWeight: 700,
    fontFamily: "var(--font-mono, monospace)",
    color: "#007AFF",
    backgroundColor: "rgba(0,122,255,0.08)",
    border: "1px solid #007aff22",
    borderRadius: "999px",
    padding: "1px 7px",
    whiteSpace: "nowrap",
  },
  convRequestId: {
    flexShrink: 0,
    fontSize: "11px",
    fontWeight: 700,
    fontFamily: "var(--font-mono, monospace)",
    color: "#007AFF",
    backgroundColor: "rgba(0,122,255,0.08)",
    border: "1px solid #007aff33",
    borderRadius: "999px",
    padding: "3px 10px",
    whiteSpace: "nowrap",
  },
  cardHeaderRight: { display: "flex", alignItems: "center", gap: "6px" },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    width: "100%",
    flex: "1 1 auto",
    minWidth: 0,
  },
  cardIdentity: { display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 },
  cardName: {
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardEmail: {
    color: "var(--text-secondary)",
    fontSize: "11px",
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardTimeRow: { display: "flex", alignItems: "center", gap: "5px" },
  cardTime: { fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" },
  cardStatusRow: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" },
  cardChip: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "999px",
    padding: "5px 10px",
    whiteSpace: "nowrap",
    marginLeft: "6px",
  },
  // Priority dropdown (EDIT MODE ONLY): chip-shaped to match the card chips,
  // native arrow removed and replaced with the Websmith-blue chevron, fixed
  // height, readable selected value, consistent with the existing UI.
  prioritySelect: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-primary)",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid #007aff66",
    borderRadius: "999px",
    padding: "5px 24px 5px 10px",
    height: "25px",
    marginLeft: "6px",
    whiteSpace: "nowrap",
    appearance: "none",
    WebkitAppearance: "none",
    cursor: "pointer",
    outline: "none",
    boxSizing: "border-box",
    backgroundImage: `url("${PRIORITY_SELECT_ARROW}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 9px center",
    backgroundSize: "10px 10px",
  },
  cardTitle: {
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
  cardDesc: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "11px",
    lineHeight: 1.45,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  cardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "7px 12px",
    borderTop: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  cardFooterInfo: {
    fontSize: "10px",
    color: "var(--text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  cardActionOpen: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "1px solid #34c75955",
    backgroundColor: "rgba(52,199,89,0.1)",
    color: "#1d7a31",
    borderRadius: "8px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  cardActionClose: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "1px solid #ff3b3044",
    backgroundColor: "rgba(255,59,48,0.08)",
    color: "#c81e12",
    borderRadius: "8px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
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
  menuItemActive: { backgroundColor: "rgba(0,122,255,0.08)", color: "#007AFF" },
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
  iconBtnLabel: { whiteSpace: "nowrap" },
  chatCard: {
    flexShrink: 0,
    // Compact WhatsApp-style footprint: the thread stays readable but the card
    // no longer dominates the conversation pane. Colors come from the shared
    // chat-skin tokens (this card carries the skin scope: ws-chat-surface +
    // data-ws-skin + --sk-* vars — the ONLY themed area on this page).
    height: "clamp(220px, 34dvh, 420px)",
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--sk-card-border)",
    borderRadius: "12px",
    backgroundColor: "var(--sk-body-bg)",
    overflow: "hidden",
  },
  bubbleRow: { display: "flex", flexShrink: 0 },
  bubbleRowClient: { justifyContent: "flex-start" },
  bubbleRowAdmin: { justifyContent: "flex-end" },
  bubbleClient: {
    maxWidth: "76%",
    border: "1px solid var(--sk-client-border)",
    borderRadius: "13px",
    borderTopLeftRadius: "5px",
    padding: "7px 10px",
    backgroundColor: "var(--sk-client-bg)",
  },
  bubbleAdmin: {
    maxWidth: "76%",
    border: "1px solid var(--sk-admin-border)",
    borderRadius: "13px",
    borderTopRightRadius: "5px",
    padding: "7px 10px",
    backgroundColor: "var(--sk-admin-bg)",
  },
  bubbleSender: { margin: 0, fontSize: "10px", fontWeight: 700, color: "var(--sk-sender)" },
  bubbleText: {
    margin: "3px 0",
    fontSize: "12px",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--sk-text)",
  },
  bubbleMeta: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "3px" },
  bubbleAttachments: { display: "flex", flexWrap: "wrap", gap: "6px 8px", marginTop: "6px" },
  attachmentLink: {
    fontSize: "11px",
    color: "var(--sk-link)",
    textDecoration: "underline",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  bubbleTime: { fontSize: "10px", color: "var(--sk-time)" },
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
  timelineDot: { width: "9px", height: "9px", borderRadius: "999px", backgroundColor: "var(--sk-accent)", marginTop: "9px", flexShrink: 0 },
  timelineContent: {
    flex: 1,
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    padding: "12px 14px",
    backgroundColor: "var(--bg-primary)",
  },
  timelineLabel: { margin: 0, color: "var(--sk-accent)", fontSize: "10px", fontWeight: 700, textTransform: "capitalize" },
  timelineMessage: { margin: "4px 0", color: "var(--text-primary)", fontSize: "12px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  timelineRecipient: { margin: "0 0 4px 0", color: "var(--text-secondary)", fontSize: "11px" },
  timelineTime: { margin: 0, color: "var(--text-secondary)", fontSize: "10px" },
  metaCard: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px",
    borderRadius: "12px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  metaItems: { display: "flex", gap: "10px 14px", flexWrap: "wrap" },
  metaItem: { display: "flex", alignItems: "center", gap: "6px", color: "var(--text-primary)", fontSize: "11px", minWidth: 0 },
  sectionLabel: { fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px" },
  composerCard: {
    flexShrink: 0,
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    padding: "12px",
    backgroundColor: "var(--bg-secondary)",
  },
  composerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" },
  greetingSelect: {
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "5px 8px",
    fontSize: "11px",
    fontWeight: 600,
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: "80px",
    resize: "vertical",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "8px 10px",
    outline: "none",
    fontSize: "12px",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  resolutionTextarea: {
    width: "100%",
    minHeight: "100px",
    resize: "vertical",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "8px 10px",
    outline: "none",
    fontSize: "12px",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  textareaDisabled: { opacity: 0.6, cursor: "not-allowed" },
  composerFooter: { display: "flex", justifyContent: "flex-end", marginTop: "8px", gap: "6px" },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    borderRadius: "8px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  // R04 FINAL — Reply Thread presentation. The card carries the SAME active
  // chat-skin token scope as the Messenger Chat above (ws-chat-surface +
  // data-ws-skin + --sk-* vars), so background/border/text/input/dropdown/
  // button all follow the selected skin live — one unified messenger system.
  // These dedicated entries are used ONLY here; Client Onboarding and
  // Resolution Summary keep their own composerCard/greetingSelect/etc styles.
  replyCard: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--sk-card-border)",
    borderRadius: "13px",
    backgroundColor: "var(--sk-card-bg)",
    boxShadow: "var(--sk-card-shadow)",
    overflow: "hidden",
  },
  replyTop: {
    flexShrink: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    padding: "9px 12px",
    borderBottom: "1px solid var(--sk-header-border)",
    backgroundColor: "var(--sk-header-bg)",
  },
  replyLabel: {
    fontSize: "11px",
    fontWeight: 800,
    color: "var(--sk-title)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  replySelectWrap: { position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 },
  replySelect: {
    appearance: "none",
    WebkitAppearance: "none",
    border: "1px solid var(--sk-input-border)",
    borderRadius: "8px",
    backgroundColor: "var(--sk-input-bg)",
    color: "var(--sk-input-text)",
    padding: "5px 24px 5px 9px",
    fontSize: "11px",
    fontWeight: 600,
    outline: "none",
    cursor: "pointer",
  },
  replyBody: { display: "flex", flexDirection: "column", gap: "9px", padding: "10px 12px 12px" },
  replyTextarea: {
    width: "100%",
    minHeight: "88px",
    resize: "vertical",
    borderRadius: "10px",
    border: "1px solid var(--sk-input-border)",
    backgroundColor: "var(--sk-input-bg)",
    color: "var(--sk-input-text)",
    padding: "9px 11px",
    outline: "none",
    fontSize: "12px",
    lineHeight: 1.55,
    boxSizing: "border-box",
  },
  replyPreview: {
    border: "1px solid var(--sk-card-border)",
    borderRadius: "10px",
    backgroundColor: "var(--sk-body-bg)",
    overflow: "hidden",
  },
  replyPreviewHead: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "7px 10px",
    borderBottom: "1px solid var(--sk-header-border)",
    backgroundColor: "var(--sk-header-bg)",
  },
  replyPreviewLabel: { fontSize: "11px", fontWeight: 700, color: "var(--sk-title)" },
  replyPreviewHint: { fontSize: "10px", color: "var(--sk-subtitle)" },
  replyPreviewBody: {
    margin: 0,
    padding: "9px 10px",
    fontSize: "11px",
    lineHeight: 1.55,
    color: "var(--sk-text)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "140px",
    overflow: "auto",
  },
  replyFooter: { display: "flex", justifyContent: "flex-end" },
  replySendBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "none",
    background: "var(--sk-send-bg)",
    color: "#FFFFFF",
    borderRadius: "8px",
    padding: "7px 13px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "var(--sk-send-shadow)",
  },
  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    borderRadius: "8px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  topbarStatusText: { fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" },
  iconBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  iconBtnBusy: { opacity: 0.6, cursor: "wait" },
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
  portalRevealBox: {
    marginTop: "10px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #ff9f0a44",
    backgroundColor: "rgba(255,159,10,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  revealResult: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  revealPasswordText: {
    fontFamily: "monospace",
    fontSize: "13px",
    fontWeight: 700,
    color: "#1d7a31",
    backgroundColor: "var(--bg-primary)",
    border: "1px dashed #34c75966",
    borderRadius: "8px",
    padding: "4px 10px",
    wordBreak: "break-all",
  },
  revealCopyBtn: {
    border: "1px solid #34c75955",
    backgroundColor: "rgba(52,199,89,0.1)",
    color: "#1d7a31",
    borderRadius: "8px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  },
  revealCancelBtn: {
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-secondary)",
    borderRadius: "8px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  revealPromptBox: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  revealInput: {
    flex: "1 1 180px",
    border: "1px solid var(--border-color)",
    borderRadius: "10px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "8px 10px",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
  },
  revealGoBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #007aff",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  revealLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    alignSelf: "flex-start",
    border: "none",
    backgroundColor: "transparent",
    color: "#007AFF",
    padding: "2px 0",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  revealError: { margin: 0, fontSize: "11px", fontWeight: 600, color: "#c81e12", lineHeight: 1.5 },
  // Get in Touch / priority info panel — FIXED and CENTERED relative to the
  // viewport (left/top 50% + translate), so it is always fully inside the
  // visible screen, never clipped left/right, never off-screen. Width is
  // capped to the viewport on small screens and height scrolls internally.
  infoPanel: {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(380px, calc(100vw - 32px))",
    maxHeight: "min(72dvh, 460px)",
    overflowY: "auto",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
    padding: "0 0 10px",
    display: "flex",
    flexDirection: "column",
    zIndex: 30,
  },
  infoPanelTitle: {
    position: "sticky",
    top: 0,
    textAlign: "center",
    fontSize: "11px",
    fontWeight: 800,
    color: "var(--text-primary)",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    backgroundColor: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border-color)",
    borderTopLeftRadius: "14px",
    borderTopRightRadius: "14px",
    padding: "12px 14px",
  },
  infoPopRow: { display: "flex", flexDirection: "column", gap: "3px", padding: "10px 16px", borderTop: "1px solid var(--border-color)" },
  infoPopLabel: { fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" },
  infoPopValue: { fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word" },
  infoPopText: { fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.55, padding: "12px 16px", borderTop: "1px solid var(--border-color)" },
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