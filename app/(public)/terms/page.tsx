import type { CSSProperties } from "react";
import { termsSections } from "../../../core/config/publicSite";
import { Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="Terms of Service"
      title="The baseline rules for using Websmith services and the platform."
      description="These terms summarize responsibilities, payment expectations, and liability boundaries for using the service and working with the team."
    >
      <Section title="Terms at a glance" description="A quick summary before the detailed policy sections.">
        <CardGrid>
          <Card accent="#007AFF">
            <h3 style={styles.heading}>Use the platform responsibly</h3>
            <p style={styles.point}>Accounts should be used lawfully, with accurate information and reasonable attention to security.</p>
          </Card>
          <Card accent="#22C55E">
            <h3 style={styles.heading}>Commercial terms matter</h3>
            <p style={styles.point}>Project scope, payment timing, and refund expectations depend on the agreed commercial arrangement.</p>
          </Card>
          <Card accent="#F59E0B">
            <h3 style={styles.heading}>Liability is limited</h3>
            <p style={styles.point}>The service is provided within clear limits rather than open-ended responsibility for every downstream outcome.</p>
          </Card>
        </CardGrid>
      </Section>

      {termsSections.map((section) => (
        <Section key={section.title} title={section.title} description="These points summarize the current baseline for this area of the service relationship.">
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
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  list: { display: "grid", gap: "12px" },
  point: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: "14px" },
};
