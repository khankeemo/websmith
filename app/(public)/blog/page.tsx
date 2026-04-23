"use client";

import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

export default function BlogPage() {
  return (
    <PublicPage
      eyebrow="Knowledge & Insights"
      title="The Official WebSmith Digital Blog"
      description="Your destination for smart ideas, business strategies, technology trends, and digital growth insights."
    >
      <SimplePublicBody>
        {/* Intro */}
        <section style={styles.section}>
          <p style={styles.narrative}>
            Welcome to the official <strong>WebSmith Digital Blog</strong>. At WebSmith Digital, we believe knowledge creates opportunity. 
            Our blog is designed to help business owners, startups, professionals, and growing companies understand how technology 
            can improve operations, attract more customers, and build stronger brands.
          </p>
          <p style={styles.narrative}>
            We share practical content based on real industry experience, modern trends, and business-focused digital solutions that create measurable results.
          </p>
        </section>

        {/* Discover Section */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>What You’ll Discover Here</h2>
          <div style={styles.grid}>
            {[
              {
                title: "Business Growth & Digital Strategy",
                desc: "Learn how businesses can grow using modern websites, automation systems, online visibility, and scalable technology solutions."
              },
              {
                title: "Website & Application Insights",
                desc: "Explore best practices for professional website development, business apps, user experience, speed optimization, and performance-driven design."
              },
              {
                title: "ERP & Business Management Systems",
                desc: "Understand how custom ERP software can simplify daily operations, manage data efficiently, improve workflow, and increase productivity."
              },
              {
                title: "Automation & Smart Tools",
                desc: "Discover how callback systems, smart messaging, appointment booking, and workflow automation can save time and increase customer engagement."
              },
              {
                title: "SEO & Online Visibility",
                desc: "Read practical tips on search engine optimization, content structuring, keyword strategy, and improving discoverability through search."
              },
              {
                title: "Marketing & Brand Presence",
                desc: "Stay updated with modern digital marketing methods, branding techniques, audience growth strategies, and customer retention ideas."
              },
              {
                title: "Technology Trends",
                desc: "Get insights into emerging tools, AI integrations, business software trends, and innovations shaping the future of digital business."
              }
            ].map((topic) => (
              <div key={topic.title} style={styles.topicCard}>
                <h3 style={styles.topicTitle}>{topic.title}</h3>
                <p style={styles.topicDesc}>{topic.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Read Section */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Why Read the WebSmith Digital Blog</h2>
          <div style={styles.listGrid}>
            {[
              "Business-focused and practical content",
              "Easy-to-understand professional insights",
              "Real solutions for real business challenges",
              "Helpful tips for startups and growing brands",
              "Updated knowledge from experienced professionals",
              "Technology explained in a business-friendly way"
            ].map((item) => (
              <div key={item} style={styles.listItem}>
                <div style={styles.listDot} />
                <span style={styles.listText}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Who It's For */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Who This Blog Is For</h2>
          <div style={styles.chipContainer}>
            {["Business Owners", "Startups", "Entrepreneurs", "Marketing Teams", "Operations Managers", "Developers & Designers", "Growing Companies"].map(label => (
              <span key={label} style={styles.chip}>{label}</span>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section style={styles.missionBox}>
          <h2 style={styles.subHeadingCenter}>Our Mission</h2>
          <p style={styles.missionText}>
            To educate, guide, and empower businesses with valuable knowledge that helps them make smarter digital decisions and achieve long-term success.
          </p>
        </section>

        {/* Stay Connected */}
        <section style={styles.closure}>
          <h2 style={styles.subHeadingCenter}>Stay Ahead of the Curve</h2>
          <p style={styles.narrativeCenter}>
            The digital world changes quickly — and we help you stay ahead. Follow the WebSmith Digital Blog for fresh insights, 
            smart strategies, and powerful ideas that move your business forward.
          </p>
          <p style={styles.narrativeLarge}>
            At WebSmith Digital, we don’t just build solutions — <strong>we share the knowledge behind them.</strong>
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
    fontSize: "14px",
    fontWeight: 700,
    color: "#007AFF",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  narrative: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    maxWidth: "850px",
  },
  narrativeCenter: {
    margin: "0 auto 24px auto",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
  },
  topicCard: {
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  topicTitle: {
    margin: "0 0 12px 0",
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  topicDesc: {
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
  chipContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  chip: {
    padding: "8px 16px",
    borderRadius: "999px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  missionBox: {
    padding: "48px 24px",
    borderRadius: "32px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    marginBottom: "56px",
    textAlign: "center",
  },
  missionText: {
    margin: "0 auto",
    fontSize: "20px",
    lineHeight: 1.6,
    color: "var(--text-primary)",
    maxWidth: "700px",
    fontWeight: 500,
  },
  closure: {
    padding: "48px 24px",
    textAlign: "center",
  },
};
