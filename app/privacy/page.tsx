"use client";

import React from "react";

export default function PrivacyPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Privacy Policy</h1>
        <p style={styles.lastUpdated}>Last Updated: October 17, 2024</p>
        
        <section style={styles.section}>
          <h2 style={styles.subtitle}>1. Introduction</h2>
          <p style={styles.text}>
            Websmith ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you visit our platform or use our services.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>2. Information We Collect</h2>
          <p style={styles.text}>
            We collect information that you provide directly to us, such as when you create an account, request a project quote, or communicate with our support team. This may include:
          </p>
          <ul style={styles.list}>
            <li>Name and contact information</li>
            <li>Company details and project requirements</li>
            <li>Payment information (processed securely through third-party providers)</li>
            <li>Technical data such as IP address and browser type</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>3. How We Use Your Information</h2>
          <p style={styles.text}>
            Internally, we use your data to provide, maintain, and improve our services. We also use it to communicate project updates, process transactions, and ensure the security of our development environment.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>4. Data Security</h2>
          <p style={styles.text}>
            We implement industry-standard security measures to protect your personal data. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>5. Contact Us</h2>
          <p style={styles.text}>
            If you have any questions about this Privacy Policy, please contact us at privacy@websmith.com.
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
  list: {
    fontSize: "16px",
    lineHeight: 1.6,
    color: "#48484A",
    paddingLeft: "20px",
  },
};
