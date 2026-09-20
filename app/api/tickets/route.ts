import { apiHandler, jsonBody, json, badRequest, ObjectId } from "@/lib/server/api";
import { generateUniqueRequestId } from "@/lib/tickets/email";

// Maximum conversations rendered in the initial Query Inbox view (Phase 10).
// The client-side list loads 15 at a time and exposes a "Load More" button;
// older conversations are never deleted, they are simply paged.
export const QUERY_INBOX_PAGE_SIZE = 15;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

// Searchable text fields (server-side so pagination and search stay consistent).
const SEARCH_FIELDS = [
  "subject",
  "description",
  "contactName",
  "contactEmail",
  "contactCompany",
  "source",
  "requestId",
];

// Lean-card projection (`GET /tickets?fields=card`): the Query Inbox list
// renders only ~8 fields per conversation, so the heavy per-ticket thread
// payload (full `messages[]`, full `history[]` bodies, attachments, resolution)
// is never transferred on the initial load. Only the card fields + the three
// history subfields needed to compute the Resend flag (`hasStoredEmail`) are
// read; the history array itself is stripped from the response. Any consumer
// that does NOT send `fields=card` (e.g. the single-ticket `ids` refresh and
// the client-facing list) keeps the full document — fully backward compatible.
const CARD_PROJECTION: Record<string, 0 | 1> = {
  _id: 1,
  source: 1,
  requestId: 1,
  clientId: 1,
  clientCustomId: 1,
  clientEmail: 1,
  contactName: 1,
  contactEmail: 1,
  contactCompany: 1,
  subject: 1,
  priority: 1,
  status: 1,
  chatStatus: 1,
  lastClientReplyAt: 1,
  adminReadAt: 1,
  createdAt: 1,
  updatedAt: 1,
  "history.recipient": 1,
  "history.emailSubject": 1,
  "history.emailBody": 1,
};

function hasStoredEmailSnapshot(ticket: any): boolean {
  return Boolean(
    (Array.isArray(ticket.history) ? ticket.history : []).some(
      (entry: any) => entry && entry.recipient && entry.emailSubject && entry.emailBody
    )
  );
}

// Unread indicator (server-derived, never trusted to the browser): a
// conversation has a new client reply when the client last replied AFTER the
// admin last read it (adminReadAt). `lastClientReplyAt` is stamped on the
// initial Get in Touch submission and every inbound email reply; `adminReadAt`
// is stamped whenever an admin opens the conversation (`/tickets/[id]/read`)
// or sends a reply / resolution / onboarding / resend email.
export function hasNewClientReply(ticket: any): boolean {
  if (!ticket.lastClientReplyAt) return false;
  const lastClient = new Date(ticket.lastClientReplyAt).getTime();
  if (Number.isNaN(lastClient)) return false;
  if (!ticket.adminReadAt) return true;
  return lastClient > new Date(ticket.adminReadAt).getTime();
}

function buildBaseFilter(user: any): any {
  const filter: any = {};
  if (user.role === "client") {
    filter.$or = [{ clientId: user._id.toString() }, { contactEmail: user.email }];
  } else if (user.role === "developer") {
    filter.developerId = user._id.toString();
  }
  return filter;
}

export const GET = apiHandler(async ({ db, request, user }) => {
  const url = new URL(request.url);

  // Soft-deleted conversations never appear in any inbox view (Phase 11/12).
  const baseFilter: any = buildBaseFilter(user);
  baseFilter.deletedAt = { $exists: false };

  // scope=active (default) shows open/in_progress/resolved; scope=closed shows
  // only closed conversations (which retain their full history).
  const scope = String(url.searchParams.get("scope") || "active");
  if (scope === "closed") {
    baseFilter.status = "closed";
  } else if (scope === "active") {
    baseFilter.status = { $ne: "closed" };
  }

  const search = String(url.searchParams.get("search") || "").trim();
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    // The search must AND with the role scope (client/developer $or) so it can
    // never widen what a non-admin user can see.
    const searchOr = SEARCH_FIELDS.map((field) => ({ [field]: regex }));
    const andClauses: any[] = [];
    if (baseFilter.$or) {
      andClauses.push({ $or: baseFilter.$or });
      delete baseFilter.$or;
    }
    andClauses.push({ $or: searchOr });
    baseFilter.$and = [...(baseFilter.$and || []), ...andClauses];
  }

  // Optional `ids` filter (comma-separated) — lets the Messenger Chat auto-poll
  // re-fetch ONLY the open conversation each second instead of the whole
  // 15-ticket page (lighter payload, same response shape). Applies after the
  // role scope / deletedAt / status scope so it can never widen access. Absent
  // when not provided — fully backward compatible.
  const idsRaw = String(url.searchParams.get("ids") || "").trim();
  if (idsRaw) {
    const oids: ObjectId[] = [];
    for (const rawId of idsRaw.split(",")) {
      const id = rawId.trim();
      if (!id) continue;
      try {
        oids.push(new ObjectId(id));
      } catch {
        // Invalid id: skip (the row simply won't match).
      }
    }
    if (oids.length > 0) {
      baseFilter._id = { $in: oids };
    } else {
      // Every provided id was invalid — return an empty result set.
      baseFilter._id = { $in: [] };
    }
  }

  const hasPagination = url.searchParams.get("page") !== null || url.searchParams.get("pageSize") !== null || url.searchParams.get("limit") !== null;
  if (hasPagination) {
    const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const rawSize = parseInt(url.searchParams.get("pageSize") || url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10);
    const pageSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const fields = String(url.searchParams.get("fields") || "").trim();
    const isCard = fields === "card";

    const total = await db.collection("tickets").countDocuments(baseFilter);
    const query = db
      .collection("tickets")
      .find(baseFilter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    if (isCard) query.project(CARD_PROJECTION);
    const tickets = await query.toArray();
    return json({
      data: tickets.map((t) => {
        const out: any = { ...t, _id: t._id.toString(), hasNewClientReply: hasNewClientReply(t) };
        if (isCard) {
          // The Resend flag is computed server-side; the history array itself is
          // NOT sent with the lean card (its full bodies stay in the DB).
          out.hasStoredEmail = hasStoredEmailSnapshot(t);
          delete out.history;
        }
        return out;
      }),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  }

  // Backward-compatible default: full (active) list for existing consumers.
  const tickets = await db.collection("tickets").find(baseFilter).sort({ updatedAt: -1 }).toArray();
  return json({ data: tickets.map((t) => ({ ...t, _id: t._id.toString(), hasNewClientReply: hasNewClientReply(t) })) });
}, { auth: "required" });

export const POST = apiHandler(async ({ db, request, user }) => {
  const body = await jsonBody(request);
  const subject = String(body.subject ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!subject || !description) throw badRequest("Subject and description are required");
  const now = new Date();
  // Customer-facing request reference (WSD-XXXXXX) — same rule as Get in Touch.
  const requestId = await generateUniqueRequestId(db);
  const doc = {
    source: "client_portal",
    requestId,
    clientId: user._id.toString(),
    contactName: user.name,
    contactEmail: user.email,
    contactCompany: user.company ?? "",
    developerId: null,
    projectId: body.projectId ? String(body.projectId) : null,
    subject,
    description,
    priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
    status: "open",
    chatStatus: "open",
    resolution: null,
    closedAt: null,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    history: [{ action: "created", actorRole: "client", message: "Ticket created", createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("tickets").insertOne(doc);
  return json({ data: { ...doc, _id: result.insertedId.toString() } }, { status: 201 });
}, { auth: "required" });
