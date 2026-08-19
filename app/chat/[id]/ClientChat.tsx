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
//          3-ZONE LAYOUT (VISUAL ONLY): the page is a strict desktop split of
//          EXACTLY 33% / 34% / 33% with NO gaps between the three zones, and
//          no element may cross into another zone:
//            LEFT  (33%)  SOCIAL ICON WATER-BUBBLE POPUPS — the left zone now
//                    hosts the social-icon popup animation: 90px popups that
//                    POP into existence (0 -> 90px over ~0.5s), live >= 1s,
//                    then fade; at most 5 coexist and are replaced
//                    continuously. Every popup uses a RANDOM real
//                    `public/social_icon` SVG (all 35 participate) inside a
//                    random mask shape, placed at a random SAFE position
//                    (measured from the real zone so the full 90px popup stays
//                    inside the left area — never in the center/right). The
//                    car/traffic animation is NOT re-added; the 33% width
//                    allocation is preserved so the page layout never shifts.
//            CENTER (34%)  MESSENGER ONLY — the existing chat card exactly as
//                    before: messages, composer, Send, Client Login, Home,
//                    dynamic Open/Closed status dot + tooltip, secure JWT chat,
//                    live 3s polling, in-card Websmith mask circle. Vertically
//                    and horizontally centered in the zone. No cars, no bubbles.
//            RIGHT  (33%)  THE EXISTING FLYING LANGUAGE BUBBLES — the original
//                    60 programming-language bubble system (80px circular masks,
//                    `border-radius: 50%`, `overflow: hidden`, real
//                    `public/wds_icon` assets, random horizontal positions,
//                    bottom → top balloon rise, continuous looping, random
//                    delays, smooth horizontal sway, subtle opacity) INCLUDING
//                    the independent RANDOM 3× ZOOM (one bubble at a time:
//                    80px → 240px scale(3), ~1.5s hold, 80px back; transform
//                    only, no reflow, never covers the messenger). All bubbles
//                    stay inside the right 33% zone.
//          Below 900px the left zone + bubbles hide and the messenger becomes
//          the full-width centered card (decorations are desktop-only);
//          `prefers-reduced-motion` stops all animation.
//          All logic (token, poll, send, status, contact info, no-executive
//          message) is unchanged.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, Send, ShieldCheck, XCircle } from "lucide-react";

const TEAM_NAME = "Websmith Digital Support";
const POLL_INTERVAL_MS = 3_000;
const CONTACT_INFO_URL = "/api/settings/public/contact_info";

// ---- RIGHT ZONE — FLYING BUBBLES data -------------------------------------
// 50 programming-language / technology icons available in public/wds_icon
// (Devicon collection, viewBox 0 0 128 128). Bubbles render ONLY these real
// assets — nothing invented.
const LANG_ICONS: string[] = [
  "python", "javascript", "typescript", "java", "csharp", "cplusplus",
  "c", "go", "rust", "php", "ruby", "kotlin", "swift", "dart", "scala",
  "r", "lua", "perl", "bash", "objectivec", "html5", "css3", "nodejs",
  "react", "nextjs", "vue", "angular", "svelte", "express", "nestjs",
  "dotnet", "spring", "laravel", "django", "flask", "fastapi", "flutter",
  "react-native", "mongodb", "postgresql", "mysql", "redis", "graphql",
  "firebase", "supabase", "docker", "kubernetes", "aws", "google-cloud",
  "git",
];

// Exactly 60 bubbles: the 50 real icons + 10 repeats of the core languages
// (the only way to reach 60 without inventing icons).
const LANG_ICONS_60: string[] = [
  ...LANG_ICONS,
  "python", "javascript", "typescript", "java", "csharp", "cplusplus",
  "c", "go", "rust", "php", "ruby",
];

// Random 3x zoom timing: at random intervals ONE bubble zooms 80px -> 240px
// (scale(3)), holds ~1.5s, returns. Next selection can begin while the
// previous bubble is returning (transition-only overlap, never two holds).
const ZOOM_MIN_DELAY_MS = 2_300;
const ZOOM_MAX_DELAY_MS = 4_500;
const ZOOM_DURATION_MS = 3_000; // 0.75s in + 1.5s hold + 0.75s out (CSS 3s)

