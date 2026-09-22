"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePublicTheme } from "../../../app/providers/PublicThemeProvider";

export function SimplePublicBody({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div style={wide ? { ...styles.body, ...styles.bodyWide } : styles.body}>
      {children}
      <style>{`
        .simple-public-link,
        .simple-public-chip {
          transition: all 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .simple-public-link:hover {
          color: #3b82f6 !important;
          transform: translateX(4px);
        }
        .simple-public-chip:hover {
          transform: translateY(-2px);
          border-color: rgba(59, 130, 246, 0.35) !important;
          color: #3b82f6 !important;
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
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

  return (
    <section
      style={{
        ...styles.section,
        borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
      }}
    >
      <div style={styles.header}>
        <h2
          style={{
            ...styles.title,
            color: isDark ? "#ffffff" : "#0f172a",
          }}
        >
          {title}
        </h2>
        {description ? (
          <p
            style={{
              ...styles.description,
              color: isDark ? "rgba(255, 255, 255, 0.7)" : "#64748b",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div style={styles.content}>{children}</div>
    </section>
  );
}

export function SimplePublicList({ items }: { items: string[] }) {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";

  return (
    <div style={styles.list}>
      {items.map((item) => (
        <div key={item} style={styles.listItem}>
          <span
            style={{
              ...styles.dot,
              backgroundColor: "#3b82f6",
              boxShadow: isDark ? "0 0 0 4px rgba(59, 130, 246, 0.2)" : "0 0 0 4px rgba(59, 130, 246, 0.12)",
            }}
          />
          <p
            style={{
              ...styles.text,
              color: isDark ? "rgba(255, 255, 255, 0.75)" : "#475569",
            }}
          >
            {item}
          </p>
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
  bodyWide: {
    maxWidth: "none",
    padding: "clamp(24px, 3vw, 40px) clamp(10px, 2vw, 28px) clamp(56px, 7vw, 88px)",
  },
  section: {
    display: "grid",
    gap: "18px",
    paddingTop: "28px",
  },
  header: {
    display: "grid",
    gap: "10px",
  },
  title: {
    margin: 0,
    fontSize: "clamp(24px, 3vw, 32px)",
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    fontWeight: 700,
  },
  description: {
    margin: 0,
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
    marginTop: "8px",
    flexShrink: 0,
  },
  text: {
    margin: 0,
    lineHeight: 1.8,
    fontSize: "15px",
  },
};
