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
//            LEFT  (33%)  ATMOSPHERE + SOCIAL POPUPS + CHAT STICKERS — the left
//                    zone hosts THREE stacked layers that COORDINATE through a
//                    shared occupancy map (zero overlap by construction):
//                    layer order (bottom -> top): subtle dim/light atmosphere
//                    -> social icon water-bubble popups -> chat stickers on TOP:
//                     (a) SOCIAL ICON WATER-BUBBLE POPUPS: 90px popups that POP
//                    into existence (0 -> 90px over ~0.5s), live >= 1s, then
//                    fade; at most 5 coexist and are replaced continuously. Every
//                    popup uses a RANDOM real `public/social_icon` SVG (all 35
//                    participate) inside a random mask shape. Each popup CLAIMS a
//                    rotation-safe bounding rect in the shared occupancy map and
//                    only spawns when a non-overlapping spot exists (otherwise it
//                    WAITS and retries — never a blank/overlapping popup).
//                     (b) CHAT STICKERS (`ChatStickers`): colorful illustrated
//                    speech-bubble stickers that carry short Websmith support
//                    messages. Each sticker SLOWLY zooms in, holds for a long
//                    readable time, then slowly zooms/fades out and is replaced
//                    (max 2 coexist; life 10-16s; gaps 2.5-5s). Every sticker is
//                    measured against the SAME shared occupancy map and retried
//                    up to 24 times before being removed (never blank, never
//                    overlapping popups or other stickers). Random message /
//                    color / organic blob shape / speech-tail side / rotation /
//                    lifetime; thick white outline, soft 3D shadow, glossy
//                    highlight. A barely-visible slow dim -> light atmosphere
//                    pulse sits behind the popups. The car/traffic animation is
//                    NOT re-added; the 33% width allocation is preserved so the
//                    page layout never shifts.
//            CENTER (34%)  MESSENGER ONLY — the Websmith-skinned chat card:
//                    messages, composer, Send, Client Login, Home, dynamic
//                    Open/Closed status dot + tooltip, secure JWT chat, live 3s
//                    polling, in-card Websmith mask circle. Elegant visual skin
//                    only (skin = branded header band INSIDE the card, blue-tinted
//                    header/body/bubbles,
//                    focused composer ring, gradient Send) — ALL messenger logic
//                    unchanged. Vertically and horizontally centered.
//            RIGHT  (33%)  THE FLYING LANGUAGE BUBBLES — EXACTLY 30 bubbles
//                    (the first 30 real `public/wds_icon` assets), arranged in
//                    5 phase-locked columns x 6 rows so bubbles NEVER overlap:
//                    each column owns a fixed horizontal slot (10/30/50/70/90%),
//                    shares ONE duration, and rows are staggered by exactly
//                    duration/6 — constant vertical separation forever. Bubble
//                    size is responsive (clamp(30px, 4vw, 64px)) and NEVER
//                    larger than the original 80px; gentle +-4px sway; subtle
//                    opacity; continuous bottom -> top looping. The independent
//                    RANDOM 3× ZOOM is preserved (one bubble at a time: scale(3),
//                    ~1.5s hold, back; transform only, no reflow, zone-clipped,
//                    never covers the messenger). All bubbles stay inside the
//                    right 33% zone.
//          Below 900px the left zone + bubbles hide and the messenger becomes
//          the full-width centered card (decorations are desktop-only);
//          `prefers-reduced-motion` stops all animation.
//          All logic (token, poll, send, status, contact info, no-executive
//          message) is unchanged.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, Send, ShieldCheck, XCircle } from "lucide-react";
import { renderMessageHtml } from "@/core/services/messageRender";
import { useMediaAsset } from "@/hooks/useMediaAsset";
import { ChatSkinPicker } from "@/components/shared/ChatSkinPicker";
import { CHAT_SURFACE_CSS } from "@/components/shared/chatSurfaceCss";
import {
  CHAT_SKINS,
  ChatSkin,
  DEFAULT_SKIN_ID,
  getChatSkin,
  readStoredSkinId,
  storeSkinId,
} from "./chatSkins";

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

// EXACTLY 30 flying bubbles — the first 30 real icons (5 columns x 6 rows,
// phase-locked so they never touch; see FlyingBubbles). Only real
// public/wds_icon assets participate — nothing invented.
const LANG_ICONS_30: string[] = LANG_ICONS.slice(0, 30);

// Random 3x zoom timing: at random intervals ONE bubble zooms to 3x its
// responsive size (scale(3)), holds ~1.5s, returns. Next selection can begin
// while the previous bubble is returning (transition-only overlap, never two
// holds).
const ZOOM_MIN_DELAY_MS = 2_300;
const ZOOM_MAX_DELAY_MS = 4_500;
const ZOOM_DURATION_MS = 3_000; // 0.75s in + 1.5s hold + 0.75s out (CSS 3s)

// Bubble field layout: exactly 30 bubbles = 5 phase-locked columns x 6 rows.
// Column slots [10,30,50,70,90]% keep columns far apart; each column shares
// ONE duration and rows are staggered by exactly duration/6, so every bubble
// in a column keeps a constant vertical separation forever — zero overlap by
// construction (columns never collide horizontally either, the slots + the
// 64px max size leave ~40px gaps). Bubble size is responsive and NEVER larger
// than the original 80px. The random 3x zoom stays (transient, zone-clipped).
const BUBBLE_COLUMNS = 5;
const BUBBLE_ROWS = 6;
const BUBBLE_COUNT = BUBBLE_COLUMNS * BUBBLE_ROWS; // 30
const BUBBLE_SLOTS = [10, 30, 50, 70, 90];
const BUBBLE_MIN_DURATION = 20; // seconds for the full 115vh travel
const BUBBLE_MAX_DURATION = 32;
const BUBBLE_SWAY_MAX_PX = 4; // gentle +-4px sway (was +-10px)

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
 * RIGHT ZONE — THE FLYING LANGUAGE BUBBLES (EXACTLY 30, ZERO OVERLAP):
 *
 *  30 programming-language bubbles (the first 30 REAL public/wds_icon assets,
 *  circular masks with `border-radius: 50%` + `overflow: hidden`) arranged in
 *  a deterministic 5-column x 6-row grid so they NEVER overlap:
 *    - each column owns a fixed horizontal slot (10/30/50/70/90% of the zone);
 *    - each column shares ONE travel duration and rows are staggered by exactly
 *      duration/6 (negative delay = rowIndex * duration / 6), so every bubble
 *      in a column keeps a CONSTANT vertical separation forever (phase-locked);
 *    - the slot gaps (~105px at 1600px) exceed the bubble's max 64px width, so
 *      columns never collide horizontally either.
 *  Bubble size is responsive (`clamp(30px, 4vw, 64px)`) and NEVER larger than
 *  the original 80px; gentle +-4px sway; subtle background opacity; continuous
 *  bottom -> top (~115vh) looping with negative delays = mid-flight on load.
 *
 *  ZOOM (preserved) — independent random 3x zoom: at random intervals ONE
 *  bubble smoothly scales to 3x its size, holds ~1.5s, returns; the next zoom
 *  may start while the previous is returning (transition-only overlap).
 *  Transform-based — no layout reflow, zone-clipped, never covers the
 *  messenger. All bubbles stay inside the right 33% zone.
 *
 * Data is randomized once per mount (useMemo); animations run in CSS.
 */
