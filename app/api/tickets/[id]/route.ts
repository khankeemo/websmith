import { apiHandler, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const result = await db.collection("tickets").deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Ticket not found");
  return json({ message: "Ticket deleted" });
}, { auth: "required" });
