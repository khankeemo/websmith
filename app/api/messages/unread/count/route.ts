import { apiHandler, json } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  const count = await db.collection("messages").countDocuments({
    receiverId: user._id.toString(),
    status: { $ne: "read" },
  });
  return json({ data: { count } });
}, { auth: "required" });
