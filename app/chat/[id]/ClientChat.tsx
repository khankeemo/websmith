// app/chat/[id]/ClientChat.tsx
// PURPOSE: Client-side Messenger-style chat for the SECURE PUBLIC CLIENT
//          MESSENGER CHAT (AWS-01 R01 — Phase 2/Phase 6/Phase 7 + FINAL CHAT UI).
//          Compact, mobile-first, reuse-only UI: it talks to the SAME ticket
//          conversation backend (`messages[]`) the admin Query Inbox renders —
//          no duplicate chat backend, no email dependency. The signed link token
//          is sent as `Authorization: Bearer <token>` on every call; the server
//          verifies it against the path ticket + the customer's email before ANY
//          data is returned or stored.
//
//          LANGUAGE RACER UI (2026-08-19, VISUAL ONLY): the page is a three-part
//          stage — LEFT  live animated Language Racer (3 vertical tracks,
//          left/right bottom→top + center top→bottom, 28 technology cars +
//          a premium Websmith car, CSS-transform loop, glow layers);
//          CENTER the existing messenger card (unchanged);
//          RIGHT  the fixed circular Websmith mask bubble (clamped in its
//          circle, ~5% smaller than the previous mask, never escapes the
//          boundary). On small screens the racer shrinks (smaller tracks and
//          cars) and moves into a top strip beside a smaller mask — never
//          hidden, never overflowing, never covering the messenger.
//          All logic (token, poll, send, status, contact info, no-executive
//          message) is unchanged.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, Send, ShieldCheck, XCircle } from "lucide-react";

const TEAM_NAME = "Websmith Digital Support";
const POLL_INTERVAL_MS = 3_000;
const CONTACT_INFO_URL = "/api/settings/public/contact_info";

// Top-right Websmith logo image (compact, keeps aspect ratio, inside the card)
const WEBSCIMITH_LOGO = "/images/Websmith.png";

// ---- LANGUAGE RACER data ---------------------------------------------------
// Every car is a real technology with its real Devicon icon from
// public/wds_icon (all references verified to exist) + its brand color.
interface RacerCar {
  id: string;
  name: string;
  icon?: string;
  color: string;
  websmith?: boolean;
}

const RACER_CARS: RacerCar[] = [
  { id: "c", name: "C", icon: "c", color: "#A8B9CC" },
  { id: "cpp", name: "C++", icon: "cplusplus", color: "#00599C" },
  { id: "csharp", name: "C#", icon: "csharp", color: "#68217A" },
  { id: "java", name: "Java", icon: "java", color: "#E76F00" },
  { id: "javascript", name: "JavaScript", icon: "javascript", color: "#F7DF1E" },
  { id: "typescript", name: "TypeScript", icon: "typescript", color: "#3178C6" },
  { id: "python", name: "Python", icon: "python", color: "#3776AB" },
  { id: "nodejs", name: "Node.js", icon: "nodejs", color: "#339933" },
  { id: "go", name: "Go", icon: "go", color: "#00ADD8" },
  { id: "rust", name: "Rust", icon: "rust", color: "#CE422B" },
  { id: "php", name: "PHP", icon: "php", color: "#777BB4" },
  { id: "ruby", name: "Ruby", icon: "ruby", color: "#CC342D" },
  { id: "swift", name: "Swift", icon: "swift", color: "#F05138" },
  { id: "kotlin", name: "Kotlin", icon: "kotlin", color: "#7F52FF" },
  { id: "dart", name: "Dart", icon: "dart", color: "#0175C2" },
  { id: "r", name: "R", icon: "r", color: "#276DC3" },
  { id: "shell", name: "Shell", icon: "bash", color: "#4EAA25" },
  { id: "perl", name: "Perl", icon: "perl", color: "#39457E" },
  { id: "lua", name: "Lua", icon: "lua", color: "#2C4AA0" },
  { id: "scala", name: "Scala", icon: "scala", color: "#DC322F" },
  { id: "react", name: "React", icon: "react", color: "#61DAFB" },
  { id: "vue", name: "Vue", icon: "vue", color: "#42B883" },
  { id: "angular", name: "Angular", icon: "angular", color: "#DD0031" },
  { id: "docker", name: "Docker", icon: "docker", color: "#2496ED" },
  { id: "kubernetes", name: "K8s", icon: "kubernetes", color: "#326CE5" },
  { id: "postgresql", name: "PostgreSQL", icon: "postgresql", color: "#336791" },
  { id: "mongodb", name: "MongoDB", icon: "mongodb", color: "#47A248" },
  { id: "graphql", name: "GraphQL", icon: "graphql", color: "#E10098" },
  // Dedicated Websmith car — clearly branded, visually premium, races with the
  // same track system as every other car.
  { id: "websmith", name: "WEBSMITH", color: "#FFD700", websmith: true },
];