// ---- LEFT ZONE — SOCIAL ICON WATER-BUBBLE POPUPS ---------------------------
// Every REAL social-icon SVG in public/social_icon (35 files — the README also
// lists WeChat but no wechat.svg exists, so only the 35 real files participate).
// Nothing invented, nothing external.
const SOCIAL_ICONS: string[] = [
  "behance", "bluesky", "discord", "dribbble", "facebook-messenger", "facebook",
  "flickr", "github", "gitlab", "instagram", "linkedin", "mastodon", "medium",
  "patreon", "pinterest", "quora", "reddit", "skype", "slack", "snapchat",
  "soundcloud", "spotify", "stackoverflow", "telegram", "threads", "tiktok",
  "tumblr", "twitch", "twitter", "vimeo", "vk", "whatsapp", "x-twitter", "x",
  "youtube",
];

// Water-bubble POP rules: a popup POPS into existence (0 -> 90px growth over
// ~0.5s, springy overshoot), lives >= 1s, then fades out; max/target
// POP_MAX_ACTIVE (5) popups are on screen at once — one dies, another pops.
const POP_MAX_ACTIVE = 5;
const POP_ICON_BASE = 50; // the icon itself is 50x50
const POP_FULL_SIZE = 90; // the popup bubble grows to 90px
const POP_GROW_MS = 520; // 0 -> 90px growth time (~0.5s)
const POP_MIN_LIFE_MS = 1_000; // minimum popup lifetime (>= 1s)
const POP_MAX_LIFE_MS = 2_600; // max popup lifetime
const POP_SAFE = 6; // px keep-out so the full 90px popup stays inside the zone

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
 * RIGHT ZONE — THE EXISTING FLYING LANGUAGE BUBBLES (60 bubbles + random 3x
 * zoom, RESTORED from the FINAL CHAT UI version and confined to the right
 * 33% zone — the bubble system was never to be removed or replaced):
 *
 *  60 programming-language bubbles (80px actual size, circular masks with
 *  `border-radius: 50%` + `overflow: hidden`, icons from public/wds_icon)
 *  that continuously float bottom -> top (~115vh) like balloons at random
 *  horizontal positions inside the RIGHT zone (4-80% of the zone), with
 *  gentle sway and subtle background opacity. Random delays = mid-flight on
 *  load; continuous looping.
 *
 *  ZOOM — independent random 3x zoom: at random intervals ONE bubble
 *  smoothly scales to 3x (240px), holds ~1.5s, returns to 80px; the next
 *  zoom may start while the previous is returning (transition-only overlap).
 *  Transform-based — no layout reflow, never covers the messenger, all
 *  bubbles stay inside the right 33% zone.
 *
 * Data is randomized once per mount (useMemo); animations run in CSS.
 */
