import type { CSSProperties } from "react";
import { privacySections } from "../../../core/config/publicSite";
import { Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Privacy Policy"
      title="How Websmith handles data, cookies, and third-party services."
      description="This page explains the kinds of information we collect, why we use it, and how supporting providers fit into the platform experience."
    >
      <Section title="Privacy at a glance" description="A short summary before the detailed sections below.">
        <CardGrid>
          <Card accent="#007AFF">
            <h3 style={styles.heading}>Use what is needed</h3>
            <p style={styles.point}>We collect information required to operate the platform, support delivery work, and maintain client communication.</p>
          </Card>
          <Card accent="#22C55E">
            <h3 style={styles.heading}>Limit unnecessary access</h3>
            <p style={styles.point}>Internal access is meant to follow operational need rather than broad visibility by default.</p>
          </Card>
          <Card accent="#F59E0B">
            <h3 style={styles.heading}>Be clear about providers</h3>
            <p style={styles.point}>When third-party tools are involved, they should only receive the data necessary for their specific role.</p>
          </Card>
        </CardGrid>
      </Section>

      {privacySections.map((section) => (
        <Section key={section.title} title={section.title} description="Summary points describing the current policy intent for this area.">
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
