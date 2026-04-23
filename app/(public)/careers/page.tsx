"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

export default function CareersPage() {
  return (
    <PublicPage
      eyebrow="Join Our Team"
      title="Build the Future of Smart Business Solutions"
      description="At WebSmith Digital, we believe great companies are built by talented people with creative minds, technical expertise, and a passion for innovation."
      cta={{ href: "mailto:support@websmithdigital.com", label: "Send Your Resume" }}
    >
      <SimplePublicBody>
        {/* Intro */}
        <section style={styles.section}>
          <p style={styles.narrative}>
            At <strong>WebSmith Digital</strong>, we are always looking for dedicated professionals who want to grow with us and help businesses transform through smart digital solutions. 
            We work on impactful projects including websites, business applications, ERP systems, automation tools, customer engagement systems, and digital growth solutions.
          </p>
          <p style={styles.narrative}>
            If you are passionate about technology, design, strategy, or operations, we would love to hear from you.
          </p>
        </section>

        {/* Why Join Us */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Why Join WebSmith Digital</h2>
          <div style={styles.reasonList}>
            {[
              "Work on real-world projects that create business value",
              "Be part of a professional and forward-thinking team",
              "Learn, grow, and build your career in a dynamic environment",
              "Opportunity to work with modern tools, technologies, and automation systems",
              "Collaborative culture focused on creativity and performance",
              "Career growth based on skill, dedication, and results"
            ].map((reason) => (
              <div key={reason} style={styles.listItem}>
                <div style={styles.listDot} />
                <span style={styles.listText}>{reason}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Opportunities Grid */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Current Opportunities</h2>
          <p style={styles.narrative}>We regularly hire talented individuals in the following areas:</p>
          <div style={styles.grid}>
            {[
              {
                category: "Development & Engineering",
                roles: ["Full Stack Developers", "Frontend Developers", "Backend Developers", "Application Developers", "ERP System Developers", "Automation Developers", "Stack Coders"]
              },
              {
                category: "Creative & Design",
                roles: ["UI/UX Designers", "Web Designers", "Graphic Designers", "Brand Creatives"]
              },
              {
                category: "Marketing & Growth",
                roles: ["Digital Marketing Experts", "SEO Specialists", "Performance Marketers", "Content Strategists"]
              },
              {
                category: "Operations & Support",
                roles: ["Automation Operators", "Customer Support Executives", "Project Coordinators", "Technical Support Staff"]
              }
            ].map((group) => (
              <div key={group.category} style={styles.opportunityCard}>
                <h3 style={styles.cardCategory}>{group.category}</h3>
                <ul style={styles.roleList}>
                  {group.roles.map(role => <li key={role} style={styles.roleItem}>{role}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Who We Look For */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Who We Look For</h2>
          <div style={styles.grid}>
            {[
              { title: "Quality Committed", desc: "Skilled and committed to quality work." },
              { title: "Problem Solvers", desc: "Innovative thinkers who find solutions." },
              { title: "Team Players", desc: "Professionals with a great attitude." },
              { title: "Eager Learners", desc: "Ready to adapt to new technologies." }
            ].map((trait) => (
              <div key={trait.title} style={styles.traitBox}>
                <h4 style={styles.traitTitle}>{trait.title}</h4>
                <p style={styles.traitDesc}>{trait.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How to Apply */}
        <section style={styles.applicationSection}>
          <h2 style={styles.subHeadingCenter}>How to Apply</h2>
          <p style={styles.narrativeCenter}>
            If you believe you are the right fit for WebSmith Digital, send your updated resume and portfolio (if applicable) to:
          </p>
          <div style={styles.contactGrid}>
            <div style={styles.contactCard}>
              <span style={styles.contactLabel}>General Applications</span>
              <a href="mailto:support@websmithdigital.com" style={styles.contactValue}>support@websmithdigital.com</a>
            </div>
            <div style={styles.contactCard}>
              <span style={styles.contactLabel}>Sales & Business Roles</span>
              <a href="mailto:sales@websmithdigital.com" style={styles.contactValue}>sales@websmithdigital.com</a>
            </div>
          </div>
        </section>

        {/* Footer Note */}
        <section style={styles.closure}>
          <p style={styles.narrativeLarge}>
            At WebSmith Digital, you won’t just join a company — you’ll become part of a team building the future of smart business solutions. 
            <strong> Join us and grow your career with purpose.</strong>
          </p>
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
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    maxWidth: "600px",
    textAlign: "center",
  },
  narrativeLarge: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.7,
    color: "var(--text-primary)",
    textAlign: "center",
  },
  reasonList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "14px",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "4px 0",
  },
  listDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#007AFF",
    flexShrink: 0,
  },
  listText: {
    fontSize: "15px",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
  },
  opportunityCard: {
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  cardCategory: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
    color: "#007AFF",
  },
  roleList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  roleItem: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  traitBox: {
    padding: "20px",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
  },
  traitTitle: {
    margin: "0 0 8px 0",
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  traitDesc: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
  },
  applicationSection: {
    padding: "48px 24px",
    borderRadius: "32px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    marginBottom: "56px",
  },
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "24px",
    maxWidth: "800px",
    margin: "0 auto",
  },
  contactCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "20px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
  },
  contactLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  contactValue: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#007AFF",
    textDecoration: "none",
  },
  closure: {
    padding: "24px",
    textAlign: "center",
  },
};
