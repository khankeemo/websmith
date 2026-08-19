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
//          FINAL 3-ZONE LAYOUT (2026-08-19, VISUAL ONLY): the page is a strict
//          desktop split of EXACTLY 33% / 34% / 33% with NO gaps between the
//          three zones, and no element may cross into another zone:
//            LEFT  (33%)  ONE CONTINUOUS RACING ROAD — a single wide road that
//                    spans the full left column height and width with EXACTLY
//                    4 lanes (Lane 1 ↑, Lane 2 ↓, Lane 3 ↑, Lane 4 ↓ — adjacent
//                    lanes always run in opposite directions), clear dashed
//                    lane markings and solid road edges. 16 sport/racing cars
//                    (15 real languages/technologies, each with its brand color
//                    + real `public/wds_icon` Devicon icon + a dedicated
//                    premium WEBSMITH car) run continuously: per-car duration,
//                    negative delay (mid-road on load), lane slot and z-index,
//                    seamless loop at the top/bottom boundaries (journey
//                    wrappers travel the full road height, extremes off-screen).
//                    Websmith Digital branding is INTEGRATED into the asphalt:
//                    a large blurred websmith_1x1.webp watermark down the road
//                    centre (screen-blended into the asphalt), vertical
//                    "WEBSMITH DIGITAL · GRAND PRIX" track prints, an F1-style
//                    checkered start/finish line, red/white kerbs and a thin
//                    branded footer strip — all painted onto the dark premium
//                    racing asphalt (never floating UI, always behind the cars).
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
//          Below 900px the road + bubbles hide and the messenger becomes the
//          full-width centered card (decorations are desktop-only);
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

// Top-right Websmith logo image (compact, keeps aspect ratio, inside the card)
const WEBSCIMITH_LOGO = "/images/Websmith.png";

// Road branding asset — subtle/blurred Websmith branding printed on the asphalt
// (websmith_1x1.webp, integrated into the road design, never floating UI).
const ROAD_BRAND_IMG = "/images/websmith_1x1.webp";

// ---- LEFT ZONE — RACING ROAD data ----------------------------------------
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
  { id: "java", name: "Java", icon: "java", color: "#E76F00" },
  { id: "go", name: "Go", icon: "go", color: "#00ADD8" },
  { id: "php", name: "PHP", icon: "php", color: "#777BB4" },
  { id: "javascript", name: "JavaScript", icon: "javascript", color: "#F7DF1E" },
  { id: "rust", name: "Rust", icon: "rust", color: "#CE422B" },
  { id: "kotlin", name: "Kotlin", icon: "kotlin", color: "#7F52FF" },
  { id: "python", name: "Python", icon: "python", color: "#3776AB" },
  { id: "typescript", name: "TypeScript", icon: "typescript", color: "#3178C6" },
  { id: "nodejs", name: "Node.js", icon: "nodejs", color: "#339933" },
  { id: "swift", name: "Swift", icon: "swift", color: "#F05138" },
  { id: "react", name: "React", icon: "react", color: "#61DAFB" },
  { id: "mongodb", name: "MongoDB", icon: "mongodb", color: "#47A248" },
  { id: "csharp", name: "C#", icon: "csharp", color: "#68217A" },
  // Dedicated Websmith car — clearly branded, visually premium, races with the
  // same road system as every other car.
  { id: "websmith", name: "WEBSMITH", color: "#FFD700", websmith: true },
];

const CAR_BY_ID: Record<string, RacerCar> = Object.fromEntries(RACER_CARS.map((c) => [c.id, c]));

