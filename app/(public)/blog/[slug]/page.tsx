import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Tag,
  User,
  Share2,
  ChevronRight,
  BookOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { blogPosts } from "../../../../core/config/publicSite";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = blogPosts.find((entry) => entry.slug === slug);

  if (!post) notFound();

  const relatedPosts = blogPosts.filter((p) => p.slug !== slug);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "transparent",
        color: "var(--text-primary)",
        paddingTop: "40px",
        paddingBottom: "80px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "920px",
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 40px)",
        }}
      >
        {/* Breadcrumb Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "rgba(255, 255, 255, 0.5)",
            marginBottom: "32px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/blog"
            style={{
              color: "#3b82f6",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <ArrowLeft size={14} /> Engineering Blog
          </Link>
          <ChevronRight size={13} style={{ opacity: 0.4 }} />
          <span>{post.category}</span>
          <ChevronRight size={13} style={{ opacity: 0.4 }} />
          <span style={{ color: "rgba(255, 255, 255, 0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
            {post.title}
          </span>
        </div>

        {/* Article Header */}
        <div style={{ marginBottom: "40px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: 700,
              backgroundColor: "rgba(37, 99, 235, 0.2)",
              border: "1px solid rgba(37, 99, 235, 0.35)",
              color: "#3b82f6",
              marginBottom: "16px",
            }}
          >
            <Tag size={12} /> {post.category}
          </div>

          <h1
            style={{
              fontSize: "clamp(28px, 4.5vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              marginBottom: "20px",
              color: "#ffffff",
            }}
          >
            {post.title}
          </h1>

          <p
            style={{
              fontSize: "clamp(16px, 2vw, 19px)",
              lineHeight: 1.6,
              color: "rgba(255, 255, 255, 0.7)",
              marginBottom: "24px",
            }}
          >
            {post.excerpt}
          </p>

          {/* Metadata Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderRadius: "16px",
              backgroundColor: "rgba(13, 19, 34, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                WS
              </div>
              <div>
                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#ffffff" }}>
                  WebSmith Architecture Team
                </div>
                <div style={{ fontSize: "11.5px", color: "rgba(255, 255, 255, 0.45)" }}>
                  Engineering &amp; System Design
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                fontSize: "12.5px",
                color: "rgba(255, 255, 255, 0.5)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Calendar size={14} />
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Clock size={14} /> {post.readTime}
              </span>
            </div>
          </div>
        </div>

        {/* Article Body Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "60px" }}>
          {post.content.map((section, idx) => (
            <div
              key={idx}
              style={{
                padding: "32px clamp(20px, 3vw, 36px)",
                borderRadius: "20px",
                backgroundColor: "rgba(13, 19, 34, 0.75)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 10px 30px -8px rgba(0, 0, 0, 0.4)",
              }}
            >
              <h2
                style={{
                  fontSize: "clamp(18px, 2.5vw, 22px)",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  marginBottom: "16px",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "20px",
                    borderRadius: "3px",
                    backgroundColor: "#3b82f6",
                    display: "inline-block",
                  }}
                />
                {section.heading}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {section.body.map((paragraph, pIdx) => (
                  <p
                    key={pIdx}
                    style={{
                      fontSize: "15px",
                      lineHeight: 1.75,
                      color: "rgba(255, 255, 255, 0.75)",
                      margin: 0,
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Consultation Callout */}
        <div
          style={{
            padding: "36px clamp(20px, 4vw, 36px)",
            borderRadius: "24px",
            background: "linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(13, 19, 34, 0.85) 100%)",
            border: "1px solid rgba(37, 99, 235, 0.3)",
            textAlign: "center",
            marginBottom: "64px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "#3b82f6",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "10px",
            }}
          >
            <Sparkles size={14} /> Partner With Our Architects
          </div>
          <h3
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: "10px",
            }}
          >
            Need help implementing scalable digital architectures?
          </h3>
          <p
            style={{
              fontSize: "14px",
              color: "rgba(255, 255, 255, 0.7)",
              maxWidth: "540px",
              margin: "0 auto 20px",
              lineHeight: 1.6,
            }}
          >
            From custom Next.js web applications to enterprise ERP systems and license management, let's discuss your project.
          </p>
          <Link
            href="/contact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "11px 26px",
              borderRadius: "9999px",
              fontSize: "13.5px",
              fontWeight: 700,
              color: "#ffffff",
              background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
              textDecoration: "none",
              boxShadow: "0 6px 20px -4px rgba(37, 99, 235, 0.4)",
            }}
          >
            Get In Touch <ArrowRight size={15} />
          </Link>
        </div>

        {/* Related Articles */}
        <div>
          <h3
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <BookOpen size={18} color="#3b82f6" /> More from WebSmith Engineering
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {relatedPosts.map((rel) => (
              <div
                key={rel.slug}
                style={{
                  padding: "22px",
                  borderRadius: "18px",
                  backgroundColor: "rgba(13, 19, 34, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        backgroundColor: "rgba(37, 99, 235, 0.15)",
                        color: "#3b82f6",
                      }}
                    >
                      {rel.category}
                    </span>
                    <span style={{ fontSize: "11.5px", color: "rgba(255, 255, 255, 0.45)" }}>
                      {rel.readTime}
                    </span>
                  </div>
                  <h4
                    style={{
                      fontSize: "15.5px",
                      fontWeight: 700,
                      lineHeight: 1.35,
                      marginBottom: "8px",
                      color: "#ffffff",
                    }}
                  >
                    <Link
                      href={`/blog/${rel.slug}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {rel.title}
                    </Link>
                  </h4>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "rgba(255, 255, 255, 0.6)",
                      lineHeight: 1.5,
                      marginBottom: "16px",
                    }}
                  >
                    {rel.excerpt.slice(0, 95)}...
                  </p>
                </div>

                <Link
                  href={`/blog/${rel.slug}`}
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: "#3b82f6",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    textDecoration: "none",
                  }}
                >
                  Read Article <ChevronRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
