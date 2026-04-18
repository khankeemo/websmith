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
        <p style={styles.eyebrow}>{eyebrow}</p>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.description}>{description}</p>
        {cta ? (
          <Link href={cta.href} style={styles.cta}>
            {cta.label}
          </Link>
        ) : null}
      </section>
      <div style={styles.body}>{children}</div>
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
  return <article style={{ ...styles.card, borderTop: accent ? `3px solid ${accent}` : styles.card.borderTop }}>{children}</article>;
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
  return <div style={styles.twoColumn}>{left}{right}</div>;
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  hero: {
    padding: "56px clamp(16px, 4vw, 48px) 28px",
    borderBottom: "1px solid var(--border-color)",
    background:
      "radial-gradient(circle at top left, color-mix(in srgb, #007AFF 12%, transparent), transparent 35%), linear-gradient(180deg, var(--bg-primary) 0%, color-mix(in srgb, var(--bg-secondary) 84%, transparent) 100%)",
  },
  eyebrow: {
    margin: 0,
    color: "#007AFF",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: "12px 0 12px",
    fontSize: "clamp(34px, 6vw, 56px)",
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
  },
  description: {
    margin: 0,
    maxWidth: "760px",
    color: "var(--text-secondary)",
    fontSize: "17px",
    lineHeight: 1.7,
  },
  cta: {
    marginTop: "20px",
    display: "inline-flex",
    padding: "12px 18px",
    borderRadius: "12px",
    textDecoration: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    fontWeight: 700,
  },
  body: {
    display: "grid",
    gap: "24px",
    padding: "32px clamp(16px, 4vw, 48px) 56px",
  },
  section: {
    display: "grid",
    gap: "18px",
  },
  sectionHeader: {
    display: "grid",
    gap: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  sectionDescription: {
    margin: 0,
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  card: {
    display: "grid",
    gap: "12px",
    padding: "20px",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
    borderTop: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  list: {
    display: "grid",
    gap: "10px",
  },
  listItem: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  dot: {
    width: "8px",
    height: "8px",
    marginTop: "8px",
    borderRadius: "999px",
    backgroundColor: "#007AFF",
    flexShrink: 0,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
    gap: "18px",
    alignItems: "start",
  },
};
