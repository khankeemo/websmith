"use client";

import React from "react";
import { Mail, MessageCircle, HelpCircle } from "lucide-react";

export default function SupportPage() {
  const faqs = [
    { q: "How do I start a new project?", a: "Go to the Services section, select your requirements, and our team will get back to you with a tailored technical blueprint." },
    { q: "Can I choose my own development team?", a: "Yes, once your project is scoped, we provide a selection of vetted senior developers for your approval." },
    { q: "What is the typical turnaround time?", a: "For MVPs, we typically deliver within 4-8 weeks. Specialized consulting projects vary by scope." }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.hero}>
          <HelpCircle size={48} color="#007AFF" style={{ marginBottom: 20 }} />
          <h1 style={styles.title}>Support Center</h1>
          <p style={styles.lead}>We're here to help you solve your technical challenges.</p>
        </div>

        <section style={styles.section}>
          <h2 style={styles.subtitle}>Frequently Asked Questions</h2>
          <div style={styles.faqList}>
            {faqs.map((faq, i) => (
              <div key={i} style={styles.faqItem}>
                <h4 style={styles.question}>{faq.q}</h4>
                <p style={styles.answer}>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.contactCard}>
          <h2 style={styles.subtitle}>Still need help?</h2>
          <p style={styles.text}>Our support team is available 24/7 to assist with any platform or project-related inquiries.</p>
          
          <div style={styles.methods}>
            <div style={styles.method}>
              <Mail size={24} color="#007AFF" />
              <div style={styles.methodText}>
                <p style={styles.methodLabel}>Email Support</p>
                <a href="mailto:support@websmith.com" style={styles.methodValue}>support@websmith.com</a>
              </div>
            </div>
            <div style={styles.method}>
              <MessageCircle size={24} color="#007AFF" />
              <div style={styles.methodText}>
                <p style={styles.methodLabel}>Client Portal</p>
                <p style={styles.methodValue}>Response within 2 hours</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "80vh",
    padding: "80px 24px",
    backgroundColor: "#FBFBFE",
  },
  content: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  hero: {
    textAlign: "center",
    marginBottom: "64px",
  },
  title: {
    fontSize: "48px",
    fontWeight: 700,
    marginBottom: "12px",
    color: "#1C1C1E",
  },
  lead: {
    fontSize: "20px",
    color: "#6C6C70",
  },
  section: {
    marginBottom: "64px",
  },
  subtitle: {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "24px",
    color: "#1C1C1E",
  },
  faqList: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  faqItem: {
    padding: "24px",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  question: {
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "8px",
    color: "#1C1C1E",
  },
  answer: {
    fontSize: "16px",
    lineHeight: 1.6,
    color: "#48484A",
  },
  contactCard: {
    backgroundColor: "#FFFFFF",
    padding: "48px",
    borderRadius: "24px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
    textAlign: "center",
  },
  text: {
    fontSize: "18px",
    color: "#6C6C70",
    marginBottom: "32px",
    lineHeight: 1.6,
  },
  methods: {
    display: "flex",
    justifyContent: "center",
    gap: "48px",
    flexWrap: "wrap",
  },
  method: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    textAlign: "left",
  },
  methodText: {
    display: "flex",
    flexDirection: "column",
  },
  methodLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#8E8E93",
  },
  methodValue: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1C1C1E",
    textDecoration: "none",
  },
};