function FlyingBubbles() {
  const bubbles = useMemo(
    () =>
      LANG_ICONS_60.map((icon, i) => ({
        id: i,
        icon,
        // Random horizontal position INSIDE the right 33% zone only
        // (4-80% of the zone; the zone clips everything via overflow hidden).
        left: 4 + Math.random() * 76,
        // Start below the zone so the balloon rises into view.
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
    <div style={styles.bubblesLayer} aria-hidden="true">
      {bubbles.map((b) => {
        const isZooming = zoom?.idx === b.id;
        return (
          <div
            key={b.id}
            className="ws-bubble"
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
          overflow: hidden;
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

// ---- LEFT ZONE — SOCIAL ICON WATER-BUBBLE POPUPS --------------------------
// Water-bubble popups confined to the LEFT zone ONLY (the 33% `roadZone` —
// even narrower than the documented "left 39%", so a popup can never reach the
// center column). Each popup POPS into existence (grows 0 -> 90px over ~0.5s
// with a springy overshoot), lives >= 1s, then fades away; max POP_MAX_ACTIVE
// (5) coexist — one dies, a replacement pops elsewhere. Every popup uses a
// RANDOM real `public/social_icon` SVG (all 35 participate), a random mask
// shape (circle / squircle / hexagon / blob / oval — icons stay recognizable),
// a random safe x/y (measured from the real zone so the full 90px popup always
// stays inside), a small random rotation and a random lifetime.
interface SocialPop {
  id: number;
  icon: string;
  x: number; // px, left (safe boundary applied)
  y: number; // px, top  (safe boundary applied)
  shape: string;
  rotate: number;
  life: number; // ms lifetime (>= 1s)
}

const POP_SHAPES = ["circle", "squircle", "hexagon", "blob", "oval"];

const SOCIAL_POP_CSS = `
.ws-social-pops-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;}
.ws-social-pop{position:absolute;width:90px;height:90px;opacity:0;will-change:transform,opacity;}
.ws-social-pop-inner{position:relative;width:100%;height:100%;will-change:transform;transform-origin:center;}
.ws-social-bubble{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 32% 26%,rgba(255,255,255,0.6),rgba(255,255,255,0.1) 46%,rgba(255,255,255,0.03) 72%);border:1px solid rgba(255,255,255,0.35);box-shadow:inset 0 0 14px rgba(255,255,255,0.18),0 6px 18px rgba(0,0,0,0.14);}
.ws-pop-shape-circle{border-radius:50%;}
.ws-pop-shape-squircle{border-radius:26%;}
.ws-pop-shape-hexagon{clip-path:polygon(25% 6.7%,75% 6.7%,98.3% 50%,75% 93.3%,25% 93.3%,1.7% 50%);}
.ws-pop-shape-blob{border-radius:58% 42% 52% 48% / 48% 56% 44% 52%;}
.ws-pop-shape-oval{border-radius:50% / 36%;}
.ws-social-icon{display:block;width:50px;height:50px;object-fit:contain;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));}
@keyframes wsSocialGrow{0%{transform:scale(0);opacity:0;}60%{transform:scale(1.1);opacity:1;}100%{transform:scale(1);opacity:1;}}
@keyframes wsSocialFade{0%{opacity:0;}8%{opacity:1;}82%{opacity:1;}100%{opacity:0;}}
@media (prefers-reduced-motion:reduce){.ws-social-pop{display:none !important;}}
`;

function SocialIconPops() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [zone, setZone] = useState<{ w: number; h: number } | null>(null);
  const [pops, setPops] = useState<SocialPop[]>([]);
  const nextId = useRef(0);
  const activeRef = useRef(0);

  // Measure the real left-zone size so every 90px popup is placed with a safe
  // boundary (never clipped, never crossing into the center column). When the
  // zone is hidden on mobile it measures 0 -> no popups are spawned.
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const measure = () => setZone({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spawn = useCallback((): SocialPop | null => {
    if (!zone || zone.w < POP_FULL_SIZE + POP_SAFE * 2 || zone.h < POP_FULL_SIZE + POP_SAFE * 2) return null;
    return {
      id: nextId.current++,
      icon: SOCIAL_ICONS[Math.floor(Math.random() * SOCIAL_ICONS.length)],
      x: POP_SAFE + Math.random() * (zone.w - POP_FULL_SIZE - POP_SAFE * 2),
      y: POP_SAFE + Math.random() * (zone.h - POP_FULL_SIZE - POP_SAFE * 2),
      shape: POP_SHAPES[Math.floor(Math.random() * POP_SHAPES.length)],
      rotate: Math.round((Math.random() - 0.5) * 24),
      life: POP_MIN_LIFE_MS + Math.random() * (POP_MAX_LIFE_MS - POP_MIN_LIFE_MS),
    };
  }, [zone]);

  // Continuous pool: staggered initial burst (not all 5 at once), then a
  // ticker tops the pool back up to POP_MAX_ACTIVE whenever a popup expires.
  // `activeRef` is the synchronous source of truth (incremented/decremented
  // immediately) so the burst + ticker can never overshoot the max of 5.
  useEffect(() => {
    if (!zone) return;
    let disposed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loop = () => {
      if (disposed) return;
      const need = POP_MAX_ACTIVE - activeRef.current;
      if (need <= 0) return;
      const created: SocialPop[] = [];
      for (let i = 0; i < need; i++) {
        const p = spawn();
        if (p) created.push(p);
      }
      if (!created.length) return;
      activeRef.current += created.length;
      setPops((prev) => [...prev, ...created]);
      created.forEach((p) => {
        timers.push(
          setTimeout(() => {
            activeRef.current -= 1;
            setPops((cur) => cur.filter((q) => q.id !== p.id));
          }, p.life)
        );
      });
    };
    for (let i = 0; i < POP_MAX_ACTIVE; i++) timers.push(setTimeout(loop, i * 140));
    const id = setInterval(loop, 250);
    return () => {
      disposed = true;
      clearInterval(id);
      timers.forEach((t) => clearTimeout(t));
      activeRef.current = 0;
    };
  }, [zone, spawn]);

  return (
    <div className="ws-social-pops-layer" ref={layerRef} aria-hidden="true">
      {pops.map((p) => (
        <div
          key={p.id}
          className="ws-social-pop"
          style={{
            left: p.x,
            top: p.y,
            transform: `rotate(${p.rotate}deg)`,
            animation: `wsSocialFade ${p.life}ms ease-out forwards`,
          }}
        >
          <div
            className="ws-social-pop-inner"
            style={{ animation: `wsSocialGrow ${POP_GROW_MS}ms cubic-bezier(0.34,1.56,0.64,1) forwards` }}
          >
            <div className={`ws-social-bubble ws-pop-shape-${p.shape}`}>
              <img
                className="ws-social-icon"
                src={`/social_icon/${p.icon}.svg`}
                alt=""
                width={POP_ICON_BASE}
                height={POP_ICON_BASE}
                draggable={false}
                decoding="async"
              />
            </div>
          </div>
        </div>
      ))}
      <style dangerouslySetInnerHTML={{ __html: SOCIAL_POP_CSS }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Full-viewport 3-zone stage: EXACT 33% / 34% / 33% desktop split with NO
  // gaps; below 900px the CSS media rules hide the left zone + bubbles and
  // make the center zone full-width (messenger stays fully usable).
  root: {
    position: "relative",
    height: "100dvh",
    maxHeight: "100dvh",
    width: "100%",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
    background: "var(--bg-primary)",
    overflow: "hidden",
  },
  // LEFT 33% — social icon water-bubble popups (the car/traffic animation was
  // removed; the 33% width allocation is preserved so the page layout never
  // shifts). Overflow hidden keeps every 90px popup inside this zone only.
  roadZone: {
    position: "relative",
    width: "33%",
    height: "100%",
    flexShrink: 0,
    overflow: "hidden",
  },
  // CENTER 34% — messenger only, vertically + horizontally centered.
  centerZone: {
    position: "relative",
    width: "34%",
    height: "100%",
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  // RIGHT 33% — the existing 60 flying language bubbles (zone-clipped).
  bubbleZone: {
    position: "relative",
    width: "33%",
    height: "100%",
    flexShrink: 0,
    overflow: "hidden",
  },
  bubblesLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: 0,
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
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderBottom: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
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
    margin: 0,
    fontSize: "11px",
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Right-side header cluster: dynamic status circle + Uiverse Slice buttons
  // + the Websmith mask circle (top-right inside the chat card).
  headerRight: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
  },
  statusWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
  },
  // The circular mask image — always clamped inside its circle (overflow
  // hidden + 50% radius + cover fit, sized 100% of the circle and centered).
  maskImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
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
    <div className="ws-chat-root" style={styles.root}>
      {/* Responsive layout rules + header status circle / tooltip / Slice
          buttons / in-card mask circle. */}
      <style jsx>{`
        /* Below 900px: decorations hide, messenger becomes the full-width
           centered card (desktop-only 33/34/33 split). */
        @media (max-width: 900px) {
          .ws-road-zone,
          .ws-bubble-zone {
            display: none !important;
          }
          .ws-center-zone {
            width: 100% !important;
          }
          .ws-chat-root {
            padding: 10px !important;
          }
        }

        /* ---- Dynamic status circle (open → green, closed → red) ---- */
        .ws-status-dot {
          width: 12px;
          height: 12px;
          flex-shrink: 0;
          display: inline-block;
          border-radius: 50%;
          cursor: help;
          outline: none;
        }
        .ws-status-dot-open {
          background: #34c759;
          box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.16), 0 0 10px rgba(52, 199, 89, 0.45);
        }
        .ws-status-dot-closed {
          background: #ff3b30;
          box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.16), 0 0 10px rgba(255, 59, 48, 0.4);
        }
        .ws-status-dot-pending {
          background: var(--text-muted);
        }
        .ws-status-dot:focus-visible {
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7), 0 0 12px rgba(20, 156, 234, 0.6);
        }

        /* ---- Status tooltip (hover / focus, fade + scale, no layout shift) ---- */
        .ws-status-tooltip {
          position: absolute;
          left: 50%;
          top: calc(100% + 9px);
          transform: translateX(-50%) scale(0.85);
          transform-origin: top center;
          opacity: 0;
          pointer-events: none;
          z-index: 20;
          white-space: nowrap;
          text-align: center;
          background: rgba(12, 18, 28, 0.97);
          color: #ffffff;
          font-size: 11px;
          font-weight: 500;
          line-height: 1.5;
          border-radius: 8px;
          padding: 6px 10px;
          border: 1px solid rgba(20, 156, 234, 0.28);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
          transition: opacity 180ms ease, transform 180ms cubic-bezier(0.83, 0, 0.17, 1);
        }
        .ws-status-tooltip strong {
          display: block;
          font-size: 11.5px;
          font-weight: 700;
        }
        .ws-status-wrap:hover .ws-status-tooltip,
        .ws-status-wrap:focus-within .ws-status-tooltip {
          opacity: 1;
          transform: translateX(-50%) scale(1);
        }

        /* ---- Uiverse Slice buttons (Client Login / Home) ---- */
        .slice {
          --c1: #202020;
          --c2: #149CEA;
          --size-letter: 14px;
          padding: 0.5em 1em;
          font-size: var(--size-letter);
          background-color: transparent;
          border: calc(var(--size-letter) / 6) solid var(--c2);
          border-radius: 0.2em;
          cursor: pointer;
          overflow: hidden;
          position: relative;
          transition: 300ms cubic-bezier(0.83, 0, 0.17, 1);
        }
        .slice > .text {
          font-weight: 700;
          color: var(--c2);
          position: relative;
          z-index: 1;
          transition: color 700ms cubic-bezier(0.83, 0, 0.17, 1);
        }
        .slice::after {
          content: "";
          width: 0;
          height: calc(300% + 1em);
          position: absolute;
          translate: -50% -50%;
          inset: 50%;
          rotate: 30deg;
          background-color: var(--c2);
          transition: 1000ms cubic-bezier(0.83, 0, 0.17, 1);
        }
        .slice:hover > .text {
          color: var(--c1);
        }
        .slice:hover::after {
          width: calc(120% + 1em);
          background-color: #1479EA;
        }
        .slice:active {
          scale: 0.98;
          filter: brightness(0.9);
        }

        /* ---- Websmith mask circle, top-right INSIDE the chat card header ---- */
        .ws-header-mask {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 50%;
          overflow: hidden;
          box-sizing: border-box;
          background: var(--bg-secondary);
          border: 1px solid rgba(20, 156, 234, 0.35);
          box-shadow: 0 0 0 3px rgba(20, 156, 234, 0.12), 0 0 14px rgba(20, 156, 234, 0.22);
        }
        @media (max-width: 480px) {
          .ws-header-mask {
            width: 36px !important;
            height: 36px !important;
          }
          .slice {
            --size-letter: 11px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ws-status-tooltip {
            transition: none;
          }
          .slice,
          .slice::after,
          .slice > .text {
            transition: none;
          }
        }
      `}</style>

      {/* LEFT 33% — SOCIAL ICON WATER-BUBBLE POPUPS (the car/traffic animation
          stays removed; the 33% width allocation is preserved so the layout
          never shifts). Popups are confined to this zone only. */}
      <div className="ws-road-zone" style={styles.roadZone} aria-hidden="true">
        <SocialIconPops />
      </div>

      {/* CENTER 34% — the existing messenger card, unchanged */}
      <div className="ws-center-zone" style={styles.centerZone}>
        <div className="ws-chat-card" style={styles.card}>
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
          {/* Dynamic status circle + Uiverse Slice buttons + mask circle */}
          <div style={styles.headerRight}>
            {conversation ? (
              <span className="ws-status-wrap" style={styles.statusWrap}>
                <span
                  role="status"
                  tabIndex={0}
                  aria-label={isClosed ? "Conversation closed" : "Conversation open"}
                  className={`ws-status-dot ${isClosed ? "ws-status-dot-closed" : "ws-status-dot-open"}`}
                />
                <span className="ws-status-tooltip" role="tooltip">
                  <strong>{isClosed ? "Closed" : "Open"}</strong>
                  {isClosed ? "Chat is closed" : "Chat is active"}
                </span>
              </span>
            ) : (
              <span
                role="status"
                aria-label="Conversation status pending"
                className="ws-status-dot ws-status-dot-pending"
              />
            )}
            <a href="https://www.websmithdigital.com/login" className="slice" aria-label="Client login">
              <span className="text">Client Login</span>
            </a>
            <a href="https://www.websmithdigital.com/" className="slice" aria-label="Home">
              <span className="text">Home</span>
            </a>
            <div className="ws-header-mask" aria-hidden="true">
              <img
                src="/images/wsd.png"
                alt=""
                style={styles.maskImage}
                draggable={false}
                decoding="async"
              />
            </div>
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

      {/* RIGHT 33% — the existing 60 flying language bubbles + random 3x zoom */}
      <div className="ws-bubble-zone" style={styles.bubbleZone}>
        <FlyingBubbles />
      </div>
    </div>
  );
}
