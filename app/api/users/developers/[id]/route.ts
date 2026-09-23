import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, serialize } from "@/lib/server/api";

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const id = parseObjectId(params.id);
  const update: any = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.email === "string") update.email = body.email.trim().toLowerCase();
  if (typeof body.phone === "string") update.phone = body.phone.trim();
  if (typeof body.company === "string") update.company = body.company.trim();
  if (typeof body.headline === "string") update.headline = body.headline.trim();
  if (typeof body.bio === "string") update.bio = body.bio.trim();
  if (Array.isArray(body.skills)) update.skills = body.skills.map(String);
  if (body.experienceYears !== undefined) update.experienceYears = Number(body.experienceYears);
  if (body.status !== undefined) update.status = body.status;
  if (body.joinedAt !== undefined) update.joinedAt = body.joinedAt || null;
  if (typeof body.published === "boolean") update.published = body.published;
  if (typeof body.avatar === "string") update.avatar = body.avatar.trim();
  update.updatedAt = new Date();

  const existing = await db.collection("users").findOne({ _id: id, role: "developer" });
  if (!existing) throw notFound("Developer not found");
  if (update.email && update.email !== existing.email) {
    const clash = await db.collection("users").findOne({ email: update.email, _id: { $ne: id } });
    if (clash) return json({ success: false, error: "An account with this email already exists", message: "An account with this email already exists" }, { status: 409 });
  }

  const result = await db.collection("users").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: serialize(result) });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  if (id.equals(user._id)) return json({ success: false, error: "You cannot delete your own account", message: "You cannot delete your own account" }, { status: 400 });
  const result = await db.collection("users").deleteOne({ _id: id, role: "developer" });
  if (result.deletedCount === 0) throw notFound("Developer not found");
  return json({ message: "Developer deleted" });
}, { auth: "required" });
