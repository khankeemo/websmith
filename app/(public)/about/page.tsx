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
      title="A delivery partner designed to make product work feel clear, steady, and trustworthy."
      description="Websmith brings together public presence, execution systems, and client collaboration so teams can move from idea to launch without the usual handoff chaos."
      cta={homeFooterCta}
    >
      <Section title="What we are building" description="The company is shaped around a simple belief: delivery quality improves when communication, visibility, and execution live in the same system.">
        <CardGrid>
          {aboutHighlights.map((item) => (
            <Card key={item.label} accent="#007AFF">
              <p style={styles.kicker}>{item.label}</p>
              <p style={styles.body}>{item.text}</p>
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section title="What makes Websmith different" description="These are operating decisions that influence how projects feel day to day, not just positioning lines on a website.">
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
              <h3 style={styles.heading}>Why clients stay with us</h3>
              <BulletList
                items={[
                  "One place for updates, files, support, invoices, approvals, and delivery communication",
                  "Client-friendly visibility without exposing noisy internal-only workflows",
                  "Launch continuity so post-release support feels like part of the same engagement",
                ]}
              />
            </Card>
          }
          right={
            <Card>
              <h3 style={styles.heading}>Operating snapshot</h3>
              <p style={styles.body}>
                We work across engineering, design, and delivery operations so product progress does not stall between specialties.
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

      <Section title="How partnerships usually start" description="Most teams come to us when they need both execution and confidence: a reliable way to ship, communicate, and support the work afterward.">
        <CardGrid>
          <Card accent="#22C55E">
            <h3 style={styles.heading}>Discovery and framing</h3>
            <p style={styles.body}>We help clarify scope, constraints, milestones, and the real operating picture before delivery starts.</p>
          </Card>
          <Card accent="#F59E0B">
            <h3 style={styles.heading}>Structured delivery</h3>
            <p style={styles.body}>Once work begins, clients should always know what changed, what is blocked, and what comes next.</p>
          </Card>
          <Card accent="#007AFF">
            <h3 style={styles.heading}>Launch and continuity</h3>
            <p style={styles.body}>Documentation, support pathways, and post-launch follow-through are treated as part of the job, not cleanup work.</p>
          </Card>
        </CardGrid>
      </Section>

      <Section title="Start a project with us">
        <Card accent="#22C55E">
          <p style={styles.body}>
            If you need a team that can shape customer-facing experience, delivery systems, and support continuity as one connected flow, we should talk.
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
