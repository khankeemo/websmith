import type { CSSProperties } from "react";
import { privacySections } from "../../../core/config/publicSite";
import { Card, PublicPage, Section } from "../_components/PublicPage";

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Privacy Policy"
      title="How Websmith handles data, cookies, and third-party services."
      description="This page explains the categories of information we collect, why we use it, and how supporting services fit into the platform."
    >
      {privacySections.map((section) => (
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
