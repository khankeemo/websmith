import type { CSSProperties } from "react";
import { documentationHighlights, documentationSections } from "../../../core/config/publicSite";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody, SimplePublicList, SimplePublicSection } from "../_components/SimplePublicContent";

export default function DocumentationPage() {
  return (
    <PublicPage
      eyebrow="Documentation"
      title="A clear guide to how the platform works and how delivery flows through it."
      description="Explore onboarding, capabilities, integrations, and support pathways in a way that feels closer to a real product guide than a placeholder docs page."
    >
      <SimplePublicBody>
        <SimplePublicSection
          title="Documentation overview"
          description="These highlights explain what the platform is trying to make easier for clients and delivery teams."
        >
          {documentationHighlights.map((item) => (
            <div key={item.title} style={styles.itemBlock}>
              <div style={styles.docHeader}>
                <span style={styles.docIcon}>
                  <item.icon size={16} />
                </span>
                <h3 style={styles.heading}>{item.title}</h3>
              </div>
              <p style={styles.body}>{item.description}</p>
            </div>
          ))}
        </SimplePublicSection>

        <SimplePublicSection
          title="Quick start"
          description="If you are new to the platform, this is the shortest useful path through the docs."
        >
          <SimplePublicList
            items={[
              "Understand the flow first so you can see how public experience and client operations connect.",
              "Review integrations if you need to understand payments, notifications, or platform-connected workflows.",
              "Keep support close when you need fast orientation without digging through internal details.",
            ]}
          />
        </SimplePublicSection>

        <SimplePublicSection
          title="Docs"
          description="Browse the main sections below for the key parts of onboarding, platform capability, and support."
        >
          {documentationSections.map((section) => (
            <article key={section.id} id={section.id} style={styles.itemBlock}>
              <div style={styles.docHeader}>
                <span style={styles.docIcon}>
                  <section.icon size={16} />
                </span>
                <h3 style={styles.heading}>{section.title}</h3>
              </div>
              <SimplePublicList items={section.items} />
            </article>
          ))}
        </SimplePublicSection>
      </SimplePublicBody>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  itemBlock: { display: "grid", gap: "10px", paddingTop: "18px", borderTop: "1px solid var(--border-color)" },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: "15px" },
  docHeader: { display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" },
  docIcon: { color: "#007AFF", display: "inline-flex" },
};
