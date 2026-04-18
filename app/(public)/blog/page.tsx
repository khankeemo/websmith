import Link from "next/link";
import type { CSSProperties } from "react";
import { blogCategories, blogPosts } from "../../../core/config/publicSite";
import { Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function BlogPage() {
  const featuredPost = blogPosts[0];
  const remainingPosts = blogPosts.slice(1);

  return (
    <PublicPage
      eyebrow="Blog"
      title="Notes from the work behind modern product delivery."
      description="Writing on development, design, operations, and the practical decisions that make client delivery feel smoother and more credible."
    >
      <Section title="Editorial themes" description="These categories reflect the kinds of decisions we keep running into while building and supporting digital products.">
        <div style={styles.categoryRow}>
          {blogCategories.map((category) => (
            <span key={category} style={styles.categoryBadge} className="public-page-chip">
              {category}
            </span>
          ))}
        </div>
      </Section>

      {featuredPost ? (
        <Section title="Featured article" description="Start with the newest or most representative piece before browsing the rest of the archive.">
          <Card accent="#007AFF">
            <div style={styles.metaRow}>
              <span style={styles.categoryTag}>{featuredPost.category}</span>
              <span style={styles.metaText}>{featuredPost.readTime}</span>
            </div>
            <h2 style={styles.featureHeading}>{featuredPost.title}</h2>
            <p style={styles.body}>{featuredPost.excerpt}</p>
            <p style={styles.metaText}>{new Date(featuredPost.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            <Link href={`/blog/${featuredPost.slug}`} style={styles.link}>
              Read featured article
            </Link>
          </Card>
        </Section>
      ) : null}

      <Section title="Latest articles" description="Short, readable articles built around product decisions, not filler content.">
        <CardGrid>
          {remainingPosts.map((post) => (
            <Card key={post.slug}>
              <div style={styles.metaRow}>
                <span style={styles.categoryTag}>{post.category}</span>
                <span style={styles.metaText}>{post.readTime}</span>
              </div>
              <h2 style={styles.heading}>{post.title}</h2>
              <p style={styles.body}>{post.excerpt}</p>
              <p style={styles.metaText}>{new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              <Link href={`/blog/${post.slug}`} style={styles.link}>
                Read article
              </Link>
            </Card>
          ))}
        </CardGrid>
      </Section>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  categoryRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  categoryBadge: { padding: "10px 14px", borderRadius: "999px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", fontWeight: 600, fontSize: "13px" },
  metaRow: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  categoryTag: { color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  metaText: { margin: 0, color: "var(--text-secondary)", fontSize: "12px" },
  featureHeading: { margin: 0, fontSize: "clamp(26px, 3vw, 34px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" },
  heading: { margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 },
  link: { color: "#007AFF", textDecoration: "none", fontWeight: 700, fontSize: "14px" },
};
