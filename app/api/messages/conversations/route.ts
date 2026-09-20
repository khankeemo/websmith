import { apiHandler, json, ObjectId } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  const me = user._id.toString();
  const messages = await db
    .collection("messages")
    .find({ $or: [{ senderId: me }, { receiverId: me }] })
    .sort({ timestamp: -1 })
    .limit(500)
    .toArray();

  const byPeer = new Map<string, any[]>();
  for (const m of messages) {
    const peerId = m.senderId === me ? m.receiverId : m.senderId;
    if (!peerId) continue;
    if (!byPeer.has(peerId)) byPeer.set(peerId, []);
    byPeer.get(peerId)!.push(m);
  }

  const conversations: any[] = [];
  const peerIds = [...byPeer.keys()];
  const peerDocs = await db.collection("users").find({ _id: { $in: peerIds.map((id) => { try { return new ObjectId(id); } catch { return id as any; } }) } }).toArray();
  const peerMap = new Map<string, any>();
  for (const p of peerDocs) peerMap.set(p._id.toString(), p);

  for (const [peerId, thread] of byPeer) {
    const last = thread[0];
    const peer = peerMap.get(peerId);
    const unreadCount = thread.filter((m) => m.senderId === peerId && m.receiverId === me && m.status !== "read").length;
    conversations.push({
      _id: peerId,
      participantId: peerId,
      participantName: peer?.name ?? "Unknown",
      participantAvatar: peer?.avatar ?? "",
      participantRole: peer?.role ?? "",
      participantEmail: peer?.email ?? "",
      lastMessage: last?.content ?? "",
      lastMessageTime: last?.timestamp ?? null,
      lastMessageSender: last?.senderId === me ? "me" : last?.senderName ?? "",
      unreadCount,
      online: false,
      lastSeen: peer?.lastSeen ?? null,
    });
  }

  conversations.sort((a, b) => new Date(b.lastMessageTime ?? 0).getTime() - new Date(a.lastMessageTime ?? 0).getTime());
  return json({ data: conversations });
}, { auth: "required" });
