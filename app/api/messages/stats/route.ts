import { apiHandler, json } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  const me = user._id.toString();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const [inbox, unread, today] = await Promise.all([
    db.collection("messages").find({ $or: [{ senderId: me }, { receiverId: me }] }).toArray(),
    db.collection("messages").countDocuments({ receiverId: me, isRead: { $ne: true } }),
    db.collection("messages").find({ $or: [{ senderId: me }, { receiverId: me }], timestamp: { $gte: startToday.toISOString() } }).toArray(),
  ]);
  const peers = new Set<string>();
  for (const m of inbox) {
    if (m.senderId === me) peers.add(m.receiverId);
    if (m.receiverId === me) peers.add(m.senderId);
  }
  const activeToday = new Set<string>();
  for (const m of today) {
    if (m.senderId === me) activeToday.add(m.receiverId);
    if (m.receiverId === me) activeToday.add(m.senderId);
  }
  return json({ data: { total: peers.size, unread, activeToday: activeToday.size, messagesToday: today.length } });
}, { auth: "required" });
