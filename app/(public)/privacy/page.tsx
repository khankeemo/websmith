"use client";

import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

type PrivacyGroup = {
  label: string;
  items: string[];
};

type PrivacySection = {
  title: string;
  body?: string;
  groups?: PrivacyGroup[];
  items?: string[];
};

const privacySections: PrivacySection[] = [
  {
    title: "Important Notice Regarding Text Messaging Data",
    body: 'Websmith Digital ("we," "us," or "our") DOES NOT share customer opt-in information, including phone numbers and consent records, with any affiliates or third parties for marketing, promotional, or any other purposes unrelated to providing our direct services. All text messaging originator opt-in data is kept strictly confidential.',
  },
  {
    title: "1. Information We Collect",
    groups: [
      {
        label: "Personal Information",
        items: [
          "Name, email address, phone number, and physical business address.",
          "Payment information when you purchase a package, make a transaction, or request a service quote.",
          "Opt-in records, timestamps, and history for all communication channels (SMS, email, etc.).",
        ],
      },
      {
        label: "Non-Personal Information",
        items: [
          "IP address, browser type, operating system, and device information.",
          "Website usage patterns, page views, navigation data, and analytics.",
          "Cookies and similar tracking technologies to enhance user experience.",
        ],
      },
      {
        label: "Customer Communication",
        items: [
          "Records of direct inquiries, support tickets, and service requests.",
          "Appointment details, scheduling preferences, and meeting briefs.",
          "Service history, project performance data, and client feedback.",
        ],
      },
    ],
  },
  {
    title: "2. How We Use Your Information",
    body: "We use the collected data for the following essential business practices:",
    groups: [
      {
        label: "Service Delivery",
        items: ["Providing, managing, maintaining, and improving our digital agency services."],
      },
      {
        label: "Transaction Processing",
        items: ["Processing financial transactions, invoicing, and secure payment handling."],
      },
      {
        label: "Client Communication",
        items: [
          "Communicating directly with you about your inquiries, active projects, ongoing account updates, promotional offerings, and scheduling alerts.",
        ],
      },
    ],
  },
  {
    title: "3. SMS Messaging & Compliance",
    body: "When you opt-in to our mobile messaging program, your phone number and text consent are strictly protected under the following guidelines:",
    items: [
      "No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.",
      "All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.",
      "You may opt-out of text messaging at any time by replying STOP to any message received.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Privacy"
      title="Privacy Policy - WebSmith Digital"
      description="Effective Date: January 1st, 2026"
    >
      <SimplePublicBody wide>
        <section style={styles.legalIntro}>
          <p style={styles.introLabel}>Websmith Digital - Privacy Policy</p>
          <p style={styles.meta}>Effective Date: January 1st, 2026</p>
          <p style={styles.introText}>
            This policy explains the information Websmith Digital collects, how it is used, and how text messaging opt-in data is protected.
          </p>
        </section>

        <div style={styles.sectionStack}>
          {privacySections.map((section) => (
            <article key={section.title} style={styles.sectionCard}>
              <h2 style={styles.subHeading}>{section.title}</h2>
              {section.body ? <p style={styles.narrative}>{section.body}</p> : null}
              {section.groups ? (
                <div style={styles.innerGrid}>
                  {section.groups.map((group) => (
                    <div key={group.label} style={styles.innerBox}>
                      <h3 style={styles.innerTitle}>{group.label}</h3>
                      <ul style={styles.innerList}>
                        {group.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
              {section.items ? (
                <ul style={styles.list}>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
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
  sectionStack: {
    display: "grid",
    gap: "18px",
    width: "100%",
  },
  sectionCard: {
    display: "grid",
    gap: "18px",
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
  meta: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
    fontSize: "15px",
    color: "var(--text-secondary)",
    lineHeight: 1.8,
  },
  innerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: "16px",
  },
  innerBox: {
    padding: "18px",
    borderRadius: "10px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
  },
  innerTitle: {
    margin: "0 0 12px 0",
    fontSize: "14px",
    fontWeight: 800,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  innerList: {
    margin: 0,
    paddingLeft: "16px",
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: 1.7,
  },
};
