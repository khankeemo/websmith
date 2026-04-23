import type { CSSProperties, ReactNode } from "react";

export function SimplePublicBody({ children }: { children: ReactNode }) {
  return (
    <div style={styles.body}>
      {children}
      <style>{`
        .simple-public-link,
        .simple-public-chip {
          transition: all 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .simple-public-link:hover {
          color: #007AFF !important;
          transform: translateX(4px);
        }
        .simple-public-chip:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 122, 255, 0.24) !important;
          color: #007AFF !important;
        }
      `}</style>
    </div>
  );
}

export function SimplePublicSection({
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
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        {description ? <p style={styles.description}>{description}</p> : null}
      </div>
      <div style={styles.content}>{children}</div>
    </section>
  );
}

export function SimplePublicList({ items }: { items: string[] }) {
  return (
    <div style={styles.list}>
      {items.map((item) => (
        <div key={item} style={styles.listItem}>
          <span style={styles.dot} />
          <p style={styles.text}>{item}</p>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    width: "100%",
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "clamp(28px, 4vw, 48px) clamp(16px, 4vw, 32px) clamp(56px, 7vw, 88px)",
    display: "grid",
    gap: "32px",
  },
  section: {
    display: "grid",
    gap: "18px",
    paddingTop: "28px",
    borderTop: "1px solid var(--border-color)",
  },
  header: {
    display: "grid",
    gap: "10px",
  },
  title: {
    margin: 0,
    fontSize: "clamp(24px, 3vw, 32px)",
    lineHeight: 1.05,
    letterSpacing: "-0.03em",
    color: "var(--text-primary)",
  },
  description: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "15px",
    lineHeight: 1.8,
  },
  content: {
    display: "grid",
    gap: "16px",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  listItem: {
    display: "grid",
    gridTemplateColumns: "12px minmax(0, 1fr)",
    gap: "12px",
    alignItems: "start",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    marginTop: "10px",
    backgroundColor: "#007AFF",
  },
  text: {
    margin: 0,
    color: "var(--text-secondary)",
    lineHeight: 1.8,
    fontSize: "15px",
  },
};
