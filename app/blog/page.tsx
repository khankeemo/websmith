"use client";

import React from "react";
import Link from "next/link";

export default function BlogPage() {
  const posts = [
    {
      id: 1,
      title: "The Future of On-Demand Engineering",
      date: "Oct 12, 2024",
      excerpt: "How distributed teams are reshaping the software delivery lifecycle for modern enterprises.",
      category: "Trends"
    },
    {
      id: 2,
      title: "Scaling React Applications in 2024",
      date: "Sep 28, 2024",
      excerpt: "Best practices for performance optimization and state management in large-scale Next.js apps.",
      category: "Technical"
    },
    {
      id: 3,
      title: "Building Trust in Remote Partnerships",
      date: "Sep 15, 2024",
      excerpt: "Communication strategies that ensure transparency and alignment across time zones.",
      category: "Culture"
    }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Blog</h1>
        <p style={styles.subtitle}>Insights from the forefront of digital delivery.</p>

        <div style={styles.blogOuter}>
          {posts.map(post => (
            <article key={post.id} style={styles.postCard}>
              <span style={styles.category}>{post.category}</span>
              <h2 style={styles.postTitle}>{post.title}</h2>
              <p style={styles.date}>{post.date}</p>
              <p style={styles.excerpt}>{post.excerpt}</p>
              <Link href="#" style={styles.readMore}>Read article →</Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "80vh",
    padding: "80px 24px",
    backgroundColor: "var(--bg-primary)",
  },
  content: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  title: {
    fontSize: "48px",
    fontWeight: 700,
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "18px",
    color: "var(--text-secondary)",
    marginBottom: "60px",
  },
  blogOuter: {
    display: "flex",
    flexDirection: "column",
    gap: "40px",
  },
  postCard: {
    paddingBottom: "40px",
    borderBottom: "1px solid var(--border-color)",
  },
  category: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: "12px",
  },
  postTitle: {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "8px",
    color: "var(--text-primary)",
    cursor: "pointer",
  },
  date: {
    fontSize: "14px",
    color: "#8E8E93",
    marginBottom: "16px",
  },
  excerpt: {
    fontSize: "17px",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
    marginBottom: "20px",
  },
  readMore: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#007AFF",
    textDecoration: "none",
  },
};
