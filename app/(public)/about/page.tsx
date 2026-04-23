"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { homeFooterCta } from "../../../core/config/publicSite";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="Who We Are"
      title="WebSmith Digital"
      description="Designing smart solutions and powerful digital ecosystems that help businesses grow, automate, and stand out in a competitive world."
      cta={homeFooterCta}
    >
      <SimplePublicBody>
        {/* Intro Section */}
        <section style={styles.section}>
          <p style={styles.narrative}>
            At <strong>WebSmith Digital</strong>, we go beyond traditional software development. 
            We build powerful digital ecosystems that help businesses grow, automate, and stand out in a competitive world. 
            We don’t just create websites or apps — we design <strong>smart solutions</strong>.
          </p>
          <p style={styles.narrative}>
            From dynamic business websites to advanced applications and fully customized ERP systems, 
            our focus is on delivering tools that improve how your business operates every day. 
            With years of experience in the industry, we have built a strong and reliable team of developers, 
            designers, and working professionals. Alongside them, our own dedicated core team ensures 
            every project is handled with precision, creativity, and a deep understanding of real business needs.
          </p>
          <p style={styles.narrative}>
            What makes us different is our ability to combine <strong>innovation with practicality</strong>. 
            We develop not only websites and applications, but also unique tools and integrations that 
            enhance your business workflow directly through your digital platforms.
          </p>
        </section>

        {/* What We Do Section */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>What We Do</h2>
          <div style={styles.grid}>
            {[
              "Professional Website Development",
              "Custom Application Development",
              "ERP Solutions for Businesses",
              "Business Automation & Integration Tools",
              "Scalable and Dynamic Digital Systems"
            ].map((item) => (
              <div key={item} style={styles.featureCard}>
                <div style={styles.cardDot} />
                <span style={styles.featureText}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Mission Section */}
        <section style={styles.section}>
          <div style={styles.missionBox}>
            <h2 style={styles.subHeadingCompact}>Our Mission</h2>
            <p style={styles.missionText}>
              To empower businesses with intelligent, scalable, and user-friendly digital solutions that drive real growth and efficiency.
            </p>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Why Choose WebSmith Digital</h2>
          <div style={styles.reasonList}>
            {[
              { title: "Experienced and passionate team", desc: "A blend of industry veterans and creative professionals dedicated to your success." },
              { title: "Real-world business understanding", desc: "We don't just write code; we solve business problems with practical technical solutions." },
              { title: "Custom-built solutions, not templates", desc: "Every project is designed from the ground up to match your specific operational needs." },
              { title: "Focus on performance, scalability, and innovation", desc: "Built to handle today's needs while being ready for tomorrow's growth." },
              { title: "Commitment to long-term client success", desc: "We are your partners, not just vendors, ensuring your digital platforms continue to deliver value." }
            ].map((reason) => (
              <div key={reason.title} style={styles.reasonCard}>
                <h3 style={styles.reasonTitle}>{reason.title}</h3>
                <p style={styles.reasonDesc}>{reason.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closure Section */}
        <section style={styles.closure}>
          <p style={styles.narrativeLarge}>
            At WebSmith Digital, we don’t just build software — we build <strong>solutions that work for your business</strong>.
          </p>
          <Link href={homeFooterCta.href} style={styles.closureCta}>
            {homeFooterCta.label}
          </Link>
        </section>
      </SimplePublicBody>
      
      <style>{`
        /* Overriding global hero title size to make it more professional as requested */
        .public-page-hero-inner h1 {
          font-size: clamp(30px, 5vw, 48px) !important;
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
    marginBottom: "48px",
  },
  subHeading: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
  },
  subHeadingCompact: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    color: "#007AFF",
    marginBottom: "8px",
  },
  narrative: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    maxWidth: "1200px",
  },
  narrativeLarge: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.7,
    color: "var(--text-primary)",
    fontWeight: 500,
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  },
  featureCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 20px",
    borderRadius: "16px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  cardDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    backgroundColor: "#007AFF",
  },
  featureText: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-primary)",
  },
  missionBox: {
    padding: "32px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, rgba(0, 122, 255, 0.05) 0%, rgba(0, 122, 255, 0.02) 100%)",
    border: "1px solid rgba(0, 122, 255, 0.1)",
    textAlign: "center",
  },
  missionText: {
    margin: "0 auto",
    fontSize: "18px",
    fontStyle: "italic",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
    maxWidth: "1200px",
  },
  reasonList: {
    display: "grid",
    gap: "20px",
  },
  reasonCard: {
    padding: "20px",
    borderRadius: "16px",
    borderLeft: "4px solid #007AFF",
    backgroundColor: "var(--bg-secondary)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  reasonTitle: {
    margin: "0 0 8px 0",
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  reasonDesc: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
  },
  closure: {
    marginTop: "40px",
    padding: "48px",
    borderRadius: "32px",
    backgroundColor: "var(--bg-secondary)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
    border: "1px solid var(--border-color)",
  },
  closureCta: {
    padding: "14px 28px",
    borderRadius: "14px",
    backgroundColor: "#007AFF",
    color: "#FFF",
    fontWeight: 700,
    textDecoration: "none",
    boxShadow: "0 10px 20px rgba(0, 122, 255, 0.2)",
  },
};
