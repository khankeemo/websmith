import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

const STATUSES = ["new", "contacted", "closed"];

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const status = body.status;
  if (!STATUSES.includes(status)) return json({ success: false, error: "Invalid status", message: "Invalid status" }, { status: 400 });
  const result = await db.collection("software_inquiries").findOneAndUpdate(
    { _id: id },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) throw notFound("Inquiry not found");
  const { _id, ...rest } = result;
  return json({ data: { ...rest, _id: _id.toString() } });
}, { auth: "required" });
