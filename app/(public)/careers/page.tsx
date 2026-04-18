import type { CSSProperties } from "react";
import { careerRoles, careerValues } from "../../../core/config/publicSite";
import { BulletList, Card, CardGrid, PublicPage, Section } from "../_components/PublicPage";

export default function CareersPage() {
  return (
    <PublicPage
      eyebrow="Careers"
      title="Join a team that values calm execution, strong craft, and useful collaboration."
      description="We want people who ship thoughtfully, communicate without drama, and care about making clients and teammates feel supported throughout the work."
      cta={{ href: "mailto:careers@websmith.dev", label: "Apply by Email" }}
    >
      <Section title="Why work with us" description="The environment is built for people who want meaningful ownership without chaotic process or performative urgency.">
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

      <Section title="Culture overview" description="These are the values that tend to matter most in the day-to-day working relationship.">
        <Card>
          <BulletList items={careerValues} />
        </Card>
      </Section>

      <Section title="What good work looks like here">
        <CardGrid>
          <Card>
            <h3 style={styles.heading}>Clarity over theatre</h3>
            <p style={styles.body}>We prefer honest progress, clean tradeoff thinking, and useful updates over busy-looking activity.</p>
          </Card>
          <Card>
            <h3 style={styles.heading}>Craft with context</h3>
            <p style={styles.body}>Good implementation includes product judgment, communication quality, and respect for how work connects across the system.</p>
          </Card>
          <Card>
            <h3 style={styles.heading}>Steady pace</h3>
            <p style={styles.body}>We want durable momentum, not short bursts of unsustainable output that create hidden cleanup later.</p>
          </Card>
        </CardGrid>
      </Section>

      <Section title="Open roles" description="Current opportunities reflect the roles that help us strengthen product delivery, frontend quality, and operational clarity.">
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

      <Section title="Application method" description="A concise, thoughtful application is more useful than a polished wall of buzzwords.">
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
