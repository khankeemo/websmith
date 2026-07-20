"use client";

import type { CSSProperties, ReactNode } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

type TermsSection = {
  title: string;
  body: ReactNode;
};

const linkStyle: CSSProperties = {
  color: "#007AFF",
  fontWeight: 700,
  textDecoration: "none",
};

const termsSections: TermsSection[] = [
  {
    title: "1. Program Description",
    body: "Websmith Digital offers mobile text messaging programs to communicate with clients, partners, and leads. Upon opting in, users can expect to receive messages regarding appointment reminders, project updates, marketing promotions, service announcements, and general inquiries related to our digital agency services.",
  },
  {
    title: "2. Cancellation",
    body: 'You can cancel the SMS service at any time. Simply text "STOP" to our number. Upon sending "STOP," we will confirm your unsubscribe status via SMS. Following this confirmation, you will no longer receive SMS messages from us. To rejoin, sign up as you did initially, or reply "START", and we will resume sending SMS messages to you.',
  },
  {
    title: "3. Support & Help",
    body: (
      <>
        If you experience issues with the messaging program, reply with the keyword HELP for more assistance, or reach out directly to our support team at{" "}
        <a href="mailto:support@websmithdigital.com" style={linkStyle}>
          support@websmithdigital.com
        </a>{" "}
        or call us toll-free at{" "}
        <a href="tel:+18154269572" style={linkStyle}>
          +1 815-426-9572
        </a>
        .
      </>
    ),
  },
  {
    title: "4. Carrier Liability",
    body: "Carriers are not liable for delayed or undelivered messages.",
  },
  {
    title: "5. Fees and Frequency",
    body: "As always, message and data rates may apply for messages sent to you from us and to us from you. Message frequency varies based on user interaction and campaign types. For questions about your text plan or data plan, please contact your wireless provider.",
  },
  {
    title: "6. Privacy",
    body: (
      <>
        We respect your privacy. For inquiries related to how we collect and use your information, please refer to our Privacy Policy:{" "}
        <a href="https://websmithdigital.com/privacy" target="_blank" rel="noreferrer" style={linkStyle}>
          https://websmithdigital.com/privacy
        </a>{" "}
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="Compliance"
      title="Terms of Service - WebSmith Digital"
      description="Terms and conditions for Websmith Digital mobile messaging programs."
    >
      <SimplePublicBody wide>
        <section style={styles.legalIntro}>
          <p style={styles.introLabel}>SMS Messaging Terms</p>
          <p style={styles.introText}>
            These terms explain how Websmith Digital uses mobile text messaging for service updates, support, and client communication.
          </p>
        </section>

        <div style={styles.sectionGrid}>
          {termsSections.map((section) => (
            <article key={section.title} style={styles.sectionCard}>
              <h2 style={styles.subHeading}>{section.title}</h2>
              <p style={styles.narrative}>{section.body}</p>
            </article>
          ))}
        </div>
      </SimplePublicBody>

      <style>{`
        .public-page-hero-inner h1 {
          font-size: clamp(30px, 5vw, 42px) !important;
          letter-spacing: -0.03em !important;
        }
        @media (max-width: 640px) {
          .legal-section-card {
            padding: 18px !important;
          }
        }
      `}</style>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  legalIntro: {
    width: "100%",
    display: "grid",
    gap: "10px",
    padding: "clamp(20px, 3vw, 28px)",
    borderRadius: "12px",
    backgroundColor: "rgba(0, 122, 255, 0.06)",
    border: "1px solid rgba(0, 122, 255, 0.14)",
  },
  introLabel: {
    margin: 0,
    color: "#007AFF",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  introText: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.75,
    color: "var(--text-secondary)",
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
    gap: "18px",
    width: "100%",
  },
  sectionCard: {
    display: "grid",
    alignContent: "start",
    gap: "12px",
    minWidth: 0,
    padding: "clamp(20px, 2.5vw, 28px)",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  subHeading: {
    margin: 0,
    fontSize: "clamp(18px, 2vw, 22px)",
    fontWeight: 800,
    color: "var(--text-primary)",
    letterSpacing: "-0.01em",
  },
  narrative: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
  },
};
