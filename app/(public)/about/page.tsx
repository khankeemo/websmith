import Link from "next/link";
import type { CSSProperties } from "react";
import {
  aboutDifferentiators,
  aboutHighlights,
  aboutMetrics,
  homeFooterCta,
} from "../../../core/config/publicSite";
import { BulletList, Card, CardGrid, PublicPage, Section, TwoColumn } from "../_components/PublicPage";

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="About Websmith"
      title="A product delivery partner built for clarity, momentum, and trust."
      description="Websmith combines public credibility, delivery operations, and client collaboration into one connected experience so growing teams can launch with fewer gaps."
      cta={homeFooterCta}
    >
      <Section title="Mission and Vision">
        <CardGrid>
          {aboutHighlights.map((item) => (
            <Card key={item.label} accent="#007AFF">
              <p style={styles.kicker}>{item.label}</p>
              <p style={styles.body}>{item.text}</p>
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section title="What makes Websmith different" description="These are operating choices, not generic promises.">
        <CardGrid>
          {aboutDifferentiators.map((item) => (
            <Card key={item.title}>
              <h3 style={styles.heading}>{item.title}</h3>
              <p style={styles.body}>{item.description}</p>
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section title="Built around real delivery needs">
        <TwoColumn
          left={
            <Card>
              <h3 style={styles.heading}>Why clients choose us</h3>
              <BulletList
                items={[
                  "A single workspace for project updates, files, support, invoices, and communication",
                  "Delivery visibility without exposing internal-only admin workflows",
                  "Structured support and launch continuity after the build phase",
                ]}
              />
            </Card>
          }
          right={
            <Card>
              <h3 style={styles.heading}>Team snapshot</h3>
              <p style={styles.body}>
                Cross-functional operators across engineering, design, and delivery keep the work moving from idea to launch.
              </p>
              <div style={styles.metricList}>
                {aboutMetrics.map((item) => (
                  <div key={item.label} style={styles.metricRow}>
                    <p style={styles.metricLabel}>{item.label}</p>
                    <p style={styles.metricValue}>{item.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          }
        />
      </Section>

      <Section title="Start a project with us">
        <Card accent="#22C55E">
          <p style={styles.body}>
            If you need a team that can shape public experience, delivery operations, and launch support as one system, we should talk.
          </p>
          <Link href={homeFooterCta.href} style={styles.inlineCta}>
            {homeFooterCta.label}
          </Link>
        </Card>
      </Section>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  kicker: { margin: 0, color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.7, fontSize: "14px" },
  metricList: { display: "grid", gap: "12px" },
  metricRow: { paddingTop: "12px", borderTop: "1px solid var(--border-color)" },
  metricLabel: { margin: 0, fontSize: "12px", color: "#007AFF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  metricValue: { margin: "6px 0 0", color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 600 },
  inlineCta: { display: "inline-flex", marginTop: "4px", textDecoration: "none", color: "#007AFF", fontWeight: 700 },
};
