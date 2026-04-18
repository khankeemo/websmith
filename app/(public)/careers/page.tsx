import type { CSSProperties } from "react";
import { careerRoles, careerValues } from "../../../core/config/publicSite";
import { BulletList, Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function CareersPage() {
  return (
    <PublicPage
      eyebrow="Careers"
      title="Join a team that values calm execution and strong craft."
      description="We look for people who care about shipping well, communicating clearly, and helping clients feel confident throughout the work."
      cta={{ href: "mailto:careers@websmith.dev", label: "Apply by Email" }}
    >
      <Section title="Why work with us">
        <CardGrid>
          <Card accent="#007AFF">
            <h3 style={styles.heading}>Ownership with support</h3>
            <p style={styles.body}>You get room to make meaningful decisions without being left to navigate ambiguity alone.</p>
          </Card>
          <Card accent="#22C55E">
            <h3 style={styles.heading}>Small-team impact</h3>
            <p style={styles.body}>Your work shapes client experience, product quality, and how the company operates end to end.</p>
          </Card>
          <Card accent="#F59E0B">
            <h3 style={styles.heading}>Thoughtful pace</h3>
            <p style={styles.body}>We care about sustainable delivery, not churn disguised as urgency.</p>
          </Card>
        </CardGrid>
      </Section>

      <Section title="Culture overview">
        <Card>
          <BulletList items={careerValues} />
        </Card>
      </Section>

      <Section title="Open roles" description="Current opportunities are listed dynamically from the public site config.">
        <CardGrid>
          {careerRoles.map((role) => (
            <Card key={role.id}>
              <div style={styles.metaRow}>
                <span style={styles.roleMeta}>{role.location}</span>
                <span style={styles.roleMeta}>{role.type}</span>
              </div>
              <h3 style={styles.heading}>{role.title}</h3>
              <p style={styles.body}>{role.summary}</p>
              <BulletList items={role.responsibilities} />
              <a href={`mailto:careers@websmith.dev?subject=Application%20for%20${encodeURIComponent(role.title)}`} style={styles.link}>
                Apply for this role
              </a>
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section title="Application method">
        <Card>
          <p style={styles.body}>
            Send your portfolio, resume, and a short note to <a href="mailto:careers@websmith.dev" style={styles.inlineLink}>careers@websmith.dev</a>. We care more about clarity and evidence of craft than polished buzzwords.
          </p>
        </Card>
      </Section>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  metaRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  roleMeta: { padding: "6px 10px", borderRadius: "999px", backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.7, fontSize: "14px" },
  link: { color: "#007AFF", textDecoration: "none", fontWeight: 700, fontSize: "14px" },
  inlineLink: { color: "#007AFF" },
};
