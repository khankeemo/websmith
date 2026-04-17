"use client";

import React from "react";
import { Book, Code, Terminal, Zap } from "lucide-react";

export default function DocumentationPage() {
  const sections = [
    { 
      title: "Getting Started", 
      icon: Zap, 
      content: "Learn how to integrate Websmith into your existing workflow, from initial consultation to team onboarding. We provide standardized communication protocols to ensure alignment." 
    },
    { 
      title: "API Reference", 
      icon: Terminal, 
      content: "Explore our technical interfaces and deployment standards. We support a wide range of modern tech stacks and provide comprehensive integration blueprints for all project types." 
    },
    { 
      title: "Security Standards", 
      icon: Code, 
      content: "We adhere to enterprise-grade security practices, including regular code audits, secure data handling, and automated penetration testing for all critical systems." 
    }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarSticky}>
          <h3 style={styles.sidebarTitle}>Guides</h3>
          <ul style={styles.sidebarList}>
            <li style={styles.sidebarItemActive}>Introduction</li>
            <li style={styles.sidebarItem}>Platform Overview</li>
            <li style={styles.sidebarItem}>Client Dashboard</li>
            <li style={styles.sidebarItem}>Project Lifecycle</li>
          </ul>
          <h3 style={styles.sidebarTitle}>Advanced</h3>
          <ul style={styles.sidebarList}>
            <li style={styles.sidebarItem}>Custom Integrations</li>
            <li style={styles.sidebarItem}>Security & Auth</li>
          </ul>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.header}>
          <div style={styles.badge}><Book size={14} style={{ marginRight: 6 }} /> Documentation</div>
          <h1 style={styles.title}>Documentation</h1>
          <p style={styles.lead}>Complete overview of the Websmith platform, processes, and technical standards.</p>
        </div>

        <div style={styles.grid}>
          {sections.map(section => (
            <div key={section.title} style={styles.docCard}>
              <div style={styles.iconBox}><section.icon size={20} color="#007AFF" /></div>
              <h2 style={styles.docTitle}>{section.title}</h2>
              <p style={styles.docText}>{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    minHeight: "80vh",
    backgroundColor: "#FFFFFF",
  },
  sidebar: {
    width: "280px",
    borderRight: "1px solid #E5E5EA",
    padding: "40px 24px",
    display: "none", // Hidden on mobile, usually would use media query
  },
  sidebarSticky: {
    position: "sticky",
    top: "100px",
  },
  sidebarTitle: {
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#8E8E93",
    marginBottom: "16px",
    letterSpacing: "0.05em",
  },
  sidebarList: {
    listStyle: "none",
    padding: 0,
    marginBottom: "32px",
  },
  sidebarItem: {
    fontSize: "15px",
    color: "#48484A",
    padding: "8px 0",
    cursor: "pointer",
  },
  sidebarItemActive: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#007AFF",
    padding: "8px 0",
    cursor: "pointer",
  },
  main: {
    flex: 1,
    padding: "80px 60px",
    maxWidth: "1000px",
  },
  header: {
    marginBottom: "60px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#6C6C70",
    marginBottom: "16px",
  },
  title: {
    fontSize: "42px",
    fontWeight: 700,
    marginBottom: "12px",
    color: "#1C1C1E",
  },
  lead: {
    fontSize: "20px",
    color: "#6C6C70",
    lineHeight: 1.5,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "32px",
  },
  docCard: {
    padding: "32px",
    border: "1px solid #E5E5EA",
    borderRadius: "20px",
  },
  iconBox: {
    width: "40px",
    height: "40px",
    backgroundColor: "#F0F7FF",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
  },
  docTitle: {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "12px",
    color: "#1C1C1E",
  },
  docText: {
    fontSize: "16px",
    lineHeight: 1.6,
    color: "#48484A",
  },
};
