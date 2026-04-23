"use client";

import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Privacy"
      title="Privacy Policy — WebSmith Digital"
      description="We respect your privacy and are committed to protecting your personal information, business data, and digital interactions."
    >
      <SimplePublicBody>


        <section style={styles.section}>
          <p style={styles.narrative}>
            At <strong>WebSmith Digital</strong>, we respect your privacy and are committed to protecting your personal information, 
            business data, and digital interactions. This Privacy Policy explains how we collect, use, store, process, and protect 
            information when you use our website, services, applications, software solutions, support systems, and communication channels.
          </p>
          <p style={styles.narrative}>
            We aim to follow responsible privacy practices and applicable legal requirements, including relevant data protection, 
            cybersecurity, electronic communication, and consumer protection principles under laws and regulations that may apply 
            in India and the United States of America, depending on the nature of services, users, and jurisdiction.
          </p>
        </section>

        {/* 1. Who We Are */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>1. Who We Are</h2>
          <p style={styles.narrative}>WebSmith Digital provides professional digital services including:</p>
          <ul style={styles.list}>
            <li>Website Development</li>
            <li>Application Development</li>
            <li>ERP Solutions</li>
            <li>Automation Systems</li>
            <li>Customer Communication Tools</li>
            <li>Booking & Scheduling Platforms</li>
            <li>Digital Marketing Services</li>
            <li>Technical Support & Consultation</li>
          </ul>
          <p style={styles.narrative}>For privacy-related inquiries:</p>
          <p style={styles.contactInfo}>
            Email: <a href="mailto:support@websmithdigital.com">support@websmithdigital.com</a><br />
            Business Queries: <a href="mailto:sales@websmithdigital.com">sales@websmithdigital.com</a><br />
            Phone: +91 ____________
          </p>
        </section>

        {/* 2. Information We May Collect */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>2. Information We May Collect</h2>
          <p style={styles.narrative}>We may collect information that you voluntarily provide or that is required for service delivery.</p>
          
          <div style={styles.innerGrid}>
            <div style={styles.innerBox}>
              <h3 style={styles.innerTitle}>Personal Information</h3>
              <ul style={styles.innerList}>
                <li>Full name, Email, Phone</li>
                <li>Company name & Billing details</li>
                <li>Job title / professional info</li>
              </ul>
            </div>
            <div style={styles.innerBox}>
              <h3 style={styles.innerTitle}>Technical Information</h3>
              <ul style={styles.innerList}>
                <li>IP address & Browser type</li>
                <li>Device & Operating system</li>
                <li>Usage logs & Cookies data</li>
              </ul>
            </div>
            <div style={styles.innerBox}>
              <h3 style={styles.innerTitle}>Business & Service Data</h3>
              <ul style={styles.innerList}>
                <li>Project requirements & Files</li>
                <li>Support requests & Records</li>
                <li>ERP or system configuration</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. How We Use Information */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>3. How We Use Your Information</h2>
          <ul style={styles.list}>
            <li>Provide requested services and maintain software</li>
            <li>Deliver customer support and process consultations</li>
            <li>Improve platform performance and marketing (where lawful)</li>
            <li>Send service-related notifications and manage bookings</li>
            <li>Prevent fraud, abuse, or unauthorized access</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        {/* 4-6 */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>4. Legal Basis for Processing</h2>
          <p style={styles.narrative}>Where applicable, we may process information based on your consent, performance of a contract, legitimate business interests, or legal/regulatory obligations.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>5. Cookies & Tracking Technologies</h2>
          <p style={styles.narrative}>Our website or systems may use cookies, analytics tools, and similar technologies to improve functionality and understand usage trends. You may control cookies through browser settings.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>6. Data Sharing & Disclosure</h2>
          <p style={styles.narrative}>We do not sell personal information to third parties. We share data only when necessary with hosting providers, payment processors, cloud services, messaging platforms, and legal authorities when required.</p>
        </section>

        {/* 7-9 */}
        <div style={styles.twoCol}>
          <section style={styles.section}>
            <h2 style={styles.subHeading}>7. International Transfers</h2>
            <p style={styles.narrative}>Your information may be processed outside your jurisdiction, including India or the USA. We take reasonable safeguards for lawful transfers.</p>
          </section>
          <section style={styles.section}>
            <h2 style={styles.subHeading}>8. Data Security</h2>
            <p style={styles.narrative}>We use commercially reasonable measures (Access controls, Encryption, Backups) but absolute security cannot be guaranteed.</p>
          </section>
        </div>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>9. Data Retention</h2>
          <p style={styles.narrative}>We retain information only as long as necessary for service delivery, support history, legal compliance, and accounting records.</p>
        </section>

        {/* 10-12 Compliance */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>10. Your Privacy Rights</h2>
          <p style={styles.narrative}>Depending on location, you may have rights to access, correct, delete, or object to processing. Contact <a href="mailto:support@websmithdigital.com">support@websmithdigital.com</a>.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>11. India Compliance Notice</h2>
          <p style={styles.narrative}>We align with the IT Act 2000, IT Rules, and the Digital Personal Data Protection Act 2023 (where applicable).</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>12. USA Compliance Notice</h2>
          <p style={styles.narrative}>We align with applicable federal and state laws regarding consumer privacy rights and breach notification obligations.</p>
        </section>

        {/* 13-16 */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>13. Children’s Privacy</h2>
          <p style={styles.narrative}>Our services are intended for businesses and adults. We do not knowingly collect info from children without authorization.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>14. Third-Party Links & Services</h2>
          <p style={styles.narrative}>We are not responsible for the privacy practices of external platforms linked from our services. Please review their policies separately.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>15. Changes to This Policy</h2>
          <p style={styles.narrative}>We may update this Privacy Policy from time to time. Updated versions will be posted with revised dates.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>16. Contact Us</h2>
          <p style={styles.narrative}>For privacy, legal, or data protection matters:</p>
          <p style={styles.contactInfo}>
            <strong>WebSmith Digital</strong><br />
            Email: support@websmithdigital.com<br />
            Sales: sales@websmithdigital.com<br />
            Phone: +91 ____________
          </p>
        </section>

        {/* Disclaimer */}
        <section style={styles.disclaimer}>
          <h3 style={styles.disclaimerTitle}>Important Disclaimer</h3>
          <p style={styles.disclaimerText}>
            This Privacy Policy is a professional general template and should be reviewed by a qualified legal professional 
            licensed in relevant jurisdictions (India/USA) before final publication, especially if you collect payments, 
            health data, sensitive personal data, operate ads, or serve users in multiple countries.
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
  metaRow: {
    display: "flex",
    gap: "24px",
    fontSize: "13px",
    color: "var(--text-secondary)",
    marginBottom: "32px",
    paddingBottom: "16px",
    borderBottom: "1px solid var(--border-color)",
  },
  section: {
    display: "grid",
    gap: "16px",
    marginBottom: "40px",
  },
  subHeading: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.01em",
  },
  narrative: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.7,
    color: "var(--text-secondary)",
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
    fontSize: "15px",
    color: "var(--text-secondary)",
    lineHeight: 1.8,
  },
  contactInfo: {
    fontSize: "15px",
    color: "var(--text-primary)",
    lineHeight: 1.7,
  },
  innerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
  },
  innerBox: {
    padding: "20px",
    borderRadius: "16px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  innerTitle: {
    margin: "0 0 12px 0",
    fontSize: "15px",
    fontWeight: 700,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  innerList: {
    margin: 0,
    paddingLeft: "16px",
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "40px",
  },
  disclaimer: {
    marginTop: "48px",
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "rgba(0, 122, 255, 0.05)",
    border: "1px solid rgba(0, 122, 255, 0.1)",
  },
  disclaimerTitle: {
    margin: "0 0 12px 0",
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  disclaimerText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
    fontStyle: "italic",
  },
};
