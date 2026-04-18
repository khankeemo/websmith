import type { CSSProperties } from "react";
import { termsSections } from "../../../core/config/publicSite";
import { Card, PublicPage, Section } from "../_components/PublicPage";

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="Terms of Service"
      title="The baseline rules for using Websmith services and the platform."
      description="These terms summarize responsibilities, payment expectations, and liability limits for use of the service."
    >
      {termsSections.map((section) => (
        <Section key={section.title} title={section.title}>
          <Card>
            <div style={styles.list}>
              {section.points.map((point) => (
                <p key={point} style={styles.point}>{point}</p>
              ))}
            </div>
          </Card>
        </Section>
      ))}
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  list: { display: "grid", gap: "12px" },
  point: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: "14px" },
};
