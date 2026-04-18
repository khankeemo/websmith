import Link from "next/link";
import type { CSSProperties } from "react";
import { supportFaqs, supportStatus } from "../../../core/config/publicSite";
import { Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function SupportPage() {
  return (
    <PublicPage
      eyebrow="Support"
      title="Need help with delivery, access, billing, or a live issue?"
      description="Support is structured to give clients a clear next step, fast routing, and a dependable response path."
      cta={{ href: "/#contact", label: "Contact Support" }}
    >
      <Section title={supportStatus.label}>
        <Card accent="#22C55E">
          <div style={styles.statusRow}>
            <span style={styles.statusPill}>{supportStatus.state}</span>
            <p style={styles.body}>{supportStatus.detail}</p>
          </div>
        </Card>
      </Section>

      <Section title="Frequently asked questions">
        <CardGrid>
          {supportFaqs.map((faq) => (
            <Card key={faq.question}>
              <h3 style={styles.heading}>{faq.question}</h3>
              <p style={styles.body}>{faq.answer}</p>
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section title="Contact support">
        <Card>
          <p style={styles.body}>
            For account, billing, project, or launch support, use the landing page contact form or email{" "}
            <a href="mailto:support@websmith.dev" style={styles.link}>support@websmith.dev</a>.
          </p>
          <Link href="/#contact" style={styles.link}>
            Open the landing page contact form
          </Link>
        </Card>
      </Section>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  statusRow: { display: "grid", gap: "12px" },
  statusPill: { display: "inline-flex", width: "fit-content", padding: "6px 10px", borderRadius: "999px", backgroundColor: "rgba(34, 197, 94, 0.14)", color: "#16A34A", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 },
  link: { color: "#007AFF", textDecoration: "none", fontWeight: 700 },
};
