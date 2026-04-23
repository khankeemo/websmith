"use client";

import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="Compliance"
      title="Terms of Service — WebSmith Digital"
      description="These terms govern your access to and use of our website, digital platforms, software, applications, and professional services."
    >
      <SimplePublicBody>


        <section style={styles.sectionHeader}>
          <p style={styles.narrative}>
            Welcome to <strong>WebSmith Digital</strong>. These Terms of Service (“Terms”) govern your access to and use of our 
            website, digital platforms, software, applications, business solutions, and professional services provided by 
            WebSmith Digital.
          </p>
          <p style={styles.narrative}>
            By accessing our website, requesting services, using our systems, or engaging with our team, you agree to these Terms. 
            If you do not agree, please do not use our services.
          </p>
        </section>

        {/* 1-5 */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>1. About WebSmith Digital</h2>
          <p style={styles.narrative}>WebSmith Digital provides professional digital services including Website development, App development, ERP Solutions, Automation Tools, and Consultation.</p>
          <p style={styles.contactInfo}>
            Email: <a href="mailto:support@websmithdigital.com">support@websmithdigital.com</a> | Phone: +91 ____________
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>2. Eligibility</h2>
          <p style={styles.narrative}>By using our services, you confirm you are legally capable, authorized to act for your business, and will provide lawful, accurate information.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>3. Scope of Services</h2>
          <p style={styles.narrative}>Services are custom defined in project proposals, quotations, or statements of work which supplement these master Terms.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>4. Client Responsibilities</h2>
          <p style={styles.narrative}>Clients must provide accurate requirements, timely feedback, and maintain rights to materials provided. Delays in client feedback may affect delivery timelines.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>5. Payments & Billing</h2>
          <p style={styles.narrative}>Fees are quoted in advance. Milestones or deposits may be required. Delayed payments may pause work. Paid amounts are generally non-refundable once work has commenced.</p>
        </section>

        {/* 6-9 */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>6. Revisions & Change Requests</h2>
          <p style={styles.narrative}>Reasonable revisions are included as per proposal. Major redesigns or features added later may require revised pricing and timelines.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>7. Delivery Timelines</h2>
          <p style={styles.narrative}>Timelines are estimates based on complexity and client responsiveness. We are not responsible for delays caused by third-party APIs, hosting providers, or force majeure.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>8. Intellectual Property</h2>
          <p style={styles.narrative}>Clients retain ownership of materials provided. Ownership of final deliverables transfers to the client after full payment, excluding reusable libraries, pre-existing tools, and third-party licenses.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>9. Acceptable Use</h2>
          <p style={styles.narrative}>Abusive conduct, fraud, IP infringement, malware distribution, or hacking results in immediate suspension of services.</p>
        </section>

        {/* 10-15 */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>10. Third-Party Services</h2>
          <p style={styles.narrative}>We use third-party providers (Hosting, Payment Gateways, APIs) governed by their own terms. We are not liable for their outages or policy changes.</p>
        </section>

        <div style={styles.grid}>
          <section style={styles.section}>
            <h2 style={styles.subHeading}>11. Support</h2>
            <p style={styles.narrative}>Availability depends on your selected maintenance plan. New features or migrations are billable separately.</p>
          </section>
          <section style={styles.section}>
            <h2 style={styles.subHeading}>12. Data & Privacy</h2>
            <p style={styles.narrative}>Subject to our Privacy Policy. Clients are responsible for data backups unless explicitly included in the contract.</p>
          </section>
        </div>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>13. Limitation of Liability</h2>
          <p style={styles.narrative}>Liability is generally limited to the amount paid for the specific service in question. We are not liable for indirect or consequential damages.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>14. Indemnification</h2>
          <p style={styles.narrative}>You agree to hold WebSmith Digital harmless from claims arising from your content, misuse of service, or violation of third-party rights.</p>
        </section>

        {/* 16-19 */}
        <div style={styles.grid}>
          <section style={styles.section}>
            <h2 style={styles.subHeading}>16. Governing Law</h2>
            <p style={styles.narrative}>Governed by laws of India and/or relevant laws of the USA where applicable by operation.</p>
          </section>
          <section style={styles.section}>
            <h2 style={styles.subHeading}>17. Force Majeure</h2>
            <p style={styles.narrative}>Not liable for delays caused by natural disasters, cyberattacks, or utility failures.</p>
          </section>
        </div>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>18. Changes to Terms</h2>
          <p style={styles.narrative}>We may update these Terms periodically. Continued use constitutes acceptance of revised terms.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subHeading}>19. Contact</h2>
          <p style={styles.contactInfo}>
            Email: <a href="mailto:support@websmithdigital.com">support@websmithdigital.com</a><br />
            Phone: +91 ____________
          </p>
        </section>

        {/* MAINTENANCE AGREEMENT SECTION */}
        <div style={styles.agreementBlock}>
          <h2 style={styles.agreementTitle}>Service Change Request & Maintenance Agreement</h2>
          <p style={styles.agreementIntro}>This supplemental agreement defines permitted changes during development and post-delivery maintenance terms.</p>
          
          <div style={styles.innerGrid}>
            <div style={styles.innerBox}>
              <h3 style={styles.innerBoxTitle}>Included Change Requests</h3>
              <p style={styles.innerBoxText}>During active development:</p>
              <ul style={styles.agreementList}>
                <li>Static Website: Up to 3 minor changes</li>
                <li>Dynamic Website: Up to 6 changes</li>
                <li>ERP / App: Up to 9 approved changes</li>
              </ul>
              <p style={styles.minorDef}>* Minor changes include color, text, images, and layout refinements.</p>
            </div>
            
            <div style={styles.innerBox}>
              <h3 style={styles.innerBoxTitle}>Billable Work</h3>
              <ul style={styles.agreementList}>
                <li>Full redesign after approval</li>
                <li>New modules or extra pages</li>
                <li>3rd party integrations added later</li>
                <li>Major database changes</li>
              </ul>
            </div>
          </div>

          <div style={styles.sectionSmall}>
            <h3 style={styles.innerSubTitle}>After Project Completion</h3>
            <p style={styles.narrative}>Once handover is done, free revision periods end. Ongoing updates, security monitoring, and performance checks are handled via our <strong>Annual Maintenance Contract (AMC)</strong>.</p>
          </div>

          <div style={styles.sectionSmall}>
            <h3 style={styles.innerSubTitle}>AMC Services May Include</h3>
            <div style={styles.chipRow}>
               {["Routine Updates", "Technical Monitoring", "Security Checks", "Minor Edits", "Backup Support", "Bug Assistance"].map(s => (
                 <span key={s} style={styles.agreementChip}>{s}</span>
               ))}
            </div>
          </div>
        </div>

        <section style={styles.disclaimer}>
          <h3 style={styles.disclaimerTitle}>Important Legal Note</h3>
          <p style={styles.disclaimerText}>
            This is a professional general Terms of Service template and should be reviewed by a qualified lawyer 
            in relevant jurisdictions (India/USA) before final publication.
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
  sectionHeader: {
    display: "grid",
    gap: "16px",
    marginBottom: "48px",
  },
  section: {
    display: "grid",
    gap: "12px",
    marginBottom: "32px",
  },
  sectionSmall: {
    display: "grid",
    gap: "12px",
    marginTop: "24px",
  },
  subHeading: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  narrative: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.7,
    color: "var(--text-secondary)",
  },
  contactInfo: {
    fontSize: "15px",
    color: "var(--text-primary)",
    fontWeight: 500,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "24px",
  },
  agreementBlock: {
    marginTop: "64px",
    padding: "40px",
    borderRadius: "32px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  agreementTitle: {
    margin: "0 0 16px 0",
    fontSize: "24px",
    fontWeight: 800,
    color: "var(--text-primary)",
    letterSpacing: "-0.03em",
  },
  agreementIntro: {
    fontSize: "16px",
    color: "var(--text-secondary)",
    marginBottom: "32px",
  },
  innerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  innerBox: {
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
  },
  innerBoxTitle: {
    margin: "0 0 16px 0",
    fontSize: "15px",
    fontWeight: 700,
    color: "#007AFF",
    textTransform: "uppercase",
  },
  innerBoxText: {
    fontSize: "14px",
    color: "var(--text-primary)",
    fontWeight: 600,
    marginBottom: "12px",
  },
  agreementList: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: 1.8,
  },
  minorDef: {
    marginTop: "16px",
    fontSize: "12px",
    fontStyle: "italic",
    color: "var(--text-secondary)",
  },
  innerSubTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  agreementChip: {
    padding: "6px 12px",
    borderRadius: "8px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontWeight: 600,
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
