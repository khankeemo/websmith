"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { usePublicTheme } from "../../../app/providers/PublicThemeProvider";

export function PublicPage({
  eyebrow,
  title,
  description,
  children,
  cta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  cta?: { href: string; label: string };
}) {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

  return (
    <div
      style={{
        ...styles.page,
        backgroundColor: "transparent",
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      <section
        style={{
          ...styles.hero,
          borderBottom: "none",
          background: isDark
            ? "radial-gradient(ellipse at 50% -20%, rgba(59, 130, 246, 0.18), transparent 70%)"
            : "radial-gradient(ellipse at 50% -20%, rgba(6, 182, 212, 0.12), transparent 70%)",
        }}
      >
        <div style={styles.heroGlowA} />
        <div style={styles.heroGlowB} />
        <div style={styles.heroInner} className="public-page-hero-inner">
          <div style={styles.heroCopy}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 16px",
                borderRadius: "9999px",
                backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
                border: isDark ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid rgba(37, 99, 235, 0.2)",
                color: "#3b82f6",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                width: "fit-content",
              }}
            >
              {eyebrow}
            </span>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(34px, 5.5vw, 56px)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                maxWidth: "1400px",
                color: isDark ? "#ffffff" : "#0f172a",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: 0,
                maxWidth: "1000px",
                color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
                fontSize: "clamp(16px, 2vw, 18px)",
                lineHeight: 1.75,
              }}
            >
              {description}
            </p>
            {cta ? (
              <Link
                href={cta.href}
                style={{
                  marginTop: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "fit-content",
                  padding: "12px 26px",
                  borderRadius: "9999px",
                  textDecoration: "none",
                  background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "15px",
                  boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)",
                }}
                className="public-page-cta"
              >
                {cta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
      <div style={styles.body}>{children}</div>
      <style>{`
        .public-page-cta,
        .public-page-card,
        .public-page-chip {
          transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .public-page-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.4);
        }
        .public-page-chip:hover {
          transform: translateY(-2px);
          border-color: rgba(59, 130, 246, 0.35) !important;
        }
        @media (max-width: 920px) {
          .public-page-hero-inner {
            grid-template-columns: 1fr !important;
          }
          .public-page-two-column {
            grid-template-columns: 1fr !important;
          }
          .public-page-docs-layout {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 520px) {
          .public-page-card {
            padding: 18px !important;
            border-radius: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2
          style={{
            ...styles.sectionTitle,
            color: isDark ? "#ffffff" : "#0f172a",
          }}
        >
          {title}
        </h2>
        {description ? (
          <p
            style={{
              ...styles.sectionDescription,
              color: isDark ? "rgba(255, 255, 255, 0.7)" : "#64748b",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div style={styles.grid}>{children}</div>;
}

export function Card({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: string;
}) {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

  return (
    <article
      style={{
        ...styles.card,
        backgroundColor: isDark ? "rgba(13, 19, 34, 0.75)" : "#ffffff",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
        borderTop: accent ? `3px solid ${accent}` : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
        boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
      }}
      className="public-page-card wsd-unified-card"
    >
      {children}
    </article>
  );
}

export function BulletList({ items }: { items: string[] }) {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

  return (
    <div style={styles.list}>
      {items.map((item) => (
        <div
          key={item}
          style={{
            ...styles.listItem,
            color: isDark ? "rgba(255, 255, 255, 0.75)" : "#475569",
          }}
        >
          <span
            style={{
              ...styles.dot,
              backgroundColor: "#3b82f6",
              boxShadow: isDark ? "0 0 0 4px rgba(59, 130, 246, 0.2)" : "0 0 0 4px rgba(59, 130, 246, 0.12)",
            }}
          />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export function TwoColumn({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div style={styles.twoColumn} className="public-page-two-column">
      {left}
      {right}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: "clamp(48px, 6vw, 84px) clamp(16px, 4vw, 48px) 38px",
  },
  heroGlowA: {
    position: "absolute",
    top: "-80px",
    left: "-80px",
    width: "320px",
    height: "320px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 72%)",
    pointerEvents: "none",
  },
  heroGlowB: {
    position: "absolute",
    right: "-120px",
    bottom: "-140px",
    width: "380px",
    height: "380px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, rgba(6,182,212,0) 72%)",
    pointerEvents: "none",
  },
  heroInner: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "28px",
    alignItems: "end",
    width: "100%",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  heroCopy: {
    display: "grid",
    gap: "16px",
  },
  body: {
    display: "grid",
    gap: "30px",
    width: "100%",
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "36px clamp(16px, 4vw, 48px) 72px",
  },
  section: {
    display: "grid",
    gap: "20px",
  },
  sectionHeader: {
    display: "grid",
    gap: "8px",
    maxWidth: "1400px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "clamp(24px, 3vw, 32px)",
    fontWeight: 700,
    letterSpacing: "-0.03em",
  },
  sectionDescription: {
    margin: 0,
    lineHeight: 1.7,
    fontSize: "15px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(clamp(150px, 45vw, 180px), 1fr))",
    gap: "clamp(14px, 3vw, 18px)",
  },
  card: {
    display: "grid",
    gap: "14px",
    padding: "clamp(18px, 3vw, 24px)",
    borderRadius: "20px",
    minHeight: "220px",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  listItem: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    lineHeight: 1.7,
    fontSize: "15px",
  },
  dot: {
    width: "8px",
    height: "8px",
    marginTop: "8px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
    gap: "20px",
    alignItems: "start",
  },
};
