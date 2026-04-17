"use client";

import React from "react";

export default function TermsPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Terms of Service</h1>
        <p style={styles.lastUpdated}>Last Updated: October 17, 2024</p>
        
        <section style={styles.section}>
          <h2 style={styles.subtitle}>1. Acceptance of Terms</h2>
          <p style={styles.text}>
            By accessing or using the Websmith platform, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>2. Services Provided</h2>
          <p style={styles.text}>
            Websmith provides on-demand technical talent and project delivery services. We act as a platform connecting clients with specialized developers. Specific project terms and delivery milestones are governed by individual service agreements.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>3. User 	Responsibilities</h2>
          <p style={styles.text}>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information when using our services.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>4. Intellectual Property</h2>
          <p style={styles.text}>
            Unless otherwise agreed in a separate service agreement, all project deliverables and code created through the Websmith platform are the property of the client upon full payment. The platform infrastructure and branding remain the property of Websmith.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>5. Limitation of Liability</h2>
          <p style={styles.text}>
            Websmith shall not be liable for any indirect, incidental, or consequential damages arising out of or in connection with the use of our platform or services.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>6. Governing Law</h2>
          <p style={styles.text}>
            These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Websmith is headquartered.
          </p>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "80vh",
    padding: "80px 24px",
    backgroundColor: "#FFFFFF",
    color: "#1C1C1E",
  },
  content: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  title: {
    fontSize: "36px",
    fontWeight: 700,
    marginBottom: "8px",
  },
  lastUpdated: {
    fontSize: "14px",
    color: "#8E8E93",
    marginBottom: "40px",
  },
  section: {
    marginBottom: "32px",
  },
  subtitle: {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "12px",
  },
  text: {
    fontSize: "16px",
    lineHeight: 1.6,
    color: "#48484A",
    marginBottom: "12px",
  },
};
