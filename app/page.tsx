// C:\websmith\app\page.tsx
// Landing Page - Websmith
// Features: Hero section, Features grid, Stats counters, Satisfied clients, Developers section, Testimonials, Footer
// Updated: Added header navigation menu with smooth scroll

"use client";

import { useState, useEffect, useRef, useMemo, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { 
  ArrowRight, 
  Star, 
  Code, 
  Rocket, 
  Zap, 
  Users, 
  BarChart3,
  Briefcase,
  ExternalLink,
  Mail,
  Building2,
  Phone,
  MessageSquare,
  Calendar,
  ChevronDown,
  Globe,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import PublicFooter from "../components/layout/PublicFooter";
import PublicSiteNav from "../components/layout/PublicSiteNav";
import { getPublishedProjects, getPublishedTestimonials } from "./projects/services/projectService";
import API from "../core/services/apiService";
import { SOCIAL_PLATFORM_META } from "../lib/social-platforms";
import { getPublishedClients } from "./clients/services/clientService";
import { getPublishedDevelopers } from "../core/services/userService";
import { createPublicTicket } from "../core/services/ticketService";
import { useLeadFunnel } from "./providers/LeadFunnelProvider";
import { usePublicTheme } from "./providers/PublicThemeProvider";
import { PhoneInputWithCountry } from "@/components/ui/PhoneInputWithCountry";
import { validatePhoneNumber } from "@/core/utils/phoneValidation";
import { useMediaAsset } from "../hooks/useMediaAsset";

const defaultContactInfo = {
  headquarters: "T-35, Rajarhat Main Road, Diamond Enclave,kolkata-700157",
  email: "support@websmithdigital.com",
  sales_email: "",
  no_reply_email: "",
  hr_email: "",
  phone: "+1 815-426-9572",
  mobile_number: "",
  landline_number: "",
  whatsapp_url: "",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
  x_url: "",
  youtube_url: "",
};

const CONTACT_SUBJECT_OPTIONS = [
  "Project Inquiry",
  "Web Development",
  "Mobile App Development",
  "Custom Software Development",
  "Software Store & Licensing",
  "Technical Support & Maintenance",
  "Consulting & Architecture",
  "Partnership & Collaboration",
  "Other",
] as const;

import {
  CONTACT_TIME_SLOT_GROUPS,
  CONTACT_TIME_SLOTS,
  ALL_WORLD_TIMEZONE_GROUPS,
  getSlotISTRange,
  getBookingDateLimits,
  type TimeSlotGroup,
  type PopularTimeZone,
  type TimeZoneGroup,
} from "@/core/utils/contactScheduling";


type HorizontalCardStripProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel: string;
  itemMinWidth?: number;
  gap?: number;
  autoLoopCount?: number;
  dragThreshold?: number;
  direction?: "left-to-right" | "right-to-left";
  scale?: number;
  speed?: number;
  outerPadding?: string;
  cardsPerView?: number;
};

function HorizontalCardStrip<T>({
  items,
  renderItem,
  ariaLabel,
  itemMinWidth = 280,
  gap = 16,
  autoLoopCount = 1,
  dragThreshold = 0,
  direction = "right-to-left",
  scale = 1,
  speed = 0.5,
  outerPadding,
  cardsPerView,
}: HorizontalCardStripProps<T>) {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const styles = useMemo(() => getLandingStyles(isDark), [isDark]);
  const outerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, startScrollLeft: 0, lastX: 0, velocity: 0 });
  const autoLoop = items.length >= autoLoopCount;
  
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const updateWidth = () => {
      if (outer.clientWidth > 0) {
        setContainerWidth(outer.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  // Compute card width when cardsPerView is specified
  const computedCardWidth = useMemo(() => {
    if (!cardsPerView) return undefined;
    if (containerWidth > 0) {
      let cols = cardsPerView;
      if (cardsPerView >= 5) {
        if (containerWidth < 640) cols = 2.2;
        else if (containerWidth < 960) cols = 3.5;
        else if (containerWidth < 1280) cols = 4.8;
        else cols = cardsPerView;
      } else {
        if (containerWidth < 640) cols = 1.2;
        else if (containerWidth < 960) cols = 2.2;
        else if (containerWidth < 1280) cols = 3.2;
        else cols = cardsPerView;
      }
      const calculated = Math.floor((containerWidth - (Math.floor(cols) - 1) * gap) / cols);
      return `${Math.max(160, calculated)}px`;
    }
    return undefined;
  }, [cardsPerView, containerWidth, gap]);

  // We use triple items for seamless looping
  const renderedItems = autoLoop ? [...items, ...items, ...items] : items;
  
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer || !autoLoop) return;

    let initialized = false;
    let frameId: number;

    const step = () => {
      if (!dragState.current.active && outer) {
        const singleLoopWidth = outer.scrollWidth / 3;
        
        if (singleLoopWidth > 0) {
          if (!initialized) {
            outer.scrollLeft = (direction === "left-to-right") ? singleLoopWidth * 1.5 : singleLoopWidth;
            initialized = true;
          }

          if (direction === "left-to-right") {
            outer.scrollLeft -= speed;
            if (outer.scrollLeft <= singleLoopWidth * 0.5) {
              outer.scrollLeft += singleLoopWidth;
            }
          } else {
            outer.scrollLeft += speed;
            if (outer.scrollLeft >= singleLoopWidth * 2) {
              outer.scrollLeft -= singleLoopWidth;
            }
          }
        }
      }
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [autoLoop, items.length, direction, speed]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const outer = outerRef.current;
    if (!outer) return;
    dragState.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: outer.scrollLeft,
      lastX: event.clientX,
      velocity: 0
    };
    outer.setPointerCapture(event.pointerId);
    outer.style.cursor = "grabbing";
    outer.style.scrollSnapType = "none"; // Disable snapping while dragging
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const outer = outerRef.current;
    if (!outer || !dragState.current.active) return;
    
    const deltaX = event.clientX - dragState.current.startX;
    outer.scrollLeft = dragState.current.startScrollLeft - deltaX;
    
    // Boundary check during drag for infinite loop
    const singleLoopWidth = outer.scrollWidth / 3;
    if (outer.scrollLeft >= singleLoopWidth * 2) {
      outer.scrollLeft -= singleLoopWidth;
      dragState.current.startX += singleLoopWidth; // Adjust startX to maintain delta
    } else if (outer.scrollLeft <= singleLoopWidth * 0.5) {
      outer.scrollLeft += singleLoopWidth;
      dragState.current.startX -= singleLoopWidth;
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const outer = outerRef.current;
    dragState.current.active = false;
    if (!outer) return;
    outer.releasePointerCapture(event.pointerId);
    outer.style.cursor = "grab";
    outer.style.scrollSnapType = "none";
  };

  return (
    <div
      ref={outerRef}
      className="landing-card-strip"
      style={{
        ...styles.hScrollOuter,
        overflowX: "auto",
        cursor: "grab",
        touchAction: "pan-y", 
        scrollBehavior: "auto",
        ...(outerPadding ? { padding: outerPadding } : {}),
      }}
      role="region"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        style={{ 
          ...styles.hScrollInner, 
          gap: `${gap * scale}px`,
          padding: "10px 0" 
        }}
      >
        {renderedItems.map((item, index) => (
          <div
            key={`${index}-${index % items.length}`}
            style={{ 
              ...styles.hScrollCell, 
              width: computedCardWidth,
              minWidth: computedCardWidth || `var(--h-card-min-width, ${itemMinWidth * scale}px)`, 
              maxWidth: computedCardWidth,
              flexShrink: 0,
              boxSizing: "border-box" as const,
              scrollSnapAlign: "start" as const,
              transform: `scale(${scale})`,
              transformOrigin: "center center",
              transition: "transform 0.3s ease"
            }}
          >
            {renderItem(item, index % items.length)}
          </div>
        ))}
      </div>
    </div>
  );
}

type StatSlide = { id: string; value: string; label: string };

const clampStatCount = (count: number) => Math.max(0, Math.min(10, count));

function StatsStrip({ items }: { items: StatSlide[] }) {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const styles = useMemo(() => getLandingStyles(isDark), [isDark]);
  return (
    <HorizontalCardStrip
      items={items}
      ariaLabel="Websmith stats"
      cardsPerView={6}
      itemMinWidth={190}
      gap={16}
      autoLoopCount={1}
      direction="left-to-right"
      scale={1}
      speed={1.2}
      outerPadding="26px clamp(8px, 2vw, 16px) 30px"
      renderItem={(item) => (
        <article key={item.id} style={{ ...styles.statStaticCard, width: "100%", maxWidth: "100%" }} className="landing-stat-card">
          <p style={styles.statStaticValue} className="landing-stat-value">{item.value}</p>
          <p style={styles.statStaticLabel} className="landing-stat-label">{item.label}</p>
        </article>
      )}
    />
  );
}

type TechnologyLink = { name: string; icon: string; href: string };

const TECHNOLOGIES: TechnologyLink[] = [
  { name: "Python", icon: "/wds_icon/python.svg", href: "https://www.python.org/" },
  { name: "JavaScript", icon: "/wds_icon/javascript.svg", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" },
  { name: "TypeScript", icon: "/wds_icon/typescript.svg", href: "https://www.typescriptlang.org/" },
  { name: "Java", icon: "/wds_icon/java.svg", href: "https://www.java.com/" },
  { name: "C#", icon: "/wds_icon/csharp.svg", href: "https://learn.microsoft.com/en-us/dotnet/csharp/" },
  { name: "C++", icon: "/wds_icon/cplusplus.svg", href: "https://isocpp.org/" },
  { name: "C", icon: "/wds_icon/c.svg", href: "https://www.open-std.org/JTC1/SC22/WG14/" },
  { name: "Go", icon: "/wds_icon/go.svg", href: "https://go.dev/" },
  { name: "Rust", icon: "/wds_icon/rust.svg", href: "https://www.rust-lang.org/" },
  { name: "PHP", icon: "/wds_icon/php.svg", href: "https://www.php.net/" },
  { name: "Ruby", icon: "/wds_icon/ruby.svg", href: "https://www.ruby-lang.org/" },
  { name: "Kotlin", icon: "/wds_icon/kotlin.svg", href: "https://kotlinlang.org/" },
  { name: "Swift", icon: "/wds_icon/swift.svg", href: "https://www.swift.org/" },
  { name: "Dart", icon: "/wds_icon/dart.svg", href: "https://dart.dev/" },
  { name: "Scala", icon: "/wds_icon/scala.svg", href: "https://www.scala-lang.org/" },
  { name: "R", icon: "/wds_icon/r.svg", href: "https://www.r-project.org/" },
  { name: "Lua", icon: "/wds_icon/lua.svg", href: "https://www.lua.org/" },
  { name: "Perl", icon: "/wds_icon/perl.svg", href: "https://www.perl.org/" },
  { name: "Bash", icon: "/wds_icon/bash.svg", href: "https://www.gnu.org/software/bash/" },
  { name: "Objective-C", icon: "/wds_icon/objectivec.svg", href: "https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/" },
  { name: "HTML5", icon: "/wds_icon/html5.svg", href: "https://developer.mozilla.org/en-US/docs/Web/HTML" },
  { name: "CSS3", icon: "/wds_icon/css3.svg", href: "https://developer.mozilla.org/en-US/docs/Web/CSS" },
  { name: "Node.js", icon: "/wds_icon/nodejs.svg", href: "https://nodejs.org/" },
  { name: "React", icon: "/wds_icon/react.svg", href: "https://react.dev/" },
  { name: "Next.js", icon: "/wds_icon/nextjs.svg", href: "https://nextjs.org/" },
  { name: "Vue.js", icon: "/wds_icon/vue.svg", href: "https://vuejs.org/" },
  { name: "Angular", icon: "/wds_icon/angular.svg", href: "https://angular.dev/" },
  { name: "Svelte", icon: "/wds_icon/svelte.svg", href: "https://svelte.dev/" },
  { name: "Express", icon: "/wds_icon/express.svg", href: "https://expressjs.com/" },
  { name: "NestJS", icon: "/wds_icon/nestjs.svg", href: "https://nestjs.com/" },
  { name: ".NET", icon: "/wds_icon/dotnet.svg", href: "https://dotnet.microsoft.com/" },
  { name: "Spring", icon: "/wds_icon/spring.svg", href: "https://spring.io/" },
  { name: "Laravel", icon: "/wds_icon/laravel.svg", href: "https://laravel.com/" },
  { name: "Django", icon: "/wds_icon/django.svg", href: "https://www.djangoproject.com/" },
  { name: "Flask", icon: "/wds_icon/flask.svg", href: "https://flask.palletsprojects.com/" },
  { name: "FastAPI", icon: "/wds_icon/fastapi.svg", href: "https://fastapi.tiangolo.com/" },
  { name: "Flutter", icon: "/wds_icon/flutter.svg", href: "https://flutter.dev/" },
  { name: "React Native", icon: "/wds_icon/react-native.svg", href: "https://reactnative.dev/" },
  { name: "MongoDB", icon: "/wds_icon/mongodb.svg", href: "https://www.mongodb.com/" },
  { name: "PostgreSQL", icon: "/wds_icon/postgresql.svg", href: "https://www.postgresql.org/" },
  { name: "MySQL", icon: "/wds_icon/mysql.svg", href: "https://www.mysql.com/" },
  { name: "Redis", icon: "/wds_icon/redis.svg", href: "https://redis.io/" },
  { name: "GraphQL", icon: "/wds_icon/graphql.svg", href: "https://graphql.org/" },
  { name: "Firebase", icon: "/wds_icon/firebase.svg", href: "https://firebase.google.com/" },
  { name: "Supabase", icon: "/wds_icon/supabase.svg", href: "https://supabase.com/" },
  { name: "Docker", icon: "/wds_icon/docker.svg", href: "https://www.docker.com/" },
  { name: "Kubernetes", icon: "/wds_icon/kubernetes.svg", href: "https://kubernetes.io/" },
  { name: "AWS", icon: "/wds_icon/aws.svg", href: "https://aws.amazon.com/" },
  { name: "Google Cloud", icon: "/wds_icon/google-cloud.svg", href: "https://cloud.google.com/" },
  { name: "Git", icon: "/wds_icon/git.svg", href: "https://git-scm.com/" },
];

const TECH_COLS = 10;
const TECH_ROWS = 5;

const techSeed = (i: number) => {
  const col = i % TECH_COLS;
  const row = Math.floor(i / TECH_COLS);
  const jx = ((i * 31) % 100) / 100;
  const jy = ((i * 57) % 100) / 100;
  return {
    fx: (col + 0.18 + 0.64 * jx) / TECH_COLS,
    fy: (row + 0.18 + 0.64 * jy) / TECH_ROWS,
  };
};

type TechParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  base: number;
  rot: number;
  spin: number;
  turnTimer: number;
  turnEvery: number;
  wander: number;
};

const MIN_SPEED = 1.1;
const MAX_SPEED = 3.6;
const BASE_SPEED = 1.7;

function FloatingTechnologyBanner() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const styles = useMemo(() => getLandingStyles(isDark), [isDark]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLElement | null)[]>([]);
  const hoverIndex = useRef(-1);
  const reducedMotion = useRef(false);
  const sizes = useRef({ w: 1, h: 1, node: 64 });
  const particles = useRef<TechParticle[]>([]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = media.matches;

    const readSize = () => {
      const rect = field.getBoundingClientRect();
      const node = nodeRefs.current[0]?.offsetWidth || 64;
      sizes.current = { w: Math.max(rect.width, 1), h: Math.max(rect.height, 1), node };
    };
    readSize();

    const { w, h, node } = sizes.current;
    const radius = node / 2;
    const minX = radius;
    const maxX = w - radius;
    const minY = radius;
    const maxY = h - radius;

    particles.current = TECHNOLOGIES.map((_, i) => {
      const seed = techSeed(i);
      const dirAngle = (i * 137.50776405003785) % (Math.PI * 2);
      const base = BASE_SPEED * (0.62 + ((i * 37) % 10) / 9);
      return {
        x: minX + seed.fx * (maxX - minX),
        y: minY + seed.fy * (maxY - minY),
        vx: Math.cos(dirAngle) * base,
        vy: Math.sin(dirAngle) * base,
        base,
        rot: (i % 20) * 18,
        spin: (i % 2 === 0 ? 1 : -1) * (0.08 + ((i * 13) % 10) / 90),
        turnTimer: 0,
        turnEvery: 1.2 + ((i * 29) % 10) / 6,
        wander: 0.35 + ((i * 47) % 10) / 14,
      };
    });

    let raf = 0;
    let last = performance.now();
    let visible = true;
    let active = false;

    const applyTransforms = () => {
      const r = sizes.current.node / 2;
      for (let i = 0; i < particles.current.length; i++) {
        const el = nodeRefs.current[i];
        if (!el) continue;
        const p = particles.current[i];
        el.style.transform = `translate3d(${p.x - r}px, ${p.y - r}px, 0) rotate(${p.rot}deg)`;
      }
    };

    const collide = () => {
      const r = sizes.current.node / 2;
      const minDist = r * 2;
      const ps = particles.current;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i];
          const b = ps[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy;
          if (distSq === 0 || distSq >= minDist * minDist) continue;
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const va = a.vx * nx + a.vy * ny;
          const vb = b.vx * nx + b.vy * ny;
          a.vx += (vb - va) * nx;
          a.vy += (vb - va) * ny;
          b.vx += (va - vb) * nx;
          b.vy += (va - vb) * ny;
          const jitter = 0.1;
          a.vx += (Math.random() - 0.5) * jitter;
          a.vy += (Math.random() - 0.5) * jitter;
          b.vx += (Math.random() - 0.5) * jitter;
          b.vy += (Math.random() - 0.5) * jitter;
        }
      }
    };

    const step = (now: number) => {
      if (!active || !visible) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { w, h, node } = sizes.current;
      const r = node / 2;
      const speedFactor = w < 768 ? 0.7 : 1;
      const ps = particles.current;

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const sp = Math.hypot(p.vx, p.vy) || 1;

        if (hoverIndex.current === i) {
          if (sp > p.base * 0.45) {
            p.vx *= 0.94;
            p.vy *= 0.94;
          }
        }

        p.turnTimer -= dt;
        if (p.turnTimer <= 0) {
          p.turnTimer = p.turnEvery;
          const cur = Math.atan2(p.vy, p.vx);
          const next = cur + (Math.random() - 0.5) * 1.6;
          p.vx = Math.cos(next) * sp;
          p.vy = Math.sin(next) * sp;
        }

        p.x += p.vx * dt * 60 * speedFactor;
        p.y += p.vy * dt * 60 * speedFactor;
        p.rot += p.spin * dt * 60 * speedFactor;

        const px = Math.min(Math.max(p.x, r), w - r);
        const py = Math.min(Math.max(p.y, r), h - r);
        const hitX = px !== p.x;
        const hitY = py !== p.y;
        p.x = px;
        p.y = py;
        if (hitX) {
          p.vx = Math.abs(p.vx) * (p.x === r ? 1 : -1) * (1 + (Math.random() - 0.5) * 0.3);
          p.vx += (Math.random() - 0.5) * p.wander;
          p.vy += (Math.random() - 0.5) * p.wander;
        }
        if (hitY) {
          p.vy = Math.abs(p.vy) * (p.y === r ? 1 : -1) * (1 + (Math.random() - 0.5) * 0.3);
          p.vx += (Math.random() - 0.5) * p.wander;
          p.vy += (Math.random() - 0.5) * p.wander;
        }
      }

      collide();

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const sp2 = Math.hypot(p.vx, p.vy);
        if (sp2 < MIN_SPEED) {
          const ang = p.rot * 0.11 + i * 1.7;
          p.vx = Math.cos(ang) * MIN_SPEED;
          p.vy = Math.sin(ang) * MIN_SPEED;
        } else if (sp2 > MAX_SPEED) {
          p.vx = (p.vx / sp2) * MAX_SPEED;
          p.vy = (p.vy / sp2) * MAX_SPEED;
        }
      }

      for (let i = 0; i < ps.length; i++) {
        const el = nodeRefs.current[i];
        if (!el) continue;
        const p = ps[i];
        el.style.transform = `translate3d(${p.x - r}px, ${p.y - r}px, 0) rotate(${p.rot}deg)`;
      }
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (active || reducedMotion.current) return;
      active = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      active = false;
      cancelAnimationFrame(raf);
    };

    applyTransforms();
    if (!reducedMotion.current) start();

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else stop();
      },
      { rootMargin: "160px" }
    );
    observer.observe(field);

    const ro = new ResizeObserver(() => {
      readSize();
      const { w, h, node } = sizes.current;
      const radius = node / 2;
      for (const p of particles.current) {
        p.x = Math.max(radius, Math.min(w - radius, p.x));
        p.y = Math.max(radius, Math.min(h - radius, p.y));
      }
      applyTransforms();
    });
    ro.observe(field);

    const onReducedChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
      if (e.matches) stop();
      else start();
    };
    media.addEventListener("change", onReducedChange);

    return () => {
      stop();
      observer.disconnect();
      ro.disconnect();
      media.removeEventListener("change", onReducedChange);
    };
  }, []);

  const handleEnter = (i: number) => {
    hoverIndex.current = i;
  };
  const handleLeave = (i: number) => {
    if (hoverIndex.current === i) hoverIndex.current = -1;
  };

  return (
    <section aria-label="Built With the Right Technology" style={styles.techSection} className="landing-section-tech">
      <div style={styles.techIntro}>
        <p style={styles.techEyebrow}>Powered by 50+ technologies</p>
        <h2 style={styles.techHeading}>
          Built With the <span style={styles.techHighlight}>Right Technology</span>
        </h2>
        <p style={styles.techSub}>From proven foundations to emerging technologies, we choose the right tools to turn your ideas into scalable digital solutions.</p>
      </div>
      <div ref={fieldRef} className="tech-field">
        {TECHNOLOGIES.map((tech, i) => {
          const nodeStyle: React.CSSProperties = {
            ...styles.techNode,
            left: 0,
            top: 0,
          };
          const inner = (
            <span style={styles.techNodeMask} className="tech-node-mask" aria-hidden="true">
              <img src={tech.icon} alt={tech.name} draggable={false} style={styles.techNodeImg} loading="lazy" />
            </span>
          );
          const handlers = {
            onMouseEnter: () => handleEnter(i),
            onMouseLeave: () => handleLeave(i),
            onFocus: () => handleEnter(i),
            onBlur: () => handleLeave(i),
          };
          return (
            <a
              key={tech.name}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              href={tech.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tech-node"
              style={nodeStyle}
              title={tech.name}
              aria-label={tech.name}
              {...handlers}
            >
              {inner}
            </a>
          );
        })}
      </div>
    </section>
  );
}