// 3 vertical tracks: LEFT bottom→top, CENTER top→bottom, RIGHT bottom→top.
// Adjacent tracks always move in opposite directions.
const RACER_TRACKS: Array<{ key: string; dir: "Up" | "Down"; cars: RacerCar[] }> = [
  { key: "left", dir: "Up", cars: RACER_CARS.slice(0, 10) },
  { key: "center", dir: "Down", cars: RACER_CARS.slice(10, 20) },
  { key: "right", dir: "Up", cars: RACER_CARS.slice(20) },
];

// Deterministic pseudo-random (hydration-safe — identical on server + client).
function racerRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

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

/**
 * CLIENT CHAT VISUAL UPDATE — decorative background layer (z-index 0,
 * pointer-events none, always BEHIND the chat card, never over its controls):
 *
 *  LEFT   — "Lanuage Racer Websmith.png": no circular mask, no border, no
 *           crop; correct aspect ratio; the layer spans from the far left
 *           edge up to the left edge of the chat card.
 *  RIGHT  — 60 programming-language bubbles (80px actual size, icons from
 *           public/wds_icon) that continuously float bottom -> top (~115vh)
 *           like balloons at random horizontal positions (48-98%), with
 *           gentle sway and subtle background opacity.
 *  ZOOM   — independent random 3x zoom: at random intervals ONE bubble
 *           smoothly scales to 3x (240px), holds ~1.5s, returns to 80px;
 *           the next zoom may start while the previous is returning
 *           (transition-only overlap). Transform-based — no layout reflow,
 *           no chat card size change.
 *
 * Data is randomized once per mount (useMemo); animations run in CSS.
 */