function FlyingBubbles() {
  const bubbles = useMemo(() => {
    const list: Array<{
      id: number;
      icon: string;
      col: number;
      row: number;
      left: number;
      bottom: number;
      duration: number;
      delay: number;
      sway: number;
      swayDuration: number;
      bgOpacity: number;
      iconOpacity: number;
    }> = [];
    for (let col = 0; col < BUBBLE_COLUMNS; col++) {
      const duration = BUBBLE_MIN_DURATION + Math.random() * (BUBBLE_MAX_DURATION - BUBBLE_MIN_DURATION);
      for (let row = 0; row < BUBBLE_ROWS; row++) {
        const idx = col * BUBBLE_ROWS + row;
        list.push({
          id: idx,
          icon: LANG_ICONS_30[idx],
          col,
          row,
          // Fixed per-column slot — bubbles in different columns can never meet.
          left: BUBBLE_SLOTS[col],
          // Start below the zone so the balloon rises into view (stable — never
          // recomputed on re-render, so zoom state changes never move bubbles).
          bottom: -96 - Math.random() * 32,
          duration,
          // Phase-lock: row r is delayed by r/6 of the column travel, so rows
          // keep a constant gap. Mid-flight on load (negative delay).
          delay: -(row / BUBBLE_ROWS) * duration,
          // Gentle +-4px sway (reduced from the old +-10px).
          sway: BUBBLE_SWAY_MAX_PX + Math.random() * 1.2,
          swayDuration: 3.5 + Math.random() * 3,
          // Subtle background opacity 0.08-0.24.
          bgOpacity: 0.08 + Math.random() * 0.16,
          iconOpacity: 0.85 + Math.random() * 0.15,
        });
      }
    }
    return list;
  }, []);

  // RANDOM 3x ZOOM: exactly one bubble zooms at a time. `key` remounts the
  // chip so the CSS animation restarts on every new selection.
  const [zoom, setZoom] = useState<{ idx: number; key: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setZoom((prev) => {
            let next = Math.floor(Math.random() * BUBBLE_COUNT);
            if (prev && next === prev.idx) {
              next = (next + 1 + Math.floor(Math.random() * (BUBBLE_COUNT - 1))) % BUBBLE_COUNT;
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
                ...({ "--ws-sway": `${b.sway}px` } as React.CSSProperties),
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
                  width={64}
                  height={64}
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
            transform: translateX(calc(-1 * var(--ws-sway, 4px)));
          }
          50% {
            transform: translateX(var(--ws-sway, 4px));
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
          --ws-bubble-size: clamp(30px, 4vw, 64px);
        }
        .ws-bubble-sway {
          will-change: transform;
          --ws-sway: 4px;
        }
        .ws-bubble-chip {
          width: var(--ws-bubble-size);
          height: var(--ws-bubble-size);
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
        .ws-bubble-chip img {
          width: calc(var(--ws-bubble-size) * 0.82);
          height: calc(var(--ws-bubble-size) * 0.82);
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

// ---- LEFT ZONE — SHARED OCCUPANCY MAP -------------------------------------
// BOTH left-zone animation layers (social popups + chat stickers) claim their
// bounding rects in ONE shared map, so they can never overlap each other (or
// their own kind) — zero blank popups, zero collisions, by construction.
// Keys are namespaced (`sticker:<id>` / `popup:<id>`). Claims are made
// SYNCHRONOUSLY (ref mutation during render/effects) so React batching can
// never race two placements into the same spot.
interface OccRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Occupancy = Map<string, OccRect>;

const OCC_MARGIN = 12; // px minimum visual gap between any two left-zone items

// True when the rect (x,y,w,h) collides with any OTHER claimed rect. `key` is
// the caller's own map key and is skipped so a re-check never sees itself.
const occOverlaps = (occ: Occupancy, key: string, x: number, y: number, w: number, h: number): boolean => {
  for (const [k, r] of occ) {
    if (k === key) continue;
    if (
      x < r.x + r.w + OCC_MARGIN &&
      x + w + OCC_MARGIN > r.x &&
      y < r.y + r.h + OCC_MARGIN &&
      y + h + OCC_MARGIN > r.y
    ) {
      return true;
    }
  }
  return false;
};

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
// ZERO OVERLAP / ZERO BLANK POPUPS: each popup CLAIMS a rotation-safe rect in
// the shared occupancy map BEFORE it is shown; a spawn attempt that cannot
// find a non-overlapping spot is skipped and the ticker WAITS and retries on
// the next tick — a popup is never rendered blank, off-screen or on top of
// another item.
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

// The claimed rect is slightly larger than the 90px bubble so a rotated popup
// (+-12deg -> ~107px bounding box) can never visually touch its neighbors.
const POP_CLAIM = 108;

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

function SocialIconPops({ occupancy }: { occupancy: React.MutableRefObject<Occupancy> }) {
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

  // Spawn attempts to find a non-overlapping spot (against the SHARED occupancy
  // map, so it never lands on another popup or a chat sticker) and CLAIMS the
  // rotation-safe rect before returning. If no spot exists after 24 tries it
  // returns null — the ticker WAITS and retries on the next tick. A popup is
  // therefore never blank, never off-screen, never overlapping.
  const spawn = useCallback((): SocialPop | null => {
    if (!zone || zone.w < POP_FULL_SIZE + POP_SAFE * 2 || zone.h < POP_FULL_SIZE + POP_SAFE * 2) return null;
    const halfPad = (POP_CLAIM - POP_FULL_SIZE) / 2;
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = POP_SAFE + Math.random() * (zone.w - POP_FULL_SIZE - POP_SAFE * 2);
      const y = POP_SAFE + Math.random() * (zone.h - POP_FULL_SIZE - POP_SAFE * 2);
      const pop: SocialPop = {
        id: nextId.current++,
        icon: SOCIAL_ICONS[Math.floor(Math.random() * SOCIAL_ICONS.length)],
        x,
        y,
        shape: POP_SHAPES[Math.floor(Math.random() * POP_SHAPES.length)],
        rotate: Math.round((Math.random() - 0.5) * 24),
        life: POP_MIN_LIFE_MS + Math.random() * (POP_MAX_LIFE_MS - POP_MIN_LIFE_MS),
      };
      const key = `popup:${pop.id}`;
      const cx = Math.max(0, x - halfPad);
      const cy = Math.max(0, y - halfPad);
      if (occOverlaps(occupancy.current, key, cx, cy, POP_CLAIM, POP_CLAIM)) continue;
      occupancy.current.set(key, { x: cx, y: cy, w: POP_CLAIM, h: POP_CLAIM });
      return pop;
    }
    return null;
  }, [zone, occupancy]);

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
            occupancy.current.delete(`popup:${p.id}`);
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
      for (const k of [...occupancy.current.keys()]) {
        if (k.startsWith("popup:")) occupancy.current.delete(k);
      }
    };
  }, [zone, spawn, occupancy]);

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

// ---- LEFT ZONE — CHAT-STICKER ATMOSPHERE LAYER -----------------------------
// The TOP-most animation layer inside the SAME left 33% zone (layer order:
// background -> dim/light atmosphere -> social popups -> chat stickers ON TOP).
// Colorful illustrated speech-bubble "stickers" carry a short Websmith support
// message, SLOWLY zoom in, hold for a long READABLE time, then slowly
// zoom/fade out and are replaced. SLOWER pacing: max 2 coexist, visible life
// 10-16s, random appearance gaps 2.5-5s. Every sticker gets a random message /
// color / organic blob shape / speech-tail side / rotation / lifetime; thick
// white outline, soft 3D shadow + glossy highlight, compact dimensions, text
// always contained inside the sticker.
// ZERO OVERLAP / ZERO BLANK: each sticker is measured against the SHARED
// occupancy map (social popups + other stickers) and retried up to 24 times;
// if no safe spot exists it is removed (never rendered blank or overlapping)
// and a later loop tick retries. A sticker is removed by its lifetime timer and
// a NEW element is created for the next one — it always fully disappears
// (fades out) before any fresh sticker appears elsewhere (no teleporting).
// Positions are measured from the real zone so the whole sticker (incl. its
// tail) always stays inside the left 33% area — never into the center/right.
const STICKER_MESSAGES: string[] = [
  "Hey! 👋 We are Websmith.",
  "Hi! How may we assist you?",
  "Need technical support? 💬",
  "Looking for a digital solution?",
  "Our team is here to help. 😊",
  "Let's build something great!",
  "Need help with your project?",
  "Welcome to Websmith! 👋",
  "Tell us what you are building.",
  "Looking for developers?",
];

interface StickerColor {
  name: string;
  from: string;
  to: string;
}

// Color variety across stickers — green / pink / red / orange / blue / purple
// + complementary teal / amber / indigo / rose. A vibrant gradient interior.
const STICKER_COLORS: StickerColor[] = [
  { name: "green", from: "#66e085", to: "#1faf4f" },
  { name: "pink", from: "#ff9ecb", to: "#e34d9f" },
  { name: "red", from: "#ff8a80", to: "#e53935" },
  { name: "orange", from: "#ffb26b", to: "#f26d1d" },
  { name: "blue", from: "#6fc3ff", to: "#2f80ed" },
  { name: "purple", from: "#b394ff", to: "#7b4ff2" },
  { name: "teal", from: "#5ee6d0", to: "#10a88a" },
  { name: "amber", from: "#ffd34d", to: "#f0a312" },
  { name: "indigo", from: "#9da6ff", to: "#5c63e8" },
  { name: "rose", from: "#ff9aa8", to: "#ef4b68" },
];

// Organic / irregular rounded bubble shapes (blob-like border-radius, so no
// two stickers are ever a plain rectangle).
const STICKER_SHAPES: string[] = [
  "42% 58% 56% 44% / 48% 42% 58% 52%",
  "58% 42% 44% 56% / 52% 58% 42% 48%",
  "50% 56% 46% 50% / 56% 48% 52% 44%",
  "60% 40% 56% 44% / 44% 60% 40% 56%",
  "44% 60% 40% 56% / 58% 42% 56% 44%",
  "52% 48% 62% 38% / 40% 56% 44% 60%",
];

// SLOW pacing — a sticker SLOWLY zooms in, holds for a long readable time,
// then slowly fades out; at most 2 coexist and there is a long gap (2.5-5s)
// before the next one appears.
const STICKER_MAX_ACTIVE = 2; // max coexisting — the left zone never feels busy
const STICKER_MAX_WIDTH = 165; // px, compact — text wraps inside the sticker
const STICKER_SAFE = 8; // px keep-out from the zone edges (whole sticker + tail)
const STICKER_MIN_LIFE_MS = 10_000; // visible-duration range (slow, readable)
const STICKER_MAX_LIFE_MS = 16_000;
const STICKER_MIN_GAP_MS = 2_500; // random appearance delay between spawns
const STICKER_MAX_GAP_MS = 5_000;

interface ChatSticker {
  id: number;
  message: string;
  colorIdx: number;
  shapeIdx: number;
  tailSide: "left" | "right";
  rotate: number;
  life: number;
  floatDur: number;
  floatDelay: number;
  stage: "pending" | "placed";
  x: number;
  y: number;
}

// CSS is injected via a plain <style dangerouslySetInnerHTML> tag (styled-jsx
// strips template interpolations — the documented pattern). `scale` / `rotate`
// / `translate` individual transform properties compose, so the life animation
// (scale + opacity) and the gentle float never fight each other. Layer order
// is enforced here: the atmosphere (bottom, z-index 0) sits below the social
// popup layer, and the sticker layer (z-index 1) paints ON TOP of the popups.
const STICKER_CSS = `
.ws-atmosphere{position:absolute;inset:0;background:rgba(255,255,255,0.06);animation:wsAtmosphere 10s ease-in-out infinite alternate;z-index:0;}
@keyframes wsAtmosphere{from{opacity:0.3;}to{opacity:1;}}
.ws-stickers-layer{position:absolute;inset:0;overflow:hidden;z-index:1;}
.ws-sticker{position:absolute;pointer-events:none;will-change:left,top,transform;}
.ws-sticker-anim{will-change:transform,opacity;transform-origin:center;}
.ws-sticker-bubble{position:relative;box-sizing:border-box;border:4px solid rgba(255,255,255,0.92);padding:14px 16px 18px;box-shadow:0 10px 22px rgba(0,0,0,0.28),0 3px 8px rgba(0,0,0,0.18),inset 0 2px 6px rgba(255,255,255,0.45),inset 0 -6px 12px rgba(0,0,0,0.12);}
.ws-sticker-bubble::before{content:"";position:absolute;left:12%;top:7%;width:46%;height:36%;background:linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0));border-radius:50%;pointer-events:none;filter:blur(1px);}
.ws-sticker-text{display:block;font-size:13px;font-weight:700;line-height:1.32;letter-spacing:0.1px;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.28);white-space:normal;text-align:center;}
.ws-sticker-tail{position:absolute;bottom:-7px;width:24px;height:24px;background:#ffffff;border-radius:4px;transform:rotate(45deg);box-shadow:0 6px 10px rgba(0,0,0,0.22);}
.ws-sticker-tail-left{left:24%;}
.ws-sticker-tail-right{left:60%;}
.ws-sticker-tail-inner{position:absolute;inset:4px;border-radius:3px;}
@keyframes wsStickerLife{0%{scale:0;opacity:0;}12%{scale:1.04;opacity:1;}16%{scale:1;opacity:1;}86%{scale:1;opacity:1;}94%{scale:0.95;opacity:0.7;}100%{scale:0.7;opacity:0;}}
@keyframes wsStickerFloat{0%,100%{translate:0 0;}50%{translate:0 -3px;}}
@media (prefers-reduced-motion:reduce){.ws-atmosphere,.ws-sticker,.ws-sticker-anim{display:none !important;}}
`;

function ChatStickers({ occupancy }: { occupancy: React.MutableRefObject<Occupancy> }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [zone, setZone] = useState<{ w: number; h: number } | null>(null);
  const [stickers, setStickers] = useState<ChatSticker[]>([]);
  const nextId = useRef(0);
  const activeRef = useRef(0);
  const activeIds = useRef<Set<number>>(new Set());
  const removalTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // Measure the real left-zone size. On mobile the zone is display:none -> it
  // measures 0 -> no stickers are spawned. Only update when the size actually
  // changes so a no-op ResizeObserver tick never churns the effects below.
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setZone((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // When the zone becomes too small (or hidden) drop every live sticker and
  // re-clamp the rest on resize so nothing is ever placed outside the zone.
  // Only the sticker claims are touched — social popup claims stay owned by
  // the popups component.
  useEffect(() => {
    if (!zone) return;
    if (zone.w < 260 || zone.h < 320) {
      setStickers([]);
      for (const k of [...occupancy.current.keys()]) {
        if (k.startsWith("sticker:")) occupancy.current.delete(k);
      }
      activeIds.current.clear();
      activeRef.current = 0;
      return;
    }
    setStickers((cur) =>
      cur.map((s) => {
        if (s.stage !== "placed") return s;
        const r = occupancy.current.get(`sticker:${s.id}`);
        if (!r) return s;
        const maxX = Math.max(0, zone.w - r.w);
        const maxY = Math.max(0, zone.h - r.h);
        const nx = Math.min(s.x, maxX);
        const ny = Math.min(s.y, maxY);
        occupancy.current.set(`sticker:${s.id}`, { x: nx, y: ny, w: r.w, h: r.h });
        return { ...s, x: nx, y: ny };
      })
    );
  }, [zone, occupancy]);

  const removeSticker = useCallback(
    (id: number) => {
      if (!activeIds.current.has(id)) return;
      activeIds.current.delete(id);
      occupancy.current.delete(`sticker:${id}`);
      activeRef.current -= 1;
      setStickers((cur) => cur.filter((s) => s.id !== id));
    },
    [occupancy]
  );

  // Measure the freshly-mounted pending sticker and place it at a random SAFE
  // position: clamped inside the zone so the whole sticker + tail always stay
  // inside, and checked against the SHARED occupancy map (social popups + other
  // stickers) with up to 24 retries. If no safe spot exists the sticker is
  // REMOVED (never blank, never overlapping) and a later loop tick retries —
  // this also guarantees the sticker fully disappears before any fresh one
  // appears elsewhere (no teleporting: a placed sticker never moves).
  const placeSticker = useCallback(
    (id: number, life: number, el: HTMLDivElement) => {
      const layer = layerRef.current;
      if (!layer || !zone) return;
      const zoneRect = layer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const w = elRect.width;
      const h = elRect.height;
      if (w <= 0 || h <= 0) {
        removeSticker(id);
        return;
      }
      const maxX = Math.max(0, zoneRect.width - w);
      const maxY = Math.max(0, zoneRect.height - h);
      const usableX = Math.max(0, maxX - STICKER_SAFE);
      const usableY = Math.max(0, maxY - STICKER_SAFE);
      const key = `sticker:${id}`;
      const overlaps = (x: number, y: number) => occOverlaps(occupancy.current, key, x, y, w, h);
      let x = STICKER_SAFE + Math.random() * usableX;
      let y = STICKER_SAFE + Math.random() * usableY;
      for (let i = 0; i < 24 && overlaps(x, y); i++) {
        x = STICKER_SAFE + Math.random() * usableX;
        y = STICKER_SAFE + Math.random() * usableY;
      }
      if (overlaps(x, y)) {
        // No safe spot right now — wait for a later loop tick to retry; never
        // render a blank or overlapping sticker.
        removeSticker(id);
        return;
      }
      x = Math.min(x, maxX);
      y = Math.min(y, maxY);
      occupancy.current.set(key, { x, y, w, h });
      removalTimers.current.push(setTimeout(() => removeSticker(id), life));
      setStickers((cur) => cur.map((s) => (s.id === id ? { ...s, stage: "placed", x, y } : s)));
    },
    [zone, removeSticker, occupancy]
  );

  // Continuous spawn loop: staggered start, then one sticker at a time with a
  // long random appearance delay (2.5-5s); never more than STICKER_MAX_ACTIVE
  // at once. Every sticker is removed (recycled) after its lifetime — bounded
  // elements, no memory growth. The cleanup ONLY clears this loop's own spawn
  // timers — the sticker lifecycle state (activeIds / occupancy / removalTimers
  // / activeRef) is torn down by the unmount-only effect below so a plain
  // resize never orphans placed stickers or cancels their removal timers.
  useEffect(() => {
    if (!zone || zone.w < 260 || zone.h < 320 || reducedMotion) return;
    let disposed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (delay: number) => {
      timers.push(
        setTimeout(() => {
          if (disposed) return;
          if (activeRef.current < STICKER_MAX_ACTIVE) {
            const s: ChatSticker = {
              id: nextId.current++,
              message: STICKER_MESSAGES[Math.floor(Math.random() * STICKER_MESSAGES.length)],
              colorIdx: Math.floor(Math.random() * STICKER_COLORS.length),
              shapeIdx: Math.floor(Math.random() * STICKER_SHAPES.length),
              tailSide: Math.random() < 0.5 ? "left" : "right",
              rotate: Math.round((Math.random() - 0.5) * 14),
              life: STICKER_MIN_LIFE_MS + Math.random() * (STICKER_MAX_LIFE_MS - STICKER_MIN_LIFE_MS),
              floatDur: 3.5 + Math.random() * 2.5,
              floatDelay: Math.random() * 2,
              stage: "pending",
              x: 0,
              y: 0,
            };
            activeIds.current.add(s.id);
            activeRef.current += 1;
            setStickers((prev) => [...prev, s]);
          }
          schedule(STICKER_MIN_GAP_MS + Math.random() * (STICKER_MAX_GAP_MS - STICKER_MIN_GAP_MS));
        }, delay)
      );
    };
    schedule(500);
    schedule(1_400);
    schedule(2_300);
    return () => {
      disposed = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [zone, reducedMotion]);

  // Unmount-only teardown: cancel every pending removal timer and reset all
  // lifecycle counters so nothing keeps running after this component goes away.
  // Only sticker claims are released — popup claims stay owned by popups.
  useEffect(() => {
    return () => {
      activeIds.current.clear();
      for (const k of [...occupancy.current.keys()]) {
        if (k.startsWith("sticker:")) occupancy.current.delete(k);
      }
      removalTimers.current.forEach((t) => clearTimeout(t));
      removalTimers.current = [];
      activeRef.current = 0;
    };
  }, [occupancy]);

  return (
    <div className="ws-stickers-layer" ref={layerRef} aria-hidden="true">
      {stickers.map((s) => {
        const c = STICKER_COLORS[s.colorIdx];
        return (
          <div
            key={s.id}
            className="ws-sticker"
            ref={(el) => {
              if (el && s.stage === "pending") placeSticker(s.id, s.life, el);
            }}
            style={{
              left: s.x,
              top: s.y,
              rotate: `${s.rotate}deg`,
              visibility: s.stage === "pending" ? "hidden" : "visible",
            }}
          >
            <div
              className="ws-sticker-anim"
              style={{
                animation:
                  s.stage === "placed"
                    ? `wsStickerLife ${s.life}ms cubic-bezier(0.33,1,0.68,1) forwards, wsStickerFloat ${s.floatDur}s ease-in-out ${s.floatDelay}s infinite`
                    : undefined,
              }}
            >
              <div
                className="ws-sticker-bubble"
                style={{
                  background: `linear-gradient(145deg, ${c.from}, ${c.to})`,
                  borderRadius: STICKER_SHAPES[s.shapeIdx],
                  maxWidth: STICKER_MAX_WIDTH,
                }}
              >
                <span className="ws-sticker-text">{s.message}</span>
                <div className={`ws-sticker-tail ws-sticker-tail-${s.tailSide}`}>
                  <div className="ws-sticker-tail-inner" style={{ background: c.to }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <style dangerouslySetInnerHTML={{ __html: STICKER_CSS }} />
    </div>
  );
}

// LEFT ZONE VISUALS — the three coordinated layers (bottom -> top): subtle
// dim/light atmosphere -> social icon water-bubble popups -> chat stickers on
// TOP. A SINGLE shared occupancy map (`occupancyRef`) is passed to both
// animation components so a sticker can never overlap a popup (or another
// sticker) and vice versa — zero blank popups, zero collisions, guaranteed.
function LeftZoneVisuals() {
  const occupancyRef = useRef<Occupancy>(new Map());
  return (
    <>
      <div className="ws-atmosphere" />
      <SocialIconPops occupancy={occupancyRef} />
      <ChatStickers occupancy={occupancyRef} />
    </>
  );
}

// ---- SKIN PICKER -----------------------------------------------------------
// The in-messenger gallery for the 10 production skins is the SHARED
// `ChatSkinPicker` component (`components/shared/ChatSkinPicker.tsx`) — the
// same picker the Admin Messenger uses. It swaps ONLY CSS custom properties on
// this existing single chat card; no second chat implementation exists and no
// chat logic is involved.

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
    background: "var(--sk-backdrop)",
    overflow: "hidden",
  },
  // LEFT 33% — atmosphere + social popups + chat stickers (coordinated via the
  // shared occupancy map; the car/traffic animation was removed; the 33% width
  // allocation is preserved so the page layout never shifts). Overflow hidden
  // keeps every 90px popup + sticker inside this zone only.
  roadZone: {
    position: "relative",
    width: "33%",
    height: "100%",
    flexShrink: 0,
    overflow: "hidden",
  },
  // CENTER 34% — messenger only, vertically + horizontally centered. R01
  // visual fix: this zone has NO background layer of its own — the ONE unified
  // window color (--sk-backdrop on the root) shows through continuously across
  // left + center + right, so the messenger card is the only surface here.
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
  // RIGHT 33% — the 30 flying language bubbles (phase-locked, zone-clipped).
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
  // THE actual Messenger container — the Websmith skin header lives INSIDE
  // this card (see `header` below), never as a wrapper or page-level
  // background behind it. Clear space above/below, responsive.
  card: {
    position: "relative",
    zIndex: 1,
    width: "min(550px, 100%)",
    height: "min(800px, 92dvh)",
    maxHeight: "92dvh",
    display: "flex",
    flexDirection: "column",
    borderRadius: "22px",
    border: "1px solid var(--sk-card-border)",
    background: "var(--sk-card-bg)",
    boxShadow: "var(--sk-card-shadow)",
    overflow: "hidden",
  },
  // THE Websmith skin header band INSIDE the Messenger card — clean and
  // professional: nav cluster (left) · team identity with live status (center)
  // · logo mask (right). Flat skin background, no inset accent layering.
  header: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderBottom: "1px solid var(--sk-header-border)",
    background: "var(--sk-header-bg)",
  },
  // Left header cluster: Client Login / Home / theme picker.
  headerNav: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  // Team identity line: live status dot + "Websmith Digital Support".
  headerTitle: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--sk-title)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Muted context line: contact · email · subject (full text on hover/title).
  headerSub: {
    margin: 0,
    fontSize: "11px",
    color: "var(--sk-subtitle)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
    background: "var(--sk-body-bg)",
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
  centerText: { margin: 0, color: "var(--sk-subtitle)", fontSize: "13px", lineHeight: 1.6, maxWidth: "380px" },
  centerTitle: { margin: 0, color: "var(--sk-title)", fontSize: "15px", fontWeight: 700 },
  row: { display: "flex", flexShrink: 0 },
  rowClient: { justifyContent: "flex-start" },
  rowAdmin: { justifyContent: "flex-end" },
  rowSystem: { justifyContent: "center" },
  bubbleClient: {
    maxWidth: "78%",
    border: "1px solid var(--sk-client-border)",
    borderRadius: "16px",
    borderTopLeftRadius: "5px",
    padding: "9px 12px",
    background: "var(--sk-client-bg)",
  },
  bubbleAdmin: {
    maxWidth: "78%",
    border: "1px solid var(--sk-admin-border)",
    borderRadius: "16px",
    borderTopRightRadius: "5px",
    padding: "9px 12px",
    background: "var(--sk-admin-bg)",
  },
  bubbleSystem: {
    maxWidth: "88%",
    border: "1px dashed var(--sk-system-border)",
    borderRadius: "12px",
    padding: "9px 12px",
    background: "var(--sk-system-bg)",
  },
  bubbleSender: { margin: 0, fontSize: "9px", fontWeight: 700, color: "var(--sk-sender)" },
  bubbleText: {
    margin: "3px 0",
    fontSize: "13px",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--sk-text)",
  },
  bubbleTime: { margin: 0, fontSize: "9px", color: "var(--sk-time)" },
  bubbleAttachments: { display: "flex", flexWrap: "wrap", gap: "5px 7px", marginTop: "4px" },
  attachmentLink: {
    fontSize: "11px",
    color: "var(--sk-link)",
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
    color: "var(--sk-system-text)",
  },
  systemLink: {
    color: "var(--sk-link)",
    textDecoration: "underline",
    fontSize: "12px",
  },
  composer: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px 12px",
    borderTop: "1px solid var(--sk-composer-border)",
    background: "var(--sk-composer-bg)",
  },
  composerRow: { display: "flex", alignItems: "flex-end", gap: "8px" },
  clientLoginRow: { display: "flex", alignItems: "center", gap: "6px" },
  clientLoginBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "1px solid var(--sk-btn-border)",
    background: "var(--sk-btn-bg)",
    color: "var(--sk-btn-text)",
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
    border: "1px solid var(--sk-input-border)",
    background: "var(--sk-input-bg)",
    color: "var(--sk-input-text)",
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
    background: "var(--sk-send-bg)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "var(--sk-send-shadow)",
  },
  connectedRow: { display: "flex", justifyContent: "center", paddingTop: "2px" },
  connectedPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "10.5px",
    color: "var(--sk-subtitle)",
  },
};

// ---- R01 FINAL: Uiverse-style directional border on the header buttons ----
// Client Login / Home / theme trigger. NORMAL = fully transparent chrome — NO
// background, NO card/container look (the real border slot stays transparent
// so nothing ever shifts). As the cursor approaches, JS records the NEAREST
// side on the element (data-border-side) and the ::before border draws in
// FROM that side; over the button it fully encircles; on leave it retracts
// toward that side. The draw is deliberately SLOW and premium: a long
// ease-out-quint clip-path glide (~0.8s) with a soft opacity fade, so motion
// never feels abrupt in either direction. Colors resolve ONLY from --sk-*
// tokens (accent-tinted per skin), so light and dark skins theme it
// automatically. Scoped under .ws-chat-root — this Direct Chat page only;
// the shared picker component and the Admin Messenger are untouched. Static
// string via a plain <style> tag (styled-jsx cannot reach the child
// ChatSkinPicker trigger DOM).
const HEADER_BORDER_CSS = `
.ws-chat-root .ws-nav-btn,
.ws-chat-root .ws-skin-trigger {
  position: relative;
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
}
.ws-chat-root .ws-center-zone .ws-skin-trigger:hover,
.ws-chat-root .ws-center-zone .ws-skin-trigger[aria-expanded="true"] {
  border-color: transparent !important;
  box-shadow: none !important;
}
.ws-chat-root .ws-nav-btn::before,
.ws-chat-root .ws-skin-trigger::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  border: 1px solid var(--sk-focus-border);
  opacity: 0;
  clip-path: inset(0 100% 0 0);
  transition:
    clip-path 0.8s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.5s ease;
  pointer-events: none;
}
.ws-chat-root [data-border-side="left"]::before { clip-path: inset(0 100% 0 0); }
.ws-chat-root [data-border-side="right"]::before { clip-path: inset(0 0 0 100%); }
.ws-chat-root [data-border-side="top"]::before { clip-path: inset(0 0 100% 0); }
.ws-chat-root [data-border-side="bottom"]::before { clip-path: inset(100% 0 0 0); }
.ws-chat-root .ws-nav-btn[data-border-hover="true"]::before,
.ws-chat-root .ws-skin-trigger[data-border-hover="true"]::before {
  opacity: 1;
  clip-path: inset(0 0 0 0);
}
.ws-chat-root .ws-skin-trigger[aria-expanded="true"]::before {
  opacity: 1;
  clip-path: inset(0 0 0 0);
}
@media (prefers-reduced-motion: reduce) {
  .ws-chat-root .ws-nav-btn::before,
  .ws-chat-root .ws-skin-trigger::before { transition: none; }
}
`;

export default function ClientChat({ ticketId }: { ticketId: string }) {
  const token = useMemo(readToken, []);
  const chatLogo = useMediaAsset("chat_messenger_logo");
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pollInFlight = useRef(false);

  // ---- SKIN STATE (presentation only — swaps CSS variables, never logic) ----
  const [skinId, setSkinId] = useState<string>(DEFAULT_SKIN_ID);
  const activeSkin = getChatSkin(skinId);
  useEffect(() => {
    const stored = readStoredSkinId();
    if (stored) setSkinId(stored);
  }, []);
  const handleSkinSelect = useCallback((id: string) => {
    setSkinId(id);
    storeSkinId(id);
  }, []);

  // ---- Header-button directional border (presentation only) ----------------
  // Pointer tracking for the Uiverse-style border draw: as the cursor
  // approaches Client Login / Home / the theme trigger, the NEAREST side is
  // written to data-border-side and the ::before border forms from that side;
  // on leave it retracts smoothly toward the same side. Purely visual.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const SELECTOR = ".ws-nav-btn, .ws-skin-trigger";
    const nearestSide = (el: Element, x: number, y: number): string => {
      const r = el.getBoundingClientRect();
      const dTop = y - r.top;
      const dBottom = r.bottom - y;
      const dLeft = x - r.left;
      const dRight = r.right - x;
      const min = Math.min(dTop, dBottom, dLeft, dRight);
      if (min === dLeft) return "left";
      if (min === dRight) return "right";
      if (min === dTop) return "top";
      return "bottom";
    };
    let active: Element | null = null;
    const onOver = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(SELECTOR) ?? null;
      if (!target || !rootEl.contains(target)) return;
      if (active && active !== target) active.removeAttribute("data-border-hover");
      active = target;
      target.setAttribute("data-border-side", nearestSide(target, event.clientX, event.clientY));
      target.setAttribute("data-border-hover", "true");
    };
    const onOut = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(SELECTOR) ?? null;
      if (!target || !rootEl.contains(target)) return;
      const next = event.relatedTarget as Element | null;
      if (next && target.contains(next)) return; // still inside this button
      target.setAttribute("data-border-hover", "false");
      if (active === target) active = null;
    };
    rootEl.addEventListener("pointerover", onOver);
    rootEl.addEventListener("pointerout", onOut);
    return () => {
      rootEl.removeEventListener("pointerover", onOver);
      rootEl.removeEventListener("pointerout", onOut);
    };
  }, []);

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
  // Header context line: contact · email · subject (each part omitted when
  // absent; full string available via the title attribute on hover).
  const headerContext = conversation
    ? [
        conversation.contactName || "Valued Customer",
        conversation.contactEmail || "",
        conversation.subject || "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "Your secure support conversation";
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
    <div
      ref={rootRef}
      className="ws-chat-root ws-chat-surface"
      data-ws-skin={activeSkin.id}
      style={{ ...styles.root, ...(activeSkin.vars as React.CSSProperties) }}
    >
      {/* R04 shared messenger polish (skin transitions, message entrance,
          Sending… pill, scrollbar, placeholder/focus theming) — ONE stylesheet
          shared with the Admin Messenger; every rule resolves --sk-* tokens. */}
      <style dangerouslySetInnerHTML={{ __html: CHAT_SURFACE_CSS }} />
      {/* R01 FINAL: Uiverse-style directional border on the header buttons
          (Client Login / Home / theme trigger) — skin-token themed. */}
      <style dangerouslySetInnerHTML={{ __html: HEADER_BORDER_CSS }} />
      {/* Responsive layout rules + header status circle / tooltip / nav
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

        /* ---- Dynamic status circle (open → green, closed → red; the exact
                hues come from the active skin's status tokens) ---- */
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
          background: var(--sk-status-open);
          box-shadow: 0 0 0 3px var(--sk-hover-bg), 0 0 10px var(--sk-status-open);
        }
        .ws-status-dot-closed {
          background: var(--sk-status-closed);
          box-shadow: 0 0 0 3px var(--sk-hover-bg), 0 0 10px var(--sk-status-closed);
        }
        .ws-status-dot-pending {
          background: var(--sk-muted);
        }
        .ws-status-dot:focus-visible {
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7), var(--sk-focus-ring);
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
          border: 1px solid var(--sk-tooltip-border);
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

        /* ---- Header nav buttons (Client Login / Home) — clean quiet
                chrome: NO background / NO card look (transparent in the
                normal state — only the animated border + text show), skin-
                owned colors, no heavy effects ---- */
        .ws-nav-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--sk-btn-border);
          background: transparent;
          color: var(--sk-btn-text);
          font-size: 11.5px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
          transition: background-color 160ms ease, border-color 160ms ease;
        }
        .ws-nav-btn:hover {
          background: transparent;
        }
        .ws-nav-btn:focus-visible {
          outline: 2px solid var(--sk-accent);
          outline-offset: 2px;
        }
        .ws-nav-btn:active {
          transform: translateY(1px);
        }

        /* ---- Websmith mask circle, top-right INSIDE the chat card header ---- */
        .ws-header-mask {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 50%;
          overflow: hidden;
          box-sizing: border-box;
          background: var(--sk-secondary-bg);
          border: 1px solid var(--sk-mask-ring);
          box-shadow: var(--sk-mask-glow);
        }
        /* ---- Websmith Messenger skin — composer + Send refinements ---- */
        .ws-skin-input {
          transition: border-color 180ms ease, box-shadow 180ms ease;
        }
        .ws-skin-input:focus {
          border-color: var(--sk-focus-border) !important;
          box-shadow: var(--sk-focus-ring) !important;
        }
        .ws-skin-send {
          transition: filter 180ms ease, box-shadow 180ms ease, transform 120ms ease;
        }
        .ws-skin-send:hover:not(:disabled) {
          filter: brightness(1.08);
          box-shadow: var(--sk-send-hover);
        }
        .ws-skin-send:active:not(:disabled) {
          transform: scale(0.96);
        }
        .ws-skin-send:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }
        .ws-msg-text a {
          color: var(--sk-link);
          text-decoration: underline;
          word-break: break-all;
        }
        /* The shared ChatSkinPicker injects its own .ws-skin-* stylesheet
           (components/shared/ChatSkinPicker.tsx) — no duplicated rules here. */
        @media (max-width: 480px) {
          .ws-header-mask {
            width: 36px !important;
            height: 36px !important;
          }
          .ws-nav-btn {
            height: 28px;
            padding: 0 9px;
            font-size: 10.5px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ws-status-tooltip {
            transition: none;
          }
          .ws-nav-btn {
            transition: none;
          }
        }
      `}</style>

      {/* LEFT 33% — ATMOSPHERE + SOCIAL POPUPS + CHAT STICKERS (coordinated via
          a shared occupancy map — zero overlap, zero blank popups; the
          car/traffic animation stays removed; the 33% width allocation is
          preserved so the layout never shifts). Layer order (bottom -> top):
          subtle dim/light atmosphere -> social icon water-bubble popups ->
          chat stickers ON TOP (stickers supersede the old popup-on-top order). */}
      <div className="ws-road-zone" style={styles.roadZone} aria-hidden="true">
        <LeftZoneVisuals />
      </div>

      {/* CENTER 34% — the Websmith Messenger card. The Websmith skin is the
          branded header band INSIDE the card (never a wrapper behind it);
          every message/composer/status/poll/send behavior is unchanged. */}
      <div className="ws-center-zone" style={styles.centerZone}>
        <div className="ws-chat-card" style={styles.card}>
        <header className="ws-chat-header" style={styles.header}>
          {/* Left cluster: Client Login / Home / theme picker (clean quiet
              buttons — the old Uiverse slice hover animation was removed). */}
          <div style={styles.headerNav}>
            <a href="https://www.websmithdigital.com/login" className="ws-nav-btn" aria-label="Client login">
              Client Login
            </a>
            <a href="https://www.websmithdigital.com/" className="ws-nav-btn" aria-label="Home">
              Home
            </a>
            <ChatSkinPicker activeSkinId={skinId} onSelect={handleSkinSelect} />
          </div>
          {/* Center identity: team name first, then the live status dot
              (immediately after the support line, before the logo); muted
              context line below keeps contact/subject info (full text on
              hover via title). */}
          <div style={styles.headerTitleBlock}>
            <p style={styles.headerTitle}>
              {TEAM_NAME}
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
            </p>
            <p
              style={styles.headerSub}
              title={headerContext}
            >
              {headerContext}
            </p>
          </div>
          {/* Right: the Websmith mask circle stays top-right INSIDE the card. */}
          <div className="ws-header-mask" aria-hidden="true">
            <img
              src={chatLogo.url}
              alt=""
              style={styles.maskImage}
              draggable={false}
              decoding="async"
            />
          </div>
        </header>

        {loading ? (
          <div style={styles.center}>
            <Loader2 size={28} className="admin-messages-spin" color="var(--sk-subtitle)" />
            <p style={styles.centerTitle}>Connecting to your conversation...</p>
            <p style={styles.centerText}>This should only take a moment.</p>
          </div>
        ) : error || !conversation ? (
          <div style={styles.center}>
            <Lock size={30} color="var(--sk-subtitle)" />
            <p style={styles.centerTitle}>Conversation unavailable</p>
            <p style={styles.centerText}>{error || "This conversation link is invalid or has expired."}</p>
            <a href="https://www.websmithdigital.com" target="_blank" rel="noreferrer" style={styles.clientLoginBtn}>
              <ShieldCheck size={15} />
              Visit websmithdigital.com
            </a>
          </div>
        ) : (
          <div className="ws-chat-scroll" style={styles.body} ref={scrollRef}>
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
                  <div
                    key={m.id || `${m.senderType}-${m.createdAt}-${m.message}`}
                    className="ws-msg"
                    style={{ ...styles.row, ...rowStyle }}
                  >
                    <div
                      className={isClient ? "ws-bubble-in" : "ws-bubble-out"}
                      style={isClient ? styles.bubbleClient : styles.bubbleAdmin}
                    >
                      <p style={styles.bubbleSender}>{isClient ? conversation.contactName || m.senderName || "You" : TEAM_NAME}</p>
                      <p className="ws-msg-text" style={styles.bubbleText} dangerouslySetInnerHTML={{ __html: renderMessageHtml(m.message) }} />
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
            {/* Honest transient state while the POST is in flight (no fake
                typing indicator — this pill only shows a real send). */}
            {sending && (
              <div style={{ ...styles.row, ...styles.rowAdmin }}>
                <span className="ws-send-pill">
                  Sending…
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
            {connected && (
              <div style={styles.connectedRow}>
                <span style={styles.connectedPill}>
                  {isClosed ? (
                    <>
                      <XCircle size={11} color="var(--sk-status-closed)" /> This conversation is closed
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={11} color="var(--sk-status-open)" /> Connected · updates every few seconds
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
              <Lock size={11} color="var(--sk-subtitle)" />
              <span style={{ fontSize: "10.5px", color: "var(--sk-subtitle)" }}>
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
                className="ws-skin-input"
                aria-label="Message"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !draft.trim() || isClosed}
                style={styles.sendBtn}
                className="ws-skin-send"
                aria-label="Send message"
              >
                {sending ? <Loader2 size={17} className="admin-messages-spin" /> : <Send size={17} />}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* RIGHT 33% — the 30 flying language bubbles (phase-locked) + random 3x zoom */}
      <div className="ws-bubble-zone" style={styles.bubbleZone}>
        <FlyingBubbles />
      </div>
    </div>
  );
}
