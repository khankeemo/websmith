import { apiHandler, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  if (id.equals(user._id)) return json({ success: false, error: "You cannot delete your own account", message: "You cannot delete your own account" }, { status: 400 });
  const result = await db.collection("users").deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("User not found");
  return json({ message: "User deleted" });
}, { auth: "required" });
