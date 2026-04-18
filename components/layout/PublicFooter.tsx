"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { publicFooterConfig } from "../../core/config/publicSite";

export default function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={styles.footer}>
      <div style={styles.content}>
        <div style={styles.brandColumn}>
          <h3 style={styles.brandName}>{publicFooterConfig.brand.name}</h3>
          <p style={styles.tagline}>{publicFooterConfig.brand.tagline}</p>
          <div style={styles.socialRow}>
            {publicFooterConfig.socials.map((social) => {
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  style={styles.socialLink}
                >
                  {social.label.slice(0, 2)}
                </a>
              );
            })}
          </div>
        </div>

        {publicFooterConfig.sections.map((section) => (
          <div key={section.title} style={styles.section}>
            <h4 style={styles.sectionTitle}>{section.title}</h4>
            <div style={styles.linkList}>
              {section.links.map((link) => (
                <Link key={`${section.title}-${link.href}`} href={link.href} style={styles.link}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={styles.bottomBar}>
        <p style={styles.bottomText}>© {year} Websmith. All rights reserved.</p>
      </div>
    </footer>
  );
}

const styles: Record<string, CSSProperties> = {
  footer: {
    borderTop: "1px solid var(--border-color)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 94%, #007AFF 6%) 0%, var(--bg-secondary) 100%)",
    padding: "48px clamp(16px, 4vw, 48px) 20px",
  },
  content: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.2fr) repeat(3, minmax(160px, 0.8fr))",
    gap: "32px",
    width: "100%",
    alignItems: "start",
  },
  brandColumn: {
    display: "grid",
    gap: "12px",
  },
  brandName: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  tagline: {
    margin: 0,
    color: "color-mix(in srgb, var(--text-secondary) 92%, var(--text-primary) 8%)",
    lineHeight: 1.6,
    fontSize: "14px",
    maxWidth: "320px",
  },
  socialRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "6px",
  },
  socialLink: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    backgroundColor: "color-mix(in srgb, var(--bg-primary) 92%, transparent)",
    color: "var(--text-primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
  },
  section: {
    display: "grid",
    alignContent: "start",
    gap: "14px",
  },
  sectionTitle: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  linkList: {
    display: "grid",
    gap: "12px",
  },
  link: {
    color: "color-mix(in srgb, var(--text-secondary) 92%, var(--text-primary) 8%)",
    textDecoration: "none",
    fontSize: "14px",
  },
  bottomBar: {
    marginTop: "28px",
    paddingTop: "18px",
    borderTop: "1px solid var(--border-color)",
    display: "flex",
    justifyContent: "center",
  },
  bottomText: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "13px",
    letterSpacing: "0.01em",
  },
};
