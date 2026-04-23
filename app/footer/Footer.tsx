"use client";

import React, { type CSSProperties } from "react";
import Link from "next/link";

/**
 * Footer component for marketing and auxiliary pages.
 * Kept visually identical to the original landing page footer.
 */
export default function Footer() {
  return (
    <footer id="footer" style={styles.footer}>
      <div style={styles.footerContent} className="landing-footer-content">
        {/* Brand Section */}
        <div style={styles.footerSection}>
          <h3 style={styles.footerLogo}>Websmith</h3>
          <p style={styles.footerDesc}>Your trusted partner for digital excellence.</p>
          <div style={styles.socialLinks}>
            <span className="social-icon" style={styles.socialIcon}>🐦</span>
            <span className="social-icon" style={styles.socialIcon}>💼</span>
            <span className="social-icon" style={styles.socialIcon}>🐙</span>
            <span className="social-icon" style={styles.socialIcon}>📘</span>
          </div>
        </div>

        {/* Company Section */}
        <div style={styles.footerSection}>
          <h4 style={styles.sectionHeading}>Company</h4>
          <Link href="/about" style={styles.footerLink} className="footer-link-hover">About Us</Link>
          <Link href="/careers" style={styles.footerLink} className="footer-link-hover">Careers</Link>
          <Link href="/blog" style={styles.footerLink} className="footer-link-hover">Blog</Link>
        </div>

        {/* Resources Section */}
        <div style={styles.footerSection}>
          <h4 style={styles.sectionHeading}>Resources</h4>
          <Link href="/documentation" style={styles.footerLink} className="footer-link-hover">Documentation</Link>
          <Link href="/support" style={styles.footerLink} className="footer-link-hover">Support</Link>
          <Link href="/#contact" style={styles.footerLink} className="footer-link-hover">Contact</Link>
        </div>

        {/* Legal Section */}
        <div style={styles.footerSection}>
          <h4 style={styles.sectionHeading}>Legal</h4>
          <Link href="/privacy" style={styles.footerLink} className="footer-link-hover">Privacy Policy</Link>
          <Link href="/terms" style={styles.footerLink} className="footer-link-hover">Terms of Service</Link>
        </div>
      </div>

      <div style={styles.copyright}>
        <p>© {new Date().getFullYear()} Websmith. All rights reserved. Developed with ❤️ by Websmith Team</p>
      </div>

      <style>{`
        .footer-link-hover {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .footer-link-hover:hover {
          color: #007AFF !important;
          transform: translateY(-2px);
          padding-left: 4px;
        }
        .social-icon {
          transition: transform 0.2s ease;
          display: inline-block;
        }
        .social-icon:hover {
          transform: scale(1.2);
        }
      `}</style>
    </footer>
  );
}

const styles: Record<string, CSSProperties> = {
  footer: {
    backgroundColor: "#F9F9FB",
    borderTop: "1px solid #E5E5EA",
    padding: "48px 0 24px",
    width: "100%",
  },
  footerContent: {
    maxWidth: "1600px",
    margin: "0 auto",
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "40px",
    marginBottom: "40px",
  },
  footerSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  footerLogo: {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "8px",
    color: "#1C1C1E",
  },
  footerDesc: {
    fontSize: "14px",
    color: "#6C6C70",
    lineHeight: "1.5",
  },
  sectionHeading: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "8px",
    color: "#1C1C1E",
  },
  footerLink: {
    fontSize: "14px",
    color: "#6C6C70",
    textDecoration: "none",
    display: "inline-block",
  },
  socialLinks: {
    display: "flex",
    gap: "16px",
    marginTop: "8px",
  },
  socialIcon: {
    fontSize: "18px",
    cursor: "pointer",
  },
  copyright: {
    textAlign: "center",
    paddingTop: "24px",
    borderTop: "1px solid #E5E5EA",
    fontSize: "12px",
    color: "#8E8E93",
    maxWidth: "1380px",
    margin: "0 auto",
    width: "calc(100% - 48px)",
  },
};
