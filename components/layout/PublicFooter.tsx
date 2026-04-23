"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { publicFooterConfig } from "../../core/config/publicSite";

export default function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={styles.footer}>
      <div style={styles.content} className="landing-footer-content">
        <div style={styles.section}>
          <h3 style={styles.brandName}>{publicFooterConfig.brand.name}</h3>
          <p style={styles.tagline}>{publicFooterConfig.brand.tagline}</p>
          <p style={styles.aboutSummary}>
            We design smart solutions and build powerful digital ecosystems that help businesses grow and automate through innovation and practicality.
          </p>
          <div style={styles.socialRow}>
            {publicFooterConfig.socials.map((social) => {
              const shortLabel =
                social.label === "Twitter"
                  ? "TW"
                  : social.label === "LinkedIn"
                    ? "IN"
                    : social.label === "GitHub"
                      ? "GH"
                      : "FB";

              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  style={styles.socialLink}
                  className="public-footer-social"
                >
                  {shortLabel}
                </a>
              );
            })}
          </div>
        </div>

        {publicFooterConfig.sections.map((section) => (
          <div key={section.title} style={styles.section}>
            <h4 style={styles.sectionTitle}>{section.title}</h4>
            {section.links.map((link) => (
              <Link key={`${section.title}-${link.href}`} href={link.href} style={styles.link} className="public-footer-link">
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div style={styles.bottomBar}>
        <p style={styles.bottomText}>(c) {year} Websmith. All rights reserved. Developed with care by Websmith Team</p>
      </div>
      <style>{`
        .public-footer-link,
        .public-footer-social {
          transition: all 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .public-footer-link:hover {
          color: #007AFF !important;
          transform: translateX(4px);
        }
        .public-footer-social:hover {
          border-color: rgba(0, 122, 255, 0.35) !important;
          color: #007AFF !important;
          transform: translateY(-3px);
          box-shadow: 0 12px 24px rgba(0, 122, 255, 0.14);
        }
      `}</style>
    </footer>
  );
}

const styles: Record<string, CSSProperties> = {
  footer: {
    backgroundColor: "var(--bg-secondary)",
    borderTop: "1px solid var(--border-color)",
    padding: "48px 0 24px",
  },
  content: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "40px",
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "0 clamp(16px, 4vw, 48px)",
    marginBottom: "40px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  brandName: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  tagline: {
    margin: 0,
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  aboutSummary: {
    margin: "8px 0 0",
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    opacity: 0.8,
  },
  socialRow: {
    display: "flex",
    gap: "16px",
    marginTop: "8px",
  },
  socialLink: {
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
    fontSize: "11px",
    fontWeight: 700,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  link: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    textDecoration: "none",
  },
  bottomBar: {
    textAlign: "center",
    paddingTop: "24px",
    borderTop: "1px solid var(--border-color)",
    margin: "0 clamp(16px, 4vw, 48px)",
  },
  bottomText: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "12px",
  },
};
