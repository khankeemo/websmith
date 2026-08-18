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
 * LANGUAGE RACER — live animated racing tracks (the old static
 * "Lanuage Racer Websmith.png" image is gone).
 *
 * 3 vertical tracks — LEFT bottom→top, CENTER top→bottom, RIGHT bottom→top —
 * so adjacent tracks always run in opposite directions. Each car is a real
 * technology (28 languages + the dedicated Websmith car) with its brand color
 * and a real Devicon icon from public/wds_icon.
 *
 * Motion model (GPU-friendly, CSS transforms only):
 *  - Every car sits in its own "journey" wrapper that spans the full track
 *    height (height:100%) and animates `translateY(100%) -> translateY(-100%)`
 *    (up) or the exact reverse (down). The car is positioned at a per-car
 *    `top: slot%` inside the wrapper, so the travel covers the WHOLE track and
 *    both extremes are always OFF-SCREEN — the loop resets at the track
 *    boundary, never with a visible teleport in the middle.
 *  - Per-car duration (9-16s), negative delay (mid-flight on mount), slot,
 *    z-index and horizontal jitter are deterministic pseudo-random: every car
 *    has its own speed, spacing and pass-over moment (a faster car overtakes
 *    and briefly passes behind/in front of a slower one).
 *  - Layering inside each track: dark track → road glow + glowing dashed lane
 *    → cars → car glow (box-shadow) + motion trail. Cars never leave their
 *    track (overflow hidden).
 *  - Responsive: tracks/cars/badges shrink through CSS custom properties at
 *    smaller widths; `prefers-reduced-motion` stops the animation.
 */
