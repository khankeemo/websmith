import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

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
  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroGlowA} />
        <div style={styles.heroGlowB} />
        <div style={styles.heroInner} className="public-page-hero-inner">
          <div style={styles.heroCopy}>
            <p style={styles.eyebrow}>{eyebrow}</p>
            <h1 style={styles.title}>{title}</h1>
            <p style={styles.description}>{description}</p>
            {cta ? (
              <Link href={cta.href} style={styles.cta} className="public-page-cta">
                {cta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
      <div style={styles.body}>
        {children}
      </div>
      <style>{`
        .public-page-cta,
        .public-page-card,
        .public-page-chip {
          transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .public-page-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(0, 122, 255, 0.24);
          background-color: #005fd1 !important;
        }
        .public-page-card:hover {
          transform: translateY(-5px);
          border-color: rgba(0, 122, 255, 0.26) !important;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.09), 0 8px 18px rgba(0, 122, 255, 0.08);
        }
        .public-page-chip:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 122, 255, 0.28) !important;
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
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        {description ? <p style={styles.sectionDescription}>{description}</p> : null}
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
  return (
    <article
      style={{ ...styles.card, borderTop: accent ? `3px solid ${accent}` : styles.card.borderTop }}
      className="public-page-card"
    >
      {children}
    </article>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <div style={styles.list}>
      {items.map((item) => (
        <div key={item} style={styles.listItem}>
          <span style={styles.dot} />
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
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 96%, #007AFF 4%) 0%, var(--bg-primary) 24%, var(--bg-primary) 100%)",
    color: "var(--text-primary)",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: "clamp(42px, 6vw, 76px) clamp(16px, 4vw, 48px) 34px",
    borderBottom: "1px solid var(--border-color)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 92%, transparent) 0%, color-mix(in srgb, var(--bg-secondary) 86%, transparent) 100%)",
  },
  heroGlowA: {
    position: "absolute",
    top: "-80px",
    left: "-80px",
    width: "260px",
    height: "260px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(0,122,255,0.18) 0%, rgba(0,122,255,0) 72%)",
    pointerEvents: "none",
  },
  heroGlowB: {
    position: "absolute",
    right: "-120px",
    bottom: "-140px",
    width: "340px",
    height: "340px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0) 72%)",
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
  },
  heroCopy: {
    display: "grid",
    gap: "14px",
  },
  eyebrow: {
    margin: 0,
    color: "#007AFF",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: "clamp(34px, 6vw, 62px)",
    lineHeight: 0.98,
    letterSpacing: "-0.05em",
    maxWidth: "1400px",
  },
  description: {
    margin: 0,
    maxWidth: "1400px",
    color: "var(--text-secondary)",
    fontSize: "clamp(16px, 2vw, 18px)",
    lineHeight: 1.75,
  },
  cta: {
    marginTop: "10px",
    display: "inline-flex",
    width: "fit-content",
    padding: "13px 20px",
    borderRadius: "14px",
    textDecoration: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(0, 122, 255, 0.18)",
  },
  body: {
    display: "grid",
    gap: "30px",
    width: "100%",
    padding: "36px clamp(16px, 4vw, 48px) 72px",
  },
  section: {
    display: "grid",
    gap: "18px",
  },
  sectionHeader: {
    display: "grid",
    gap: "8px",
    maxWidth: "1400px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "clamp(24px, 3vw, 34px)",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "var(--text-primary)",
  },
  sectionDescription: {
    margin: 0,
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    fontSize: "15px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px",
  },
  card: {
    display: "grid",
    gap: "14px",
    padding: "24px",
    borderRadius: "24px",
    border: "1px solid var(--border-color)",
    borderTop: "1px solid var(--border-color)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 78%, transparent) 0%, color-mix(in srgb, var(--bg-secondary) 92%, #007AFF 8%) 100%)",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  listItem: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    color: "var(--text-secondary)",
    lineHeight: 1.7,
  },
  dot: {
    width: "8px",
    height: "8px",
    marginTop: "9px",
    borderRadius: "999px",
    backgroundColor: "#007AFF",
    flexShrink: 0,
    boxShadow: "0 0 0 4px rgba(0,122,255,0.14)",
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
    gap: "18px",
    alignItems: "start",
  },
};