const FEATURE_GRADIENTS = [
  "radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.18), transparent 70%), radial-gradient(ellipse at 20% 80%, rgba(37, 99, 235, 0.08), transparent 70%)",
  "radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.18), transparent 70%), radial-gradient(ellipse at 20% 80%, rgba(6, 182, 212, 0.08), transparent 70%)",
  "radial-gradient(ellipse at 80% 20%, rgba(6, 182, 212, 0.18), transparent 70%), radial-gradient(ellipse at 20% 80%, rgba(14, 165, 233, 0.08), transparent 70%)",
  "radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.18), transparent 70%), radial-gradient(ellipse at 20% 80%, rgba(5, 150, 105, 0.08), transparent 70%)",
  "radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.18), transparent 70%), radial-gradient(ellipse at 20% 80%, rgba(59, 130, 246, 0.08), transparent 70%)",
];

export default function LandingPage() {
  const { openLeadServicesModal } = useLeadFunnel();
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const styles = useMemo(() => getLandingStyles(isDark), [isDark]);
  
  // Refs for smooth scroll
  const featuresRef = useRef<HTMLElement>(null);
  const developersRef = useRef<HTMLElement>(null);
  const clientsRef = useRef<HTMLElement>(null);
  const contactFormRef = useRef<HTMLElement>(null);
  const diversityVideoRef = useRef<HTMLVideoElement>(null);

  // Managed media from the Neon media system (public /api/settings/public/media)
  const heroVideo = useMediaAsset("landing_hero_video");
  const globalCollabImage = useMediaAsset("global_collaboration_image");
  const globalCollabVideo = useMediaAsset("global_collaboration_video");
  const featureCardBgs = [
    useMediaAsset("landing_feature_card_background_1"),
    useMediaAsset("landing_feature_card_background_2"),
    useMediaAsset("landing_feature_card_background_3"),
    useMediaAsset("landing_feature_card_background_4"),
    useMediaAsset("landing_feature_card_background_5"),
  ];
  
  // Contact form state
  const [contactState, setContactState] = useState({
    name: "",
    email: "",
    callingPhone: "",
    callingCountry: "",
    callingDial: "+91",
    whatsappPhone: "",
    whatsappCountry: "",
    whatsappDial: "+91",
    sameAsCalling: false,
    preferredContactDate: "",
    preferredContactTime: "",
    userTimeZone: "",
    company: "",
    subject: "",
    message: "",
    consent: false,
  });
  const [userTimeZoneInfo, setUserTimeZoneInfo] = useState<{ zone: string; badge: string }>({
    zone: "",
    badge: "",
  });

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      let shortCode = "";
      try {
        const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
        const tzPart = parts.find((p) => p.type === "timeZoneName");
        if (tzPart?.value) shortCode = tzPart.value;
      } catch {
        // fallback
      }
      const badge = shortCode ? `${tz} (${shortCode})` : tz;
      setUserTimeZoneInfo({ zone: tz, badge });
      setContactState((prev) => ({
        ...prev,
        userTimeZone: prev.userTimeZone || tz,
      }));
    } catch (err) {
      console.error("Timezone detection error:", err);
    }
  }, []);

  const activeTzLabel = useMemo(() => {
    const current = contactState.userTimeZone || userTimeZoneInfo.zone;
    if (!current) return "Detected Local Timezone";
    for (const grp of ALL_WORLD_TIMEZONE_GROUPS) {
      const match = grp.zones.find((z) => z.value === current);
      if (match) return match.label;
    }
    return current;
  }, [contactState.userTimeZone, userTimeZoneInfo.zone]);

  const isUserIST = useMemo(() => {
    const tz = contactState.userTimeZone || userTimeZoneInfo.zone || "";
    return tz === "Asia/Kolkata" || tz === "Asia/Calcutta";
  }, [contactState.userTimeZone, userTimeZoneInfo.zone]);

  const calculatedISTRange = useMemo(() => {
    if (!contactState.preferredContactTime) return "";
    return getSlotISTRange(
      contactState.preferredContactDate,
      contactState.preferredContactTime,
      contactState.userTimeZone || userTimeZoneInfo.zone || "Asia/Kolkata"
    );
  }, [contactState.preferredContactDate, contactState.preferredContactTime, contactState.userTimeZone, userTimeZoneInfo.zone]);

  const bookingDateLimits = useMemo(() => {
    return getBookingDateLimits(7);
  }, []);


  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<null | "success" | "error">(null);
  const [submitErrorMsg, setSubmitErrorMsg] = useState("");

  const validateContactForm = () => {
    const errors: Record<string, string> = {};
    const name = contactState.name.trim();
    const email = contactState.email.trim().toLowerCase();
    const subject = contactState.subject.trim();
    const message = contactState.message.trim();
    if (!name) errors.name = "Please enter your name.";
    else if (name.length > 200) errors.name = "Name must be 200 characters or fewer.";
    if (!email) errors.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Please enter a valid email address.";
    else if (email.length > 200) errors.email = "Email must be 200 characters or fewer.";
    if (contactState.company.trim().length > 200) errors.company = "Company must be 200 characters or fewer.";
    if (contactState.preferredContactDate) {
      if (contactState.preferredContactDate < bookingDateLimits.minDate) {
        errors.preferredContactDate = "Please choose a date from today onwards.";
      } else if (contactState.preferredContactDate > bookingDateLimits.maxDate) {
        errors.preferredContactDate = "Please select a date within the next 7 days.";
      }
    }
    if (contactState.callingPhone.trim()) {
      const callCheck = validatePhoneNumber(contactState.callingPhone, contactState.callingCountry);
      if (!callCheck.valid) {
        errors.callingPhone = callCheck.error || "Please enter a valid calling phone number.";
      }
    }
    if (contactState.whatsappPhone.trim()) {
      const waCheck = validatePhoneNumber(contactState.whatsappPhone, contactState.whatsappCountry);
      if (!waCheck.valid) {
        errors.whatsappPhone = waCheck.error || "Please enter a valid WhatsApp number.";
      }
    }
    if (!subject) errors.subject = "Please select a subject.";
    else if (subject.length > 300) errors.subject = "Subject must be 300 characters or fewer.";
    if (!message) errors.message = "Please enter your message.";
    else if (message.length > 20000) errors.message = "Message must be 20,000 characters or fewer.";
    if (!contactState.consent) {
      errors.consent = "Please agree to the privacy policy before submitting.";
    }
    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContactChange = (field: keyof typeof contactState, value: any) => {
    setContactState((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "sameAsCalling" && value === true) {
        next.whatsappPhone = prev.callingPhone;
        next.whatsappCountry = prev.callingCountry;
        next.whatsappDial = prev.callingDial;
      } else if (field === "callingPhone" && prev.sameAsCalling) {
        next.whatsappPhone = value;
      } else if (field === "callingCountry" && prev.sameAsCalling) {
        next.whatsappCountry = value;
      } else if (field === "callingDial" && prev.sameAsCalling) {
        next.whatsappDial = value;
      }
      return next;
    });
    setContactErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
  };
  
  const [contactInfo, setContactInfo] = useState(defaultContactInfo);
  
  // Stats counter animation
  const [stats, setStats] = useState({
    projects: 0,
    clients: 0,
    developers: 0,
    countries: 0,
  });
  const [publishedProjects, setPublishedProjects] = useState<any[]>([]);
  const [publishedClients, setPublishedClients] = useState<any[]>([]);
  const [publishedDevelopers, setPublishedDevelopers] = useState<any[]>([]);
  const [publishedTestimonials, setPublishedTestimonials] = useState<any[]>([]);

  useEffect(() => {
    Promise.allSettled([
      getPublishedProjects(), 
      getPublishedClients(), 
      getPublishedDevelopers(), 
      getPublishedTestimonials(),
      API.get('/settings/public/contact_info')
    ]).then((results) => {
      if (results[0].status === "fulfilled") setPublishedProjects(results[0].value);
      if (results[1].status === "fulfilled") setPublishedClients(results[1].value);
      if (results[2].status === "fulfilled") setPublishedDevelopers(results[2].value);
      if (results[3].status === "fulfilled") setPublishedTestimonials(results[3].value);
      if (results[4].status === "fulfilled" && results[4].value?.data?.success) {
        const data = results[4].value.data.data;
        setContactInfo({
          ...defaultContactInfo,
          ...data,
          headquarters: data.headquarters || defaultContactInfo.headquarters,
          phone: data.phone || defaultContactInfo.phone,
        });
      }
    });
  }, []);

  useEffect(() => {
    const video = diversityVideoRef.current;
    if (!video) return;
    const attemptPlay = () => {
      if (video.paused) {
        video.play().catch(() => {});
      }
      window.removeEventListener("pointerdown", attemptPlay);
      window.removeEventListener("keydown", attemptPlay);
    };
    window.addEventListener("pointerdown", attemptPlay);
    window.addEventListener("keydown", attemptPlay);
    return () => {
      window.removeEventListener("pointerdown", attemptPlay);
      window.removeEventListener("keydown", attemptPlay);
    };
  }, []);

  useEffect(() => {
    const video = diversityVideoRef.current;
    if (!video) return;
    video.load();
    video.play().catch(() => {});
  }, [globalCollabVideo.url]);

  // Smooth scroll function
  const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleGetStarted = () => {
    openLeadServicesModal();
  };

  // Features data
  const features = [
    { icon: Code, title: "Expert Developers", description: "Top-tier developers with proven experience in modern tech stacks", href: "#developers" },
    { icon: Rocket, title: "Fast Delivery", description: "Agile methodology ensuring quick turnaround without quality compromise", href: "#projects" },
    { icon: Zap, title: "24/7 Support", description: "Round-the-clock technical support and maintenance", href: "#contact" },
    { icon: Users, title: "Dedicated Teams", description: "Build your dedicated development team tailored to your needs", href: "#clients" },
    { icon: BarChart3, title: "Scalable Solutions", description: "Grow your business with scalable, future-proof solutions", href: "#testimonials" }
  ];

  const effectiveProjects = (publishedProjects || []).filter(Boolean);

  const rawClients = (publishedClients || []).filter(Boolean);

  const publicClients = rawClients.map((client: any, index: number) => ({
    id: client?._id || client?.id || `client-${index}`,
    name: client?.name || "Client",
    company: client?.company || "Independent client",
    description:
      client?.address ||
      client?.customId ||
      client?.description ||
      "Partnered with Websmith on product delivery, design quality, and long-term support.",
  }));

  const rawDevelopers = (publishedDevelopers || []).filter(Boolean);

  const publicDevelopers = rawDevelopers.map((developer: any, index: number) => ({
    id: developer?._id || developer?.id || `dev-${index}`,
    name: developer?.name || "Developer",
    role: developer?.headline || developer?.role || "Software Developer",
    skills: Array.isArray(developer?.skills) && developer.skills.length ? developer.skills : ["Engineering", "Delivery"],
    experience: developer?.experienceYears || developer?.experience || 6,
    avatar: developer?.avatar || "",
    bio: developer?.bio || "Experienced engineer focused on shipping resilient digital products.",
  }));

  const statTargets = {
    projects: 120,
    clients: 85,
    developers: 40,
    countries: 25,
  };

  useEffect(() => {
    const duration = 1200;
    const stepTime = 30;
    const steps = Math.max(1, Math.floor(duration / stepTime));

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep += 1;
      const progress = currentStep / steps;

      setStats({
        projects: Math.round(statTargets.projects * progress),
        clients: Math.round(statTargets.clients * progress),
        developers: Math.round(statTargets.developers * progress),
        countries: Math.round(statTargets.countries * progress),
      });

      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, [statTargets.projects, statTargets.clients, statTargets.developers, statTargets.countries]);

  const rawTestimonials = (publishedTestimonials || []).filter(Boolean);

  const reviewCards = rawTestimonials.map((testimonial: any, index: number) => ({
    id: testimonial?._id || testimonial?.id || `testimonial-${index}`,
    name: testimonial?.name || "Client",
    company: testimonial?.company || testimonial?.projectName || "Websmith client",
    quote: testimonial?.quote || "",
    rating: testimonial?.rating || 5,
  }));

  const statsCarouselItems = [
    { id: "stat-projects", value: `${stats.projects}+`, label: "Projects Delivered" },
    { id: "stat-clients", value: `${stats.clients}+`, label: "Active Client Partnerships" },
    { id: "stat-developers", value: `${stats.developers}+`, label: "Specialist Developers" },
    { id: "stat-countries", value: `${stats.countries}+`, label: "Countries Served" },
    { id: "stat-support", value: "< 2h", label: "Support Response Target" },
    { id: "stat-visibility", value: "100%", label: "Shared Delivery Visibility" },
  ];

  // Manage Page (contact_info) is the source of truth. Derive complete
  // collections so EVERY configured email / phone / social account renders
  // (never first-item-only), with empties excluded and no invented values.
  const contactEmails: string[] = [
    contactInfo.email,
    contactInfo.sales_email,
    contactInfo.no_reply_email,
    contactInfo.hr_email,
  ].filter((value: string) => Boolean(value && value.trim()));

  const contactPhones: string[] = [
    contactInfo.phone,
    contactInfo.mobile_number,
    contactInfo.landline_number,
  ].filter((value: string) => Boolean(value && value.trim()));

  const contactSocials = SOCIAL_PLATFORM_META.map((platform) => ({
    ...platform,
    href: String(contactInfo[platform.key] || "").trim(),
  })).filter((item) => Boolean(item.href));

  return (
    <div style={styles.container} className="landing-page-root">
      {/* Hero Section */}
      <section style={styles.hero} className="landing-hero">
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            zIndex: 0,
          }}
        >
          <source src={heroVideo.url} type="video/mp4" />
        </video>
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent} className="landing-hero-content">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 18px",
              borderRadius: "9999px",
              backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.12)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: isDark ? "1px solid rgba(41, 151, 255, 0.3)" : "1px solid rgba(0, 113, 227, 0.25)",
              color: isDark ? "#2997ff" : "#0071e3",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "22px",
            }}
          >
            <Sparkles size={13} /> Enterprise Digital Ecosystems
          </div>
          <h1 style={styles.heroTitle} className="landing-hero-title">
            Enterprise Digital Ecosystems &amp;{" "}
            <span
              className="landing-hero-highlight"
              style={{
                display: "inline-block",
                background: "linear-gradient(135deg, #38bdf8 0%, #06b6d4 50%, #34d399 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                textShadow: "none",
                filter: "drop-shadow(0 2px 10px rgba(6, 182, 212, 0.4))",
              }}
            >
              Custom Software
            </span>
          </h1>
          <p style={styles.heroSubtitle} className="landing-hero-subtitle">
            We architect high-performance web applications, enterprise ERP systems, and universal licensing infrastructure for high-growth businesses.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
            <button
              onClick={handleGetStarted}
              style={styles.ctaButton}
              className="cta-hover"
            >
              Get Started <ArrowRight size={17} />
            </button>
            <Link
              href="/portfolio"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "13px 26px",
                borderRadius: "9999px",
                fontSize: "15px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "#ffffff",
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                textDecoration: "none",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="hero-secondary-btn"
            >
              Explore Portfolio
            </Link>
          </div>
        </div>
      </section>

      {/* Enterprise Trust & Security Strip */}
      <div
        style={{
          width: "100%",
          padding: "16px clamp(16px, 4vw, 40px)",
          backgroundColor: isDark ? "#161617" : "#f5f5f7",
          borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #d2d2d7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(16px, 3vw, 40px)",
          flexWrap: "wrap",
          fontSize: "12px",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: isDark ? "#a1a1a6" : "#424245",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#3b82f6" }}>🔒</span>
          <span>AES-256-GCM Credential Encryption</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#10b981" }}>🔑</span>
          <span>HMAC-SHA256 Cryptographic API Gate</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#8b5cf6" }}>⚡</span>
          <span>99.99% High-Availability Cloud Architecture</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#06b6d4" }}>🌍</span>
          <span>418 World Timezones Live Support</span>
        </div>
      </div>

      {/* Features Grid */}
      <section id="features" ref={featuresRef} style={styles.section} className="landing-section-features">
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 16px",
                borderRadius: "9999px",
                backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)",
                border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)",
                color: isDark ? "#2997ff" : "#0071e3",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              <Sparkles size={13} /> Core Capabilities &amp; Standards
            </div>
          <h2 style={styles.sectionTitle}>Why Choose Websmith</h2>
          <p style={styles.sectionSubtitle}>Everything you need to build exceptional digital products</p>
        </div>
        <div style={styles.featuresGrid} className="landing-features-grid">
          {features.map((feature, index) => (
            <button
              key={index} 
              type="button"
              onClick={() => {
                const target = document.querySelector(feature.href);
                if (target instanceof HTMLElement) {
                  target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              style={{
                ...styles.featureCard,
                backgroundImage: featureCardBgs[index % 5]?.managed
                  ? `linear-gradient(color-mix(in srgb, var(--bg-secondary) 92%, transparent), color-mix(in srgb, var(--bg-secondary) 92%, transparent)), url(${featureCardBgs[index % 5].url})`
                  : FEATURE_GRADIENTS[index % 5],
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              className={`feature-card landing-feature-grid-card feature-card-${['blue', 'blue', 'cyan', 'green', 'green'][index % 5]}`}
            >
              <div style={styles.featureIcon} className="landing-card-icon">{<feature.icon size={28} />}</div>
              <h3 style={styles.featureTitle} className="landing-card-title">{feature.title}</h3>
              <p style={styles.featureDesc} className="landing-card-desc">{feature.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Built With the Right Technology — floating technology banner */}
      <FloatingTechnologyBanner />

      {/* Stats — looping carousel */}
      <section style={styles.statsSection} className="landing-section-stats">
        <div style={styles.statsIntro}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 16px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)",
                border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)",
                color: isDark ? "#2997ff" : "#0071e3",
              }}
            >
              <BarChart3 size={13} />
              Proven Engineering Velocity
            </span>
          </div>
          <h2 style={styles.statsHeading}>Momentum you can see</h2>
          <p style={styles.statsSub}>Real numbers that reflect how modern engineering teams ship with Websmith.</p>
        </div>
        <StatsStrip items={statsCarouselItems} />
      </section>

      {effectiveProjects.length > 0 && (
        <section id="projects" style={styles.section} className="landing-section-projects">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)", border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)", color: isDark ? "#2997ff" : "#0071e3", marginBottom: "12px" }}>
                <Briefcase size={13} />
                Production Systems &amp; Case Studies
              </div>
              <h2 style={{ ...styles.sectionTitle, textAlign: "left", marginBottom: "8px" }}>Portfolio &amp; Case Studies</h2>
              <p style={{ ...styles.sectionSubtitle, textAlign: "left", marginBottom: 0 }}>Selected launches and enterprise delivery work with public-facing architecture details.</p>
            </div>
            <Link
              href="/portfolio"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "14px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "#ffffff",
                textDecoration: "none",
                padding: "10px 22px",
                borderRadius: "9999px",
                backgroundColor: isDark ? "#2997ff" : "#0071e3",
                boxShadow: "0 4px 14px rgba(0, 113, 227, 0.35)",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              View Full Portfolio ➔
            </Link>
          </div>
          <HorizontalCardStrip
            items={effectiveProjects}
            ariaLabel="Published projects"
            cardsPerView={4}
            gap={18}
            autoLoopCount={6}
            direction="right-to-left"
            scale={1}
            renderItem={(project: any) => (
              <div style={{ ...styles.horizontalCardSurface, ...styles.sliderCard, width: "100%", maxWidth: "100%" }} className="feature-card landing-project-card">
                {project.previewImage ? (
                  <img 
                    src={project.previewImage} 
                    alt={project.name} 
                    style={styles.projectPreviewImage} 
                    className="landing-project-img"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/images/portfolio/apexflow_mockup.jpg";
                    }}
                  />
                ) : null}
                <div style={styles.featureIcon} className="landing-card-icon"><Briefcase size={26} /></div>
                <h3 style={styles.featureTitle} className="landing-card-title">{project.name}</h3>
                <p style={styles.featureDesc} className="landing-card-desc">{project.description}</p>
                <p style={{ ...styles.clientCompany, marginTop: "12px" }} className="landing-card-subtitle">{project.client || "Published Project"}</p>
                {project.publicUrl ? (
                  <a href={project.publicUrl} target="_blank" rel="noreferrer" style={styles.projectLink} className="landing-card-link">
                    <span>{project.publicUrl}</span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <p style={styles.projectLinkMuted} className="landing-card-muted">Hosted project URL will appear here once added from the admin panel.</p>
                )}
              </div>
            )}
          />
        </section>
      )}


      {/* Global Diversity & Collaboration — Full Screen + Edge-to-Edge 16:9 Video Frame */}
      <section className="relative w-full overflow-hidden" style={{ ...styles.section, padding: "clamp(36px, 5vw, 64px) clamp(8px, 2vw, 28px)" }}>
        <div className="w-full">
          <div
            className="w-full rounded-[28px]"
            style={{
              backgroundColor: isDark ? "#161617" : "#ffffff",
              backdropFilter: isDark ? "blur(20px)" : "none",
              WebkitBackdropFilter: isDark ? "blur(20px)" : "none",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: isDark ? "0 20px 60px rgba(0, 0, 0, 0.7)" : "0 12px 40px rgba(0, 0, 0, 0.05)",
              padding: "clamp(24px, 3.5vw, 44px)",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)", border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)", color: isDark ? "#2997ff" : "#0071e3", marginBottom: "20px" }}>
              <Globe size={13} />
              Global Engineering Culture
            </div>
            <div className="flex flex-col lg:flex-row items-start justify-between gap-6 lg:gap-10 mb-8">
              <div className="flex flex-col items-start w-full lg:w-1/2">
                <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? "text-[#f5f5f7]" : "text-[#1d1d1f]"}`} style={{ letterSpacing: "-0.025em" }}>Global Collaboration &amp; Technical Excellence</h2>
                <p className={`text-base leading-relaxed ${isDark ? "text-[#a1a1a6]" : "text-[#86868b]"}`}>
                  Our team brings together diverse perspectives and world-class expertise to solve complex challenges.
                  We believe in the power of inclusive collaboration to build the next generation of digital products.
                </p>
              </div>
              <div className="flex flex-col items-start w-full lg:w-1/2">
                <p className={`text-base leading-relaxed ${isDark ? "text-[#a1a1a6]" : "text-[#86868b]"}`}>
                  Why Websmith? Because we pair global talent with enterprise-grade delivery and round-the-clock support.
                  One dedicated team that builds faster, ships smarter, and stays by your side long after launch —
                  that is why clients choose Websmith, and why they stay.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 w-full items-center">
              <div className="w-full aspect-video rounded-[20px] overflow-hidden shadow-md">
                <img
                  src={globalCollabImage.url}
                  alt="Global Technical Team"
                  className="w-full h-full object-cover block"
                  style={{ border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)" }}
                />
              </div>
              <div className="relative w-full aspect-video rounded-[20px] overflow-hidden bg-black shadow-md group">
                <video
                  ref={diversityVideoRef}
                  autoPlay
                  loop
                  playsInline
                  muted
                  preload="auto"
                  src={globalCollabVideo.url}
                  className="w-full h-full object-cover block"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                  }}
                />
                {/* Sleek Floating Apple Fullscreen & Mute Controls */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      if (diversityVideoRef.current) {
                        diversityVideoRef.current.muted = !diversityVideoRef.current.muted;
                      }
                    }}
                    className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white transition-all text-xs flex items-center justify-center cursor-pointer shadow-sm"
                    aria-label="Toggle sound"
                    title="Toggle sound"
                  >
                    🔊
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (diversityVideoRef.current) {
                        if (diversityVideoRef.current.requestFullscreen) {
                          diversityVideoRef.current.requestFullscreen();
                        } else if ((diversityVideoRef.current as any).webkitRequestFullscreen) {
                          (diversityVideoRef.current as any).webkitRequestFullscreen();
                        }
                      }
                    }}
                    className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white transition-all text-xs flex items-center justify-center cursor-pointer shadow-sm"
                    aria-label="Full screen video"
                    title="Full screen video"
                  >
                    ⛶
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Satisfied Clients - 4 Cards Layout */}
      {publicClients.length > 0 && (
        <section id="clients" ref={clientsRef} style={styles.section} className="landing-section-clients">
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)", border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)", color: isDark ? "#2997ff" : "#0071e3", marginBottom: "12px" }}>
              <Building2 size={13} />
              Trusted Enterprise Partnerships
            </div>
            <h2 style={styles.sectionTitle}>Our Satisfied Clients</h2>
            <p style={styles.sectionSubtitle}>Recognized organizations scaling their mission-critical applications with Websmith.</p>
          </div>
          <HorizontalCardStrip
            items={publicClients}
            ariaLabel="Satisfied clients"
            cardsPerView={4}
            gap={18}
            autoLoopCount={6}
            direction="left-to-right"
            scale={1}
            renderItem={(client, index) => (
              <div key={client.id || index} style={{ ...styles.horizontalCardSurfaceCenter, ...styles.sliderCard, width: "100%", maxWidth: "100%" }} className="client-card landing-client-card">
                <div style={styles.clientAvatarContainer} className="landing-client-avatar">
                  <Building2 size={22} color={isDark ? "#2997ff" : "#0071e3"} className="landing-client-icon" />
                </div>
                <h4 style={styles.clientName} className="landing-card-title">{client.name}</h4>
                <p style={styles.clientCompany} className="landing-card-subtitle">{client.company}</p>
                <p style={styles.clientProject} className="landing-card-desc">{client.description}</p>
              </div>
            )}
          />
        </section>
      )}


      {/* Developers - expert profiles */}
      {publicDevelopers.length > 0 && (
        <section id="developers" ref={developersRef} style={styles.section} className="landing-section-developers">
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)", border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)", color: isDark ? "#2997ff" : "#0071e3", marginBottom: "12px" }}>
              <Users size={13} />
              Technical Architects &amp; Leadership
            </div>
            <h2 style={styles.sectionTitle}>Meet Our Expert Developers</h2>
            <p style={styles.sectionSubtitle}>The senior systems architects and product engineers driving your digital transformation.</p>
          </div>
          <HorizontalCardStrip
            items={publicDevelopers}
            ariaLabel="Expert developers"
            cardsPerView={4}
            gap={18}
            autoLoopCount={6}
            direction="right-to-left"
            scale={1}
            renderItem={(dev) => (
              <div key={dev.id} style={{ ...styles.horizontalCardSurfaceCenter, ...styles.sliderCard, width: "100%", maxWidth: "100%" }} className="developer-card landing-developer-card">
                <div style={styles.circleMask} className="landing-dev-circle-mask">
                  {dev.avatar ? <img src={dev.avatar} alt={dev.name} style={styles.devAvatarImg} /> : <span style={styles.circleInitial} className="landing-dev-circle-initial">{dev.name.charAt(0)}</span>}
                </div>
                <h4 style={styles.developerName} className="landing-card-title">{dev.name}</h4>
                <p style={styles.developerRole} className="landing-card-role">{dev.role}</p>
                <div style={styles.skillTags} className="landing-skill-tags">
                  {dev.skills.slice(0, 3).map((skill, i) => (
                    <span key={i} style={styles.skillTag} className="landing-skill-tag">{skill}</span>
                  ))}
                </div>
                <p style={styles.developerExperience} className="landing-card-experience">{dev.experience}+ years experience</p>
                <p style={styles.developerBlurb} className="landing-card-desc">{dev.bio}</p>
              </div>
            )}
          />
        </section>
      )}


      {/* Testimonials */}
      {reviewCards.length > 0 && (
        <section id="testimonials" style={styles.section} className="landing-section-testimonials">
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)", border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)", color: isDark ? "#2997ff" : "#0071e3", marginBottom: "12px" }}>
              <Star size={13} />
              Client Endorsements &amp; SLAs
            </div>
            <h2 style={styles.sectionTitle}>What Our Clients Say</h2>
            <p style={styles.sectionSubtitle}>Continuous feedback highlights from across enterprise delivery teams and executive sponsors.</p>
          </div>
          <HorizontalCardStrip
            items={reviewCards}
            ariaLabel="Client testimonials"
            cardsPerView={4}
            gap={18}
            autoLoopCount={6}
            direction="left-to-right"
            scale={1}
            renderItem={(testimonial) => (
              <div key={testimonial.id} style={{ ...styles.horizontalCardSurfaceCenter, ...styles.sliderCard, ...styles.testimonialCard }} className="testimonial-card landing-testimonial-card">
                <div style={styles.testimonialAvatar} className="landing-testimonial-avatar">{testimonial.name.slice(0, 2).toUpperCase()}</div>
                <div style={styles.testimonialStars} className="landing-testimonial-stars">
                  {[...Array(testimonial.rating || 5)].map((_, i) => (
                    <Star key={i} size={16} fill="#FFB800" color="#FFB800" />
                  ))}
                </div>
                <p style={styles.testimonialText} className="landing-testimonial-quote">&ldquo;{testimonial.quote}&rdquo;</p>
                <h4 style={styles.testimonialName} className="landing-card-title">{testimonial.name}</h4>
                <p style={styles.testimonialCompany} className="landing-card-subtitle">{testimonial.company}</p>
              </div>
            )}
          />
        </section>
      )}


      {/* Contact Section */}
      <section id="contact" ref={contactFormRef} style={styles.contactSection} className="landing-section-contact">
        <div style={styles.contactContainer}>
          <div style={styles.contactHeader}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)", border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)", color: isDark ? "#2997ff" : "#0071e3", marginBottom: "12px" }}>
              <MessageSquare size={13} />
              Direct Architecture Inquiry
            </div>
            <h2 style={styles.sectionTitle}>Get in Touch</h2>
            <p style={styles.sectionSubtitle}>Have a project or high-scale platform in mind? Let&apos;s build something exceptional together.</p>
          </div>
          
          <div style={styles.contactGrid} className="contact-grid-layout w-full">
            <div style={styles.contactInfo}>
              <h3 style={styles.contactInfoTitle}>Contact Information</h3>
              <p style={styles.contactInfoDesc}>Fill out the form and our team will get back to you within 24 hours.</p>
              
              <div style={styles.infoItems}>
                <div style={styles.infoItem}>
                  <div style={styles.infoIcon}>📍</div>
                  <div>
                    <h4 style={styles.infoLabel}>Headquarters</h4>
                    <p style={styles.infoValue} className="whitespace-pre-wrap">{contactInfo.headquarters}</p>
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoIcon}>📧</div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={styles.infoLabel}>Email</h4>
                    <div style={styles.infoValueRow}>
                      {contactEmails.length > 0 ? (
                        contactEmails.map((email, index) => (
                          <span key={email} style={styles.infoValueRowItem}>
                            {index > 0 && <span style={styles.infoValueSeparator}>|</span>}
                            <a href={`mailto:${email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{email}</a>
                          </span>
                        ))
                      ) : (
                        <p style={styles.infoValue}>—</p>
                      )}
                    </div>
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoIcon}>📞</div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={styles.infoLabel}>Phone</h4>
                    <div style={styles.infoValueRow}>
                      {contactPhones.length > 0 ? (
                        contactPhones.map((phone, index) => (
                          <span key={phone} style={styles.infoValueRowItem}>
                            {index > 0 && <span style={styles.infoValueSeparator}>|</span>}
                            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} style={{ color: 'inherit', textDecoration: 'none' }}>{phone}</a>
                          </span>
                        ))
                      ) : (
                        <p style={styles.infoValue}>—</p>
                      )}
                    </div>
                  </div>
                </div>
                {contactSocials.length > 0 && (
                  <div style={styles.infoItem}>
                    <div style={styles.infoIcon}>🌐</div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={styles.infoLabel}>Social Media</h4>
                      <div style={styles.infoSocialRow}>
                        {contactSocials.map((social) => {
                          const Icon = social.icon;
                          return (
                            <a
                              key={social.key}
                              href={social.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={social.label}
                              title={social.label}
                              style={styles.infoSocialLink}
                            >
                              <Icon size={16} />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div style={styles.contactFormContainer}>
              <div style={styles.contactGlassCard}>
                <form 
                  style={styles.contactForm}
                  noValidate
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSubmitStatus(null);
                    setSubmitErrorMsg("");
                    if (!validateContactForm()) return;
                    setIsSubmitting(true);
                    try {
                      const callingNumberFull = contactState.callingPhone.trim()
                        ? `${contactState.callingDial || "+91"} ${contactState.callingPhone.trim()}`
                        : "";
                      const whatsappNumberFull = contactState.sameAsCalling
                        ? callingNumberFull
                        : contactState.whatsappPhone.trim()
                        ? `${contactState.whatsappDial || "+91"} ${contactState.whatsappPhone.trim()}`
                        : "";

                      const activeTz = contactState.userTimeZone || userTimeZoneInfo.zone || "Asia/Kolkata";
                      const istConverted = calculatedISTRange || "";

                      const scheduleParts = [
                        contactState.preferredContactDate.trim(),
                        contactState.preferredContactTime.trim()
                          ? `${contactState.preferredContactTime} (${userTimeZoneInfo.badge || activeTz})`
                          : "",
                        istConverted && !isUserIST ? `[Call at IST: ${istConverted}]` : "",
                      ].filter(Boolean);
                      const formattedSchedule = scheduleParts.join(" · ");

                      await createPublicTicket({
                        name: contactState.name.trim(),
                        email: contactState.email.trim().toLowerCase(),
                        callingPhone: callingNumberFull,
                        whatsappPhone: whatsappNumberFull,
                        preferredContactDate: formattedSchedule || contactState.preferredContactDate.trim(),
                        preferredContactTime: contactState.preferredContactTime.trim(),
                        timeZone: activeTz,
                        clientTimeZone: activeTz,
                        adminCallTimeIST: istConverted,
                        company: contactState.company.trim(),
                        subject: contactState.subject.trim(),
                        message: contactState.message.trim(),
                      });
                      setSubmitStatus("success");
                      setContactState({
                        name: "",
                        email: "",
                        callingPhone: "",
                        callingCountry: "",
                        callingDial: "+91",
                        whatsappPhone: "",
                        whatsappCountry: "",
                        whatsappDial: "+91",
                        sameAsCalling: false,
                        preferredContactDate: "",
                        preferredContactTime: "",
                        userTimeZone: activeTz,
                        company: "",
                        subject: "",
                        message: "",
                        consent: false,
                      });
                      setContactErrors({});
                    } catch (error: any) {
                      console.error("Public inquiry error:", error);
                      setSubmitStatus("error");
                      setSubmitErrorMsg(
                        error?.response?.data?.message ||
                        "We could not send your message right now. Please try again."
                      );
                    } finally {
                      setIsSubmitting(false);
                      setTimeout(() => setSubmitStatus(null), 6000);
                    }
                  }}
                >
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel} htmlFor="contact-name">Name</label>
                      <input 
                        id="contact-name"
                        name="name"
                        type="text" 
                        placeholder="Your Name" 
                        style={{ ...styles.formInput, ...(contactErrors.name ? styles.formInputError : {}) }}
                        required
                        autoComplete="name"
                        aria-invalid={Boolean(contactErrors.name)}
                        aria-describedby={contactErrors.name ? "contact-name-error" : undefined}
                        value={contactState.name}
                        onChange={(e) => handleContactChange("name", e.target.value)}
                      />
                      {contactErrors.name && (
                        <p id="contact-name-error" role="alert" style={styles.fieldError}>{contactErrors.name}</p>
                      )}
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel} htmlFor="contact-email">Email</label>
                      <input 
                        id="contact-email"
                        name="email"
                        type="email" 
                        placeholder="john@example.com" 
                        style={{ ...styles.formInput, ...styles.emailInput, ...(contactErrors.email ? styles.formInputError : {}) }}
                        required
                        autoComplete="email"
                        aria-invalid={Boolean(contactErrors.email)}
                        aria-describedby={contactErrors.email ? "contact-email-error" : undefined}
                        value={contactState.email}
                        onChange={(e) => handleContactChange("email", e.target.value)}
                      />
                      {contactErrors.email && (
                        <p id="contact-email-error" role="alert" style={styles.fieldError}>{contactErrors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Calling Number & WhatsApp Number */}
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel} htmlFor="contact-calling-phone">
                        Calling Number
                      </label>
                      <PhoneInputWithCountry
                        id="contact-calling-phone"
                        name="callingPhone"
                        value={contactState.callingPhone}
                        countryCode={contactState.callingCountry}
                        onCountryChange={(country) => {
                          handleContactChange("callingCountry", country.code);
                          handleContactChange("callingDial", country.dial);
                        }}
                        onChange={(digits) => handleContactChange("callingPhone", digits)}
                        placeholder="Phone number"
                        error={contactErrors.callingPhone}
                        icon={<Phone size={15} />}
                      />
                      {contactErrors.callingPhone && (
                        <p role="alert" style={styles.fieldError}>{contactErrors.callingPhone}</p>
                      )}
                    </div>

                    <div style={styles.formGroup}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "20px" }}>
                        <label style={styles.formLabel} htmlFor="contact-whatsapp-phone">
                          WhatsApp Number
                        </label>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" }}>
                          <input
                            type="checkbox"
                            checked={contactState.sameAsCalling}
                            onChange={(e) => handleContactChange("sameAsCalling", e.target.checked)}
                            style={{ cursor: "pointer" }}
                          />
                          Same as calling
                        </label>
                      </div>
                      <PhoneInputWithCountry
                        id="contact-whatsapp-phone"
                        name="whatsappPhone"
                        value={contactState.whatsappPhone}
                        countryCode={contactState.whatsappCountry}
                        disabled={contactState.sameAsCalling}
                        onCountryChange={(country) => {
                          handleContactChange("whatsappCountry", country.code);
                          handleContactChange("whatsappDial", country.dial);
                        }}
                        onChange={(digits) => handleContactChange("whatsappPhone", digits)}
                        placeholder="WhatsApp number"
                        error={contactErrors.whatsappPhone}
                        icon={<MessageSquare size={15} />}
                      />
                      {contactErrors.whatsappPhone && (
                        <p role="alert" style={styles.fieldError}>{contactErrors.whatsappPhone}</p>
                      )}
                    </div>
                  </div>

                  {/* Preferred Date, Time Slot & Timezone in ONE row */}
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <label style={styles.formLabel} htmlFor="contact-preferred-date">
                          Preferred Date
                        </label>
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>
                          Next 7 days only
                        </span>
                      </div>
                      <input 
                        id="contact-preferred-date"
                        name="preferredContactDate"
                        type="date" 
                        min={bookingDateLimits.minDate}
                        max={bookingDateLimits.maxDate}
                        style={{
                          ...styles.formInput,
                          ...(contactErrors.preferredContactDate ? { borderColor: "var(--color-danger, #ef4444)" } : {}),
                        }}
                        value={contactState.preferredContactDate}
                        onChange={(e) => handleContactChange("preferredContactDate", e.target.value)}
                      />
                      {contactErrors.preferredContactDate && (
                        <p role="alert" style={styles.fieldError}>{contactErrors.preferredContactDate}</p>
                      )}
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel} htmlFor="contact-preferred-time">
                        Preferred Time Slot
                      </label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <select
                          id="contact-preferred-time"
                          name="preferredContactTime"
                          style={{
                            ...styles.formInput,
                            ...styles.formSelect,
                            color: contactState.preferredContactTime ? "var(--text-primary)" : "var(--text-secondary)",
                          }}
                          value={contactState.preferredContactTime}
                          onChange={(e) => handleContactChange("preferredContactTime", e.target.value)}
                        >
                          <option value="" style={{ color: "var(--text-secondary)" }}>
                            Select preferred slot...
                          </option>
                          {CONTACT_TIME_SLOT_GROUPS.map((grp) => (
                            <optgroup key={grp.group} label={grp.group} style={{ fontWeight: 700, color: "var(--text-secondary)", backgroundColor: "var(--bg-secondary)" }}>
                              {grp.slots.map((slot) => (
                                <option key={slot} value={slot} style={styles.selectOption}>
                                  {slot}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <ChevronDown 
                          size={18} 
                          style={{
                            position: "absolute",
                            right: "14px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            pointerEvents: "none",
                            color: "var(--text-secondary)",
                          }} 
                        />
                      </div>
                    </div>

                    <div style={styles.formGroup}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", minHeight: "20px" }}>
                        <label style={styles.formLabel} htmlFor="contact-timezone">
                          Your Timezone
                        </label>
                        {userTimeZoneInfo.badge && (
                          <span 
                            style={{ 
                              fontSize: "11px", 
                              color: "var(--accent-primary, #007AFF)", 
                              fontWeight: 500,
                              letterSpacing: "0.2px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                            title={`Detected system timezone: ${userTimeZoneInfo.zone}`}
                          >
                            <Globe size={11} /> Detected
                          </span>
                        )}
                      </div>
                      <div style={{ position: "relative", width: "100%" }}>
                        <select
                          id="contact-timezone"
                          name="userTimeZone"
                          style={{
                            ...styles.formInput,
                            ...styles.formSelect,
                            color: "var(--text-primary)",
                          }}
                          value={contactState.userTimeZone || userTimeZoneInfo.zone}
                          onChange={(e) => handleContactChange("userTimeZone", e.target.value)}
                        >
                          {ALL_WORLD_TIMEZONE_GROUPS.map((grp) => (
                            <optgroup key={grp.group} label={grp.group} style={{ fontWeight: 700, color: "var(--text-secondary)", backgroundColor: "var(--bg-secondary)" }}>
                              {grp.zones.map((tz) => (
                                <option key={tz.value} value={tz.value} style={styles.selectOption}>
                                  {tz.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <ChevronDown 
                          size={18} 
                          style={{
                            position: "absolute",
                            right: "14px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            pointerEvents: "none",
                            color: "var(--text-secondary)",
                          }} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dual-Timezone Live Conversion Card */}
                  {contactState.preferredContactTime && (
                    <div
                      style={{
                        padding: "16px 20px",
                        borderRadius: "14px",
                        border: "1px solid rgba(0, 122, 255, 0.25)",
                        backgroundColor: "rgba(0, 122, 255, 0.05)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        animation: "fadeIn 0.25s ease-out",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "16px",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "var(--text-secondary)",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <Globe size={13} color="#007AFF" /> Your Local Time
                          </span>
                          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {contactState.preferredContactTime}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                            {activeTzLabel}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: isUserIST ? "#34C759" : "#FF9500",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <Clock size={13} color={isUserIST ? "#34C759" : "#FF9500"} />
                            {isUserIST ? "India HQ Match" : "India Agency Time (IST)"}
                          </span>
                          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {isUserIST ? "Direct Local Time Match (IST)" : calculatedISTRange}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                            {isUserIST
                              ? "You are in the same timezone as our core engineering team."
                              : "Our team in India will dial you during your selected local window."}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Company & Subject in ONE row */}
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel} htmlFor="contact-company">Company</label>
                      <input 
                        id="contact-company"
                        name="company"
                        type="text" 
                        placeholder="Company / Organization" 
                        style={{ ...styles.formInput, ...(contactErrors.company ? styles.formInputError : {}) }}
                        autoComplete="organization"
                        aria-invalid={Boolean(contactErrors.company)}
                        aria-describedby={contactErrors.company ? "contact-company-error" : undefined}
                        value={contactState.company}
                        onChange={(e) => handleContactChange("company", e.target.value)}
                      />
                      {contactErrors.company && (
                        <p id="contact-company-error" role="alert" style={styles.fieldError}>{contactErrors.company}</p>
                      )}
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel} htmlFor="contact-subject">Subject</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <select 
                          id="contact-subject"
                          name="subject"
                          style={{ 
                            ...styles.formInput, 
                            ...styles.formSelect,
                            ...(contactErrors.subject ? styles.formInputError : {}),
                            color: contactState.subject ? "var(--text-primary)" : "var(--text-secondary)",
                          }}
                          required
                          aria-invalid={Boolean(contactErrors.subject)}
                          aria-describedby={contactErrors.subject ? "contact-subject-error" : undefined}
                          value={contactState.subject}
                          onChange={(e) => handleContactChange("subject", e.target.value)}
                        >
                          <option value="" disabled style={{ color: "var(--text-secondary)" }}>
                            Select a subject...
                          </option>
                          {CONTACT_SUBJECT_OPTIONS.map((option) => (
                            <option key={option} value={option} style={styles.selectOption}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <ChevronDown 
                          size={18} 
                          style={{
                            position: "absolute",
                            right: "14px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            pointerEvents: "none",
                            color: "var(--text-secondary)",
                          }} 
                        />
                      </div>
                      {contactErrors.subject && (
                        <p id="contact-subject-error" role="alert" style={styles.fieldError}>{contactErrors.subject}</p>
                      )}
                    </div>
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel} htmlFor="contact-message">Message</label>
                    <textarea 
                      id="contact-message"
                      name="message"
                      placeholder="Tell us about your project..." 
                      style={{ ...styles.formTextarea, ...(contactErrors.message ? styles.formInputError : {}) }}
                      required
                      aria-invalid={Boolean(contactErrors.message)}
                      aria-describedby={contactErrors.message ? "contact-message-error" : undefined}
                      value={contactState.message}
                      onChange={(e) => handleContactChange("message", e.target.value)}
                    />
                    {contactErrors.message && (
                      <p id="contact-message-error" role="alert" style={styles.fieldError}>{contactErrors.message}</p>
                    )}
                  </div>
                  
                  {/* Privacy / Consent Checkbox */}
                  <div style={{ marginBottom: "20px", marginTop: "4px" }}>
                    <label
                      htmlFor="contact-consent"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        cursor: "pointer",
                        fontSize: "13px",
                        lineHeight: 1.5,
                        color: "var(--text-secondary, #86868b)",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        id="contact-consent"
                        name="consent"
                        checked={contactState.consent}
                        onChange={(e) => handleContactChange("consent", e.target.checked)}
                        aria-invalid={Boolean(contactErrors.consent)}
                        aria-describedby={contactErrors.consent ? "contact-consent-error" : undefined}
                        style={{
                          marginTop: "3px",
                          width: "16px",
                          height: "16px",
                          accentColor: isDark ? "#2997ff" : "#0071e3",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                      <span>
                        I consent to WebSmith Digital collecting and processing my contact details to respond to my inquiry in accordance with the{" "}
                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: isDark ? "#2997ff" : "#0071e3",
                            textDecoration: "underline",
                            textUnderlineOffset: "3px",
                          }}
                        >
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </label>
                    {contactErrors.consent && (
                      <p id="contact-consent-error" role="alert" style={styles.fieldError}>
                        {contactErrors.consent}
                      </p>
                    )}
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    style={styles.submitBtn} 
                    className="cta-hover"
                  >
                    {isSubmitting ? "Sending..." : (submitStatus === "success" ? "Message Sent!" : "Send Message")}
                  </button>
                  
                  {submitStatus === "success" && (
                    <p role="status" style={{ color: "#34C759", marginTop: "12px", fontSize: "14px", fontWeight: 500 }}>
                      Inquiry submitted successfully. It is now available in the admin query thread.
                    </p>
                  )}
                  {submitStatus === "error" && (
                    <p role="alert" style={{ color: "#FF3B30", marginTop: "12px", fontSize: "14px", fontWeight: 500 }}>
                      {submitErrorMsg}
                    </p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>



      <style>{`
        /* Contact Section 40% - 60% Split Layout */
        .contact-grid-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: clamp(24px, 3.5vw, 48px);
          width: 100%;
          align-items: start;
        }
        @media (min-width: 992px) {
          .contact-grid-layout {
            grid-template-columns: 4fr 6fr !important;
          }
        }

        /* Logo Hover */
        .logo-hover { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .logo-hover:hover { 
          transform: scale(1.02); 
        }
        
        /* Menu Item Hover - Apple Style */
        .menu-item-hover { 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          position: relative;
        }
        .menu-item-hover::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          width: 0;
          height: 2px;
          background-color: #007AFF;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(-50%);
        }
        .menu-item-hover:hover { 
          color: #007AFF !important; 
        }
        .menu-item-hover:hover::after { 
          width: 80%; 
        }
        
        /* Login Button Hover - Theme Aware */
        .login-btn-hover { 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        html:not(.dark-theme) .login-btn-hover:hover,
        .light-theme .login-btn-hover:hover { 
          background-color: rgba(15, 23, 42, 0.06) !important; 
          border-color: rgba(15, 23, 42, 0.18) !important;
          color: #0f172a !important;
          transform: translateY(-2px); 
        }
        .dark-theme .login-btn-hover:hover { 
          background-color: rgba(255, 255, 255, 0.14) !important; 
          border-color: rgba(255, 255, 255, 0.28) !important;
          color: #ffffff !important;
          transform: translateY(-2px); 
        }
        .login-btn-hover:active { 
          transform: scale(0.98); 
        }
        
        /* CTA Button Hover */
        .cta-hover { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .cta-hover:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 8px 20px rgba(0,122,255,0.3); 
          background-color: #0055CC !important; 
        }
        .cta-hover:active { 
          transform: scale(0.98); 
        }
        
        .landing-card-strip::-webkit-scrollbar {
          display: none;
        }

        /* ============================================================
           LIGHT THEME 3-COLOR PASTEL ATMOSPHERIC BACKGROUND SYSTEM
           (Soft Blue, Soft Cyan, and Soft Mint Green — Seamless Background Canvas)
           ============================================================ */
        html:not(.dark-theme) .landing-page-root,
        .light-theme .landing-page-root {
          background-color: #f8fafc !important;
          background-image: 
            radial-gradient(ellipse 100% 60% at 50% 0%, rgba(59, 130, 246, 0.15), transparent 70%),
            radial-gradient(ellipse 85% 55% at 85% 18%, rgba(6, 182, 212, 0.15), transparent 65%),
            radial-gradient(ellipse 90% 60% at 15% 38%, rgba(16, 185, 129, 0.14), transparent 65%),
            radial-gradient(ellipse 85% 55% at 85% 58%, rgba(59, 130, 246, 0.13), transparent 65%),
            radial-gradient(ellipse 90% 60% at 15% 78%, rgba(6, 182, 212, 0.14), transparent 65%),
            radial-gradient(ellipse 100% 60% at 50% 98%, rgba(16, 185, 129, 0.14), transparent 70%) !important;
        }

        /* 1. Features Section ("Why Choose Websmith"): Rich, Balanced Soft Blue Gradient */
        html:not(.dark-theme) .landing-section-features,
        .light-theme .landing-section-features {
          background: 
            radial-gradient(ellipse 80% 65% at 50% 30%, rgba(59, 130, 246, 0.16), transparent 75%),
            radial-gradient(ellipse 65% 50% at 15% 70%, rgba(99, 102, 241, 0.10), transparent 65%),
            radial-gradient(ellipse 65% 50% at 85% 70%, rgba(6, 182, 212, 0.10), transparent 65%) !important;
          border: none !important;
        }

        /* 2. Floating Technology Banner: Soft Cyan-Blue Auroral Flow */
        html:not(.dark-theme) .landing-section-tech,
        .light-theme .landing-section-tech {
          background: radial-gradient(ellipse 90% 60% at 50% 50%, rgba(59, 130, 246, 0.11), transparent 70%) !important;
          border: none !important;
        }

        /* 3. Stats Section ("Momentum you can see"): Radiant Soft Cyan / Aqua Aura (Seamless Flow, No Borders) */
        html:not(.dark-theme) .landing-section-stats,
        .light-theme .landing-section-stats {
          background: 
            radial-gradient(ellipse 85% 70% at 50% 50%, rgba(6, 182, 212, 0.18), transparent 75%),
            radial-gradient(ellipse 70% 50% at 10% 20%, rgba(14, 165, 233, 0.12), transparent 65%),
            radial-gradient(ellipse 70% 50% at 90% 80%, rgba(6, 182, 212, 0.12), transparent 65%) !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* 4. Portfolio & Case Studies: Ambient Cyan-to-Green Transition */
        html:not(.dark-theme) .landing-section-projects,
        .light-theme .landing-section-projects {
          background: 
            radial-gradient(ellipse 75% 55% at 15% 30%, rgba(6, 182, 212, 0.13), transparent 70%),
            radial-gradient(ellipse 75% 55% at 85% 70%, rgba(16, 185, 129, 0.13), transparent 70%) !important;
          border: none !important;
        }

        /* 5. Satisfied Clients: Lush Soft Mint / Emerald Green Aura (Seamless Flow, No Borders) */
        html:not(.dark-theme) .landing-section-clients,
        .light-theme .landing-section-clients {
          background: 
            radial-gradient(ellipse 85% 65% at 50% 40%, rgba(16, 185, 129, 0.18), transparent 75%),
            radial-gradient(ellipse 70% 50% at 85% 20%, rgba(52, 211, 153, 0.12), transparent 65%),
            radial-gradient(ellipse 70% 50% at 15% 80%, rgba(16, 185, 129, 0.12), transparent 65%) !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* 6. Expert Developers: Harmonious Mint Green to Sky Transition */
        html:not(.dark-theme) .landing-section-developers,
        .light-theme .landing-section-developers {
          background: 
            radial-gradient(ellipse 80% 60% at 40% 40%, rgba(16, 185, 129, 0.12), transparent 70%),
            radial-gradient(ellipse 70% 50% at 85% 75%, rgba(6, 182, 212, 0.12), transparent 65%) !important;
          border: none !important;
        }

        /* 7. Testimonials Section: Ambient Soft Amber to Cyan Warm Blend */
        html:not(.dark-theme) .landing-section-testimonials,
        .light-theme .landing-section-testimonials {
          background: 
            radial-gradient(ellipse 80% 60% at 50% 45%, rgba(245, 158, 11, 0.10), transparent 70%),
            radial-gradient(ellipse 70% 50% at 85% 30%, rgba(6, 182, 212, 0.10), transparent 65%) !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* 8. Contact Section: Ambient Soft Blue Foundation */
        html:not(.dark-theme) .landing-section-contact,
        .light-theme .landing-section-contact {
          background: 
            radial-gradient(ellipse 85% 70% at 50% 30%, rgba(59, 130, 246, 0.14), transparent 75%) !important;
          border: none !important;
        }

        /* ============================================================
           LIGHT THEME SIGNATURE CORNER PASTEL GLOWS ACROSS ALL CARDS
           (Blue, Purple, Cyan, Green, Amber Frosted Light Glass)
           ============================================================ */
        html:not(.dark-theme) .feature-card:not(:hover),
        html:not(.dark-theme) .client-card:not(:hover),
        html:not(.dark-theme) .developer-card:not(:hover),
        html:not(.dark-theme) .testimonial-card:not(:hover),
        html:not(.dark-theme) .landing-stat-card:not(:hover),
        .light-theme .feature-card:not(:hover),
        .light-theme .client-card:not(:hover),
        .light-theme .developer-card:not(:hover),
        .light-theme .testimonial-card:not(:hover),
        .light-theme .landing-stat-card:not(:hover) {
          background-color: rgba(255, 255, 255, 0.86) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255, 255, 255, 0.95) !important;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(15, 23, 42, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
        }

        /* Stats Cards: Soft Cyan Corner Glow (Resting Only) */
        html:not(.dark-theme) .landing-stat-card:not(:hover),
        .light-theme .landing-stat-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(6, 182, 212, 0.18), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(14, 165, 233, 0.06), transparent 70%) !important;
          border-color: rgba(6, 182, 212, 0.24) !important;
        }

        /* Project Cards: Soft Electric Blue Corner Glow (Resting Only) */
        html:not(.dark-theme) .landing-project-card:not(:hover),
        .light-theme .landing-project-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(59, 130, 246, 0.18), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(37, 99, 235, 0.06), transparent 70%) !important;
          border-color: rgba(59, 130, 246, 0.24) !important;
        }

        /* Client Cards: Soft Emerald Green Corner Glow (Resting Only) */
        html:not(.dark-theme) .landing-client-card:not(:hover),
        .light-theme .landing-client-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(16, 185, 129, 0.18), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(5, 150, 105, 0.06), transparent 70%) !important;
          border-color: rgba(16, 185, 129, 0.24) !important;
        }

        /* Developer Cards: Soft Electric Blue Corner Glow (Resting Only) */
        html:not(.dark-theme) .landing-developer-card:not(:hover),
        .light-theme .landing-developer-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(59, 130, 246, 0.18), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(37, 99, 235, 0.06), transparent 70%) !important;
          border-color: rgba(59, 130, 246, 0.24) !important;
        }

        /* Testimonial Cards: Soft Radiant Cyan Corner Glow (Resting Only) */
        html:not(.dark-theme) .landing-testimonial-card:not(:hover),
        .light-theme .landing-testimonial-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(6, 182, 212, 0.18), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(14, 165, 233, 0.06), transparent 70%) !important;
          border-color: rgba(6, 182, 212, 0.24) !important;
        }

        /* ============================================================
           DARK THEME 5-COLOR COSMIC ATMOSPHERIC BACKGROUND SYSTEM
           (Blue, Purple, Cyan, Green, and Amber Nebulae — Seamless Cosmic Flow)
           ============================================================ */
        .dark-theme .landing-page-root {
          background-color: #050811 !important;
          background-image: 
            radial-gradient(ellipse 100% 60% at 50% 0%, rgba(59, 130, 246, 0.18), transparent 70%),
            radial-gradient(ellipse 85% 55% at 85% 18%, rgba(6, 182, 212, 0.16), transparent 65%),
            radial-gradient(ellipse 90% 60% at 15% 38%, rgba(16, 185, 129, 0.15), transparent 65%),
            radial-gradient(ellipse 85% 55% at 85% 58%, rgba(168, 85, 247, 0.15), transparent 65%),
            radial-gradient(ellipse 90% 60% at 15% 78%, rgba(245, 158, 11, 0.12), transparent 65%),
            radial-gradient(ellipse 100% 60% at 50% 98%, rgba(59, 130, 246, 0.16), transparent 70%) !important;
        }

        /* 1. Features Section: Deep Royal Blue & Purple Cosmic Nebulae */
        .dark-theme .landing-section-features {
          background: 
            radial-gradient(ellipse 80% 65% at 50% 30%, rgba(59, 130, 246, 0.18), transparent 75%),
            radial-gradient(ellipse 65% 50% at 15% 70%, rgba(168, 85, 247, 0.14), transparent 65%),
            radial-gradient(ellipse 65% 50% at 85% 70%, rgba(6, 182, 212, 0.12), transparent 65%) !important;
          border: none !important;
        }

        /* 2. Floating Technology Banner: Deep Cyan-Blue Auroral Flow */
        .dark-theme .landing-section-tech {
          background: radial-gradient(ellipse 90% 60% at 50% 50%, rgba(59, 130, 246, 0.13), transparent 70%) !important;
          border: none !important;
        }

        /* 3. Stats Section ("Momentum you can see"): Radiant Deep Cyan / Aqua Cosmic Aura (Seamless Flow, No Borders) */
        .dark-theme .landing-section-stats {
          background: 
            radial-gradient(ellipse 85% 70% at 50% 50%, rgba(6, 182, 212, 0.18), transparent 75%),
            radial-gradient(ellipse 70% 50% at 10% 20%, rgba(14, 165, 233, 0.12), transparent 65%),
            radial-gradient(ellipse 70% 50% at 90% 80%, rgba(6, 182, 212, 0.12), transparent 65%) !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* 4. Portfolio & Case Studies: Cosmic Cyan-to-Emerald Transition */
        .dark-theme .landing-section-projects {
          background: 
            radial-gradient(ellipse 75% 55% at 15% 30%, rgba(6, 182, 212, 0.14), transparent 70%),
            radial-gradient(ellipse 75% 55% at 85% 70%, rgba(16, 185, 129, 0.14), transparent 70%) !important;
          border: none !important;
        }

        /* 5. Satisfied Clients: Deep Emerald & Mint Green Cosmic Glow (Seamless Flow, No Borders) */
        .dark-theme .landing-section-clients {
          background: 
            radial-gradient(ellipse 85% 65% at 50% 40%, rgba(16, 185, 129, 0.18), transparent 75%),
            radial-gradient(ellipse 70% 50% at 85% 20%, rgba(52, 211, 153, 0.12), transparent 65%),
            radial-gradient(ellipse 70% 50% at 15% 80%, rgba(16, 185, 129, 0.12), transparent 65%) !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* 6. Expert Developers: Deep Purple to Mint Auroral Glow */
        .dark-theme .landing-section-developers {
          background: 
            radial-gradient(ellipse 80% 65% at 35% 40%, rgba(168, 85, 247, 0.15), transparent 70%),
            radial-gradient(ellipse 70% 50% at 85% 75%, rgba(16, 185, 129, 0.13), transparent 65%) !important;
          border: none !important;
        }

        /* 7. Testimonials Section: Deep Amber to Cyan Warm Cosmic Blend */
        .dark-theme .landing-section-testimonials {
          background: 
            radial-gradient(ellipse 80% 60% at 50% 45%, rgba(245, 158, 11, 0.12), transparent 70%),
            radial-gradient(ellipse 70% 50% at 85% 30%, rgba(6, 182, 212, 0.11), transparent 65%) !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* 8. Contact Section: Deep Cosmic Blue Foundation */
        .dark-theme .landing-section-contact {
          background: 
            radial-gradient(ellipse 85% 70% at 50% 30%, rgba(59, 130, 246, 0.16), transparent 75%) !important;
          border: none !important;
        }

        /* ============================================================
           DARK THEME SIGNATURE CORNER AMBIENT GLOWS ACROSS ALL CARDS
           (Blue, Purple, Cyan, Green, Amber Frosted Obsidian Glass)
           ============================================================ */
        .dark-theme .feature-card:not(:hover),
        .dark-theme .client-card:not(:hover),
        .dark-theme .developer-card:not(:hover),
        .dark-theme .testimonial-card:not(:hover),
        .dark-theme .landing-stat-card:not(:hover) {
          background-color: rgba(14, 18, 30, 0.82) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.09) !important;
        }

        /* Stats Cards: Subtle Cyan Corner Glow (Resting Only) */
        .dark-theme .landing-stat-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(6, 182, 212, 0.20), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(14, 165, 233, 0.08), transparent 70%) !important;
          border-color: rgba(6, 182, 212, 0.28) !important;
        }

        /* Project Cards: Subtle Electric Blue Corner Glow (Resting Only) */
        .dark-theme .landing-project-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(59, 130, 246, 0.20), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(37, 99, 235, 0.08), transparent 70%) !important;
          border-color: rgba(59, 130, 246, 0.28) !important;
        }

        /* Client Cards: Subtle Emerald Green Corner Glow (Resting Only) */
        .dark-theme .landing-client-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(16, 185, 129, 0.20), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(5, 150, 105, 0.08), transparent 70%) !important;
          border-color: rgba(16, 185, 129, 0.28) !important;
        }

        /* Developer Cards: Subtle Electric Blue Corner Glow (Resting Only) */
        .dark-theme .landing-developer-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(59, 130, 246, 0.20), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(37, 99, 235, 0.08), transparent 70%) !important;
          border-color: rgba(59, 130, 246, 0.28) !important;
        }

        /* Testimonial Cards: Subtle Radiant Cyan Corner Glow (Resting Only) */
        .dark-theme .landing-testimonial-card:not(:hover) {
          background-image: radial-gradient(ellipse at 85% 15%, rgba(6, 182, 212, 0.20), transparent 70%),
                            radial-gradient(ellipse at 15% 85%, rgba(14, 165, 233, 0.08), transparent 70%) !important;
          border-color: rgba(6, 182, 212, 0.28) !important;
        }

        /* ============================================================
           VIBRANT ELECTRIC CYAN / BLUE GRADIENT HOVER EFFECT FOR ALL CARDS
           Matching "Momentum you can see" stat cards (.landing-stat-card)
           ============================================================ */
        .feature-card,
        .client-card,
        .developer-card,
        .testimonial-card,
        .landing-stat-card {
          transition: background-color 0.35s ease, background-image 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), color 0.35s ease;
          cursor: pointer;
        }

        /* Base Card Hover Elevation / Lift */
        .feature-card:hover,
        .developer-card:hover {
          transform: translateY(-6px);
        }
        .client-card:hover,
        .testimonial-card:hover {
          transform: translateY(-5px);
        }

        /* ------------------------------------------------------------
           PALETTE 1: RADIANT CYAN / AQUA HOVER
           Applied to: Stat Cards ("Momentum you can see"), Testimonial Cards, Cyan Feature Card ("24/7 Support")
           ------------------------------------------------------------ */
        html:not(.dark-theme) .landing-stat-card:hover,
        .light-theme .landing-stat-card:hover,
        .dark-theme .landing-stat-card:hover,
        .landing-stat-card:hover,
        html:not(.dark-theme) .feature-card-cyan:hover,
        .light-theme .feature-card-cyan:hover,
        .dark-theme .feature-card-cyan:hover,
        .feature-card-cyan:hover,
        html:not(.dark-theme) .testimonial-card:hover,
        .light-theme .testimonial-card:hover,
        .dark-theme .testimonial-card:hover,
        .testimonial-card:hover,
        html:not(.dark-theme) .landing-testimonial-card:hover,
        .light-theme .landing-testimonial-card:hover,
        .dark-theme .landing-testimonial-card:hover,
        .landing-testimonial-card:hover {
          background-color: #06B6D4 !important;
          background-image: linear-gradient(135deg, #67E8F9 0%, #22D3EE 45%, #06B6D4 100%) !important;
          border-color: rgba(6, 182, 212, 0.85) !important;
          box-shadow: 0 24px 70px rgba(6, 182, 212, 0.45), 0 0 40px rgba(6, 182, 212, 0.3), inset 0 0 24px rgba(255, 255, 255, 0.3) !important;
        }
        html:not(.dark-theme) .landing-stat-card:hover .landing-stat-value,
        .light-theme .landing-stat-card:hover .landing-stat-value,
        .dark-theme .landing-stat-card:hover .landing-stat-value,
        .landing-stat-card:hover .landing-stat-value,
        html:not(.dark-theme) .feature-card-cyan:hover h3,
        .light-theme .feature-card-cyan:hover h3,
        .dark-theme .feature-card-cyan:hover h3,
        .feature-card-cyan:hover h3,
        html:not(.dark-theme) .feature-card-cyan:hover .landing-card-title,
        .light-theme .feature-card-cyan:hover .landing-card-title,
        .dark-theme .feature-card-cyan:hover .landing-card-title,
        .feature-card-cyan:hover .landing-card-title,
        html:not(.dark-theme) .testimonial-card:hover h4,
        .light-theme .testimonial-card:hover h4,
        .dark-theme .testimonial-card:hover h4,
        .testimonial-card:hover h4,
        html:not(.dark-theme) .testimonial-card:hover .landing-card-title,
        .light-theme .testimonial-card:hover .landing-card-title,
        .dark-theme .testimonial-card:hover .landing-card-title,
        .testimonial-card:hover .landing-card-title {
          color: #043844 !important;
        }
        html:not(.dark-theme) .testimonial-card:hover .landing-card-subtitle,
        .light-theme .testimonial-card:hover .landing-card-subtitle,
        .dark-theme .testimonial-card:hover .landing-card-subtitle,
        .testimonial-card:hover .landing-card-subtitle {
          color: #064B5B !important;
          font-weight: 600 !important;
        }
        html:not(.dark-theme) .testimonial-card:hover .landing-testimonial-quote,
        .light-theme .testimonial-card:hover .landing-testimonial-quote,
        .dark-theme .testimonial-card:hover .landing-testimonial-quote,
        .testimonial-card:hover .landing-testimonial-quote {
          color: #043844 !important;
          font-weight: 500 !important;
        }
        html:not(.dark-theme) .testimonial-card:hover .landing-testimonial-avatar,
        .light-theme .testimonial-card:hover .landing-testimonial-avatar,
        .dark-theme .testimonial-card:hover .landing-testimonial-avatar,
        .testimonial-card:hover .landing-testimonial-avatar {
          background-color: #043844 !important;
          color: #FFFFFF !important;
          box-shadow: 0 4px 14px rgba(4, 56, 68, 0.35) !important;
        }
        html:not(.dark-theme) .landing-stat-card:hover .landing-stat-label,
        .light-theme .landing-stat-card:hover .landing-stat-label,
        .dark-theme .landing-stat-card:hover .landing-stat-label,
        .landing-stat-card:hover .landing-stat-label,
        html:not(.dark-theme) .feature-card-cyan:hover p,
        .light-theme .feature-card-cyan:hover p,
        .dark-theme .feature-card-cyan:hover p,
        .feature-card-cyan:hover p,
        html:not(.dark-theme) .feature-card-cyan:hover .landing-card-desc,
        .light-theme .feature-card-cyan:hover .landing-card-desc,
        .dark-theme .feature-card-cyan:hover .landing-card-desc,
        .feature-card-cyan:hover .landing-card-desc,
        html:not(.dark-theme) .testimonial-card:hover p,
        .light-theme .testimonial-card:hover p,
        .dark-theme .testimonial-card:hover p,
        .testimonial-card:hover p,
        html:not(.dark-theme) .testimonial-card:hover .landing-card-desc,
        .light-theme .testimonial-card:hover .landing-card-desc,
        .dark-theme .testimonial-card:hover .landing-card-desc,
        .testimonial-card:hover .landing-card-desc {
          color: #085566 !important;
        }
        html:not(.dark-theme) .feature-card-cyan:hover .landing-card-icon,
        .light-theme .feature-card-cyan:hover .landing-card-icon,
        .dark-theme .feature-card-cyan:hover .landing-card-icon,
        .feature-card-cyan:hover .landing-card-icon {
          background-color: rgba(255, 255, 255, 0.4) !important;
          border-color: rgba(255, 255, 255, 0.65) !important;
          box-shadow: 0 4px 14px rgba(4, 56, 68, 0.15) !important;
        }
        html:not(.dark-theme) .feature-card-cyan:hover .landing-card-icon svg,
        .light-theme .feature-card-cyan:hover .landing-card-icon svg,
        .dark-theme .feature-card-cyan:hover .landing-card-icon svg,
        .feature-card-cyan:hover .landing-card-icon svg {
          color: #043844 !important;
          stroke: #043844 !important;
        }

        /* ------------------------------------------------------------
           PALETTE 2: RADIANT ELECTRIC BLUE HOVER
           Applied to: Portfolio Project Cards, Developer Cards, Blue Feature Cards ("Expert Developers", "Fast Delivery")
           ------------------------------------------------------------ */
        html:not(.dark-theme) .landing-project-card:hover,
        .light-theme .landing-project-card:hover,
        .dark-theme .landing-project-card:hover,
        .landing-project-card:hover,
        html:not(.dark-theme) .developer-card:hover,
        .light-theme .developer-card:hover,
        .dark-theme .developer-card:hover,
        .developer-card:hover,
        html:not(.dark-theme) .landing-developer-card:hover,
        .light-theme .landing-developer-card:hover,
        .dark-theme .landing-developer-card:hover,
        .landing-developer-card:hover,
        html:not(.dark-theme) .feature-card-blue:hover,
        .light-theme .feature-card-blue:hover,
        .dark-theme .feature-card-blue:hover,
        .feature-card-blue:hover,
        html:not(.dark-theme) .feature-card:not(.feature-card-cyan):not(.feature-card-green):not(.landing-project-card):hover,
        .light-theme .feature-card:not(.feature-card-cyan):not(.feature-card-green):not(.landing-project-card):hover,
        .dark-theme .feature-card:not(.feature-card-cyan):not(.feature-card-green):not(.landing-project-card):hover,
        .feature-card:not(.feature-card-cyan):not(.feature-card-green):not(.landing-project-card):hover {
          background-color: #3B82F6 !important;
          background-image: linear-gradient(135deg, #93C5FD 0%, #60A5FA 45%, #2563EB 100%) !important;
          border-color: rgba(59, 130, 246, 0.85) !important;
          box-shadow: 0 24px 70px rgba(37, 99, 235, 0.45), 0 0 40px rgba(59, 130, 246, 0.3), inset 0 0 24px rgba(255, 255, 255, 0.3) !important;
        }
        html:not(.dark-theme) .landing-project-card:hover h3,
        .light-theme .landing-project-card:hover h3,
        .dark-theme .landing-project-card:hover h3,
        .landing-project-card:hover h3,
        html:not(.dark-theme) .landing-project-card:hover .landing-card-title,
        .light-theme .landing-project-card:hover .landing-card-title,
        .dark-theme .landing-project-card:hover .landing-card-title,
        .landing-project-card:hover .landing-card-title,
        html:not(.dark-theme) .developer-card:hover h4,
        .light-theme .developer-card:hover h4,
        .dark-theme .developer-card:hover h4,
        .developer-card:hover h4,
        html:not(.dark-theme) .developer-card:hover .landing-card-title,
        .light-theme .developer-card:hover .landing-card-title,
        .dark-theme .developer-card:hover .landing-card-title,
        .developer-card:hover .landing-card-title,
        html:not(.dark-theme) .feature-card-blue:hover h3,
        .light-theme .feature-card-blue:hover h3,
        .dark-theme .feature-card-blue:hover h3,
        .feature-card-blue:hover h3,
        html:not(.dark-theme) .feature-card-blue:hover .landing-card-title,
        .light-theme .feature-card-blue:hover .landing-card-title,
        .dark-theme .feature-card-blue:hover .landing-card-title,
        .feature-card-blue:hover .landing-card-title {
          color: #04274F !important;
        }
        html:not(.dark-theme) .landing-project-card:hover .landing-card-subtitle,
        .light-theme .landing-project-card:hover .landing-card-subtitle,
        .dark-theme .landing-project-card:hover .landing-card-subtitle,
        .landing-project-card:hover .landing-card-subtitle,
        html:not(.dark-theme) .developer-card:hover .landing-card-role,
        .light-theme .developer-card:hover .landing-card-role,
        .dark-theme .developer-card:hover .landing-card-role,
        .developer-card:hover .landing-card-role {
          color: #07355B !important;
          font-weight: 600 !important;
        }
        html:not(.dark-theme) .developer-card:hover .landing-skill-tag,
        .light-theme .developer-card:hover .landing-skill-tag,
        .dark-theme .developer-card:hover .landing-skill-tag,
        .developer-card:hover .landing-skill-tag {
          background-color: rgba(255, 255, 255, 0.4) !important;
          border-color: rgba(255, 255, 255, 0.65) !important;
          color: #04274F !important;
          font-weight: 600 !important;
          box-shadow: 0 2px 6px rgba(4, 39, 79, 0.12) !important;
        }
        html:not(.dark-theme) .developer-card:hover .landing-card-experience,
        .light-theme .developer-card:hover .landing-card-experience,
        .dark-theme .developer-card:hover .landing-card-experience,
        .developer-card:hover .landing-card-experience {
          color: #0B4A82 !important;
          font-weight: 600 !important;
        }
        html:not(.dark-theme) .landing-project-card:hover p,
        .light-theme .landing-project-card:hover p,
        .dark-theme .landing-project-card:hover p,
        .landing-project-card:hover p,
        html:not(.dark-theme) .landing-project-card:hover .landing-card-desc,
        .light-theme .landing-project-card:hover .landing-card-desc,
        .dark-theme .landing-project-card:hover .landing-card-desc,
        .landing-project-card:hover .landing-card-desc,
        html:not(.dark-theme) .landing-project-card:hover .landing-card-muted,
        .light-theme .landing-project-card:hover .landing-card-muted,
        .dark-theme .landing-project-card:hover .landing-card-muted,
        .landing-project-card:hover .landing-card-muted,
        html:not(.dark-theme) .developer-card:hover p,
        .light-theme .developer-card:hover p,
        .dark-theme .developer-card:hover p,
        .developer-card:hover p,
        html:not(.dark-theme) .developer-card:hover .landing-card-desc,
        .light-theme .developer-card:hover .landing-card-desc,
        .dark-theme .developer-card:hover .landing-card-desc,
        .developer-card:hover .landing-card-desc,
        html:not(.dark-theme) .feature-card-blue:hover p,
        .light-theme .feature-card-blue:hover p,
        .dark-theme .feature-card-blue:hover p,
        .feature-card-blue:hover p,
        html:not(.dark-theme) .feature-card-blue:hover .landing-card-desc,
        .light-theme .feature-card-blue:hover .landing-card-desc,
        .dark-theme .feature-card-blue:hover .landing-card-desc,
        .feature-card-blue:hover .landing-card-desc {
          color: #0B4A82 !important;
        }
        html:not(.dark-theme) .developer-card:hover .landing-dev-circle-mask,
        .light-theme .developer-card:hover .landing-dev-circle-mask,
        .dark-theme .developer-card:hover .landing-dev-circle-mask,
        .developer-card:hover .landing-dev-circle-mask {
          border-color: rgba(255, 255, 255, 0.85) !important;
          box-shadow: 0 6px 18px rgba(4, 39, 79, 0.25) !important;
        }
        html:not(.dark-theme) .developer-card:hover .landing-dev-circle-initial,
        .light-theme .developer-card:hover .landing-dev-circle-initial,
        .dark-theme .developer-card:hover .landing-dev-circle-initial,
        .developer-card:hover .landing-dev-circle-initial {
          background-color: #04274F !important;
          color: #FFFFFF !important;
        }
        html:not(.dark-theme) .landing-project-card:hover .landing-card-icon,
        .light-theme .landing-project-card:hover .landing-card-icon,
        .dark-theme .landing-project-card:hover .landing-card-icon,
        .landing-project-card:hover .landing-card-icon,
        html:not(.dark-theme) .feature-card-blue:hover .landing-card-icon,
        .light-theme .feature-card-blue:hover .landing-card-icon,
        .dark-theme .feature-card-blue:hover .landing-card-icon,
        .feature-card-blue:hover .landing-card-icon {
          background-color: rgba(255, 255, 255, 0.4) !important;
          border-color: rgba(255, 255, 255, 0.65) !important;
          box-shadow: 0 4px 14px rgba(4, 39, 79, 0.15) !important;
        }
        html:not(.dark-theme) .landing-project-card:hover .landing-card-icon svg,
        .light-theme .landing-project-card:hover .landing-card-icon svg,
        .dark-theme .landing-project-card:hover .landing-card-icon svg,
        .landing-project-card:hover .landing-card-icon svg,
        html:not(.dark-theme) .feature-card-blue:hover .landing-card-icon svg,
        .light-theme .feature-card-blue:hover .landing-card-icon svg,
        .dark-theme .feature-card-blue:hover .landing-card-icon svg,
        .feature-card-blue:hover .landing-card-icon svg {
          color: #04274F !important;
          stroke: #04274F !important;
        }
        html:not(.dark-theme) .landing-project-card:hover a,
        .light-theme .landing-project-card:hover a,
        .dark-theme .landing-project-card:hover a,
        .landing-project-card:hover a,
        html:not(.dark-theme) .landing-project-card:hover .landing-card-link,
        .light-theme .landing-project-card:hover .landing-card-link,
        .dark-theme .landing-project-card:hover .landing-card-link,
        .landing-project-card:hover .landing-card-link {
          color: #04274F !important;
          font-weight: 600 !important;
        }
        html:not(.dark-theme) .landing-project-card:hover a svg,
        .light-theme .landing-project-card:hover a svg,
        .dark-theme .landing-project-card:hover a svg,
        .landing-project-card:hover a svg,
        html:not(.dark-theme) .landing-project-card:hover .landing-card-link svg,
        .light-theme .landing-project-card:hover .landing-card-link svg,
        .dark-theme .landing-project-card:hover .landing-card-link svg,
        .landing-project-card:hover .landing-card-link svg {
          color: #04274F !important;
          stroke: #04274F !important;
        }
        html:not(.dark-theme) .landing-project-card:hover .landing-project-img,
        .light-theme .landing-project-card:hover .landing-project-img,
        .dark-theme .landing-project-card:hover .landing-project-img,
        .landing-project-card:hover .landing-project-img {
          border-color: rgba(255, 255, 255, 0.5) !important;
          box-shadow: 0 8px 24px rgba(4, 39, 79, 0.25) !important;
        }

        /* ------------------------------------------------------------
           PALETTE 3: RADIANT EMERALD / MINT GREEN HOVER
           Applied to: Client Cards, Green Feature Card ("Dedicated Teams", "Scalable Solutions")
           ------------------------------------------------------------ */
        html:not(.dark-theme) .client-card:hover,
        .light-theme .client-card:hover,
        .dark-theme .client-card:hover,
        .client-card:hover,
        html:not(.dark-theme) .landing-client-card:hover,
        .light-theme .landing-client-card:hover,
        .dark-theme .landing-client-card:hover,
        .landing-client-card:hover,
        html:not(.dark-theme) .feature-card-green:hover,
        .light-theme .feature-card-green:hover,
        .dark-theme .feature-card-green:hover,
        .feature-card-green:hover {
          background-color: #10B981 !important;
          background-image: linear-gradient(135deg, #6EE7B7 0%, #34D399 45%, #059669 100%) !important;
          border-color: rgba(16, 185, 129, 0.85) !important;
          box-shadow: 0 24px 70px rgba(16, 185, 129, 0.45), 0 0 40px rgba(16, 185, 129, 0.3), inset 0 0 24px rgba(255, 255, 255, 0.3) !important;
        }
        html:not(.dark-theme) .client-card:hover h4,
        .light-theme .client-card:hover h4,
        .dark-theme .client-card:hover h4,
        .client-card:hover h4,
        html:not(.dark-theme) .client-card:hover .landing-card-title,
        .light-theme .client-card:hover .landing-card-title,
        .dark-theme .client-card:hover .landing-card-title,
        .client-card:hover .landing-card-title,
        html:not(.dark-theme) .feature-card-green:hover h3,
        .light-theme .feature-card-green:hover h3,
        .dark-theme .feature-card-green:hover h3,
        .feature-card-green:hover h3,
        html:not(.dark-theme) .feature-card-green:hover .landing-card-title,
        .light-theme .feature-card-green:hover .landing-card-title,
        .dark-theme .feature-card-green:hover .landing-card-title,
        .feature-card-green:hover .landing-card-title {
          color: #033B2B !important;
        }
        html:not(.dark-theme) .client-card:hover .landing-card-subtitle,
        .light-theme .client-card:hover .landing-card-subtitle,
        .dark-theme .client-card:hover .landing-card-subtitle,
        .client-card:hover .landing-card-subtitle {
          color: #064E3B !important;
          font-weight: 600 !important;
        }
        html:not(.dark-theme) .client-card:hover p,
        .light-theme .client-card:hover p,
        .dark-theme .client-card:hover p,
        .client-card:hover p,
        html:not(.dark-theme) .client-card:hover .landing-card-desc,
        .light-theme .client-card:hover .landing-card-desc,
        .dark-theme .client-card:hover .landing-card-desc,
        .client-card:hover .landing-card-desc,
        html:not(.dark-theme) .feature-card-green:hover p,
        .light-theme .feature-card-green:hover p,
        .dark-theme .feature-card-green:hover p,
        .feature-card-green:hover p,
        html:not(.dark-theme) .feature-card-green:hover .landing-card-desc,
        .light-theme .feature-card-green:hover .landing-card-desc,
        .dark-theme .feature-card-green:hover .landing-card-desc,
        .feature-card-green:hover .landing-card-desc {
          color: #065F46 !important;
        }
        html:not(.dark-theme) .client-card:hover .landing-client-avatar,
        .light-theme .client-card:hover .landing-client-avatar,
        .dark-theme .client-card:hover .landing-client-avatar,
        .client-card:hover .landing-client-avatar,
        html:not(.dark-theme) .feature-card-green:hover .landing-card-icon,
        .light-theme .feature-card-green:hover .landing-card-icon,
        .dark-theme .feature-card-green:hover .landing-card-icon,
        .feature-card-green:hover .landing-card-icon {
          background-color: rgba(255, 255, 255, 0.4) !important;
          border-color: rgba(255, 255, 255, 0.65) !important;
          box-shadow: 0 4px 14px rgba(3, 59, 43, 0.18) !important;
        }
        html:not(.dark-theme) .client-card:hover .landing-client-avatar svg,
        .light-theme .client-card:hover .landing-client-avatar svg,
        .dark-theme .client-card:hover .landing-client-avatar svg,
        .client-card:hover .landing-client-avatar svg,
        html:not(.dark-theme) .client-card:hover svg,
        .light-theme .client-card:hover svg,
        .dark-theme .client-card:hover svg,
        .client-card:hover svg,
        html:not(.dark-theme) .feature-card-green:hover .landing-card-icon svg,
        .light-theme .feature-card-green:hover .landing-card-icon svg,
        .dark-theme .feature-card-green:hover .landing-card-icon svg,
        .feature-card-green:hover .landing-card-icon svg {
          color: #033B2B !important;
          stroke: #033B2B !important;
        }

        /* Scale/elevate strip cells so hovered cards float gracefully above neighbors */
        .landing-card-strip > div > div:has(.landing-stat-card:hover) {
          position: relative;
          z-index: 5;
          transform: scale(1.14) !important;
        }
        .landing-card-strip > div > div:has(.feature-card:hover),
        .landing-card-strip > div > div:has(.client-card:hover),
        .landing-card-strip > div > div:has(.developer-card:hover),
        .landing-card-strip > div > div:has(.testimonial-card:hover) {
          position: relative;
          z-index: 5;
          transform: translateY(-4px) scale(1.025) !important;
        }

        /* Built With the Right Technology — floating technology banner (Full Width Edge-to-Edge) */
        .tech-field {
          position: relative;
          height: clamp(300px, 34vw, 420px);
          min-height: 240px;
          width: 100%;
          max-width: 100%;
          margin: 0;
          --tech-node: 84px;
        }
        .tech-node {
          z-index: 1;
        }
        .tech-node:hover .tech-node-mask,
        .tech-node:focus-visible .tech-node-mask {
          transform: scale(1.15);
          border-color: rgba(34, 211, 238, 0.75);
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.55), 0 0 26px rgba(139, 92, 246, 0.45), 0 0 34px rgba(34, 211, 238, 0.28), inset 0 0 16px rgba(139, 92, 246, 0.22);
        }
        .tech-node:focus-visible {
          outline: 2px solid rgba(34, 211, 238, 0.8);
          outline-offset: 4px;
          border-radius: 50%;
        }
        @media (max-width: 768px) {
          .tech-field {
            --tech-node: 62px;
            height: clamp(250px, 60vw, 320px);
          }
        }
        @media (max-width: 520px) {
          .tech-field {
            --tech-node: 54px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .tech-node,
          .tech-node .tech-node-mask {
            animation: none !important;
          }
          .tech-node .tech-node-mask {
            transition: box-shadow 0.2s ease, border-color 0.2s ease;
          }
        }

        /* Removed landing-marquee-track animation as it is now handled via JS for drag support */
        
        /* Social Icon Hover */
        .social-icon { 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
          display: inline-block; 
        }
        .social-icon:hover { 
          transform: translateY(-2px); 
          color: #007AFF; 
        }
        
        /* Mobile Menu Animations */
        .mobile-menu-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mobile-menu-btn:hover {
          transform: scale(1.05);
          background-color: #F2F2F7;
        }
        
        .mobile-menu-item {
          transition: all 0.2s ease;
        }
        .mobile-menu-item:hover {
          background-color: #F2F2F7;
          transform: translateX(4px);
        }
        
        .mobile-login-btn {
          transition: all 0.2s ease;
        }
        .mobile-login-btn:hover {
          background-color: #F2F2F7;
          transform: translateX(4px);
        }

        .public-mobile-menu-overlay {
          opacity: 1;
          transition: opacity 0.2s ease;
        }

        .public-mobile-menu-panel {
          animation: publicNavSlideDown 0.22s ease;
        }

        @keyframes publicNavSlideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .landing-hero-highlight {
          display: inline-block !important;
          background: linear-gradient(135deg, #38bdf8 0%, #06b6d4 50%, #34d399 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: transparent !important;
          text-shadow: none !important;
          filter: drop-shadow(0 2px 10px rgba(6, 182, 212, 0.4)) !important;
        }

        @media (max-width: 1120px) {
          .ws-diversity-col {
            width: min(480px, 100%) !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 1024px) {
          .landing-hero-title {
            font-size: 46px !important;
          }
        }

        @media (max-width: 768px) {
          .landing-nav-shell {
            position: fixed !important;
            top: 0 !important;
            left: 0;
            right: 0;
            width: 100%;
          }
          .desktop-menu,
          .nav-buttons {
            display: none !important;
          }
          .mobile-menu-btn,
          .mobile-menu {
            display: flex !important;
          }
          .landing-nav-content {
            padding: 10px 16px !important;
          }
          .landing-hero {
            min-height: 63vh !important;
            padding: 56px 16px !important;
            margin-top: 57px !important;
          }
          .landing-hero-title {
            font-size: 36px !important;
            line-height: 1.1 !important;
          }
          .landing-hero-subtitle {
            font-size: 17px !important;
          }
          .landing-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 20px !important;
          }
          .landing-badges-row {
            flex-wrap: wrap;
          }
          .landing-footer-content {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 24px !important;
          }
        }

        @media (max-width: 520px) {
          .landing-hero-title {
            font-size: 30px !important;
          }
          .landing-hero-subtitle {
            font-size: 15px !important;
          }
          .landing-card-strip {
            --h-card-min-width: 150px !important;
          }
          .landing-features-grid,
          .landing-client-grid,
          .landing-developer-grid,
          .landing-footer-content,
          .landing-stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
            gap: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}

function getLandingStyles(isDark: boolean): Record<string, any> {
  const appleBlue = isDark ? "#2997ff" : "#0071e3";
  const appleCanvas = isDark ? "#050811" : "#f8fafc";
  const appleSectionBg = isDark ? "#070d1a" : "#f4f8fb";
  const appleCardBg = isDark ? "#161617" : "#ffffff";
  const appleCardBorder = isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)";
  const appleCardShadow = isDark 
    ? "0 12px 36px rgba(0, 0, 0, 0.6)" 
    : "0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)";
  const appleTextPrimary = isDark ? "#f5f5f7" : "#1d1d1f";
  const appleTextSecondary = isDark ? "#a1a1a6" : "#86868b";
  const appleTextMuted = isDark ? "#6e6e73" : "#a1a1a6";
  const appleHairline = isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #d2d2d7";

  return {
    container: {
      minHeight: "100vh",
      width: "100%",
      backgroundColor: appleCanvas,
      color: appleTextPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    },
    // Hero
    hero: {
      padding: "clamp(60px, 8vw, 100px) 0 clamp(40px, 6vw, 60px)",
      textAlign: "center",
      position: "relative",
      color: "#FFFFFF",
      overflow: "hidden",
      minHeight: "68vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#000000",
    },
    heroOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.38)",
      backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)",
      zIndex: 1,
    },
    heroContent: {
      maxWidth: "920px",
      margin: "0 auto",
      padding: "0 clamp(20px, 4vw, 36px)",
      position: "relative",
      zIndex: 2,
    },
    heroTitle: {
      fontSize: "clamp(38px, 6vw, 68px)",
      fontWeight: 700,
      letterSpacing: "-0.035em",
      lineHeight: 1.08,
      marginBottom: "20px",
      color: "#FFFFFF",
      textShadow: "0 2px 14px rgba(0,0,0,0.5)",
    },
    highlight: {
      color: isDark ? "#2997ff" : "#38bdf8",
      fontWeight: 700,
    },
    heroSubtitle: {
      fontSize: "clamp(18px, 2.2vw, 22px)",
      color: "rgba(255, 255, 255, 0.88)",
      fontWeight: 400,
      marginBottom: "36px",
      lineHeight: 1.45,
      letterSpacing: "-0.015em",
      maxWidth: "720px",
      margin: "0 auto 36px",
      textShadow: "0 1px 6px rgba(0,0,0,0.4)",
    },
    ctaButton: {
      padding: "13px 28px",
      fontSize: "15px",
      fontWeight: 500,
      letterSpacing: "-0.01em",
      background: appleBlue,
      color: "#FFFFFF",
      border: "none",
      borderRadius: "9999px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      fontFamily: "inherit",
      boxShadow: "0 4px 16px rgba(0, 113, 227, 0.4)",
      transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    },
    
    // Section
    section: {
      width: "100%",
      maxWidth: "100%",
      margin: 0,
      padding: "clamp(56px, 8vw, 104px) clamp(16px, 4vw, 48px)",
      boxSizing: "border-box",
    },
    sectionTitle: {
      fontSize: "clamp(28px, 4.2vw, 44px)",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
      textAlign: "center",
      marginBottom: "12px",
      color: appleTextPrimary,
    },
    sectionSubtitle: {
      fontSize: "clamp(16px, 1.8vw, 19px)",
      color: appleTextSecondary,
      fontWeight: 400,
      letterSpacing: "-0.015em",
      textAlign: "center",
      maxWidth: "680px",
      margin: "0 auto clamp(36px, 5vw, 56px)",
      lineHeight: 1.45,
    },
    
    // Features Grid (Apple Bento Squircles)
    featuresGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(clamp(150px, 45vw, 200px), 1fr))",
      gap: "clamp(16px, 2.5vw, 24px)",
    },
    featureCard: {
      padding: "clamp(24px, 3.5vw, 36px)",
      backgroundColor: appleCardBg,
      borderRadius: "24px",
      border: appleCardBorder,
      boxShadow: appleCardShadow,
      textAlign: "left",
      cursor: "pointer",
      width: "100%",
      minHeight: "220px",
      display: "flex",
      flexDirection: "column",
      transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
    },
    featureIcon: {
      width: "50px",
      height: "50px",
      backgroundColor: isDark ? "rgba(41, 151, 255, 0.15)" : "rgba(0, 113, 227, 0.08)",
      border: isDark ? "1px solid rgba(41, 151, 255, 0.25)" : "1px solid rgba(0, 113, 227, 0.16)",
      borderRadius: "14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: appleBlue,
      marginBottom: "20px",
    },
    featureTitle: {
      fontSize: "clamp(18px, 2vw, 21px)",
      fontWeight: 600,
      letterSpacing: "-0.02em",
      marginBottom: "8px",
      color: appleTextPrimary,
    },
    featureDesc: {
      fontSize: "13.5px",
      color: appleTextSecondary,
      lineHeight: 1.45,
      letterSpacing: "-0.01em",
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical" as any,
      overflow: "hidden",
    },

    projectLink: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      color: appleBlue,
      fontSize: "13.5px",
      fontWeight: 500,
      textDecoration: "none",
      wordBreak: "break-all" as const,
    },
    projectLinkMuted: {
      margin: 0,
      color: appleTextMuted,
      fontSize: "12px",
    },
    projectPreviewImage: {
      width: "100%",
      height: "165px",
      objectFit: "cover",
      borderRadius: "14px",
      marginBottom: "14px",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.06)",
    },
    
    // Stats Section (Apple Keynote Style)
    statsSection: {
      backgroundColor: "transparent",
      borderTop: "none",
      borderBottom: "none",
      padding: "clamp(48px, 7vw, 84px) 0",
      overflow: "hidden",
    },
    // Technology Banner (Edge-to-Edge Full Width)
    techSection: {
      position: "relative",
      width: "100%",
      boxSizing: "border-box",
      overflow: "hidden",
      padding: "clamp(48px, 6vw, 80px) 0",
      marginBottom: "clamp(32px, 4vw, 48px)",
      background: "transparent",
      borderTop: "none",
      borderBottom: "none",
    },
    techIntro: {
      textAlign: "center" as const,
      padding: "0 20px 28px",
      maxWidth: "720px",
      margin: "0 auto",
    },
    techEyebrow: {
      margin: 0,
      fontSize: "12px",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: appleBlue,
    },
    techHeading: {
      margin: "10px 0 0",
      fontSize: "clamp(24px, 3.5vw, 34px)",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      color: appleTextPrimary,
    },
    techHighlight: {
      backgroundImage: isDark
        ? "linear-gradient(90deg, #38bdf8, #06b6d4)"
        : "linear-gradient(90deg, #0284c7, #0d9488)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
      textShadow: "none",
    },
    techSub: {
      margin: "12px 0 0",
      fontSize: "15px",
      lineHeight: 1.5,
      letterSpacing: "-0.01em",
      color: appleTextSecondary,
    },
    techNode: {
      position: "absolute",
      left: 0,
      top: 0,
      width: "var(--tech-node, 84px)",
      height: "var(--tech-node, 84px)",
      willChange: "transform",
      cursor: "pointer",
    },
    techNodeMask: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: appleCardBg,
      border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.08)",
      boxShadow: appleCardShadow,
      transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease",
      willChange: "transform",
    },
    techNodeImg: {
      width: "56%",
      height: "56%",
      objectFit: "contain" as const,
      filter: isDark ? "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" : "none",
      pointerEvents: "none",
      userSelect: "none" as const,
    },
    statsIntro: {
      textAlign: "center" as const,
      padding: "0 20px 28px",
      maxWidth: "720px",
      margin: "0 auto",
    },
    statsEyebrow: {
      margin: 0,
      fontSize: "12px",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: appleBlue,
    },
    statsHeading: {
      margin: "10px 0 0",
      fontSize: "clamp(24px, 3.5vw, 34px)",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      color: appleTextPrimary,
    },
    statsSub: {
      margin: "12px 0 0",
      fontSize: "15px",
      lineHeight: 1.5,
      letterSpacing: "-0.01em",
      color: appleTextSecondary,
    },
    hScrollOuter: {
      width: "100%",
      maxWidth: "100%",
      overflowX: "auto" as const,
      overflowY: "hidden",
      WebkitOverflowScrolling: "touch",
      padding: "16px clamp(4px, 2vw, 12px) 24px",
      boxSizing: "border-box" as const,
      scrollSnapType: "none",
      scrollbarWidth: "none" as const,
      msOverflowStyle: "none" as const,
      cursor: "grab",
      userSelect: "none" as const,
    },
    hScrollInner: {
      display: "flex",
      flexDirection: "row" as const,
      alignItems: "stretch",
      width: "max-content",
      minHeight: "100%",
    },
    hScrollCell: {
      flexShrink: 0,
    },
    horizontalCardSurface: {
      padding: "clamp(20px, 3vw, 28px)",
      borderRadius: "24px",
      border: appleCardBorder,
      backgroundColor: appleCardBg,
      backdropFilter: isDark ? "blur(20px)" : "none",
      WebkitBackdropFilter: isDark ? "blur(20px)" : "none",
      boxShadow: appleCardShadow,
      textAlign: "left" as const,
      boxSizing: "border-box" as const,
    },
    horizontalCardSurfaceCenter: {
      padding: "clamp(20px, 3vw, 28px)",
      borderRadius: "24px",
      border: appleCardBorder,
      backgroundColor: appleCardBg,
      backdropFilter: isDark ? "blur(20px)" : "none",
      WebkitBackdropFilter: isDark ? "blur(20px)" : "none",
      boxShadow: appleCardShadow,
      textAlign: "center" as const,
      boxSizing: "border-box" as const,
    },

    statsStaticRow: {
      display: "flex",
      flexWrap: "wrap" as const,
      justifyContent: "center",
      gap: "20px",
      padding: "0 clamp(12px, 3vw, 28px)",
    },
    statStaticCard: {
      flex: "0 1 auto",
      width: "100%",
      maxWidth: "100%",
      padding: "22px 18px",
      borderRadius: "22px",
      background: appleCardBg,
      border: appleCardBorder,
      boxShadow: appleCardShadow,
      textAlign: "center",
      boxSizing: "border-box" as const,
    },
    statStaticValue: {
      margin: "0 0 6px",
      fontSize: "clamp(34px, 5vw, 44px)",
      fontWeight: 700,
      color: appleTextPrimary,
      letterSpacing: "-0.035em",
    },
    statStaticLabel: {
      margin: 0,
      fontSize: "13px",
      fontWeight: 500,
      color: appleTextSecondary,
      letterSpacing: "-0.01em",
    },
    sliderCard: {
      height: "100%",
      minHeight: "280px",
      display: "flex",
      flexDirection: "column",
    },

    clientAvatarContainer: {
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      margin: "0 auto 16px",
      border: isDark ? "1px solid rgba(41, 151, 255, 0.3)" : "1px solid rgba(0, 113, 227, 0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(41, 151, 255, 0.12)" : "rgba(0, 113, 227, 0.08)",
      color: appleBlue,
    },
    clientAvatarImg: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
    clientName: {
      fontSize: "16px",
      fontWeight: 600,
      letterSpacing: "-0.015em",
      marginBottom: "4px",
      color: appleTextPrimary,
    },
    clientCompany: {
      fontSize: "13px",
      color: appleBlue,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      marginBottom: "8px",
    },
    clientProject: {
      fontSize: "13px",
      color: appleTextSecondary,
      lineHeight: 1.55,
      letterSpacing: "-0.01em",
    },
    
    // Developer Grid
    developerGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      gap: "24px",
    },
    developerCard: {
      padding: "clamp(20px, 3vw, 28px)",
      backgroundColor: appleCardBg,
      borderRadius: "24px",
      border: appleCardBorder,
      boxShadow: appleCardShadow,
      textAlign: "center",
      cursor: "pointer",
    },
    circleMask: {
      width: "84px",
      height: "84px",
      borderRadius: "50%",
      overflow: "hidden",
      margin: "0 auto 16px",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#f5f5f7",
      border: isDark ? "2px solid rgba(41, 151, 255, 0.3)" : "2px solid rgba(0, 113, 227, 0.2)",
    },
    devAvatarImg: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
    circleInitial: {
      fontSize: "32px",
      fontWeight: 600,
      color: "#FFFFFF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      background: appleBlue,
    },
    developerName: {
      fontSize: "17px",
      fontWeight: 600,
      letterSpacing: "-0.02em",
      marginBottom: "4px",
      color: appleTextPrimary,
    },
    developerRole: {
      fontSize: "13px",
      color: appleBlue,
      fontWeight: 500,
      marginBottom: "12px",
    },
    skillTags: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      justifyContent: "center",
      marginBottom: "12px",
    },
    skillTag: {
      padding: "4px 10px",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#f5f5f7",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e5e5ea",
      borderRadius: "9999px",
      fontSize: "11.5px",
      color: isDark ? "#d1d1d6" : "#424245",
      fontWeight: 500,
    },
    developerExperience: {
      fontSize: "12px",
      color: appleTextSecondary,
      marginBottom: "8px",
    },
    developerBlurb: {
      fontSize: "13px",
      color: appleTextSecondary,
      lineHeight: 1.55,
      margin: 0,
    },
    rating: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
    },
    ratingValue: {
      fontSize: "12px",
      fontWeight: 600,
      color: "#FF9F0A",
      marginLeft: "4px",
    },

    // Testimonials
    testimonialCard: {
      padding: "clamp(20px, 3vw, 28px)",
      backgroundColor: appleCardBg,
      borderRadius: "24px",
      border: appleCardBorder,
      boxShadow: appleCardShadow,
      textAlign: "center",
      width: "100%",
      maxWidth: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxSizing: "border-box",
      flexShrink: 0,
    },
    testimonialAvatar: {
      width: "52px",
      height: "52px",
      background: appleBlue,
      boxShadow: "0 4px 14px rgba(0, 113, 227, 0.3)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: "0 auto 14px",
      color: "#FFFFFF",
      fontWeight: 600,
      fontSize: "17px",
    },
    testimonialStars: {
      display: "flex",
      justifyContent: "center",
      gap: "4px",
      marginBottom: "12px",
    },
    testimonialText: {
      fontSize: "14px",
      color: appleTextPrimary,
      lineHeight: 1.45,
      marginBottom: "14px",
      fontStyle: "normal",
      letterSpacing: "-0.01em",
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical" as any,
      overflow: "hidden",
    },
    testimonialName: {
      fontSize: "15px",
      fontWeight: 600,
      letterSpacing: "-0.015em",
      marginBottom: "2px",
      color: appleTextPrimary,
    },
    testimonialCompany: {
      fontSize: "12.5px",
      color: appleTextSecondary,
    },

    // Contact Section (Apple Consultation Console - Full Screen & Compact)
    contactSection: {
      backgroundColor: appleSectionBg,
      borderTop: appleHairline,
      padding: "clamp(44px, 6vw, 76px) 0",
      width: "100%",
    },
    contactContainer: {
      width: "100%",
      maxWidth: "100%",
      margin: 0,
      padding: "0 clamp(20px, 3.5vw, 64px)",
      boxSizing: "border-box",
    },
    contactHeader: {
      textAlign: "center",
      marginBottom: "36px",
    },
    contactGrid: {
      display: "grid",
      gap: "clamp(24px, 3.5vw, 48px)",
      width: "100%",
      alignItems: "start",
    },
    contactInfo: {
      width: "100%",
    },
    contactInfoTitle: {
      fontSize: "22px",
      fontWeight: 700,
      letterSpacing: "-0.025em",
      color: appleTextPrimary,
      marginBottom: "10px",
    },
    contactInfoDesc: {
      fontSize: "14.5px",
      color: appleTextSecondary,
      lineHeight: 1.5,
      letterSpacing: "-0.01em",
      marginBottom: "28px",
    },
    infoItems: {
      display: "flex",
      flexDirection: "column",
      gap: "18px",
    },
    infoItem: {
      display: "flex",
      gap: "14px",
      alignItems: "flex-start",
    },
    infoIcon: {
      width: "38px",
      height: "38px",
      backgroundColor: appleCardBg,
      border: appleCardBorder,
      borderRadius: "10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "16px",
      boxShadow: isDark ? "none" : "0 2px 8px rgba(0, 0, 0, 0.04)",
      flexShrink: 0,
    },
    infoLabel: {
      fontSize: "11px",
      fontWeight: 600,
      color: appleTextSecondary,
      marginBottom: "3px",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
    },
    infoValue: {
      fontSize: "14px",
      fontWeight: 500,
      color: appleTextPrimary,
    },
    infoValueRow: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      rowGap: "6px",
      fontSize: "14px",
      fontWeight: 500,
      color: appleTextPrimary,
    },
    infoValueRowItem: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
    },
    infoValueSeparator: {
      color: appleTextSecondary,
      opacity: 0.5,
      marginRight: "6px",
    },
    infoSocialRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      alignItems: "center",
    },
    infoSocialLink: {
      width: "34px",
      height: "34px",
      borderRadius: "999px",
      border: appleCardBorder,
      backgroundColor: appleCardBg,
      color: appleTextPrimary,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    },
    contactFormContainer: {
      width: "100%",
    },
    contactGlassCard: {
      backgroundColor: appleCardBg,
      backdropFilter: isDark ? "blur(20px)" : "none",
      WebkitBackdropFilter: isDark ? "blur(20px)" : "none",
      padding: "clamp(20px, 3vw, 32px)",
      borderRadius: "24px",
      boxShadow: appleCardShadow,
      border: appleCardBorder,
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
    },
    contactForm: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    formRow: {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
    },
    formGroup: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      minWidth: "170px",
    },
    formLabel: {
      fontSize: "12.5px",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: appleTextPrimary,
    },
    formInput: {
      padding: "9px 13px",
      borderRadius: "11px",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid #d2d2d7",
      fontSize: "13.5px",
      fontFamily: "inherit",
      outline: "none",
      transition: "all 0.2s ease",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#ffffff",
      color: appleTextPrimary,
    },
    formSelect: {
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      cursor: "pointer",
      paddingRight: "36px",
      width: "100%",
    },
    selectOption: {
      backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
      color: appleTextPrimary,
    },
    emailInput: {
      border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid #d2d2d7",
      boxShadow: "none",
    },
    formInputError: {
      borderColor: "#FF3B30",
      boxShadow: "0 0 0 1px #FF3B30",
    },
    fieldError: {
      margin: "3px 2px 0",
      fontSize: "11.5px",
      fontWeight: 500,
      color: "#FF3B30",
    },
    formTextarea: {
      padding: "10px 13px",
      borderRadius: "11px",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid #d2d2d7",
      fontSize: "13.5px",
      fontFamily: "inherit",
      outline: "none",
      minHeight: "80px",
      resize: "vertical" as any,
      transition: "all 0.2s ease",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#ffffff",
      color: appleTextPrimary,
    },
    submitBtn: {
      padding: "11px 26px",
      background: appleBlue,
      color: "#FFFFFF",
      border: "none",
      borderRadius: "9999px",
      fontSize: "14.5px",
      fontWeight: 500,
      letterSpacing: "-0.01em",
      cursor: "pointer",
      marginTop: "4px",
      boxShadow: "0 4px 16px rgba(0, 113, 227, 0.35)",
      transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    },
  };
}

const defaultLandingStyles = getLandingStyles(true);
const styles = defaultLandingStyles;

