// app/chat/[id]/ClientChat.tsx
// PURPOSE: Client-side Messenger-style chat for the SECURE PUBLIC CLIENT
//          MESSENGER CHAT (AWS-01 R01 — Phase 2/Phase 6/Phase 7). Compact,
//          mobile-first, reuse-only UI: it talks to the SAME ticket conversation
//          backend (`messages[]`) the admin Query Inbox renders — no duplicate chat
//          backend, no email dependency. The signed link token is sent as
//          `Authorization: Bearer <token>` on every call; the server verifies
//          it against the path ticket + the customer's email before ANY data is
//          returned or stored.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, Send, ShieldCheck, XCircle } from "lucide-react";

const TEAM_NAME = "Websmith Digital Support";
const POLL_INTERVAL_MS = 3_000;
const CONTACT_INFO_URL = "/api/settings/public/contact_info";

export interface ChatAttachment {
  name: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  senderType: "client" | "admin";
  senderName: string;
  message: string;
  createdAt: string;
  attachments?: ChatAttachment[];
}

export interface ChatConversation {
  ticketId: string;
  subject: string;
  status: string;
  contactName: string;
  contactEmail: string;
  createdAt: string;
  messages: ChatMessage[];
}

interface ContactInfo {
  phone?: string;
  mobile_number?: string;
  whatsapp_url?: string;
  email?: string;
  sales_email?: string;
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

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    height: "100dvh",
    maxHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    margin: "0 auto",
    width: "100%",
    maxWidth: "720px",
    background: "var(--bg-primary)",
    borderLeft: "1px solid var(--border-color)",
    borderRight: "1px solid var(--border-color)",
    overflow: "hidden",
  },
  bgCircles: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: 0,
  },
  bgCircle: {
    position: "absolute",
    borderRadius: "999px",
    opacity: 0.12,
    filter: "blur(60px)",
  },
  header: {
    position: "relative",
    zIndex: 2,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 16px",
    borderBottom: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
  brand: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text-primary)",
    textDecoration: "none",
  },
  brandLogo: {
    width: "24px",
    height: "24px",
    borderRadius: "6px",
    background: "linear-gradient(135deg, #007aff, #1479ea)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: 800,
    color: "#fff",
  },
  headerText: { minWidth: 0, flex: 1 },
  headerTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerSub: {
    margin: "1px 0 0 0",
    fontSize: "11px",
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerBtns: { flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" },
  headerBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderRadius: "8px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },
  statusPill: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "10px",
    fontWeight: 700,
    borderRadius: "999px",
    padding: "3px 8px",
    whiteSpace: "nowrap",
  },
  statusPillOpen: {
    color: "#1d7a31",
    backgroundColor: "rgba(52,199,89,0.12)",
    border: "1px solid rgba(52,199,89,0.35)",
  },
  statusPillClosed: {
    color: "#c81e12",
    backgroundColor: "rgba(255,59,48,0.1)",
    border: "1px solid rgba(255,59,48,0.35)",
  },
  dotOpen: { width: "6px", height: "6px", borderRadius: "999px", backgroundColor: "#34c759", flexShrink: 0 },
  dotClosed: { width: "6px", height: "6px", borderRadius: "999px", backgroundColor: "#ff3b30", flexShrink: 0 },
  body: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "9px",
  },
  center: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "20px",
    textAlign: "center",
  },
  centerText: { margin: 0, color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6, maxWidth: "420px" },
  centerTitle: { margin: 0, color: "var(--text-primary)", fontSize: "15px", fontWeight: 700 },
  row: { display: "flex", flexShrink: 0 },
  rowClient: { justifyContent: "flex-start" },
  rowAdmin: { justifyContent: "flex-end" },
  rowSystem: { justifyContent: "center" },
  bubbleClient: {
    maxWidth: "76%",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    borderTopLeftRadius: "4px",
    padding: "8px 11px",
    background: "var(--bg-secondary)",
  },
  bubbleAdmin: {
    maxWidth: "76%",
    border: "1px solid #007aff33",
    borderRadius: "12px",
    borderTopRightRadius: "4px",
    padding: "8px 11px",
    background: "rgba(0,122,255,0.07)",
  },
  bubbleSystem: {
    maxWidth: "86%",
    border: "1px dashed var(--border-color)",
    borderRadius: "12px",
    padding: "9px 12px",
    background: "rgba(150,150,150,0.05)",
  },
  bubbleSender: { margin: 0, fontSize: "9px", fontWeight: 700, color: "#007AFF" },
  bubbleText: {
    margin: "3px 0",
    fontSize: "13px",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--text-primary)",
  },
  bubbleTime: { margin: 0, fontSize: "9px", color: "var(--text-muted)" },
  bubbleAttachments: { display: "flex", flexWrap: "wrap", gap: "5px 7px", marginTop: "4px" },
  attachmentLink: {
    fontSize: "11px",
    color: "#007AFF",
    textDecoration: "underline",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  systemMsgText: {
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--text-secondary)",
  },
  systemLink: {
    color: "#007AFF",
    textDecoration: "underline",
    fontSize: "12px",
  },
  composer: {
    position: "relative",
    zIndex: 2,
    flexShrink: 0,
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    padding: "10px 12px",
    borderTop: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
  clientLoginRow: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" },
  clientLoginBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "1px solid #007aff33",
    background: "rgba(0,122,255,0.08)",
    color: "#007AFF",
    borderRadius: "8px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },
  input: {
    flex: 1,
    minHeight: "40px",
    maxHeight: "110px",
    resize: "none",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    padding: "10px 13px",
    outline: "none",
    fontSize: "13px",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  sendBtn: {
    flexShrink: 0,
    width: "40px",
    height: "40px",
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
    gap: "5px",
    padding: "6px 12px",
    fontSize: "10.5px",
    color: "var(--text-secondary)",
    borderTop: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
};

function FloatingBackground() {
  const circles = useMemo(() => {
    const arr: { id: number; size: number; left: number; delay: number; duration: number; color: string }[] = [];
    const colors = ["#007aff33", "#34c75933", "#ff9f0a33", "#af52de33"];
    for (let i = 0; i < 18; i++) {
      arr.push({
        id: i,
        size: 30 + Math.random() * 70,
        left: Math.random() * 100,
        delay: Math.random() * 12,
        duration: 14 + Math.random() * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    return arr;
  }, []);

  return (
    <div style={styles.bgCircles} aria-hidden="true">
      {circles.map((c) => (
        <div
          key={c.id}
          className="chat-float-circle"
          style={{
            ...styles.bgCircle,
            width: c.size,
            height: c.size,
            left: `${c.left}%`,
            ...{
              animation: `chatFloat ${c.duration}s ease-in-out ${c.delay}s infinite`,
              backgroundColor: c.color,
            },
          }}
        />
      ))}
      <style jsx>{`
        @keyframes chatFloat {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 0.14;
          }
          90% {
            opacity: 0.1;
          }
          100% {
            transform: translateY(-110vh) scale(0.9);
            opacity: 0;
          }
        }
        .chat-float-circle {
          will-change: transform;
        }
      `}</style>
    </div>
  );
}

export default function ClientChat({ ticketId }: { ticketId: string }) {
  const token = useMemo(readToken, []);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
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

  useEffect(() => {
    let cancelled = false;
    fetch(CONTACT_INFO_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.data) setContactInfo(j.data);
      })
      .catch(() => {} );
    return () => { cancelled = true; };
  }, []);

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
  const hasAdminReply = (conversation?.messages || []).some((m) => m.senderType === "admin");

  const whatsappUrl = contactInfo?.whatsapp_url || contactInfo?.email
    ? `https://wa.me/${(contactInfo.whatsapp_url || "").replace(/[^\d]/g, "")}`
    : "";
  const phoneText = contactInfo?.mobile_number || contactInfo?.phone || "";

  const renderNoExecutiveMessage = () => {
    if (!conversation || hasAdminReply) return null;
    return (
      <div style={{ ...styles.row, ...styles.rowSystem }}>
        <div style={styles.bubbleSystem}>
          <p style={styles.systemMsgText}>
            Sorry, no executive is available right now. We will connect with you shortly.
          </p>
          <p style={styles.systemMsgText}>
            In the meantime, please share your preferred contact details below in the chat (phone or WhatsApp number) and we will reach out as soon as someone is free.
          </p>
          {phoneText && <p style={styles.systemMsgText}>Mobile: {phoneText}</p>}
          <p style={styles.systemMsgText}>
            Or visit{" "}
            <Link href="/contact" style={styles.systemLink}>
              the Websmith Contact page
            </Link>{" "}
            to get in touch directly.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.root}>
      <FloatingBackground />

      <header style={styles.header}>
        <Link href="/" style={styles.brand} aria-label="Websmith home">
          <span style={styles.brandLogo}>W</span>
          Websmith
        </Link>
        <div style={styles.headerText}>
          <p style={styles.headerTitle} title={conversation?.subject}>
            {conversation?.subject || "Your Conversation"}
          </p>
          <p style={styles.headerSub} title={conversation?.contactEmail}>
            {conversation
              ? `${conversation.contactName || "Valued Customer"}${conversation.contactEmail ? ` · ${conversation.contactEmail}` : ""}`
              : TEAM_NAME}
          </p>
        </div>
        <div style={styles.headerBtns}>
          <Link href="/login" style={styles.headerBtn} aria-label="Client login">
            Client Login
          </Link>
          <Link href="/" style={styles.headerBtn} aria-label="Home">
            Home
          </Link>
          {conversation && (
            <span style={{ ...styles.statusPill, ...(isClosed ? styles.statusPillClosed : styles.statusPillOpen) }}>
              <span style={isClosed ? styles.dotClosed : styles.dotOpen} />
              {isClosed ? "Closed" : "Open"}
            </span>
          )}
        </div>
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
          <a href="https://www.websmithdigital.com" target="_blank" rel="noreferrer" style={styles.clientLoginBtn}>
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
              {renderNoExecutiveMessage()}
            </div>
          ) : (
            conversation.messages.map((m) => {
              const isClient = m.senderType === "client";
              const rowStyle = isClient ? styles.rowClient : styles.rowAdmin;
              return (
                <div key={m.id || `${m.senderType}-${m.createdAt}-${m.message}`} style={{ ...styles.row, ...rowStyle }}>
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
          {renderNoExecutiveMessage()}
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
          <div style={styles.clientLoginRow}>
            <Lock size={11} color="var(--text-secondary)" />
            <span style={{ fontSize: "10.5px", color: "var(--text-secondary)" }}>
              Secure conversation · only you and the Websmith team can see this chat
            </span>
            <Link href="/login" style={styles.clientLoginBtn}>
              Client Login
            </Link>
          </div>
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
            disabled={sending || !draft.trim() || isClosed}
            style={styles.sendBtn}
            aria-label="Send message"
          >
            {sending ? <Loader2 size={17} className="admin-messages-spin" /> : <Send size={17} />}
          </button>
        </div>
      )}
    </div>
  );
}
