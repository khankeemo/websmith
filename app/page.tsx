// C:\websmith\app\page.tsx
// Landing Page - Websmith
// Features: Hero section, Features grid, Stats counters, Satisfied clients, Developers section, Testimonials, Footer
// Updated: Added header navigation menu with smooth scroll

"use client";

import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
} from "lucide-react";
import PublicFooter from "../components/layout/PublicFooter";
import PublicSiteNav from "../components/layout/PublicSiteNav";
import { getPublishedProjects, getPublishedTestimonials } from "./projects/services/projectService";
import API from "../core/services/apiService";
import { SOCIAL_PLATFORM_META } from "../lib/social-platforms";
import { getPublishedClients } from "./clients/services/clientService";
import { getPublishedDevelopers } from "../core/services/userService";
import { createPublicTicket } from "../core/services/ticketService";
import { useLeadFunnel } from "./providers/LeadFunnelProvider";

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
};

function HorizontalCardStrip<T>({
  items,
  renderItem,
  ariaLabel,
  itemMinWidth = 280,
  gap = 14,
  autoLoopCount = 1,
  dragThreshold = 0,
  direction = "right-to-left",
  scale = 1,
  speed = 0.5,
  outerPadding,
}: HorizontalCardStripProps<T>) {
  const outerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, startScrollLeft: 0, lastX: 0, velocity: 0 });
  const autoLoop = items.length >= autoLoopCount;
  
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
              minWidth: `var(--h-card-min-width, ${itemMinWidth * scale}px)`, 
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
  return (
    <HorizontalCardStrip
      items={items}
      ariaLabel="Websmith stats"
      itemMinWidth={220}
      gap={18}
      autoLoopCount={1}
      direction="left-to-right"
      scale={1}
      speed={1.2}
      outerPadding="26px clamp(8px, 2vw, 16px) 30px"
      renderItem={(item) => (
        <article key={item.id} style={styles.statStaticCard} className="landing-stat-card">
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
    <section aria-label="Built With the Right Technology" style={styles.techSection}>
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

export default function LandingPage() {
  const { openLeadServicesModal } = useLeadFunnel();
  
  // Refs for smooth scroll
  const featuresRef = useRef<HTMLElement>(null);
  const developersRef = useRef<HTMLElement>(null);
  const clientsRef = useRef<HTMLElement>(null);
  const contactFormRef = useRef<HTMLElement>(null);
  const diversityVideoRef = useRef<HTMLVideoElement>(null);
  
  // Contact form state
  const [contactState, setContactState] = useState({
    name: "",
    email: "",
    company: "",
    subject: "",
    message: ""
  });
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
    if (!subject) errors.subject = "Please enter a subject.";
    else if (subject.length > 300) errors.subject = "Subject must be 300 characters or fewer.";
    if (!message) errors.message = "Please enter your message.";
    else if (message.length > 20000) errors.message = "Message must be 20,000 characters or fewer.";
    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContactChange = (field: keyof typeof contactState, value: string) => {
    setContactState((prev) => ({ ...prev, [field]: value }));
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

  const effectiveProjects = publishedProjects;
  const publicClients = publishedClients.map((client: any, index: number) => ({
    id: client._id || client.id || `client-${index}`,
    name: client.name,
    company: client.company || "Independent client",
    description:
      client.address ||
      client.customId ||
      client.description ||
      "Partnered with Websmith on product delivery, design quality, and long-term support.",
  }));

  const effectiveDevelopers = publishedDevelopers;

  const publicDevelopers = effectiveDevelopers.map((developer: any, index: number) => ({
    id: developer._id || developer.id || `dev-${index}`,
    name: developer.name,
    role: developer.headline || developer.role || "Software Developer",
    skills: developer.skills?.length ? developer.skills : ["Engineering", "Delivery"],
    experience: developer.experienceYears || developer.experience || 0,
    avatar: developer.avatar || "",
    bio: developer.bio || "Experienced engineer focused on shipping resilient digital products.",
  }));

  const statTargets = {
    projects: clampStatCount(publishedProjects.length),
    clients: clampStatCount(publishedClients.length),
    developers: clampStatCount(publishedDevelopers.length),
    countries: clampStatCount(
      new Set(
        publishedClients
          .map((client: any) => String(client.address || "").trim())
          .filter(Boolean)
      ).size
    ),
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

  const reviewCards = publishedTestimonials.map((testimonial: any, index: number) => ({
    id: testimonial.id || `testimonial-${index}`,
    name: testimonial.name,
    company: testimonial.company || testimonial.projectName || "Websmith client",
    quote: testimonial.quote,
    rating: testimonial.rating || 5,
  }));


  const statsCarouselItems = [
    { id: "stat-projects", value: String(stats.projects), label: "Projects Delivered" },
    { id: "stat-clients", value: String(stats.clients), label: "Active Client Partnerships" },
    { id: "stat-developers", value: String(stats.developers), label: "Specialist Developers" },
    { id: "stat-countries", value: String(stats.countries), label: "Countries Served" },
    { id: "stat-support", value: "2h", label: "Support Response Target" },
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
    <div style={styles.container}>
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
          <source src="/videos/Websmith Digital.mp4" type="video/mp4" />
        </video>
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent} className="landing-hero-content">
          <h1 style={styles.heroTitle} className="landing-hero-title">Your On-Demand <span style={styles.highlight}>Tech Partner</span></h1>
          <p style={styles.heroSubtitle} className="landing-hero-subtitle">Connect with top-tier developers, build amazing products, and scale your business with confidence.</p>
          <button onClick={handleGetStarted} style={styles.ctaButton} className="cta-hover">
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" ref={featuresRef} style={styles.section}>
        <h2 style={styles.sectionTitle}>Why Choose Websmith</h2>
        <p style={styles.sectionSubtitle}>Everything you need to build exceptional digital products</p>
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
                backgroundImage: `linear-gradient(color-mix(in srgb, var(--bg-secondary) 92%, transparent), color-mix(in srgb, var(--bg-secondary) 92%, transparent)), url(/images/assets/service_${index % 5 + 1}.png)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} 
              className="feature-card"
            >
              <div style={styles.featureIcon}>{<feature.icon size={28} />}</div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Built With the Right Technology — floating technology banner */}
      <FloatingTechnologyBanner />

      {/* Stats — looping carousel */}
      <section style={styles.statsSection}>
        <div style={styles.statsIntro}>
          <p style={styles.statsEyebrow}>Trust at scale</p>
          <h2 style={styles.statsHeading}>Momentum you can see</h2>
          <p style={styles.statsSub}>Numbers that reflect how teams ship with Websmith.</p>
        </div>
        <StatsStrip items={statsCarouselItems} />
      </section>

      {effectiveProjects.length > 0 && (
        <section id="projects" style={styles.section}>
          <h2 style={styles.sectionTitle}>Projects</h2>
          <p style={styles.sectionSubtitle}>Selected launches and delivery work with public-facing details only.</p>
          <HorizontalCardStrip
            items={effectiveProjects}
            ariaLabel="Published projects"
            itemMinWidth={180}
            autoLoopCount={6}
            direction="right-to-left"
            scale={1}
            renderItem={(project: any) => (
              <div style={{ ...styles.horizontalCardSurface, ...styles.sliderCard }} className="feature-card">
                {project.previewImage ? (
                  <img src={project.previewImage} alt={project.name} style={styles.projectPreviewImage} />
                ) : null}
                <div style={styles.featureIcon}><Briefcase size={28} /></div>
                <h3 style={styles.featureTitle}>{project.name}</h3>
                <p style={styles.featureDesc}>{project.description}</p>
                <p style={{ ...styles.clientCompany, marginTop: "12px" }}>{project.client || "Published Project"}</p>
                {project.publicUrl ? (
                  <a href={project.publicUrl} target="_blank" rel="noreferrer" style={styles.projectLink}>
                    <span>{project.publicUrl}</span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <p style={styles.projectLinkMuted}>Hosted project URL will appear here once added from the admin panel.</p>
                )}
              </div>
            )}
          />
        </section>
      )}


      {/* Global Diversity & Collaboration */}
      <section style={styles.diversitySection}>
          <div style={styles.diversityContent} className="landing-diversity-content">
          <div style={styles.diversityTextColumn} className="ws-diversity-col">
            <h2 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "20px", color: "var(--text-primary)" }}>Global Collaboration & Technical Excellence</h2>
            <p style={{ fontSize: "18px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "24px" }}>
              Our team brings together diverse perspectives and world-class expertise to solve complex challenges. 
              We believe in the power of inclusive collaboration to build the next generation of digital products.
            </p>
            <div style={{ display: "flex", gap: "16px" }} className="landing-badges-row">
              <div style={styles.diversityBadge}>Enterprise Grade</div>
              <div style={styles.diversityBadge}>Diverse Talent</div>
            </div>
            <div style={styles.diversityImageContainer}>
              <img
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1200"
                alt="Global Technical Team"
                style={styles.diversityImage}
              />
            </div>
          </div>
          <div style={styles.diversityMediaColumn} className="ws-diversity-col">
            <p style={styles.diversityMediaMessage}>
              Why Websmith? Because we pair global talent with enterprise-grade delivery and round-the-clock support.
              One dedicated team that builds faster, ships smarter, and stays by your side long after launch —
              that is why clients choose Websmith, and why they stay.
            </p>
            <div style={styles.diversityVideoContainer}>
              <video
                ref={diversityVideoRef}
                autoPlay
                loop
                playsInline
                controls
                preload="auto"
                style={styles.diversityVideo}
              >
                <source src="/videos/WDS_UAC.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Satisfied Clients - 10 Rectangle Cards */}
      {publicClients.length > 0 && (
        <section id="clients" ref={clientsRef} style={styles.section}>
          <h2 style={styles.sectionTitle}>Our Satisfied Clients</h2>
          <p style={styles.sectionSubtitle}>Trusted by businesses worldwide</p>
          <HorizontalCardStrip
            items={publicClients}
            ariaLabel="Satisfied clients"
            itemMinWidth={180}
            autoLoopCount={6}
            direction="left-to-right"
            scale={1}
            renderItem={(client, index) => (
              <div key={client.id || index} style={{ ...styles.horizontalCardSurfaceCenter, ...styles.sliderCard }} className="client-card">
                <div style={styles.clientAvatarContainer}>
                  <Building2 size={22} color="#007AFF" />
                </div>
                <h4 style={styles.clientName}>{client.name}</h4>
                <p style={styles.clientCompany}>{client.company}</p>
                <p style={styles.clientProject}>{client.description}</p>
              </div>
            )}
          />
        </section>
      )}


      {/* Developers - expert profiles */}
      {publicDevelopers.length > 0 && (
        <section id="developers" ref={developersRef} style={styles.section}>
          <h2 style={styles.sectionTitle}>Meet Our Expert Developers</h2>
          <p style={styles.sectionSubtitle}>The technical minds behind your digital success</p>
          <HorizontalCardStrip
            items={publicDevelopers}
            ariaLabel="Expert developers"
            itemMinWidth={180}
            autoLoopCount={6}
            direction="right-to-left"
            scale={1}
            renderItem={(dev) => (
              <div key={dev.id} style={{ ...styles.horizontalCardSurfaceCenter, ...styles.sliderCard }} className="developer-card">
                <div style={styles.circleMask}>
                  {dev.avatar ? <img src={dev.avatar} alt={dev.name} style={styles.devAvatarImg} /> : <span style={styles.circleInitial}>{dev.name.charAt(0)}</span>}
                </div>
                <h4 style={styles.developerName}>{dev.name}</h4>
                <p style={styles.developerRole}>{dev.role}</p>
                <div style={styles.skillTags}>
                  {dev.skills.slice(0, 3).map((skill, i) => (
                    <span key={i} style={styles.skillTag}>{skill}</span>
                  ))}
                </div>
                <p style={styles.developerExperience}>{dev.experience}+ years experience</p>
                <p style={styles.developerBlurb}>{dev.bio}</p>
              </div>
            )}
          />
        </section>
      )}


      {/* Testimonials */}
      {reviewCards.length > 0 && (
        <section id="testimonials" style={styles.section}>
          <h2 style={styles.sectionTitle}>What Our Clients Say</h2>
          <p style={styles.sectionSubtitle}>Continuous feedback highlights from across projects, clients, and delivery teams.</p>
          <HorizontalCardStrip
            items={reviewCards}
            ariaLabel="Client testimonials"
            itemMinWidth={180}
            autoLoopCount={6}
            direction="left-to-right"
            scale={1}
            renderItem={(testimonial) => (
              <div key={testimonial.id} style={{ ...styles.horizontalCardSurfaceCenter, ...styles.sliderCard }} className="testimonial-card">
                <div style={styles.testimonialAvatar}>{testimonial.name.slice(0, 2).toUpperCase()}</div>
                <div style={styles.testimonialStars}>
                  {[...Array(testimonial.rating || 5)].map((_, i) => (
                    <Star key={i} size={16} fill="#FFB800" color="#FFB800" />
                  ))}
                </div>
                <p style={styles.testimonialText}>"{testimonial.quote}"</p>
                <h4 style={styles.testimonialName}>{testimonial.name}</h4>
                <p style={styles.testimonialCompany}>{testimonial.company}</p>
              </div>
            )}
          />
        </section>
      )}


      {/* Contact Section */}
      <section id="contact" ref={contactFormRef} style={styles.contactSection}>
        <div style={styles.contactContainer}>
          <div style={styles.contactHeader}>
            <h2 style={styles.sectionTitle}>Get in Touch</h2>
            <p style={styles.sectionSubtitle}>Have a project in mind? Let&apos;s build something amazing together.</p>
          </div>
          
          <div style={styles.contactGrid}>
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
                      await createPublicTicket({
                        name: contactState.name.trim(),
                        email: contactState.email.trim().toLowerCase(),
                        company: contactState.company.trim(),
                        subject: contactState.subject.trim(),
                        message: contactState.message.trim(),
                      });
                      setSubmitStatus("success");
                      setContactState({ name: "", email: "", company: "", subject: "", message: "" });
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
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel} htmlFor="contact-company">Company <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>(optional)</span></label>
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
                    <input 
                      id="contact-subject"
                      name="subject"
                      type="text" 
                      placeholder="Project Inquiry" 
                      style={{ ...styles.formInput, ...(contactErrors.subject ? styles.formInputError : {}) }}
                      required
                      autoComplete="off"
                      aria-invalid={Boolean(contactErrors.subject)}
                      aria-describedby={contactErrors.subject ? "contact-subject-error" : undefined}
                      value={contactState.subject}
                      onChange={(e) => handleContactChange("subject", e.target.value)}
                    />
                    {contactErrors.subject && (
                      <p id="contact-subject-error" role="alert" style={styles.fieldError}>{contactErrors.subject}</p>
                    )}
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
        
        /* Login Button Hover */
        .login-btn-hover { 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .login-btn-hover:hover { 
          background-color: #F2F2F7 !important; 
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
        
        .feature-card,
        .client-card,
        .developer-card,
        .testimonial-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }
        .client-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.08);
        }
        .developer-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.12);
        }
        .testimonial-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.08);
        }

        .landing-card-strip::-webkit-scrollbar {
          display: none;
        }

        /* Trust at scale — stat card hover pop */
        .landing-stat-card {
          transition: background-color 0.35s ease, background-image 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease, color 0.35s ease;
          cursor: pointer;
        }
        .landing-stat-card:hover {
          background-color: #149CEA !important;
          background-image: linear-gradient(135deg, #22D3EE 0%, #149CEA 55%, #1479EA 100%) !important;
          border-color: rgba(20, 156, 234, 0.9) !important;
          box-shadow: 0 26px 80px rgba(20, 156, 234, 0.55), 0 0 46px rgba(20, 156, 234, 0.38), inset 0 0 24px rgba(255, 255, 255, 0.16);
        }
        .landing-stat-card:hover .landing-stat-value {
          color: #062A4A !important;
        }
        .landing-stat-card:hover .landing-stat-label {
          color: #12527E !important;
        }
        /* scale the whole strip cell so the popup floats above neighboring cards */
        .landing-card-strip > div > div:has(.landing-stat-card:hover) {
          position: relative;
          z-index: 5;
          transform: scale(1.16) !important;
        }

        /* Built With the Right Technology — floating technology banner */
        .tech-field {
          position: relative;
          height: clamp(280px, 34vw, 400px);
          min-height: 240px;
          max-width: 1240px;
          margin: 0 auto;
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

        @media (max-width: 1100px) {
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

const styles: any = {
  container: {
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-sans)",
  },
  // Hero
  hero: {
    padding: "60px 0",
    textAlign: "center",
    position: "relative",
    color: "#FFFFFF",
    overflow: "hidden",
    minHeight: "63vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    zIndex: 1,
  },
  heroContent: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "0 24px",
    position: "relative",
    zIndex: 2,
  },
  heroTitle: {
    fontSize: "56px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    marginBottom: "20px",
    color: "#FFFFFF",
    textShadow: "0 2px 10px rgba(0,0,0,0.5)",
  },
  highlight: {
    color: "#007AFF",
    fontWeight: 700,
  },
  heroSubtitle: {
    fontSize: "20px",
    color: "#F2F2F7",
    fontWeight: 500,
    marginBottom: "32px",
    lineHeight: 1.4,
    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
  },
  ctaButton: {
    padding: "14px 32px",
    fontSize: "16px",
    fontWeight: 600,
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "inherit",
  },
  
  // Section
  section: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "clamp(40px, 7vw, 88px) clamp(16px, 4vw, 48px)",
    boxSizing: "border-box",
  },
  sectionTitle: {
    fontSize: "clamp(24px, 4vw, 36px)",
    fontWeight: 600,
    textAlign: "center",
    marginBottom: "16px",
    color: "var(--text-primary)",
  },
  sectionSubtitle: {
    fontSize: "clamp(15px, 2vw, 18px)",
    color: "var(--text-secondary)",
    textAlign: "center",
    marginBottom: "clamp(32px, 5vw, 48px)",
    lineHeight: 1.45,
  },
  
  // Features Grid
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(140px, 45vw, 180px), 1fr))",
    gap: "clamp(14px, 3vw, 24px)",
  },
  featureCard: {
    padding: "clamp(16px, 3vw, 28px)",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
    textAlign: "left",
    cursor: "pointer",
    width: "100%",
    minHeight: "200px",
    display: "flex",
    flexDirection: "column",
  },

  featureIcon: {
    width: "clamp(40px, 5vw, 56px)",
    height: "clamp(40px, 5vw, 56px)",
    backgroundColor: "#E3F2FF",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#007AFF",
    marginBottom: "clamp(12px, 2vw, 20px)",
  },
  featureTitle: {
    fontSize: "clamp(17px, 2vw, 20px)",
    fontWeight: 600,
    marginBottom: "clamp(8px, 1.5vw, 12px)",
    color: "var(--text-primary)",
  },
  featureDesc: {
    fontSize: "clamp(13px, 1.5vw, 15px)",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },

  projectLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    color: "#0A66FF",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    wordBreak: "break-all" as const,
  },
  projectLinkMuted: {
    margin: 0,
    color: "#8E8E93",
    fontSize: "12px",
  },
  projectPreviewImage: {
    width: "100%",
    height: "190px",
    objectFit: "cover",
    borderRadius: "18px",
    marginBottom: "18px",
    border: "1px solid rgba(0,0,0,0.06)",
  },
  
  // Stats Section
  statsSection: {
    backgroundColor: "#1C1C1E",
    padding: "clamp(40px, 6vw, 72px) 0",
    overflow: "hidden",
  },
  // Built With the Right Technology — floating technology banner
  techSection: {
    position: "relative",
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    padding: "clamp(40px, 6vw, 72px) clamp(16px, 4vw, 48px)",
    marginBottom: "clamp(32px, 4vw, 48px)",
    background:
      "radial-gradient(1100px 520px at 12% -10%, rgba(139,92,246,0.22), transparent 62%), radial-gradient(1000px 480px at 92% 8%, rgba(34,211,238,0.13), transparent 55%), #131024",
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
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "rgba(167,139,250,0.75)",
  },
  techHeading: {
    margin: "10px 0 0",
    fontSize: "clamp(22px, 3vw, 30px)",
    fontWeight: 700,
    color: "#FFFFFF",
    textShadow: "0 0 22px rgba(139,92,246,0.35)",
  },
  techHighlight: {
    backgroundImage: "linear-gradient(90deg, #a78bfa, #22d3ee)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
  techSub: {
    margin: "12px 0 0",
    fontSize: "15px",
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.65)",
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
    backgroundColor: "#171a2e",
    backgroundImage: "radial-gradient(circle at 32% 26%, #232743, #0f1122 72%)",
    border: "1px solid rgba(139,92,246,0.4)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.5), 0 0 16px rgba(139,92,246,0.18), inset 0 0 14px rgba(139,92,246,0.15)",
    transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease, border-color 0.3s ease",
    willChange: "transform",
  },
  techNodeImg: {
    width: "56%",
    height: "56%",
    objectFit: "contain" as const,
    filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.55))",
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
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.5)",
  },
  statsHeading: {
    margin: "10px 0 0",
    fontSize: "clamp(22px, 3vw, 30px)",
    fontWeight: 700,
    color: "#FFFFFF",
  },
  statsSub: {
    margin: "12px 0 0",
    fontSize: "15px",
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.65)",
  },
  hScrollOuter: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto" as const,
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    padding: "4px clamp(4px, 2vw, 12px) 12px",
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
    padding: "clamp(16px, 3vw, 24px)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
    background: "linear-gradient(180deg, var(--bg-primary) 0%, color-mix(in srgb, var(--bg-secondary) 88%, #007AFF) 100%)",
    textAlign: "left" as const,
    boxSizing: "border-box" as const,
  },
  horizontalCardSurfaceCenter: {
    padding: "clamp(16px, 3vw, 24px)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
    background: "linear-gradient(180deg, var(--bg-primary) 0%, color-mix(in srgb, var(--bg-secondary) 88%, #007AFF) 100%)",
    textAlign: "center" as const,
    boxSizing: "border-box" as const,
  },

  statsStaticRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    justifyContent: "center",
    gap: "22px",
    padding: "0 clamp(12px, 3vw, 28px)",
  },
  statStaticCard: {
    flex: "0 1 auto",
    width: "min(240px, 82vw)",
    padding: "18px 18px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
  },
  statStaticValue: {
    margin: "0 0 6px",
    fontSize: "clamp(30px, 5vw, 40px)",
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  statStaticLabel: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.72)",
  },
  sliderCard: {
    height: "100%",
    minHeight: "280px",
    display: "flex",
    flexDirection: "column",
  },

  statsGrid: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "32px",
    textAlign: "center",
  },
  statCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "16px",
    padding: "22px",
    minHeight: "132px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    textAlign: "center",
  },
  statNumber: {
    fontSize: "48px",
    fontWeight: 700,
    color: "#FFFFFF",
    marginBottom: "8px",
  },
  statLabel: {
    fontSize: "14px",
    color: "#8E8E93",
  },
  
  // Client Grid
  clientGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "24px",
  },
  clientCard: {
    padding: "clamp(16px, 3vw, 24px)",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
    textAlign: "center",
  },
  clientAvatarContainer: {
    width: "clamp(48px, 6vw, 60px)",
    height: "clamp(48px, 6vw, 60px)",
    borderRadius: "50%",
    margin: "0 auto 16px",
    border: "2px solid #E3F2FF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F7FF",
  },
  clientAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  clientName: {
    fontSize: "clamp(15px, 2vw, 16px)",
    fontWeight: 600,
    marginBottom: "4px",
    color: "var(--text-primary)",
  },
  clientCompany: {
    fontSize: "13px",
    color: "#007AFF",
    marginBottom: "8px",
  },
  clientProject: {
    fontSize: "clamp(12px, 1.5vw, 13px)",
    color: "#6C6C70",
    lineHeight: 1.6,
  },
  
  // Developer Grid
  developerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "24px",
  },
  developerCard: {
    padding: "clamp(16px, 3vw, 24px)",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
    textAlign: "center",
    cursor: "pointer",
  },
  circleMask: {
    width: "clamp(70px, 8vw, 100px)",
    height: "clamp(70px, 8vw, 100px)",
    borderRadius: "50%",
    overflow: "hidden",
    margin: "0 auto 16px",
    backgroundColor: "#F2F2F7",
    border: "3px solid #E3F2FF",
  },
  devAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  circleInitial: {
    fontSize: "clamp(28px, 4vw, 40px)",
    fontWeight: 600,
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, #007AFF, #34C759)",
  },
  developerName: {
    fontSize: "clamp(16px, 2vw, 18px)",
    fontWeight: 600,
    marginBottom: "4px",
    color: "var(--text-primary)",
  },

  developerRole: {
    fontSize: "13px",
    color: "#007AFF",
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
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "20px",
    fontSize: "11px",
    color: "var(--text-primary)",
  },
  developerExperience: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    marginBottom: "8px",
  },
  developerBlurb: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
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
    color: "#FFB800",
    marginLeft: "4px",
  },
  
  // Testimonials
  testimonialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "24px",
  },
  marqueeViewport: {
    overflow: "hidden",
    maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
  },
  marqueeTrack: {
    display: "flex",
    gap: "20px",
    width: "max-content",
    paddingRight: "20px",
  },
  testimonialCard: {
    padding: "clamp(16px, 3vw, 28px)",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
    textAlign: "center",
    width: "clamp(170px, 80vw, 320px)",
    flexShrink: 0,
  },

  testimonialAvatar: {
    width: "60px",
    height: "60px",
    backgroundColor: "#007AFF",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: "20px",
  },
  testimonialStars: {
    display: "flex",
    justifyContent: "center",
    gap: "4px",
    marginBottom: "16px",
  },
  testimonialText: {
    fontSize: "15px",
    color: "var(--text-primary)",
    lineHeight: 1.5,
    marginBottom: "16px",
    fontStyle: "italic",
  },
  testimonialName: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "4px",
  },
  testimonialCompany: {
    fontSize: "13px",
    color: "var(--text-secondary)",
  },


  // Diversity Section Styles

  diversitySection: {
    backgroundColor: "var(--bg-secondary)",
    padding: "clamp(56px, 8vw, 100px) 0",
    width: "100%",
  },
  diversityContent: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "0 clamp(16px, 4vw, 48px)",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    gap: "40px",
    flexWrap: "wrap",
    boxSizing: "border-box",
  },
  // LEFT column — heading / description / badges + image (480 × 270).
  diversityTextColumn: {
    width: "480px",
    minWidth: "480px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
  },
  // RIGHT column — Websmith explanation + video (480 × 270).
  diversityMediaColumn: {
    width: "480px",
    minWidth: "480px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
  },
  diversityMediaMessage: {
    fontSize: "17px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  // Image + video cards: exactly 480 × 270, 16:9, aligned at the same
  // bottom level (marginTop auto pins both to the bottom of equal-height
  // columns).
  diversityImageContainer: {
    width: "100%",
    height: "270px",
    aspectRatio: "16 / 9",
    marginTop: "auto",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
  },
  diversityImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  diversityVideoContainer: {
    width: "100%",
    height: "270px",
    aspectRatio: "16 / 9",
    marginTop: "auto",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
  },
  diversityVideo: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  diversityBadge: {
    padding: "8px 16px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#007AFF",
    boxShadow: "var(--card-shadow)",
    display: "inline-block",
  },

  // Contact Section Styles
  contactSection: {
    backgroundColor: "var(--bg-primary)",
    padding: "clamp(56px, 8vw, 100px) 0",
    width: "100%",
  },
  contactContainer: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "0 clamp(16px, 4vw, 48px)",
  },
  contactHeader: {
    textAlign: "center",
    marginBottom: "60px",
  },
  contactGrid: {
    display: "flex",
    gap: "60px",
    flexWrap: "wrap",
  },
  contactInfo: {
    flex: 1,
    minWidth: "300px",
  },
  contactInfoTitle: {
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "16px",
  },
  contactInfoDesc: {
    fontSize: "16px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    marginBottom: "40px",
  },
  infoItems: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  infoItem: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  },
  infoIcon: {
    width: "48px",
    height: "48px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    boxShadow: "var(--card-shadow)",
  },
  infoLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  infoValue: {
    fontSize: "16px",
    fontWeight: 500,
    color: "var(--text-primary)",
  },
  // One horizontal row per category (emails | phones | socials) that wraps
  // naturally only when the available width requires it.
  infoValueRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: "8px",
    fontSize: "16px",
    fontWeight: 500,
    color: "var(--text-primary)",
  },
  infoValueRowItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  infoValueSeparator: {
    color: "var(--text-secondary)",
    opacity: 0.6,
    marginRight: "8px",
  },
  infoSocialRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
  },
  infoSocialLink: {
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    transition: "all 0.24s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  contactFormContainer: {
    flex: 1.5,
    minWidth: "320px",
  },
  contactGlassCard: {
    backgroundColor: "var(--bg-primary)",
    padding: "40px",
    borderRadius: "24px",
    boxShadow: "var(--card-shadow)",
    border: "1px solid var(--border-color)",
  },
  contactForm: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  formRow: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap",
  },
  formGroup: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: "200px",
  },
  formLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  formInput: {
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    fontSize: "16px",
    fontFamily: "inherit",
    outline: "none",
    transition: "all 0.2s ease",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
  },
  emailInput: {
    border: "1px solid var(--border-color)",
    boxShadow: "inset 0 0 0 1px var(--border-color)",
  },
  formInputError: {
    borderColor: "#FF3B30",
    boxShadow: "inset 0 0 0 1px #FF3B30",
  },
  fieldError: {
    margin: "6px 2px 0",
    fontSize: "13px",
    fontWeight: 500,
    color: "#FF3B30",
  },
  formTextarea: {
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    fontSize: "16px",
    fontFamily: "inherit",
    outline: "none",
    minHeight: "150px",
    resize: "vertical" as any,
    transition: "all 0.2s ease",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
  },
  submitBtn: {
    padding: "16px 32px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "10px",
    transition: "all 0.3s ease",
    width: "100%",
  },
};

