// app/chat/[id]/ClientChat.tsx
// PURPOSE: Client-side Messenger-style chat for the SECURE PUBLIC CLIENT
//          MESSENGER CHAT (AWS-01 R01 — Phase 2). Compact, mobile-first,
//          reuse-only UI: it talks to the SAME ticket conversation backend
//          (`messages[]`) the admin Query Inbox renders — no duplicate chat
//          backend, no email dependency. The signed link token is sent as
//          `Authorization: Bearer <token>` on every call; the server verifies
//          it against the path ticket + the customer's email before ANY data is
//          returned or stored.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Lock, Send, ShieldCheck, XCircle } from "lucide-react";

// Canonical admin identity shown for every team/outbound bubble (mirrors the
// Query Inbox's ADMIN_SENDER_LABEL so both ends of the conversation agree).
const TEAM_NAME = "Websmith Digital Support";

const POLL_INTERVAL_MS = 3_000;

interface ChatAttachment {
  name: string;
  url: string;
}

interface ChatMessage {
  id: string;
  senderType: "client" | "admin";
  senderName: string;
  message: string;
  createdAt: string;
  attachments?: ChatAttachment[];
}

interface ChatConversation {
  ticketId: string;
  subject: string;
  status: string;
  contactName: string;
  contactEmail: string;
  createdAt: string;
  messages: ChatMessage[];
}

function readToken(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") || "";
}