// ONE continuous road, EXACTLY 4 lanes: Lane 1 ↑, Lane 2 ↓, Lane 3 ↑, Lane 4 ↓.
// Adjacent lanes always move in opposite directions. 16 cars total (>= 10),
// evenly distributed 4 / 4 / 4 / 4 so every lane stays busy.
const ROAD_LANES: Array<{ dir: "Up" | "Down"; cars: RacerCar[] }> = [
  { dir: "Up", cars: ["c", "java", "go", "php"].map((id) => CAR_BY_ID[id]) },
  { dir: "Down", cars: ["cpp", "javascript", "rust", "kotlin"].map((id) => CAR_BY_ID[id]) },
  { dir: "Up", cars: ["python", "typescript", "nodejs", "swift"].map((id) => CAR_BY_ID[id]) },
  { dir: "Down", cars: ["react", "mongodb", "csharp", "websmith"].map((id) => CAR_BY_ID[id]) },
];

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
 * LEFT ZONE — ONE CONTINUOUS RACING ROAD (the old 3-track racer is gone).
 *
 * A single wide road fills the entire left 33% zone (full width, full usable
 * height) with EXACTLY 4 lanes — Lane 1 ↑, Lane 2 ↓, Lane 3 ↑, Lane 4 ↓ — so
 * adjacent lanes always run in opposite directions. Solid road edges + 3
 * glowing dashed lane dividers (one road, no separated road blocks).
 *
 * 16 sport/racing cars (15 real technologies + the dedicated WEBSMITH car):
 * each car is a styled side-profile racer (glowing body in the language's
 * brand color, windshield, rear wing, wheels, direction chevron, language
 * icon on the body, label), NOT a plain rectangle or bare icon.
 *
 * Websmith Digital branding is printed INTO the road itself (dark premium
 * racing asphalt): a large blurred websmith_1x1.webp watermark down the road
 * centre (screen-blended into the asphalt, behind the cars), vertical
 * "WEBSMITH DIGITAL · GRAND PRIX" track prints, an F1-style checkered
 * start/finish line across the road top, red/white kerbs along both road
 * edges and a thin branded footer strip at the road base — all painted onto
 * the asphalt (z-index 1-2, always behind the cars), never floating UI.
 *
 * Motion model (GPU-friendly, CSS transforms only):
 *  - Every car sits in its own "journey" wrapper that spans the full road
 *    height (height:100%) and animates `translateY(110%) -> translateY(-110%)`
 *    (up) or the exact reverse (down). The car is positioned at a per-car
 *    `top: slot%` inside the wrapper, so the travel covers the WHOLE road and
 *    both extremes are always OFF-SCREEN — the loop resets at the road
 *    boundary, never with a visible teleport in the middle.
 *  - Per-car duration (8-16s), negative delay (mid-road on mount), slot,
 *    z-index and horizontal jitter are deterministic pseudo-random: every car
 *    has its own speed and spacing (a faster car overtakes and briefly passes
 *    behind/in front of a slower one). Cars never leave their lane (each lane
 *    is overflow hidden) and never cross into the center zone.
 *  - Responsive: cars/badges shrink through CSS custom properties at smaller
 *    widths; `prefers-reduced-motion` stops the animation.
 */
