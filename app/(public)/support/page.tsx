"use client";

import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

export default function SupportPage() {
  return (
    <PublicPage
      eyebrow="Client Care"
      title="Support — WebSmith Digital"
      description="Support is more than assistance — it is our commitment to keeping your business running smoothly, efficiently, and without interruption."
      cta={{ href: "mailto:support@websmithdigital.com", label: "Email Support" }}
    >
      <SimplePublicBody>
        {/* Intro */}
        <section style={styles.section}>
          <p style={styles.narrative}>
            At <strong>WebSmith Digital</strong>, we believe every client deserves reliable guidance, fast responses, and professional solutions 
            whenever needed. Whether you need technical help, service assistance, project guidance, updates, or business consultation, 
            our dedicated support team is ready to assist you with professionalism and care.
          </p>
        </section>

        {/* Services Grid */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Our Support Services</h2>
          <div style={styles.grid}>
            {[
              {
                title: "Technical Assistance",
                desc: "Get expert help for websites, applications, ERP systems, integrations, and software-related issues."
              },
              {
                title: "Website & Application Maintenance",
                desc: "We provide support for updates, bug fixes, performance improvements, and smooth system operations."
              },
              {
                title: "Business Automation Support",
                desc: "Need help with callback systems, booking tools, messaging automation, or workflow features? Our team is here."
              },
              {
                title: "Account & Service Guidance",
                desc: "Receive assistance regarding services, project status, consultations, and business solution inquiries."
              },
              {
                title: "Priority Client Support",
                desc: "We value your time and work to resolve important concerns quickly and effectively."
              }
            ].map((service) => (
              <div key={service.title} style={styles.serviceCard}>
                <h3 style={styles.serviceTitle}>{service.title}</h3>
                <p style={styles.serviceDesc}>{service.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Choose Us */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Why Choose Our Support Team</h2>
          <div style={styles.listGrid}>
            {[
              "Fast and professional responses",
              "Skilled technical and customer support staff",
              "Reliable troubleshooting and guidance",
              "Business-focused problem solving",
              "Long-term client assistance",
              "Clear communication and dependable service"
            ].map((item) => (
              <div key={item} style={styles.listItem}>
                <div style={styles.listDot} />
                <span style={styles.listText}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Support */}
        <section style={styles.contactSection}>
          <h2 style={styles.subHeadingCenter}>Contact Support</h2>
          <div style={styles.contactGrid}>
            <div style={styles.contactCard}>
              <span style={styles.contactLabel}>General Support</span>
              <a href="mailto:support@websmithdigital.com" style={styles.contactLink}>support@websmithdigital.com</a>
            </div>
            <div style={styles.contactCard}>
              <span style={styles.contactLabel}>Sales & Business</span>
              <a href="mailto:sales@websmithdigital.com" style={styles.contactLink}>sales@websmithdigital.com</a>
            </div>
            <div style={styles.contactCard}>
              <span style={styles.contactLabel}>Mobile</span>
              <span style={styles.contactValue}>+91 ____________</span>
            </div>
            <div style={styles.contactCard}>
              <span style={styles.contactLabel}>Support Hours</span>
              <span style={styles.contactValue}>Mon - Sat | ____________</span>
            </div>
          </div>
        </section>

        {/* Promise */}
        <section style={styles.promiseSection}>
          <h2 style={styles.subHeadingCenter}>Our Promise</h2>
          <p style={styles.promiseText}>
            At WebSmith Digital, we don’t disappear after project delivery. We stand with our clients through every stage 
            of growth by providing dependable support, trusted service, and real solutions when they matter most.
          </p>
          <p style={styles.narrativeLarge}>
            <strong>Your success is our priority.</strong>
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
    margin: "0 0 24px 0",
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
  narrativeLarge: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.7,
    color: "var(--text-primary)",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  serviceCard: {
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  serviceTitle: {
    margin: "0 0 12px 0",
    fontSize: "17px",
    fontWeight: 700,
    color: "#007AFF",
  },
  serviceDesc: {
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
    fontWeight: 500,
  },
  contactSection: {
    padding: "48px 24px",
    borderRadius: "32px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    marginBottom: "56px",
  },
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
  },
  contactCard: {
    padding: "20px",
    borderRadius: "16px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
  },
  contactLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  contactLink: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#007AFF",
    textDecoration: "none",
  },
  contactValue: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  promiseSection: {
    textAlign: "center",
  },
  promiseText: {
    margin: "0 auto 24px auto",
    fontSize: "17px",
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    maxWidth: "700px",
  },
};
