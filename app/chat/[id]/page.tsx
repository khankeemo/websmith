// app/chat/[id]/page.tsx
// PURPOSE: SECURE PUBLIC CLIENT MESSENGER CHAT (AWS-01 R01 — Phase 2).
//          A customer clicks their secure direct chat link
//          `/chat/<ticketId>?token=<signed>` and lands DIRECTLY in their own
//          Messenger-style conversation — no login, no account, no intermediate
//          website pages. The signed token (bound to this ticket + the
//          customer's email) is the only access credential; the page is public
//          so the proxy never gates it, and every data call is token-verified
//          server-side.
import ClientChat from "./ClientChat";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientChat ticketId={id} />;
}