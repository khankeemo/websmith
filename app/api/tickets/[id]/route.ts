import { apiHandler, jsonBody, json, badRequest, forbidden, notFound, parseObjectId } from "@/lib/server/api";

const MAX_LEN = 300;

export const PATCH = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const update: any = {};
  const changes: string[] = [];

  const applyPriority = (field: "priority", label: string) => {
    if (body[field] === undefined) return;
    const priorityValues = ["low", "medium", "high", "urgent"];
    const value = String(body[field] ?? "").trim().toLowerCase();
    if (!priorityValues.includes(value)) {
      throw badRequest(`${label} must be one of: low, medium, high, urgent`);
    }
    // Map "urgent" to "high" for backend storage
    const storedValue = value === "urgent" ? "high" : value;
    if (String(ticket[field] ?? "") !== storedValue) {
      update[field] = storedValue;
      changes.push(`${label}: ${storedValue || "(empty)"}`);
    }
  };

  const apply = (field: "subject" | "contactName" | "contactEmail" | "contactCompany", label: string) => {
    if (body[field] === undefined) return;
    const value = String(body[field] ?? "").trim();
    if (value.length > MAX_LEN) {
      throw badRequest(`${label} is too long`);
    }
    if (String(ticket[field] ?? "") !== value) {
      update[field] = value;
      changes.push(`${label}: ${value || "(empty)"}`);
    }
  };

  applyPriority("priority", "Priority");
  apply("subject", "Subject");
  apply("contactName", "Name");
  apply("contactEmail", "Email");
  apply("contactCompany", "Company");

  if (Object.keys(update).length === 0) {
    return json({ data: { ...ticket, _id: ticket._id.toString() }, changed: [] });
  }

  const now = new Date();
  update.updatedAt = now;
  const history = ticket.history ?? [];
  history.push({
    action: "edited",
    actorRole: "admin",
    message: `Edited by admin: ${changes.join("; ")}`,
    createdAt: now,
  });
  update.history = history;

  const result = await db.collection("tickets").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: { ...result, _id: result._id.toString() }, changed: changes });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  // Soft delete (Phase 11): the conversation is removed from the active Inbox
  // but its full history is retained and never orphaned. Real customer history
  // is never permanently destroyed by the UI.
  if (ticket.deletedAt) {
    return json({ message: "Conversation already deleted", data: { id: ticket._id.toString(), already: true } });
  }

  const now = new Date();
  const history = ticket.history ?? [];
  history.push({
    action: "deleted",
    actorRole: "admin",
    message: "Conversation deleted from the Query Inbox by admin",
    createdAt: now,
  });

  const result = await db.collection("tickets").findOneAndUpdate(
    { _id: id },
    {
      $set: {
        deletedAt: now,
        deletedBy: user._id.toString(),
        status: "closed",
        chatStatus: "closed",
        closedAt: now,
        history,
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );
  return json({ message: "Conversation deleted", data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });
