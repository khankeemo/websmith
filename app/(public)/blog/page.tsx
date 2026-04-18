import Link from "next/link";
import type { CSSProperties } from "react";
import { blogCategories, blogPosts } from "../../../core/config/publicSite";
import { Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function BlogPage() {
  return (
    <PublicPage
      eyebrow="Blog"
      title="Ideas from the work behind product delivery."
      description="Notes on development, design, and business operations from teams building better delivery systems."
    >
      <Section title="Categories">
        <div style={styles.categoryRow}>
          {blogCategories.map((category) => (
            <span key={category} style={styles.categoryBadge}>
              {category}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Latest articles" description="Card-based posts with slug-based detail pages.">
        <CardGrid>
          {blogPosts.map((post) => (
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
  heading: { margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 },
  link: { color: "#007AFF", textDecoration: "none", fontWeight: 700, fontSize: "14px" },
};