async function chatFetch(ticketId: string, token: string, path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`${window.location.origin}/api/tickets/${ticketId}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body: surface as a transport failure below.
  }
  if (!response.ok) {
    const error: any = new Error(payload?.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

const formatTime = (value?: string) => {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const styles: Record<string, any> = {
  root: {
    height: "100dvh",
    maxHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-primary)",
    margin: "0 auto",
    width: "100%",
    maxWidth: "720px",
    borderLeft: "1px solid var(--border-color)",
    borderRight: "1px solid var(--border-color)",
  },
  header: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    borderBottom: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #007aff, #1479ea)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: 800,
    flexShrink: 0,
  },
  headerText: { minWidth: 0, flex: 1 },
  headerTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 800,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerSub: {
    margin: "2px 0 0 0",
    fontSize: "12px",
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  statusPillOpen: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#1d7a31",
    backgroundColor: "rgba(52,199,89,0.12)",
    border: "1px solid rgba(52,199,89,0.35)",
    borderRadius: "999px",
    padding: "4px 10px",
    whiteSpace: "nowrap",
  },
  statusPillClosed: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#c81e12",
    backgroundColor: "rgba(255,59,48,0.1)",
    border: "1px solid rgba(255,59,48,0.35)",
    borderRadius: "999px",
    padding: "4px 10px",
    whiteSpace: "nowrap",
  },
  dotOpen: { width: "7px", height: "7px", borderRadius: "999px", backgroundColor: "#34c759", flexShrink: 0 },
  dotClosed: { width: "7px", height: "7px", borderRadius: "999px", backgroundColor: "#ff3b30", flexShrink: 0 },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    background: "var(--bg-secondary)",
  },
  center: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "24px",
    textAlign: "center",
  },
  centerText: { margin: 0, color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, maxWidth: "420px" },
  centerTitle: { margin: 0, color: "var(--text-primary)", fontSize: "17px", fontWeight: 800 },
  row: { display: "flex", flexShrink: 0 },
  rowClient: { justifyContent: "flex-start" },
  rowAdmin: { justifyContent: "flex-end" },
  bubbleClient: {
    maxWidth: "78%",
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    borderTopLeftRadius: "4px",
    padding: "9px 12px",
    background: "var(--bg-primary)",
  },
  bubbleAdmin: {
    maxWidth: "78%",
    border: "1px solid #007aff33",
    borderRadius: "14px",
    borderTopRightRadius: "4px",
    padding: "9px 12px",
    background: "rgba(0,122,255,0.07)",
  },
  bubbleSender: { margin: 0, fontSize: "10px", fontWeight: 700, color: "#007AFF" },
  bubbleText: {
    margin: "5px 0",
    fontSize: "13.5px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--text-primary)",
  },
  bubbleTime: { margin: 0, fontSize: "10px", color: "var(--text-muted)" },
  bubbleAttachments: { display: "flex", flexWrap: "wrap", gap: "6px 8px", marginTop: "5px" },
  attachmentLink: {
    fontSize: "11px",
    color: "#007AFF",
    textDecoration: "underline",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  composer: {
    flexShrink: 0,
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    padding: "10px 12px",
    borderTop: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
  input: {
    flex: 1,
    minHeight: "44px",
    maxHeight: "120px",
    resize: "none",
    borderRadius: "14px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    padding: "11px 14px",
    outline: "none",
    fontSize: "14px",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  sendBtn: {
    flexShrink: 0,
    width: "44px",
    height: "44px",
    borderRadius: "999px",
    border: "none",
    background: "#007AFF",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  securityNote: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "6px 12px",
    fontSize: "10.5px",
    color: "var(--text-secondary)",
    borderTop: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
  linkBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    border: "1px solid #007aff33",
    background: "rgba(0,122,255,0.08)",
    color: "#007AFF",
    borderRadius: "10px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
  },
};

export default function ClientChat({ ticketId }: { ticketId: string }) {
  const token = useMemo(readToken, []);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pollInFlight = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const applyConversation = useCallback((next: ChatConversation | null) => {
    if (!next) return;
    setConversation((prev) => {
      const prevLast = prev?.messages?.length ? prev.messages[prev.messages.length - 1] : null;
      const nextLast = next.messages?.length ? next.messages[next.messages.length - 1] : null;
      const changed =
        (prevLast?.id || "") !== (nextLast?.id || "") ||
        next.messages.length !== (prev?.messages?.length || 0) ||
        next.status !== prev?.status;
      return changed ? next : prev;
    });
    setConnected(true);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await chatFetch(ticketId, token, "/chat");
      applyConversation(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "This conversation link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }, [ticketId, token, applyConversation]);

  useEffect(() => {
    load();
  }, [load]);

  // Silent polling for new team messages — a client message or an admin reply
  // lands in this thread within a few seconds of either side sending it. The
  // in-flight ref guard keeps consecutive polls from ever overlapping.
  useEffect(() => {
    if (!conversation || error) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const data = await chatFetch(ticketId, token, "/chat");
        if (!cancelled) applyConversation(data);
      } catch {
        // Silent; the next tick retries automatically.
      } finally {
        pollInFlight.current = false;
      }
    };
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [conversation, error, ticketId, token, applyConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [conversation, scrollToBottom]);

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const data = await chatFetch(ticketId, token, "/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setDraft("");
      applyConversation(data);
      scrollToBottom();
    } catch (err: any) {
      setError(err?.message || "Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const isClosed = conversation?.status === "closed";

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div style={styles.avatar}>
          {(conversation?.contactName || "C").charAt(0).toUpperCase()}
        </div>
        <div style={styles.headerText}>
          <p style={styles.headerTitle} title={conversation?.subject}>
            {conversation?.subject || "Your Conversation"}
          </p>
          <p style={styles.headerSub} title={conversation?.contactEmail}>
            {conversation
              ? `${conversation.contactName || "Valued Customer"}${conversation.contactEmail ? ` · ${conversation.contactEmail}` : ""}`
              : "Websmith Digital Support"}
          </p>
        </div>
        {conversation && (
          <span style={isClosed ? styles.statusPillClosed : styles.statusPillOpen}>
            <span style={isClosed ? styles.dotClosed : styles.dotOpen} />
            {isClosed ? "Closed" : "Open"}
          </span>
        )}
      </header>

      {loading ? (
        <div style={styles.center}>
          <Loader2 size={28} className="admin-messages-spin" color="var(--text-secondary)" />
          <p style={styles.centerTitle}>Connecting to your conversation...</p>
          <p style={styles.centerText}>This should only take a moment.</p>
        </div>
      ) : error || !conversation ? (
        <div style={styles.center}>
          <Lock size={30} color="var(--text-secondary)" />
          <p style={styles.centerTitle}>Conversation unavailable</p>
          <p style={styles.centerText}>{error || "This conversation link is invalid or has expired."}</p>
          <a href="https://www.websmithdigital.com" target="_blank" rel="noreferrer" style={styles.linkBtn}>
            <ShieldCheck size={15} />
            Visit websmithdigital.com
          </a>
        </div>
      ) : (
        <div style={styles.body} ref={scrollRef}>
          {conversation.messages.length === 0 ? (
            <div style={styles.center}>
              <p style={styles.centerText}>
                No messages yet. Say hello — the Websmith team will get back to you right here.
              </p>
            </div>
          ) : (
            conversation.messages.map((m) => {
              const isClient = m.senderType === "client";
              return (
                <div key={m.id || `${m.senderType}-${m.createdAt}-${m.message}`} style={{ ...styles.row, ...(isClient ? styles.rowClient : styles.rowAdmin) }}>
                  <div style={isClient ? styles.bubbleClient : styles.bubbleAdmin}>
                    <p style={styles.bubbleSender}>{isClient ? m.senderName || "You" : TEAM_NAME}</p>
                    <p style={styles.bubbleText}>{m.message}</p>
                    {m.attachments && m.attachments.length > 0 && (
                      <div style={styles.bubbleAttachments}>
                        {m.attachments.map((att, ai) => (
                          <a
                            key={`${att.url}-${ai}`}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.attachmentLink}
                            title={att.name}
                          >
                            {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                    <p style={styles.bubbleTime}>{formatTime(m.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
          {connected && (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: "2px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10.5px", color: "var(--text-secondary)" }}>
                {isClosed ? (
                  <>
                    <XCircle size={11} color="#c81e12" /> This conversation is closed
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={11} color="#34c759" /> Connected · updates every few seconds
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {conversation && (
        <div style={styles.composer}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            style={styles.input}
            aria-label="Message"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            style={styles.sendBtn}
            aria-label="Send message"
          >
            {sending ? <Loader2 size={17} className="admin-messages-spin" /> : <Send size={17} />}
          </button>
        </div>
      )}

      <div style={styles.securityNote}>
        <Lock size={11} />
        Secure conversation · only you and the Websmith team can see this chat
      </div>
    </div>
  );
}