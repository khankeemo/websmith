"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Tag,
  User,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { blogPosts } from "../../../core/config/publicSite";
import { usePublicTheme } from "../../providers/PublicThemeProvider";
import { useLeadFunnel } from "../../providers/LeadFunnelProvider";

export default function BlogPage() {
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const { openLeadServicesModal } = useLeadFunnel();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = useMemo(() => {
    const set = new Set(blogPosts.map((p) => p.category));
    return ["All", ...Array.from(set)];
  }, []);

  const filteredPosts = useMemo(() => {
    return blogPosts.filter((post) => {
      const matchesCategory =
        selectedCategory === "All" || post.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const featuredPost = blogPosts[0];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "transparent",
        color: isDark ? "#f8fafc" : "#0f172a",
        paddingTop: "48px",
        paddingBottom: "80px",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 64px)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "9999px",
            backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.08)",
            border: isDark ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid rgba(37, 99, 235, 0.2)",
            color: "#3b82f6",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "20px",
          }}
        >
          <BookOpen size={14} /> Engineering Insights &amp; Architecture
        </div>

        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 54px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: "20px",
          }}
        >
          The WebSmith{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              textShadow: "none",
            }}
          >
            Engineering Blog
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 19px)",
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
            maxWidth: "760px",
            margin: "0 auto 40px",
            lineHeight: 1.65,
          }}
        >
          Deep dives into full-stack Next.js architecture, enterprise ERP workflows, software licensing, and real-world system resilience from our engineering team.
        </p>

        {/* Search & Category Filter Bar */}
        <div
          style={{
            maxWidth: "840px",
            margin: "0 auto 52px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            alignItems: "center",
          }}
        >
          {/* Search Input */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "520px",
            }}
          >
            <Search
              size={18}
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: isDark ? "rgba(255, 255, 255, 0.4)" : "#94a3b8",
              }}
            />
            <input
              type="text"
              placeholder="Search engineering articles, topics, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px 12px 46px",
                borderRadius: "9999px",
                backgroundColor: isDark ? "rgba(13, 19, 34, 0.8)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                color: isDark ? "#ffffff" : "#0f172a",
                fontSize: "14px",
                outline: "none",
                boxShadow: isDark ? "none" : "0 2px 8px rgba(0, 0, 0, 0.04)",
              }}
            />
          </div>

          {/* Category Chips */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              justifyContent: "center",
            }}
          >
            {categories.map((category) => {
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: "9999px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    border: isSelected
                      ? "1px solid #3b82f6"
                      : isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid #e2e8f0",
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(37, 99, 235, 0.25)"
                        : "rgba(37, 99, 235, 0.1)"
                      : isDark
                      ? "rgba(255, 255, 255, 0.04)"
                      : "#ffffff",
                    color: isSelected ? "#3b82f6" : isDark ? "rgba(255, 255, 255, 0.7)" : "#64748b",
                  }}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Featured Post Hero */}
      {featuredPost && selectedCategory === "All" && !searchQuery && (
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            margin: "0 auto 56px",
            padding: "0 clamp(20px, 4vw, 64px)",
          }}
        >
          <div
            style={{
              borderRadius: "28px",
              padding: "clamp(28px, 4vw, 44px)",
              background: isDark
                ? "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(13, 19, 34, 0.9) 100%)"
                : "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, #ffffff 100%)",
              border: isDark ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid rgba(37, 99, 235, 0.2)",
              boxShadow: isDark
                ? "0 24px 60px -12px rgba(0, 0, 0, 0.6)"
                : "0 16px 40px -8px rgba(0, 0, 0, 0.06)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "32px",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  marginBottom: "14px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <Sparkles size={12} /> Featured Article
              </div>
              <h2
                style={{
                  fontSize: "clamp(22px, 3.5vw, 34px)",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  marginBottom: "14px",
                  color: isDark ? "#ffffff" : "#0f172a",
                }}
              >
                <Link
                  href={`/blog/${featuredPost.slug}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {featuredPost.title}
                </Link>
              </h2>
              <p
                style={{
                  fontSize: "15.5px",
                  lineHeight: 1.6,
                  color: isDark ? "rgba(255, 255, 255, 0.75)" : "#475569",
                  marginBottom: "24px",
                }}
              >
                {featuredPost.excerpt}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  fontSize: "13px",
                  color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b",
                  marginBottom: "24px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={14} />
                  {new Date(featuredPost.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={14} /> {featuredPost.readTime}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Tag size={14} color="#3b82f6" /> {featuredPost.category}
                </span>
              </div>
              <Link
                href={`/blog/${featuredPost.slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 24px",
                  borderRadius: "9999px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                  textDecoration: "none",
                  boxShadow: "0 6px 20px -4px rgba(37, 99, 235, 0.4)",
                }}
              >
                Read Full Story <ArrowRight size={15} />
              </Link>
            </div>

            <div
              style={{
                borderRadius: "20px",
                padding: "28px",
                backgroundColor: isDark ? "rgba(7, 11, 20, 0.8)" : "#f8fafc",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#3b82f6",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "12px",
                }}
              >
                Article Highlights
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {featuredPost.content.map((sec, i) => (
                  <div key={i} style={{ borderLeft: "2px solid #3b82f6", paddingLeft: "14px" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: isDark ? "#ffffff" : "#0f172a",
                        marginBottom: "4px",
                      }}
                    >
                      {sec.heading}
                    </div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        color: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b",
                        lineHeight: 1.4,
                      }}
                    >
                      {sec.body[0].slice(0, 120)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Articles Grid */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto 80px",
          padding: "0 clamp(20px, 4vw, 64px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <h2
            style={{
              fontSize: "clamp(20px, 3vw, 28px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: 0,
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            {selectedCategory === "All" ? "All Engineering Articles" : `${selectedCategory} Articles`}
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: isDark ? "rgba(255, 255, 255, 0.4)" : "#94a3b8",
                marginLeft: "10px",
              }}
            >
              ({filteredPosts.length})
            </span>
          </h2>
        </div>

        {filteredPosts.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              borderRadius: "20px",
              backgroundColor: isDark ? "rgba(13, 19, 34, 0.6)" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>No articles found</div>
            <p style={{ fontSize: "14px", color: isDark ? "rgba(255, 255, 255, 0.5)" : "#64748b" }}>
              Try searching for a different keyword or resetting the category filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              style={{
                marginTop: "16px",
                padding: "8px 18px",
                borderRadius: "9999px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "24px",
            }}
          >
            {filteredPosts.map((post) => (
              <article
                key={post.slug}
                style={{
                  borderRadius: "22px",
                  padding: "28px",
                  backgroundColor: isDark ? "rgba(13, 19, 34, 0.75)" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: isDark ? "none" : "0 4px 16px -2px rgba(0, 0, 0, 0.04)",
                  transition: "transform 0.2s ease, border-color 0.2s ease",
                }}
                className="wsd-blog-card"
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "14px",
                    }}
                  >
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor: isDark ? "rgba(37, 99, 235, 0.2)" : "rgba(37, 99, 235, 0.1)",
                        color: "#3b82f6",
                      }}
                    >
                      {post.category}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: isDark ? "rgba(255, 255, 255, 0.45)" : "#94a3b8",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Clock size={12} /> {post.readTime}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: "19px",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.35,
                      marginBottom: "12px",
                      color: isDark ? "#ffffff" : "#0f172a",
                    }}
                  >
                    <Link
                      href={`/blog/${post.slug}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {post.title}
                    </Link>
                  </h3>

                  <p
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.6,
                      color: isDark ? "rgba(255, 255, 255, 0.65)" : "#475569",
                      marginBottom: "20px",
                    }}
                  >
                    {post.excerpt}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "16px",
                    borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #f1f5f9",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: isDark ? "rgba(255, 255, 255, 0.45)" : "#94a3b8",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Calendar size={13} />
                    {new Date(post.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>

                  <Link
                    href={`/blog/${post.slug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#3b82f6",
                      textDecoration: "none",
                    }}
                  >
                    Read Article <ChevronRight size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Engineering Consultation Callout */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 64px)",
        }}
      >
        <div
          style={{
            padding: "52px clamp(24px, 5vw, 64px)",
            borderRadius: "28px",
            textAlign: "center",
            background: isDark
              ? "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(13, 19, 34, 0.8) 100%)"
              : "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, #ffffff 100%)",
            border: isDark ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid rgba(37, 99, 235, 0.15)",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(24px, 3.5vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "14px",
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            Want to build architectures like these?
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
              maxWidth: "600px",
              margin: "0 auto 28px",
              lineHeight: 1.6,
            }}
          >
            Partner with WebSmith to build custom web applications, multi-tenant ERP platforms, or secure software licensing systems.
          </p>

          <button
            type="button"
            onClick={() => openLeadServicesModal()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "13px 32px",
              borderRadius: "9999px",
              fontSize: "14.5px",
              fontWeight: 700,
              color: "#ffffff",
              background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 24px -4px rgba(37, 99, 235, 0.4)",
            }}
          >
            Talk to an Architect <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <style>{`
        .wsd-blog-card:hover {
          border-color: rgba(37, 99, 235, 0.4) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
