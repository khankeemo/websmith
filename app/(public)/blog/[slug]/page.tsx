import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { blogPosts } from "../../../../core/config/publicSite";
import { Card, PublicPage, Section } from "../../_components/PublicPage";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = blogPosts.find((entry) => entry.slug === slug);

  if (!post) notFound();

  return (
    <PublicPage
      eyebrow={post.category}
      title={post.title}
      description={`${post.readTime} • ${new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
    >
      {post.content.map((section) => (
        <Section key={section.heading} title={section.heading}>
          <Card>
            <div style={styles.content}>
              {section.body.map((paragraph) => (
                <p key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </p>
              ))}
            </div>
          </Card>
        </Section>
      ))}
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  content: { display: "grid", gap: "14px" },
  paragraph: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: "15px" },
};
