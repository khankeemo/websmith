"use client";

import React from "react";

export default function AboutPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>About Us</h1>
        
        <section style={styles.section}>
          <h2 style={styles.subtitle}>Our History</h2>
          <p style={styles.text}>
            Founded in 2020, Websmith started with a simple vision: to bridge the gap between visionary entrepreneurs and world-class technical talent. What began as a small collective of senior developers has grown into a premier on-demand tech partnership agency, serving clients across six continents.
          </p>
          <p style={styles.text}>
            Over the years, we have successfully delivered over 500+ projects, ranging from rapid MVP launches for startups to complex enterprise-grade systems for established organizations.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>What We Do</h2>
          <p style={styles.text}>
            Websmith provides dedicated development teams and specialized technical consulting. We specialize in modern web technologies, mobile applications, and scalable cloud infrastructure.
          </p>
          <ul style={styles.list}>
            <li>Full-stack Web Development (React, Next.js, Node.js)</li>
            <li>Mobile App Development (iOS, Android, React Native)</li>
            <li>UI/UX Design Systems</li>
            <li>DevOps & Cloud Architecture</li>
            <li>Technical Strategy & Project Management</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>Our Mission</h2>
          <p style={styles.text}>
            Our mission is to empower businesses to scale their impact through digital excellence. We believe in transparency, technical precision, and building long-term partnerships that drive real business value.
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
    marginBottom: "40px",
    letterSpacing: "-0.02em",
  },
  section: {
    marginBottom: "48px",
  },
  subtitle: {
    fontSize: "24px",
    fontWeight: 600,
    marginBottom: "16px",
    color: "#007AFF",
  },
  text: {
    fontSize: "18px",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
    marginBottom: "16px",
  },
  list: {
    fontSize: "18px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    paddingLeft: "20px",
  },
};
