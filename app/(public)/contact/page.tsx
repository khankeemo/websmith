"use client";

import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

export default function ContactPage() {
  return (
    <PublicPage
      eyebrow="Get in Touch"
      title="Connect with WebSmith Digital"
      description="Ready to build something great? Our team is here to assist you with professional digital solutions and expert consultation."
    >
      <SimplePublicBody>
        {/* Intro */}
        <section style={styles.section}>
          <p style={styles.narrative}>
            At <strong>WebSmith Digital</strong>, we are always ready to connect with businesses, startups, professionals, and organizations 
            looking for reliable digital solutions. Whether you need a professional website, custom software, ERP system, automation tools, 
            digital marketing services, or expert consultation — our team is here to assist you.
          </p>
          <p style={styles.narrative}>
            We believe strong communication creates successful partnerships. Reach out to us for inquiries, project discussions, 
            service support, or collaboration opportunities.
          </p>
        </section>

        {/* Contact info grid */}
        <section style={styles.gridSection}>
          <div style={styles.infoCard}>
            <span style={styles.cardLabel}>General Inquiries</span>
            <h3 style={styles.cardTitle}>Support & Support</h3>
            <a href="mailto:support@websmithdigital.com" style={styles.cardLink}>support@websmithdigital.com</a>
          </div>
          <div style={styles.infoCard}>
            <span style={styles.cardLabel}>Sales & Business</span>
            <h3 style={styles.cardTitle}>Consultation</h3>
            <a href="mailto:sales@websmithdigital.com" style={styles.cardLink}>sales@websmithdigital.com</a>
          </div>
          <div style={styles.infoCard}>
            <span style={styles.cardLabel}>Call Us</span>
            <h3 style={styles.cardTitle}>Phone Number</h3>
            <span style={styles.cardText}>+91 ____________</span>
          </div>
          <div style={styles.infoCard}>
            <span style={styles.cardLabel}>Business Hours</span>
            <h3 style={styles.cardTitle}>Monday to Saturday</h3>
            <span style={styles.cardText}>Time: ____________</span>
          </div>
        </section>

        {/* Social channels */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Social Media</h2>
          <p style={styles.narrative}>Stay connected with WebSmith Digital through our social platforms:</p>
          <div style={styles.socialGrid}>
            {[
              { label: "Facebook", value: "____________________" },
              { label: "Instagram", value: "____________________" },
              { label: "LinkedIn", value: "____________________" },
              { label: "X / Twitter", value: "____________________" },
              { label: "YouTube", value: "____________________" },
              { label: "WhatsApp", value: "____________________" }
            ].map(social => (
              <div key={social.label} style={styles.socialItem}>
                <span style={styles.socialLabel}>{social.label}:</span>
                <span style={styles.socialValue}>{social.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Why contact us */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Why Contact WebSmith Digital</h2>
          <div style={styles.listGrid}>
            {[
              "Professional and timely communication",
              "Expert guidance for your business needs",
              "Reliable consultation and support",
              "Customized solutions for every business size",
              "Long-term partnership focused approach"
            ].map((item) => (
              <div key={item} style={styles.listItem}>
                <div style={styles.listDot} />
                <span style={styles.listText}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={styles.closure}>
          <p style={styles.narrativeLarge}>
            Let’s Build Something Great Together
          </p>
          <p style={styles.narrativeCenter}>
            Whether you are starting a new business, upgrading your systems, or growing your digital presence, 
            WebSmith Digital is ready to help you move forward with confidence. 
            <strong> We look forward to hearing from you.</strong>
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
  gridSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginBottom: "56px",
  },
  subHeading: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
  },
  narrative: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    maxWidth: "850px",
  },
  infoCard: {
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  cardLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  cardTitle: {
    margin: "4px 0 8px 0",
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  cardLink: {
    fontSize: "15px",
    fontWeight: 500,
    color: "#007AFF",
    textDecoration: "none",
  },
  cardText: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  socialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "12px",
  },
  socialItem: {
    display: "flex",
    gap: "10px",
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  socialLabel: {
    fontWeight: 700,
    color: "var(--text-primary)",
    minWidth: "80px",
  },
  socialValue: {
    color: "var(--text-secondary)",
  },
  listGrid: {
    display: "grid",
    gap: "12px",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
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
  closure: {
    marginTop: "40px",
    padding: "48px 24px",
    borderRadius: "32px",
    backgroundColor: "var(--bg-secondary)",
    textAlign: "center",
    border: "1px solid var(--border-color)",
  },
  narrativeLarge: {
    margin: "0 0 16px 0",
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  narrativeCenter: {
    margin: "0 auto",
    fontSize: "16px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    maxWidth: "600px",
  },
};
