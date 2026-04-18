import type { CSSProperties } from "react";
import { documentationHighlights, documentationSections } from "../../../core/config/publicSite";
import { Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function DocumentationPage() {
  return (
    <PublicPage
      eyebrow="Documentation"
      title="Everything a client needs to understand the platform and delivery flow."
      description="Explore onboarding, platform capabilities, integrations, and FAQs through a structured docs experience."
    >
      <Section title="Documentation overview">
        <CardGrid>
          {documentationHighlights.map((item) => (
            <Card key={item.title}>
              <div style={styles.iconWrap}><item.icon size={18} /></div>
              <h3 style={styles.heading}>{item.title}</h3>
              <p style={styles.body}>{item.description}</p>
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section title="Docs">
        <div style={styles.docsLayout}>
          <aside style={styles.sidebar}>
            <p style={styles.sidebarLabel}>Contents</p>
            <div style={styles.sidebarLinks}>
              {documentationSections.map((section) => (
                <a key={section.id} href={`#${section.id}`} style={styles.sidebarLink}>
                  {section.title}
                </a>
              ))}
            </div>
          </aside>
          <div style={styles.contentPanel}>
            {documentationSections.map((section) => (
              <article key={section.id} id={section.id} style={styles.docBlock}>
                <div style={styles.docHeader}>
                  <span style={styles.docIcon}><section.icon size={16} /></span>
                  <h3 style={styles.heading}>{section.title}</h3>
                </div>
                <div style={styles.docList}>
                  {section.items.map((item) => (
                    <div key={item} style={styles.docListItem}>
                      <span style={styles.docDot} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  iconWrap: { width: "40px", height: "40px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-primary)", color: "#007AFF", border: "1px solid var(--border-color)" },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 },
  docsLayout: { display: "grid", gridTemplateColumns: "minmax(220px, 0.34fr) minmax(0, 1fr)", gap: "18px", alignItems: "start" },
  sidebar: { position: "sticky", top: "88px", display: "grid", gap: "12px", padding: "18px", borderRadius: "20px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-secondary)" },
  sidebarLabel: { margin: 0, color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  sidebarLinks: { display: "grid", gap: "10px" },
  sidebarLink: { textDecoration: "none", color: "var(--text-secondary)", fontWeight: 600, fontSize: "14px" },
  contentPanel: { display: "grid", gap: "14px" },
  docBlock: { padding: "22px", borderRadius: "20px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-secondary)" },
  docHeader: { display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" },
  docIcon: { color: "#007AFF", display: "inline-flex" },
  docList: { display: "grid", gap: "12px" },
  docListItem: { display: "flex", gap: "10px", alignItems: "flex-start", color: "var(--text-secondary)", lineHeight: 1.7 },
  docDot: { width: "8px", height: "8px", borderRadius: "999px", marginTop: "8px", backgroundColor: "#22C55E", flexShrink: 0 },
};
