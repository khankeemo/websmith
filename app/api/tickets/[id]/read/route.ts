import { apiHandler, json, notFound, parseObjectId } from "@/lib/server/api";

// ============================================================================
// MARK CONVERSATION READ (Query Inbox, AWS-01 R01)
//
// Stamps `adminReadAt` on the ticket so the unread indicator
// (`lastClientReplyAt > adminReadAt`) clears after an admin opens the
// conversation. Any authenticated user who can reach the ticket may mark it
// read (the list scoping already restricts non-admins to their own rows).
// ============================================================================
export const POST = apiHandler(async ({ db, params }) => {
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const now = new Date();
  const result = await db.collection("tickets").findOneAndUpdate(
    { _id: id },
    { $set: { adminReadAt: now, updatedAt: now } },
    { returnDocument: "after" }
  );
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });
