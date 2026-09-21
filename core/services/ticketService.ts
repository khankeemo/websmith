import API from "./apiService";
import { getToken } from "../../lib/auth";

/**
 * Resilient same-origin fetch for NON-CRITICAL Query Inbox calls (mark-read,
 * client-account). The global axios response interceptor (apiService.ts)
 * REPLACES the whole page with /login?reason=session-expired on any 401 whose
 * message matches a session failure ("Session invalid. Please log in again.")
 * — correct for page-lifeline requests, but these two fire on every
 * conversation selection and must NEVER be able to kill the page: their
 * failure is best-effort by design and already swallowed by the UI. Same
 * endpoint, same Authorization header, same response shape — transport only.
 */
async function quietFetch(path: string, init?: RequestInit): Promise<any> {
  const token = typeof window !== "undefined" ? getToken() : "";
  const response = await fetch(`${window.location.origin}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body (e.g. HTML error page): surface as a transport failure.
  }
  if (!response.ok) {
    const error: any = new Error(payload?.message || `Request failed (${response.status})`);
    error.response = { status: response.status, data: payload };
    throw error;
  }
  return payload;
}

/** Resolve stored ticket file paths for <img src> (same-origin `/api` in dev). */
export const resolveTicketFileUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window === "undefined") return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${window.location.origin}${path}`;
};

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface TicketHistoryEntry {
  action: string;
  actorRole: "admin" | "client" | "developer" | "system";
  message?: string;
  attachments?: Array<{ name: string; url: string }>;
  emailDelivered?: boolean;
  emailError?: string;
  // Email snapshots captured at send time (used by Resend / Phase 13).
  recipient?: string;
  emailSubject?: string;
  emailBody?: string;
  templateKey?: string;
  templateName?: string;
  accountState?: string;
  accountId?: string;
  originalAction?: string;
  createdAt: string;
}

/** Canonical two-way conversation message (Query Inbox thread bubbles). */
export interface ThreadMessage {
  id: string;
  senderType: "client" | "admin" | "developer";
  direction: "inbound" | "outbound";
  senderEmail?: string;
  senderName?: string;
  recipientEmail?: string;
  message: string;
  createdAt: string;
  source?: "public_contact" | "portal" | "email" | "admin_reply" | "resolution_email" | "onboarding_email" | "resend" | "chat" | "welcome_email";
  deliveryStatus?: "sent" | "failed" | "not_sent";
  deliveryError?: string;
  providerMessageId?: string;
  // Query Ticket bridge dedupe key: `cm:<conversation_messages.id>` for client
  // inbound messages synchronized from the universal email system (R01 Phase 2).
  sourceRef?: string;
  inReplyTo?: string[];
  references?: string[];
  // Inbound email attachments (Query Inbox). Stored in the shared `uploads`
  // collection and linked to the message so the Messenger Chat can render a
  // compact indicator. Outgoing admin attachments are tracked in `history`.
  attachments?: Array<{ name: string; url: string; size?: number; contentType?: string }>;
}

export interface Ticket {
  _id: string;
  source?: "client_portal" | "public_contact";
  /** Customer-facing request reference (WSD-XXXXXX) — shown instead of the
   *  internal ObjectId everywhere a customer/admin references the request.
   *  Absent on pre-WSD tickets (those keep their legacy id). */
  requestId?: string;
  clientId: {
    _id: string;
    name: string;
    email: string;
  } | string | null;
  clientEmail?: string;
  contactName?: string;
  contactEmail?: string;
  contactCompany?: string;
  contactPhone?: string;
  contactCallingPhone?: string;
  contactWhatsappPhone?: string;
  preferredContactDate?: string;
  preferredContactTime?: string;
  timeZone?: string;
  clientTimeZone?: string;
  adminCallTimeIST?: string;
  developerId?: {
    _id: string;
    name: string;
    email: string;
  } | string | null;
  projectId?: {
    _id: string;
    name: string;
    status: string;
  } | string | null;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: TicketStatus;
  chatStatus?: "open" | "closed";
  resolution?: string;
  closedAt?: string | null;
  archiveAfter?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  clientAccountSource?: "created" | "existing";
  clientAccountEmail?: string;
  clientCustomId?: string;
  onboardingSentAt?: string | null;
  attachments?: Array<{
    _id?: string;
    name: string;
    url: string;
  }>;
  history?: TicketHistoryEntry[];
  messages?: ThreadMessage[];
  lastClientReplyAt?: string | null;
  adminReadAt?: string | null;
  hasNewClientReply?: boolean;
  createdAt: string;
  updatedAt?: string;
  emailDelivered?: boolean;
  emailError?: string;
  /** Server-computed Resend flag on lean card list items (`fields=card`): the
   *  full history array is NOT downloaded with the card, so the presence of a
   *  stored email snapshot is computed server-side instead. */
  hasStoredEmail?: boolean;
}

export const getTickets = async () => {
  const response = await API.get("/tickets");
  return response.data.data as Ticket[];
};

/** Paged Query Inbox list (Phase 10: max 15 initial + Load More). Pass
 *  `fields: "card"` to receive ONLY the lean card fields (fast initial load —
 *  the full messages/history payload is fetched per-conversation on open). */
export const getTicketsPaged = async (params: {
  scope?: "active" | "closed";
  page?: number;
  pageSize?: number;
  search?: string;
  fields?: "card";
} = {}) => {
  const response = await API.get("/tickets", {
    params: {
      scope: params.scope || "active",
      page: params.page || 1,
      pageSize: params.pageSize || 15,
      ...(params.search ? { search: params.search } : {}),
      ...(params.fields ? { fields: params.fields } : {}),
    },
  });
  return response.data as {
    data: Ticket[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
};

/**
 * Same list fetch as getTicketsPaged but via quietFetch (transport-only, never
 * page-lifeline): the inbound-email auto-poll re-checks the open thread every
 * 1 second, and a session expiry mid-poll must never let the axios interceptor
 * replace the whole page with /login. Response shape identical. R02: accepts
 * `fields: "card"` too — the every-second card-list sync uses the lean
 * projection over the quiet transport.
 */
export const getTicketsQuiet = async (params: {
  scope?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  fields?: "card";
} = {}) => {
  const query = new URLSearchParams({
    scope: params.scope || "active",
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 15),
  });
   if (params.search) query.set("search", params.search);
   if (params.fields) query.set("fields", params.fields);
  const payload = await quietFetch(`/tickets?${query.toString()}`);
  return payload.data as {
    data: Ticket[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
};

/**
 * Lightweight refresh of ONLY one ticket (the open conversation) via the
 * existing list endpoint's `ids` filter — the Messenger Chat auto-poll uses
 * this every 1 second instead of re-downloading the whole 15-ticket page.
 * quietFetch transport (never page-lifeline), same Ticket shape as the list.
 */
export const getTicketQuiet = async (id: string): Promise<Ticket | null> => {
  const payload = await quietFetch(`/tickets?ids=${encodeURIComponent(id)}`);
  const list = Array.isArray(payload.data) ? (payload.data as Ticket[]) : [];
  return list.find((t) => t._id === id) || null;
};

/**
 * INCREMENTAL message fetch for the open conversation (AWS-01 R01 — FIX
 * /admin/messages REAL-TIME): returns ONLY the messages newer than the cursor
 * (`?after=<ISO timestamp>`) plus lightweight ticket metadata. The Messenger
 * Chat 1-second auto-poll calls this instead of re-downloading the whole
 * conversation every second — the full thread is fetched once on open via
 * getTicketQuiet, deltas only thereafter. quietFetch transport (never
 * page-lifeline). Response shape:
 *   { messages: ThreadMessage[], updatedAt?, lastClientReplyAt?, hasNewClientReply?, status? }
 */
export const getTicketMessages = async (
  id: string,
  after?: string
): Promise<{
  messages: ThreadMessage[];
  updatedAt?: string;
  lastClientReplyAt?: string | null;
  hasNewClientReply?: boolean;
  status?: TicketStatus;
}> => {
  const query = new URLSearchParams();
  if (after) query.set("after", after);
  const payload = await quietFetch(`/tickets/${encodeURIComponent(id)}/messages?${query.toString()}`);
  return payload.data as {
    messages: ThreadMessage[];
    updatedAt?: string;
    lastClientReplyAt?: string | null;
    hasNewClientReply?: boolean;
    status?: TicketStatus;
  };
};

export const createTicket = async (payload: {
  projectId?: string;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high";
  attachments?: Array<{ name: string; url: string }>;
}) => {
  const response = await API.post("/tickets", payload);
  return response.data.data as Ticket;
};

export const createPublicTicket = async (payload: {
  name: string;
  email: string;
  callingPhone?: string;
  whatsappPhone?: string;
  preferredContactDate?: string;
  preferredContactTime?: string;
  timeZone?: string;
  clientTimeZone?: string;
  adminCallTimeIST?: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  source?: string;
  budget?: number | null;
  timeline?: string;
  services?: string[];
  cmsRequirement?: string;
  appPlatform?: string;
}) => {
  const response = await API.post("/tickets/public", payload);
  return response.data.data as Ticket;
};


export const updateTicketStatus = async (
  id: string,
  payload: { status: TicketStatus; resolution?: string; reopenMessage?: string }
) => {
  const response = await API.put(`/tickets/${id}/status`, payload);
  return response.data.data as Ticket;
};

/** Edit a conversation (Phase 11 — ⋮ → Edit). Admin only. */
export const updateTicket = async (
  id: string,
  payload: { subject?: string; contactName?: string; contactEmail?: string; contactCompany?: string }
) => {
  const response = await API.patch(`/tickets/${id}`, payload);
  return response.data as { data: Ticket; changed: string[] };
};

/** Soft delete a conversation (Phase 11 — ⋮ → Delete). Admin only. */
export const deleteTicket = async (id: string) => {
  const response = await API.delete(`/tickets/${id}`);
  return response.data as { message: string; data?: { id: string; already?: boolean } };
};

export const uploadTicketImage = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await API.post("/tickets/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data as { url: string; name: string; type: string };
};

export const addTicketReply = async (
  id: string,
  message: string,
  attachments?: Array<{ name: string; url: string }>
) => {
  const response = await API.post(`/tickets/${id}/replies`, {
    message,
    attachments: attachments && attachments.length ? attachments : [],
  });
  return response.data.data as Ticket;
};

export interface ResolutionTemplate {
  key: string;
  name: string;
  category: string;
  subject: string;
  body?: string;
  isActive: boolean;
  isDefault: boolean;
}

export type ClientAccountState = "not_created" | "ready" | "existing";

export interface TicketClientAccount {
  state: ClientAccountState;
  email: string;
  name: string;
  clientId?: string;
  clientCustomId?: string;
  /** Phase 3 — the temporary password exists (encrypted at rest) and can be revealed after admin password verify. */
  hasTemporaryPassword?: boolean;
}

/** Phase 3 — reveal a client's temporary password after verifying the admin's own password. Never shown automatically. */
export const revealClientPassword = async (id: string, adminPassword: string) => {
  const response = await API.post(`/tickets/${id}/reveal-password`, { adminPassword });
  return response.data as { temporaryPassword?: string };
};

export const getResolutionTemplates = async (): Promise<{ data: ResolutionTemplate[]; defaultKey: string }> => {
  const response = await API.get("/tickets/resolution-templates");
  return response.data as { data: ResolutionTemplate[]; defaultKey: string };
};

export const getTicketClientAccount = async (id: string): Promise<TicketClientAccount> => {
  const payload = await quietFetch(`/tickets/${id}/client-account`);
  return payload.data as TicketClientAccount;
};

export type OnboardingResult = {
  accountState: "not_created" | "created" | "existing";
  createdAccount: boolean;
  clientId: string | null;
  clientCustomId?: string;
  temporaryPassword?: string;
  emailDelivered: boolean;
  emailError?: string;
};

/** Client onboarding credential delivery (Phase 3 + Phase 6). Admin only. */
export const sendClientPortalAccess = async (
  id: string,
  payload: { portalUrl?: string } = {}
) => {
  const response = await API.post(`/tickets/${id}/send-client-portal-access`, payload);
  return response.data as OnboardingResult;
};

export const sendResolutionEmail = async (
  id: string,
  payload: {
    resolution: string;
    templateKey?: string;
    portalUrl?: string;
  }
) => {
  const response = await API.post(`/tickets/${id}/send-resolution-email`, payload);
  return response.data as {
    emailDelivered: boolean;
    emailError?: string;
    accountState?: string;
    clientId?: string | null;
    clientCustomId?: string;
  };
};

/** Resend the last stored email snapshot (Phase 13). Admin only. */
export const resendTicketEmail = async (id: string) => {
  const response = await API.post(`/tickets/${id}/resend`);
  return response.data as {
    emailDelivered: boolean;
    emailError?: string;
    recipient?: string;
    subject?: string;
  };
};

/** Mark a conversation read (clears the unread/new-client-reply indicator). */
export const markTicketRead = async (id: string) => {
  const payload = await quietFetch(`/tickets/${id}/read`, { method: "POST" });
  return payload.data as Ticket;
};

/**
 * Generate the SECURE PUBLIC CLIENT MESSENGER CHAT link for a ticket (admin
 * only). The link is a signed token bound to the ticket id + the customer's
 * email; the customer opens their own conversation directly from it.
 */
export const createTicketChatLink = async (id: string, origin?: string) => {
  const response = await API.post(`/tickets/${id}/chat-link`, origin ? { origin } : {});
  return response.data as { url: string };
};

/**
 * Sync processed universal-email customer messages into their tickets (Query
 * Inbox). This is a BRIDGE, not a mail receiver: it reads customer messages
 * ALREADY processed by the universal email system (PostgreSQL
 * communication_conversations / conversation_messages) and appends each one to
 * the client's existing ticket (`messages[]`), so Messenger Chat shows the
 * client's email reply live. Runs on the Messenger Chat auto-poll every 1
 * second while a conversation is open — the transport is quietFetch so the
 * poll is SILENT and can never kill the page (a 401 session expiry is swallowed
 * by the poll, never redirected). Same endpoint, same response shape as always.
 */
export const syncInboundEmail = async () => {
  const payload = await quietFetch(`/tickets/inbound`, { method: "POST" });
  return payload.data as {
    noMailboxes?: boolean;
    message?: string;
    processed: number;
    matched: number;
    duplicate: number;
    senderMismatch: number;
    unmatched: number;
    attachmentsStored: number;
    errors?: string[];
    skipped?: boolean;
  };
};