function DecorativeLayer() {
  const bubbles = useMemo(
    () =>
      LANG_ICONS_60.map((icon, i) => ({
        id: i,
        icon,
        // Random horizontal position inside the RIGHT decorative band
        // (48-98% of the viewport; the card + left image stay clear).
        left: 48 + Math.random() * 50,
        // Start below the viewport so the balloon rises into view.
        bottom: -90 - Math.random() * 60,
        // Full balloon travel 18-36s; negative delay = mid-flight on load.
        duration: 18 + Math.random() * 18,
        delay: -Math.random() * 36,
        // Horizontal sway ~±10px.
        sway: 8 + Math.random() * 2,
        swayDuration: 3.5 + Math.random() * 3,
        // Subtle background opacity 0.08-0.24.
        bgOpacity: 0.08 + Math.random() * 0.16,
        iconOpacity: 0.85 + Math.random() * 0.15,
      })),
    []
  );

  // RANDOM 3x ZOOM: exactly one bubble zooms at a time. `key` remounts the
  // chip so the CSS animation restarts on every new selection.
  const [zoom, setZoom] = useState<{ idx: number; key: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setZoom((prev) => {
            let next = Math.floor(Math.random() * LANG_ICONS_60.length);
            if (prev && next === prev.idx) {
              next = (next + 1 + Math.floor(Math.random() * (LANG_ICONS_60.length - 1))) % LANG_ICONS_60.length;
            }
            return { idx: next, key: (prev?.key ?? 0) + 1 };
          });
          schedule();
        },
        ZOOM_MIN_DELAY_MS + Math.random() * (ZOOM_MAX_DELAY_MS - ZOOM_MIN_DELAY_MS)
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={styles.decoLayer} aria-hidden="true">
      {/* LEFT: Lanuage Racer Websmith.png — full left band, no mask, no border */}
      <div style={styles.leftImageLayer} className="ws-hide-mobile">
        <img
          src="/images/Lanuage Racer Websmith.png"
          alt=""
          style={styles.leftImage}
          draggable={false}
          decoding="async"
        />
      </div>

      {/* RIGHT: 60 programming-language bubbles + random 3x zoom */}
      {bubbles.map((b) => {
        const isZooming = zoom?.idx === b.id;
        return (
          <div
            key={b.id}
            className="ws-bubble ws-hide-mobile"
            style={{
              left: `${b.left}%`,
              bottom: b.bottom,
              animation: `wsBubbleUp ${b.duration}s linear ${b.delay}s infinite`,
            }}
          >
            <div
              className="ws-bubble-sway"
              style={{
                animation: `wsBubbleSway ${b.swayDuration}s ease-in-out ${b.delay}s infinite`,
              }}
            >
              <div
                key={isZooming ? `zoom-${zoom.key}` : undefined}
                className={isZooming ? "ws-bubble-chip ws-bubble-zoom" : "ws-bubble-chip"}
                style={{ backgroundColor: `rgba(255,255,255,${b.bgOpacity})` }}
              >
                <img
                  src={`/wds_icon/${b.icon}.svg`}
                  alt=""
                  width={66}
                  height={66}
                  draggable={false}
                  decoding="async"
                  style={{ opacity: b.iconOpacity }}
                />
              </div>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        @keyframes wsBubbleUp {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          6% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            transform: translateY(-115vh);
            opacity: 0;
          }
        }
        @keyframes wsBubbleSway {
          0%,
          100% {
            transform: translateX(-10px);
          }
          50% {
            transform: translateX(10px);
          }
        }
        @keyframes wsBubbleZoom {
          0% {
            transform: scale(1);
          }
          25% {
            transform: scale(3);
          }
          75% {
            transform: scale(3);
          }
          100% {
            transform: scale(1);
          }
        }
        .ws-bubble {
          position: absolute;
          will-change: transform, opacity;
        }
        .ws-bubble-sway {
          will-change: transform;
        }
        .ws-bubble-chip {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.12),
            0 4px 14px rgba(0, 0, 0, 0.1);
          transform-origin: center;
          will-change: transform;
        }
        .ws-bubble-zoom {
          animation: wsBubbleZoom 3s cubic-bezier(0.45, 0, 0.25, 1) forwards;
        }
        /* Mobile: decorative elements may hide; chat stays fully usable. */
        @media (max-width: 767px) {
          .ws-hide-mobile {
            display: none !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ws-bubble,
          .ws-bubble-sway,
          .ws-bubble-chip,
          .ws-bubble-zoom {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Full-viewport stage: the chat card is CENTERED with clear space above and
  // below; left/right decorative bands are never reduced or removed.
  root: {
    position: "relative",
    height: "100dvh",
    maxHeight: "100dvh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "var(--bg-primary)",
    overflow: "hidden",
  },
  // Decorative layer — always BEHIND the chat card, never clickable.
  decoLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: 0,
  },
  // LEFT decorative band: far left edge -> left edge of the chat card.
  leftImageLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "calc(50% - 275px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  // No circular mask, no border, no crop — correct aspect ratio via contain.
  leftImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  // THE centered chat card (clear space above and below; responsive on mobile).
  card: {
    position: "relative",
    zIndex: 1,
    width: "min(550px, 100%)",
    height: "min(800px, 92dvh)",
    maxHeight: "92dvh",
    display: "flex",
    flexDirection: "column",
    borderRadius: "22px",
    border: "1px solid var(--border-color)",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.08)",
    background: "var(--bg-primary)",
    overflow: "hidden",
  },
  header: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px 14px 10px",
    borderBottom: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
  headerTitleBlock: { minWidth: 0 },
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
    margin: "2px 0 0 0",
    fontSize: "11px",
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Client Login / Home / Open·Closed — SAME SIZE, DIFFERENT COLORS.
  headerBtns: { flexShrink: 0, display: "flex", alignItems: "center", gap: "8px" },
  headerBtn: {
    flex: 1,
    minWidth: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    height: "32px",
    borderRadius: "10px",
    padding: "0 8px",
    fontSize: "11.5px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    border: "1px solid transparent",
  },
  headerBtnLogin: {
    backgroundColor: "#007AFF",
    color: "#ffffff",
  },
  headerBtnHome: {
    backgroundColor: "#34C759",
    color: "#ffffff",
  },
  headerBtnOpen: {
    backgroundColor: "#FF9F0A",
    color: "#ffffff",
  },
  headerBtnClosed: {
    backgroundColor: "#FF3B30",
    color: "#ffffff",
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "9px",
    background: "var(--bg-secondary)",
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
  centerText: { margin: 0, color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6, maxWidth: "380px" },
  centerTitle: { margin: 0, color: "var(--text-primary)", fontSize: "15px", fontWeight: 700 },
  row: { display: "flex", flexShrink: 0 },
  rowClient: { justifyContent: "flex-start" },
  rowAdmin: { justifyContent: "flex-end" },
  rowSystem: { justifyContent: "center" },
  bubbleClient: {
    maxWidth: "78%",
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    borderTopLeftRadius: "4px",
    padding: "8px 11px",
    background: "var(--bg-primary)",
  },
  bubbleAdmin: {
    maxWidth: "78%",
    border: "1px solid #007aff33",
    borderRadius: "14px",
    borderTopRightRadius: "4px",
    padding: "8px 11px",
    background: "rgba(0,122,255,0.07)",
  },
  bubbleSystem: {
    maxWidth: "88%",
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
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px 12px",
    borderTop: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
  composerRow: { display: "flex", alignItems: "flex-end", gap: "8px" },
  clientLoginRow: { display: "flex", alignItems: "center", gap: "6px" },
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
  connectedRow: { display: "flex", justifyContent: "center", paddingTop: "2px" },
  connectedPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "10.5px",
    color: "var(--text-secondary)",
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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
      {/* Decorative layer — balloons + left image, always behind the card */}
      <DecorativeLayer />

      {/* Centered chat card */}
      <div style={styles.card}>
        <header style={styles.header}>
          <div style={styles.headerTitleBlock}>
            <p style={styles.headerTitle} title={conversation?.subject}>
              {conversation?.subject || "Your Conversation"}
            </p>
            <p style={styles.headerSub} title={conversation?.contactEmail}>
              {conversation
                ? `${conversation.contactName || "Valued Customer"}${conversation.contactEmail ? ` · ${conversation.contactEmail}` : ""}`
                : TEAM_NAME}
            </p>
          </div>
          {/* SAME-SIZE buttons, DIFFERENT colors */}
          <div style={styles.headerBtns}>
            <Link
              href="/login"
              style={{ ...styles.headerBtn, ...styles.headerBtnLogin }}
              aria-label="Client login"
            >
              Client Login
            </Link>
            <Link href="/" style={{ ...styles.headerBtn, ...styles.headerBtnHome }} aria-label="Home">
              Home
            </Link>
            {conversation ? (
              <span
                role="status"
                aria-label={isClosed ? "Conversation closed" : "Conversation open"}
                style={{
                  ...styles.headerBtn,
                  ...(isClosed ? styles.headerBtnClosed : styles.headerBtnOpen),
                  cursor: "default",
                }}
              >
                {isClosed ? "Closed" : "Open"}
              </span>
            ) : (
              <span
                role="status"
                aria-label="Conversation status pending"
                style={{ ...styles.headerBtn, backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)", cursor: "default" }}
              >
                ...
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
            <div style={{ position: "absolute", right: 10, top: 10, zIndex: 1 }}>
              <img
                src={WEBSCIMITH_LOGO}
                alt="Websmith"
                width={48}
                height={48}
                style={{ objectFit: "contain" }}
                decoding="async"
              />
            </div>
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
              <div style={styles.connectedRow}>
                <span style={styles.connectedPill}>
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
            </div>
            <div style={styles.composerRow}>
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
          </div>
        )}
      </div>
    </div>
  );
}