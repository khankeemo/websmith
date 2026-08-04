import { apiHandler, json } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, request, user }) => {
  const me = user._id.toString();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return json({ data: [] });
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const messages = await db
    .collection("messages")
    .find({
      $and: [
        { content: regex },
        { $or: [{ senderId: me }, { receiverId: me }] },
      ],
    })
    .sort({ timestamp: -1 })
    .limit(50)
    .toArray();
  return json({ data: messages.map((m) => ({ ...m, _id: m._id.toString() })) });
}, { auth: "required" });