function LanguageRacer() {
  const tracks = useMemo(
    () =>
      RACER_TRACKS.map((track, tIndex) => ({
        ...track,
        cars: track.cars.map((car, cIndex) => {
          const seed = tIndex * 100 + cIndex;
          const duration = 9 + racerRand(seed + 1) * 7;
          const delay = -(duration * (0.15 + racerRand(seed + 2) * 0.75));
          const slot = 3 + (cIndex / track.cars.length) * 86 + (racerRand(seed + 3) - 0.5) * 6;
          const zIndex = 1 + Math.floor(racerRand(seed + 4) * 3);
          const jitter = (racerRand(seed + 5) - 0.5) * 6;
          return { ...car, duration, delay, slot, zIndex, jitter };
        }),
      })),
    []
  );

  return (
    <div className="ws-racer" style={styles.racer}>
      <div style={styles.racerHead}>
        <span style={styles.racerTitle}>LANGUAGE RACER</span>
      </div>
      <div className="ws-racer-tracks" style={styles.racerTracks}>
        {tracks.map((track) => (
          <div key={track.key} className="ws-racer-track" style={styles.racerTrack}>
            {/* Road glow + glowing dashed lane (under the cars) */}
            <div className="ws-racer-road" />
            <div className="ws-racer-lane" />
            {track.cars.map((car) => (
              <div
                key={car.id}
                className="ws-racer-journey"
                style={{
                  animation: `wsRace${track.dir} ${car.duration}s linear ${car.delay}s infinite`,
                }}
              >
                <div
                  className="ws-racer-car"
                  style={{ top: `${car.slot}%`, zIndex: car.zIndex, transform: `translateX(${car.jitter}px)` }}
                >
                  <div
                    className="ws-racer-badge"
                    style={
                      car.websmith
                        ? {
                            ...styles.racerBadgeWebsmith,
                            borderColor: "#FFD700cc",
                            boxShadow: "0 0 16px rgba(255,215,0,0.4), inset 0 0 10px rgba(255,215,0,0.22)",
                          }
                        : {
                            ...styles.racerBadge,
                            borderColor: `${car.color}aa`,
                            boxShadow: `0 0 12px ${car.color}55, inset 0 0 8px ${car.color}2e`,
                          }
                    }
                  >
                    <img
                      className="ws-racer-icon"
                      src={car.icon ? `/wds_icon/${car.icon}.svg` : WEBSCIMITH_LOGO}
                      alt={car.name}
                      draggable={false}
                      decoding="async"
                    />
                  </div>
                  <span
                    className="ws-racer-label"
                    style={{ color: car.color, ...(car.websmith ? styles.racerLabelWebsmith : {}) }}
                  >
                    {car.name}
                  </span>
                  <span
                    className="ws-racer-trail"
                    style={{ background: `linear-gradient(180deg, ${car.color}cc, transparent)` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <style jsx>{`
        /* Seamless vertical loops: travel the full track height, both extremes
           are off-screen, so the reset is invisible at the track boundary. */
        @keyframes wsRaceUp {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(-100%);
          }
        }
        @keyframes wsRaceDown {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100%);
          }
        }
        .ws-racer {
          --track-w: 56px;
          --badge-w: 46px;
          --badge-h: 30px;
          --label-fs: 8.5px;
          --icon-s: 18px;
        }
        .ws-racer-track {
          position: relative;
          overflow: hidden;
          border-radius: 12px;
          background: rgba(9, 13, 21, 0.6);
          border: 1px solid rgba(20, 156, 234, 0.22);
          box-shadow:
            inset 0 0 14px rgba(20, 156, 234, 0.14),
            0 0 10px rgba(20, 156, 234, 0.1);
        }
        .ws-racer-road {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(20, 156, 234, 0.22) 0%,
            rgba(20, 156, 234, 0.05) 18%,
            rgba(20, 156, 234, 0.05) 82%,
            rgba(20, 156, 234, 0.22) 100%
          );
        }
        .ws-racer-lane {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          transform: translateX(-50%);
          background: repeating-linear-gradient(
            180deg,
            rgba(20, 156, 234, 0.55) 0 7px,
            transparent 7px 15px
          );
          box-shadow: 0 0 8px rgba(20, 156, 234, 0.5);
        }
        .ws-racer-journey {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          will-change: transform;
        }
        .ws-racer-car {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          will-change: transform;
        }
        .ws-racer-badge {
          width: var(--badge-w);
          height: var(--badge-h);
          border-radius: 9px;
          border: 1px solid;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(160deg, #131a28, #1b2334);
        }
        .ws-racer-icon {
          width: var(--icon-s);
          height: var(--icon-s);
          object-fit: contain;
          display: block;
        }
        .ws-racer-label {
          font-size: var(--label-fs);
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          white-space: nowrap;
          line-height: 1.1;
          text-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
        }
        .ws-racer-trail {
          position: absolute;
          top: calc(100% + 2px);
          width: 2px;
          height: 30px;
          border-radius: 2px;
          opacity: 0.75;
        }
        /* Desktop shrink: 1101-1150px keeps the 3-column stage, smaller cars */
        @media (max-width: 1150px) and (min-width: 901px) {
          .ws-racer {
            --track-w: 46px;
            --badge-w: 38px;
            --badge-h: 26px;
            --label-fs: 7.5px;
            --icon-s: 15px;
          }
        }
        /* Mobile: the racer becomes a compact strip (smaller tracks/cars,
           animation intact — never hidden, never overflowing). */
        @media (max-width: 900px) {
          .ws-racer {
            --track-w: 40px;
            --badge-w: 33px;
            --badge-h: 22px;
            --label-fs: 6.5px;
            --icon-s: 13px;
          }
          .ws-racer-head {
            display: none !important;
          }
          .ws-racer-tracks {
            height: 100% !important;
          }
          .ws-racer-track {
            border-radius: 9px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ws-racer-journey {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * RIGHT-SIDE MASK BUBBLE — the Websmith Digital2 image locked inside a
 * circular container (border-radius 50% + overflow hidden + cover-fit, image
 * sized 100% of the circle and centered), so it can never escape the circular
 * boundary — not on hover, animation (bob is applied to the CONTAINER only,
 * transform-based) or responsive resizing. The bubble is ~5% smaller than the
 * previous mask (clamp(96px,11vw,150px) → clamp(91px,10.5vw,142px)) and stays
 * fixed at the right side of the stage (desktop right column / mobile strip).
 */
function MaskBubble() {
  return (
    <div className="ws-mask-bubble" style={styles.maskBubble} aria-hidden="true">
      <img
        src="/images/Websmith Digital2.png"
        alt=""
        style={styles.maskImage}
        draggable={false}
        decoding="async"
      />
      <style jsx>{`
        @keyframes wsMaskBob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(6px);
          }
        }
        .ws-mask-bubble {
          animation: wsMaskBob 5s ease-in-out infinite;
          will-change: transform;
        }
        @media (max-width: 900px) {
          .ws-mask-bubble {
            width: 72px !important;
            height: 72px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ws-mask-bubble {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Full-viewport 3-part stage: LEFT Language Racer | CENTER chat card |
  // RIGHT mask bubble. Rows on desktop; below 900px the CSS media rules in the
  // root <style jsx> switch it to a column (racer strip on top, card below).
  root: {
    position: "relative",
    height: "100dvh",
    maxHeight: "100dvh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "24px",
    background: "var(--bg-primary)",
    overflow: "hidden",
  },
  // LEFT slot — the live Language Racer (decorative, never interactive).
  racerSlot: {
    flexShrink: 0,
    width: "216px",
    height: "100%",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  // CENTER slot — the existing messenger card, unchanged, centered.
  centerSlot: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  // RIGHT slot — fixed mask bubble at the right side (desktop only).
  maskSlot: {
    flexShrink: 0,
    width: "170px",
    height: "100%",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  // Mobile variant of the mask bubble — lives inside the top strip; hidden on
  // desktop via display:none, shown again by the CSS media rule.
  maskMobile: {
    display: "none",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  // The circular mask bubble: fixed circle, image clamped inside (overflow
  // hidden + 50% radius + cover fit), ~5% smaller than the previous mask.
  maskBubble: {
    width: "clamp(91px, 10.5vw, 142px)",
    height: "clamp(91px, 10.5vw, 142px)",
    borderRadius: "50%",
    overflow: "hidden",
    boxSizing: "border-box",
    border: "1px solid rgba(20, 156, 234, 0.35)",
    boxShadow:
      "0 0 0 4px rgba(20, 156, 234, 0.12), 0 0 24px rgba(20, 156, 234, 0.25), inset 0 0 0 2px rgba(255, 255, 255, 0.06)",
  },
  maskImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
  },
  // ---- Language Racer layout ----
  racer: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    pointerEvents: "none",
    zIndex: 0,
  },
  racerHead: { flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  racerTitle: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    background: "linear-gradient(90deg, #149CEA, #FFD700)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    whiteSpace: "nowrap",
  },
  racerTracks: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: "10px",
    height: "min(68dvh, 600px)",
    flex: "1 1 auto",
    minHeight: 0,
  },
  racerTrack: {
    position: "relative",
    width: "var(--track-w)",
    height: "100%",
    flexShrink: 0,
  },
  racerBadge: {
    border: "1px solid",
    borderColor: "transparent",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  racerBadgeWebsmith: {
    border: "1px solid",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "calc(var(--badge-w) + 10px)",
    height: "calc(var(--badge-h) + 8px)",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #1a2434, #0e1522)",
  },
  racerLabelWebsmith: {
    fontWeight: 900,
    letterSpacing: "1px",
    textShadow: "0 0 10px rgba(255, 215, 0, 0.55)",
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
    <div className="ws-chat-root" style={styles.root}>
      {/* Responsive layout rules for the 3-part stage (racer | chat | mask). */}
      <style jsx>{`
        @media (max-width: 900px) {
          .ws-chat-root {
            flex-direction: column !important;
            padding: 10px !important;
            gap: 8px !important;
          }
          .ws-racer-slot {
            width: 100% !important;
            height: 120px !important;
            flex-direction: row !important;
            gap: 8px !important;
          }
          .ws-racer {
            flex: 1 1 0 !important;
            width: auto !important;
            min-width: 0 !important;
          }
          .ws-mask-slot {
            display: none !important;
          }
          .ws-mask-mobile {
            display: flex !important;
          }
          .ws-chat-card {
            height: min(800px, calc(100dvh - 150px)) !important;
          }
        }
      `}</style>

      {/* LEFT: live Language Racer (desktop column; mobile = top strip) */}
      <div className="ws-racer-slot" style={styles.racerSlot}>
        <LanguageRacer />
        <div className="ws-mask-mobile" style={styles.maskMobile}>
          <MaskBubble />
        </div>
      </div>

      {/* CENTER: the existing messenger card (unchanged) */}
      <div className="ws-center-slot" style={styles.centerSlot}>
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

      {/* RIGHT: fixed circular mask bubble (desktop) */}
      <div className="ws-mask-slot" style={styles.maskSlot}>
        <MaskBubble />
      </div>
    </div>
  );
}