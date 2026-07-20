"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

export default function DocumentationPage() {
  return (
    <PublicPage
      eyebrow="Knowledge Base"
      title="WebSmith Digital Documentation Center"
      description="Your trusted resource for understanding, managing, and maximizing the digital solutions we build for your business."
    >
      <SimplePublicBody>
        {/* Intro */}
        <section style={styles.section}>
          <p style={styles.narrative}>
            Welcome to the <strong>Documentation Center of WebSmith Digital</strong>. We believe great systems should not only be powerful, 
            but also easy to understand and operate. Our documentation is designed to help clients, teams, and administrators use their 
            platforms smoothly, efficiently, and with confidence.
          </p>
          <p style={styles.narrative}>
            Whether you use a website, custom application, ERP system, automation tools, booking platform, or integrated business solution, 
            our documentation provides clear guidance for every stage.
          </p>
        </section>

        {/* What You'll Find */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>What You’ll Find in Our Documentation</h2>
          <div style={styles.grid}>
            {[
              { title: "Getting Started Guides", desc: "Step-by-step instructions to help you begin using your website, software, or system quickly and correctly." },
              { title: "User Manuals", desc: "Easy-to-follow guides for daily operations, features, dashboard access, settings, and workflow usage." },
              { title: "Admin Documentation", desc: "Detailed resources for administrators to manage users, permissions, configurations, and advanced controls." },
              { title: "ERP & Business Systems", desc: "Documentation for inventory, sales, customer management, reporting, accounts, and business process tools." },
              { title: "Automation & Integration Help", desc: "Understand callback systems, smart messaging, API integrations, and workflow automation features." },
              { title: "Website Management", desc: "Learn how to manage content, update pages, upload media, monitor inquiries, and maintain performance." },
              { title: "Troubleshooting & Support", desc: "Common issue resolutions, best practices, maintenance tips, and guidance for contacting support." }
            ].map((doc) => (
              <div key={doc.title} style={styles.docCard}>
                <h3 style={styles.cardTitle}>{doc.title}</h3>
                <p style={styles.cardDesc}>{doc.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Documentation Matters */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Why Our Documentation Matters</h2>
          <div style={styles.listGrid}>
            {[
              "Clear and professional instructions",
              "Easy-to-understand language",
              "Faster onboarding for teams",
              "Better productivity and system usage",
              "Reduced downtime and confusion",
              "Confidence in managing your digital tools"
            ].map((reason) => (
              <div key={reason} style={styles.listItem}>
                <div style={styles.listDot} />
                <span style={styles.listText}>{reason}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Who It's For */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Who This Documentation Is For</h2>
          <div style={styles.chipContainer}>
            {["Business Owners", "Company Staff", "Administrators", "Operations Teams", "Managers", "Technical Teams", "New Users"].map(label => (
              <span key={label} style={styles.chip}>{label}</span>
            ))}
          </div>
        </section>

        {/* Support Hook */}
        <section style={styles.missionBox}>
          <h2 style={styles.subHeadingCompact}>Our Commitment</h2>
          <p style={styles.missionText}>
            At WebSmith Digital, we don’t just deliver systems — we ensure you know how to use them effectively. 
            Good documentation is part of great service.
          </p>
        </section>

        {/* Help Contact */}
        <section style={styles.closure}>
          <h2 style={styles.subHeadingCenter}>Need Additional Help?</h2>
          <p style={styles.narrativeCenter}>
            If you require personalized guidance, training, or technical assistance:
          </p>
          <div style={styles.contactRow}>
            <div style={styles.contactItem}>
              <span style={styles.contactLabel}>Support Email</span>
              <a href="mailto:support@websmithdigital.com" style={styles.contactValue}>support@websmithdigital.com</a>
            </div>
            <div style={styles.contactItem}>
              <span style={styles.contactLabel}>Sales & Consultation</span>
              <a href="mailto:sales@websmithdigital.com" style={styles.contactValue}>sales@websmithdigital.com</a>
            </div>
            <div style={styles.contactItem}>
              <span style={styles.contactLabel}>Mobile</span>
              <span style={styles.contactValueText}>+91 ____________</span>
            </div>
          </div>
        </section>
      </SimplePublicBody>

      <style>{`
        .public-page-hero-inner h1 {
          font-size: clamp(30px, 5vw, 42px) !important;
          letter-spacing: -0.03em !important;
        }
      `}</style>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    display: "grid",
    gap: "24px",
    marginBottom: "56px",
  },
  subHeading: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
  },
  subHeadingCompact: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 700,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "12px",
    textAlign: "center",
  },
  subHeadingCenter: {
    margin: "0 0 16px 0",
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
    textAlign: "center",
  },
  narrative: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    maxWidth: "850px",
  },
  narrativeCenter: {
    margin: "0 auto 32px auto",
    fontSize: "16px",
    color: "var(--text-secondary)",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  docCard: {
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  cardTitle: {
    margin: "0 0 8px 0",
    fontSize: "17px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  cardDesc: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
  },
  listGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "12px",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  listDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#007AFF",
  },
  listText: {
    fontSize: "15px",
    color: "var(--text-secondary)",
  },
  chipContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  chip: {
    padding: "8px 16px",
    borderRadius: "999px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  missionBox: {
    padding: "32px",
    borderRadius: "24px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    marginBottom: "56px",
  },
  missionText: {
    margin: "0 auto",
    fontSize: "18px",
    lineHeight: 1.6,
    color: "var(--text-primary)",
    maxWidth: "700px",
    textAlign: "center",
  },
  closure: {
    padding: "48px 24px",
    borderRadius: "32px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  contactRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "24px",
  },
  contactItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  contactLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  contactValue: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#007AFF",
    textDecoration: "none",
  },
  contactValueText: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
};
