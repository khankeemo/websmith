import Link from "next/link";
import type { CSSProperties } from "react";
import {
  aboutDifferentiators,
  aboutHighlights,
  aboutMetrics,
  homeFooterCta,
} from "../../../core/config/publicSite";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody, SimplePublicList, SimplePublicSection } from "../_components/SimplePublicContent";

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="About Websmith"
      title="A delivery partner designed to make product work feel clear, steady, and trustworthy."
      description="Websmith brings together public presence, execution systems, and client collaboration so teams can move from idea to launch without the usual handoff chaos."
      cta={homeFooterCta}
    >
      <SimplePublicBody>
        <SimplePublicSection
          title="What we are building"
          description="The company is shaped around a simple belief: delivery quality improves when communication, visibility, and execution live in the same system."
        >
          {aboutHighlights.map((item) => (
            <div key={item.label} style={styles.block}>
              <p style={styles.kicker}>{item.label}</p>
              <p style={styles.body}>{item.text}</p>
            </div>
          ))}
        </SimplePublicSection>

        <SimplePublicSection
          title="What makes Websmith different"
          description="These are operating decisions that influence how projects feel day to day, not just positioning lines on a website."
        >
          {aboutDifferentiators.map((item) => (
            <div key={item.title} style={styles.block}>
              <h3 style={styles.heading}>{item.title}</h3>
              <p style={styles.body}>{item.description}</p>
            </div>
          ))}
        </SimplePublicSection>

        <SimplePublicSection title="Built around real delivery needs">
          <h3 style={styles.heading}>Why clients stay with us</h3>
          <SimplePublicList
            items={[
              "One place for updates, files, support, invoices, approvals, and delivery communication",
              "Client-friendly visibility without exposing noisy internal-only workflows",
              "Launch continuity so post-release support feels like part of the same engagement",
            ]}
          />
          <div style={styles.metricList}>
            {aboutMetrics.map((item) => (
              <div key={item.label} style={styles.metricRow}>
                <p style={styles.metricLabel}>{item.label}</p>
                <p style={styles.metricValue}>{item.value}</p>
              </div>
            ))}
          </div>
        </SimplePublicSection>

        <SimplePublicSection
          title="How partnerships usually start"
          description="Most teams come to us when they need both execution and confidence: a reliable way to ship, communicate, and support the work afterward."
        >
          <SimplePublicList
            items={[
              "Discovery and framing to clarify scope, constraints, milestones, and the real operating picture before delivery starts.",
              "Structured delivery so clients always know what changed, what is blocked, and what comes next.",
              "Launch and continuity with documentation, support pathways, and post-launch follow-through treated as part of the job.",
            ]}
          />
        </SimplePublicSection>

        <SimplePublicSection title="Start a project with us">
          <p style={styles.body}>
            If you need a team that can shape customer-facing experience, delivery systems, and support continuity as one connected flow, we should talk.
          </p>
          <Link href={homeFooterCta.href} style={styles.inlineCta} className="simple-public-link">
            {homeFooterCta.label}
          </Link>
        </SimplePublicSection>
      </SimplePublicBody>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  block: { display: "grid", gap: "8px" },
  kicker: { margin: 0, color: "#007AFF", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: "15px" },
  metricList: { display: "grid", gap: "12px" },
  metricRow: { paddingTop: "12px", borderTop: "1px solid var(--border-color)" },
  metricLabel: { margin: 0, fontSize: "12px", color: "#007AFF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  metricValue: { margin: "6px 0 0", color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 600 },
  inlineCta: { display: "inline-flex", width: "fit-content", marginTop: "4px", textDecoration: "none", color: "#007AFF", fontWeight: 700 },
};
