import Link from "next/link";
import type { CSSProperties } from "react";
import { blogCategories, blogPosts } from "../../../core/config/publicSite";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody, SimplePublicSection } from "../_components/SimplePublicContent";

export default function BlogPage() {
  const featuredPost = blogPosts[0];
  const remainingPosts = blogPosts.slice(1);

  return (
    <PublicPage
      eyebrow="Blog"
      title="Notes from the work behind modern product delivery."
      description="Writing on development, design, operations, and the practical decisions that make client delivery feel smoother and more credible."
    >
      <SimplePublicBody>
        <SimplePublicSection
          title="Editorial themes"
          description="These categories reflect the kinds of decisions we keep running into while building and supporting digital products."
        >
          <div style={styles.categoryRow}>
            {blogCategories.map((category) => (
              <span key={category} style={styles.categoryBadge} className="simple-public-chip">
                {category}
              </span>
            ))}
          </div>
        </SimplePublicSection>

        {featuredPost ? (
          <SimplePublicSection
            title="Featured article"
            description="Start with the newest or most representative piece before browsing the rest of the archive."
          >
            <article style={styles.postBlock}>
              <div style={styles.metaRow}>
                <span style={styles.categoryTag}>{featuredPost.category}</span>
                <span style={styles.metaText}>{featuredPost.readTime}</span>
              </div>
              <h2 style={styles.featureHeading}>{featuredPost.title}</h2>
              <p style={styles.body}>{featuredPost.excerpt}</p>
              <p style={styles.metaText}>{new Date(featuredPost.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              <Link href={`/blog/${featuredPost.slug}`} style={styles.link} className="simple-public-link">
                Read featured article
              </Link>
            </article>
          </SimplePublicSection>
        ) : null}

        <SimplePublicSection
          title="Latest articles"
          description="Short, readable articles built around product decisions, not filler content."
        >
          {remainingPosts.map((post) => (
            <article key={post.slug} style={styles.postBlock}>
              <div style={styles.metaRow}>
                <span style={styles.categoryTag}>{post.category}</span>
                <span style={styles.metaText}>{post.readTime}</span>
              </div>
              <h2 style={styles.heading}>{post.title}</h2>
              <p style={styles.body}>{post.excerpt}</p>
              <p style={styles.metaText}>{new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              <Link href={`/blog/${post.slug}`} style={styles.link} className="simple-public-link">
                Read article
              </Link>
            </article>
          ))}
        </SimplePublicSection>
      </SimplePublicBody>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  postBlock: { display: "grid", gap: "12px", paddingTop: "18px", borderTop: "1px solid var(--border-color)" },
  categoryRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  categoryBadge: { padding: "10px 14px", borderRadius: "999px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", fontWeight: 600, fontSize: "13px" },
  metaRow: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  categoryTag: { color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  metaText: { margin: 0, color: "var(--text-secondary)", fontSize: "12px" },
  featureHeading: { margin: 0, fontSize: "clamp(26px, 3vw, 34px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" },
  heading: { margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: "15px" },
  link: { color: "#007AFF", textDecoration: "none", fontWeight: 700, fontSize: "14px", width: "fit-content" },
};
