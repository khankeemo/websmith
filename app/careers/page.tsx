"use client";

import React from "react";
import { Mail, Briefcase, Rocket, Users } from "lucide-react";

export default function CareersPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Careers at Websmith</h1>
        <p style={styles.lead}>
          Help us build the software that powers the world's most innovative companies.
        </p>

        <div style={styles.benefitsGrid}>
          <div style={styles.benefitCard}>
            <Rocket size={32} color="#007AFF" />
            <h3 style={styles.benefitTitle}>High Impact</h3>
            <p style={styles.benefitText}>Work on mission-critical products for global scale.</p>
          </div>
          <div style={styles.benefitCard}>
            <Users size={32} color="#007AFF" />
            <h3 style={styles.benefitTitle}>Expert Peer Group</h3>
            <p style={styles.benefitText}>Collaborate with senior engineers and domain experts.</p>
          </div>
        </div>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>Open Positions</h2>
          <div style={styles.jobsList}>
            <div style={styles.jobItem}>
              <h4 style={styles.jobTitle}>Senior Fullstack Engineer (React/Node)</h4>
              <p style={styles.jobMeta}>Remote | Full-time | $120k - $160k</p>
            </div>
            <div style={styles.jobItem}>
              <h4 style={styles.jobTitle}>UI/UX Product Designer</h4>
              <p style={styles.jobMeta}>Remote | Full-time | $90k - $130k</p>
            </div>
          </div>
        </section>

        <section style={styles.ctaSection}>
          <h2 style={styles.subtitle}>How to Apply</h2>
          <p style={styles.text}>
            We are always looking for passionate talent. If you don't see a role that fits but think you can make an impact, send your resume and portfolio to our recruitment team.
          </p>
          <div style={styles.contactCard}>
            <Mail size={24} style={styles.icon} />
            <a href="mailto:careerteam@wsd.com" style={styles.emailLink}>careerteam@wsd.com</a>
          </div>
          <p style={styles.note}>Please note: We only accept applications via email at this time.</p>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "80vh",
    padding: "80px 24px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  content: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  title: {
    fontSize: "48px",
    fontWeight: 700,
    marginBottom: "16px",
    letterSpacing: "-0.02em",
  },
  lead: {
    fontSize: "20px",
    color: "var(--text-secondary)",
    marginBottom: "48px",
  },
  benefitsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "24px",
    marginBottom: "60px",
  },
  benefitCard: {
    padding: "24px",
    backgroundColor: "#F5F5F7",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
  },
  benefitTitle: {
    fontSize: "18px",
    fontWeight: 600,
    marginTop: "16px",
    marginBottom: "8px",
  },
  benefitText: {
    fontSize: "15px",
    color: "var(--text-secondary)",
    lineHeight: "1.4",
  },
  section: {
    marginBottom: "60px",
  },
  subtitle: {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "24px",
  },
  jobsList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  jobItem: {
    padding: "20px",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  jobTitle: {
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "4px",
  },
  jobMeta: {
    fontSize: "14px",
    color: "#007AFF",
    fontWeight: 500,
  },
  ctaSection: {
    backgroundColor: "#F0F7FF",
    padding: "40px",
    borderRadius: "24px",
    textAlign: "center",
  },
  text: {
    fontSize: "18px",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
    marginBottom: "24px",
  },
  contactCard: {
    display: "inline-flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 24px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    marginBottom: "16px",
  },
  icon: {
    color: "#007AFF",
  },
  emailLink: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1C1C1E",
    textDecoration: "none",
  },
  note: {
    fontSize: "14px",
    color: "#8E8E93",
  },
};
