import { apiHandler, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const email = String(ticket.contactEmail || ticket.clientEmail || "").trim().toLowerCase();
  const name = String(ticket.contactName || "").trim();

  if (!email) {
    return json({ data: { state: "not_created", email: "", name } });
  }

  const account = await db.collection("users").findOne({ email, role: "client" });
  if (!account) {
    return json({ data: { state: "not_created", email, name } });
  }

  const state = account.isTemporaryPassword ? "ready" : "existing";
  return json({
    data: {
      state,
      email,
      name: name || account.name || "",
      clientId: account._id.toString(),
      clientCustomId: String(account.customId ?? ticket.clientCustomId ?? ""),
      // Phase 3 — Client Onboarding: the temporary password still exists
      // (encrypted at rest) and can be revealed after admin password verify.
      hasTemporaryPassword: Boolean(account.isTemporaryPassword && account.temporaryPasswordEnc),
    },
  });
}, { auth: "required" });