function LanguageRoad() {
  const lanes = useMemo(
    () =>
      ROAD_LANES.map((lane, lIndex) => ({
        ...lane,
        cars: lane.cars.map((car, cIndex) => {
          const seed = lIndex * 40 + cIndex * 7 + 1;
          const duration = 8 + racerRand(seed) * 8;
          const delay = -(duration * (0.1 + racerRand(seed + 1) * 0.8));
          const slot = 2 + (cIndex / lane.cars.length) * 90 + (racerRand(seed + 2) - 0.5) * 10;
          const zIndex = 1 + Math.floor(racerRand(seed + 3) * 3);
          const jitter = (racerRand(seed + 4) - 0.5) * 6;
          return { ...car, duration, delay, slot, zIndex, jitter };
        }),
      })),
    []
  );

  return (
    <div className="ws-road" style={styles.road} aria-hidden="true">
      {/* Websmith Digital branding INTEGRATED into the asphalt — a subtle/blurred
          websmith_1x1.webp watermark layer + F1-style track prints, painted onto
          the road (behind the cars, part of the asphalt, never floating UI). */}
      <div className="ws-road-brand">
        <img src={ROAD_BRAND_IMG} alt="" draggable={false} decoding="async" />
      </div>
      <span className="ws-road-print">WEBSMITH DIGITAL · GRAND PRIX</span>
      <span className="ws-road-print ws-road-print-b">TECHNOLOGY · ENGINEERING · SUPPORT</span>

      {/* F1 racing markings painted on the asphalt: start/finish checkered line
          across the road + red/white kerbs along both road edges. */}
      <span className="ws-road-checker" />
      <span className="ws-road-kerb ws-road-kerb-l" />
      <span className="ws-road-kerb ws-road-kerb-r" />

      {/* Road edges (solid lines) + 3 dashed lane dividers (one continuous road) */}
      <span className="ws-road-edge ws-road-edge-l" />
      <span className="ws-road-edge ws-road-edge-r" />
      <span className="ws-road-divider" style={{ left: "25%" }} />
      <span className="ws-road-divider" style={{ left: "50%" }} />
      <span className="ws-road-divider" style={{ left: "75%" }} />

      {lanes.map((lane, lIndex) => (
        <div key={lIndex} className="ws-lane" style={styles.lane}>
          {lane.cars.map((car) => (
            <div
              key={car.id}
              className="ws-journey"
              style={{
                animation: `wsRoad${lane.dir} ${car.duration}s linear ${car.delay}s infinite`,
              }}
            >
              <div
                className="ws-car"
                style={{
                  top: `${car.slot}%`,
                  zIndex: car.zIndex,
                  transform: `translateX(${car.jitter}px)`,
                }}
              >
                <span
                  className="ws-car-trail"
                  style={{ background: `linear-gradient(180deg, ${car.color}bb, transparent)` }}
                />
                <div
                  className={car.websmith ? "ws-car-frame ws-car-frame-websmith" : "ws-car-frame"}
                  style={car.websmith ? styles.carFrameWebsmith : undefined}
                >
                  <span className="ws-car-wing" style={{ borderColor: `${car.color}99` }} />
                  <div
                    className={car.websmith ? "ws-car-body ws-car-body-websmith" : "ws-car-body"}
                    style={
                      car.websmith
                        ? {
                            background: "linear-gradient(180deg, #FFD700, #b8860b)",
                            borderColor: "#FFD700dd",
                            boxShadow: "0 0 16px rgba(255,215,0,0.55), inset 0 0 10px rgba(255,215,0,0.28)",
                          }
                        : {
                            background: `linear-gradient(180deg, ${car.color}, ${car.color}88)`,
                            borderColor: `${car.color}cc`,
                            boxShadow: `0 0 14px ${car.color}66, inset 0 0 8px ${car.color}33`,
                          }
                    }
                  >
                    <span
                      className="ws-car-glass"
                      style={{ background: "linear-gradient(180deg, rgba(180,235,255,0.95), rgba(90,150,210,0.6))" }}
                    />
                    <img
                      className="ws-car-icon"
                      src={car.websmith ? WEBSCIMITH_LOGO : `/wds_icon/${car.icon}.svg`}
                      alt=""
                      draggable={false}
                      decoding="async"
                    />
                    <span className="ws-car-chevron">{lane.dir === "Up" ? "▲" : "▼"}</span>
                  </div>
                  <span className="ws-car-wheel ws-car-wheel-l" />
                  <span className="ws-car-wheel ws-car-wheel-r" />
                </div>
                <span
                  className="ws-car-label"
                  style={{ color: car.color, ...(car.websmith ? styles.carLabelWebsmith : {}) }}
                >
                  {car.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Websmith Digital footer hoarding — a thin branded strip painted onto
          the road base (part of the asphalt layer, subtle, behind the cars). */}
      <div className="ws-road-footer">
        <img src={ROAD_BRAND_IMG} alt="" draggable={false} decoding="async" />
        <span>WEBSMITH DIGITAL — OFFICIAL TRACK PARTNER</span>
      </div>

      <style jsx>{`
        /* Seamless vertical loops: travel the full road height, both extremes
           are off-screen, so the reset is invisible at the road boundary. */
        @keyframes wsRoadUp {
          0% {
            transform: translateY(110%);
          }
          100% {
            transform: translateY(-110%);
          }
        }
        @keyframes wsRoadDown {
          0% {
            transform: translateY(-110%);
          }
          100% {
            transform: translateY(110%);
          }
        }
        .ws-road {
          --car-w: 58px;
          --body-h: 30px;
          --icon-s: 20px;
          --label-fs: 7.5px;
        }
        /* ---- Websmith Digital branding integrated into the asphalt ---- */
        /* Large blurred websmith_1x1.webp watermark down the road centre:
           mixed into the asphalt (screen blend), never over the cars. */
        .ws-road-brand {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 44%;
          height: 100%;
          transform: translate(-50%, -50%);
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
          opacity: 0.55;
          filter: blur(6px) saturate(1.1);
        }
        .ws-road-brand img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          opacity: 0.26;
          mix-blend-mode: screen;
        }
        /* F1-style track print on the asphalt: vertical sponsor text running
           down the road centre-line (subtle, painted look). */
        .ws-road-print {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(90deg);
          white-space: nowrap;
          pointer-events: none;
          z-index: 1;
          color: rgba(255, 255, 255, 0.09);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 9px;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(20, 156, 234, 0.4);
        }
        .ws-road-print-b {
          top: 82%;
          font-size: 8.5px;
          letter-spacing: 5px;
          color: rgba(255, 255, 255, 0.06);
        }
        /* F1 start/finish checkered line painted across the road top. */
        .ws-road-checker {
          position: absolute;
          left: 0;
          right: 0;
          top: 2.5%;
          height: 24px;
          pointer-events: none;
          z-index: 2;
          opacity: 0.85;
          background: repeating-conic-gradient(#dde3ec 0% 25%, #151a24 0% 50%) 0 0 / 15px 15px;
          box-shadow:
            0 0 10px rgba(20, 156, 234, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
          border-radius: 2px;
        }
        /* Red/white F1 kerbs along both road edges. */
        .ws-road-kerb {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 5px;
          pointer-events: none;
          z-index: 2;
          opacity: 0.7;
        }
        .ws-road-kerb-l {
          left: 0;
          background: repeating-linear-gradient(180deg, #b3261e 0 9px, #e8ecf2 9px 18px);
        }
        .ws-road-kerb-r {
          right: 0;
          background: repeating-linear-gradient(180deg, #e8ecf2 0 9px, #b3261e 9px 18px);
        }
        /* Websmith Digital footer strip — painted onto the road base. */
        .ws-road-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          pointer-events: none;
          z-index: 2;
          background: linear-gradient(180deg, rgba(8, 11, 17, 0.82), rgba(5, 7, 12, 0.9));
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 12px rgba(20, 156, 234, 0.12);
          opacity: 0.9;
        }
        .ws-road-footer img {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          object-fit: cover;
          opacity: 0.85;
        }
        .ws-road-footer span {
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
          text-shadow: 0 0 8px rgba(20, 156, 234, 0.35);
          white-space: nowrap;
        }
        /* One continuous asphalt road, full left-zone width and height. */
        .ws-road-edge {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 3px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.32);
          box-shadow: 0 0 8px rgba(20, 156, 234, 0.45);
          z-index: 2;
        }
        .ws-road-edge-l {
          left: 4px;
        }
        .ws-road-edge-r {
          right: 4px;
        }
        .ws-road-divider {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          transform: translateX(-50%);
          background: repeating-linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.28) 0 8px,
            transparent 8px 18px
          );
          box-shadow: 0 0 8px rgba(20, 156, 234, 0.35);
          z-index: 2;
        }
        .ws-lane {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 25%;
          overflow: hidden;
        }
        .ws-journey {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 100%;
          will-change: transform;
        }
        /* Sport-car: glowing body (language color), windshield, rear wing,
           wheels, direction chevron, language icon on the body, label. */
        .ws-car {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          will-change: transform;
        }
        .ws-car-frame {
          position: relative;
          width: var(--car-w);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .ws-car-frame-websmith {
          width: calc(var(--car-w) + 10px);
        }
        .ws-car-wing {
          position: absolute;
          top: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(var(--car-w) - 8px);
          height: 4px;
          border-radius: 2px;
          border-top: 2px solid;
          box-sizing: border-box;
          background: rgba(10, 15, 24, 0.85);
          z-index: 3;
        }
        .ws-car-body {
          position: relative;
          width: 100%;
          height: var(--body-h);
          border-radius: 8px 8px 12px 12px;
          border: 1px solid;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }
        .ws-car-glass {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 58%;
          height: 12px;
          border-radius: 8px 8px 4px 4px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-sizing: border-box;
          z-index: 1;
        }
        .ws-car-icon {
          width: var(--icon-s);
          height: var(--icon-s);
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
        }
        .ws-car-chevron {
          position: absolute;
          top: 1px;
          right: 3px;
          font-size: 6px;
          line-height: 1;
          color: rgba(255, 255, 255, 0.85);
          text-shadow: 0 0 4px rgba(0, 0, 0, 0.9);
        }
        .ws-car-wheel {
          position: absolute;
          bottom: -6px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #0b0f16;
          border: 2px solid rgba(235, 240, 248, 0.9);
          box-sizing: border-box;
          z-index: 3;
        }
        .ws-car-wheel-l {
          left: 7px;
        }
        .ws-car-wheel-r {
          right: 7px;
        }
        .ws-car-trail {
          position: absolute;
          top: calc(100% + 3px);
          width: 2px;
          height: 34px;
          border-radius: 2px;
          opacity: 0.8;
          z-index: 1;
        }
        .ws-car-label {
          margin-top: 7px;
          font-size: var(--label-fs);
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          white-space: nowrap;
          line-height: 1.1;
          text-shadow: 0 0 6px rgba(0, 0, 0, 0.85);
        }
        /* Desktop shrink: 901-1150px keeps the 3-zone stage, smaller cars */
        @media (max-width: 1150px) and (min-width: 901px) {
          .ws-road {
            --car-w: 48px;
            --body-h: 26px;
            --icon-s: 17px;
            --label-fs: 6.5px;
          }
          .ws-road-footer {
            height: 22px;
          }
          .ws-road-footer span {
            font-size: 6.5px;
            letter-spacing: 1.6px;
          }
          .ws-road-print {
            font-size: 10px;
            letter-spacing: 6px;
          }
          .ws-road-print-b {
            font-size: 7px;
            letter-spacing: 4px;
          }
          .ws-road-checker {
            height: 18px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ws-journey {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

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

const styles: Record<string, React.CSSProperties> = {
  // Full-viewport 3-zone stage: EXACT 33% / 34% / 33% desktop split with NO
  // gaps; below 900px the CSS media rules hide the road + bubbles and make
  // the center zone full-width (messenger stays fully usable).
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
  // LEFT 33% — one continuous racing road (full zone width + height).
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
  // ---- Racing road layout ----
  // Dark premium racing asphalt: deep blue-black base, faint horizontal wear
  // streaks, subtle lengthwise sheen and a neon-blue ambient glow that fades
  // toward the edges (technical circuit atmosphere, cars stay readable).
  road: {
    position: "absolute",
    inset: 0,
    background: [
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.013) 0 2px, transparent 2px 27px)",
      "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 96px, transparent 96px 140px)",
      "radial-gradient(120% 90% at 50% 50%, rgba(20,156,234,0.07) 0%, transparent 62%)",
      "linear-gradient(180deg, #0a0e15 0%, #0c1220 22%, #080c13 55%, #0b1019 85%, #070a10 100%)",
    ].join(", "),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    pointerEvents: "none",
    zIndex: 0,
    overflow: "hidden",
  },
  lane: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "25%",
    overflow: "hidden",
  },
  carFrameWebsmith: {
    filter: "drop-shadow(0 0 6px rgba(255, 215, 0, 0.35))",
  },
  carLabelWebsmith: {
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
          --c2: #00a1b7;
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

      {/* LEFT 33% — ONE CONTINUOUS RACING ROAD (4 lanes, ↑ ↓ ↑ ↓) */}
      <div className="ws-road-zone" style={styles.roadZone}>
        <LanguageRoad />
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
                src="/images/Websmith Digital2.png"
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
