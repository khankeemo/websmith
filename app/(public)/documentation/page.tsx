import type { CSSProperties } from "react";
import { documentationHighlights, documentationSections } from "../../../core/config/publicSite";
import { Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function DocumentationPage() {
  return (
    <PublicPage
      eyebrow="Documentation"
      title="A clear guide to how the platform works and how delivery flows through it."
      description="Explore onboarding, capabilities, integrations, and support pathways in a way that feels closer to a real product guide than a placeholder docs page."
    >
      <Section title="Documentation overview" description="These highlights explain what the platform is trying to make easier for clients and delivery teams.">
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

      <Section title="Quick start" description="If you are new to the platform, this is the shortest useful path through the docs.">
        <CardGrid>
          <Card accent="#007AFF">
            <h3 style={styles.heading}>1. Understand the flow</h3>
            <p style={styles.body}>Start with onboarding and features overview so you can see how public experience and client operations connect.</p>
          </Card>
          <Card accent="#22C55E">
            <h3 style={styles.heading}>2. Review integrations</h3>
            <p style={styles.body}>Check the integrations section if you need to understand payments, notifications, or platform-connected workflows.</p>
          </Card>
          <Card accent="#F59E0B">
            <h3 style={styles.heading}>3. Keep support close</h3>
            <p style={styles.body}>Use the FAQ and support references when you need fast orientation without digging through internal details.</p>
          </Card>
        </CardGrid>
      </Section>

      <Section title="Docs" description="Browse the main sections below. The left rail acts as a lightweight table of contents.">
        <div style={styles.docsLayout} className="public-page-docs-layout">
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
  sidebar: { position: "sticky", top: "88px", display: "grid", gap: "12px", padding: "18px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 76%, transparent) 0%, color-mix(in srgb, var(--bg-secondary) 92%, #007AFF 8%) 100%)" },
  sidebarLabel: { margin: 0, color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  sidebarLinks: { display: "grid", gap: "10px" },
  sidebarLink: { textDecoration: "none", color: "var(--text-secondary)", fontWeight: 600, fontSize: "14px" },
  contentPanel: { display: "grid", gap: "14px" },
  docBlock: { padding: "22px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 76%, transparent) 0%, color-mix(in srgb, var(--bg-secondary) 92%, #007AFF 8%) 100%)" },
  docHeader: { display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" },
  docIcon: { color: "#007AFF", display: "inline-flex" },
  docList: { display: "grid", gap: "12px" },
  docListItem: { display: "flex", gap: "10px", alignItems: "flex-start", color: "var(--text-secondary)", lineHeight: 1.7 },
  docDot: { width: "8px", height: "8px", borderRadius: "999px", marginTop: "8px", backgroundColor: "#22C55E", flexShrink: 0 },
};
