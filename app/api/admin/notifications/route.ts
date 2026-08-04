import { apiHandler, json, forbidden } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const notifications = await db
    .collection("notifications")
    .find({ recipientId: user._id.toString() })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return json({ data: notifications.map((n) => ({ ...n, _id: n._id.toString() })) });
}, { auth: "required" });
