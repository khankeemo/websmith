import type { CSSProperties } from "react";
import { careerRoles, careerValues } from "../../../core/config/publicSite";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody, SimplePublicList, SimplePublicSection } from "../_components/SimplePublicContent";

export default function CareersPage() {
  return (
    <PublicPage
      eyebrow="Careers"
      title="Join a team that values calm execution, strong craft, and useful collaboration."
      description="We want people who ship thoughtfully, communicate without drama, and care about making clients and teammates feel supported throughout the work."
      cta={{ href: "mailto:careers@websmith.dev", label: "Apply by Email" }}
    >
      <SimplePublicBody>
        <SimplePublicSection
          title="Why work with us"
          description="The environment is built for people who want meaningful ownership without chaotic process or performative urgency."
        >
          <SimplePublicList
            items={[
              "Ownership with support so you can make meaningful decisions without being left to navigate ambiguity alone.",
              "Small-team impact where your work shapes client experience, product quality, and how the company operates end to end.",
              "A thoughtful pace focused on sustainable delivery instead of churn disguised as urgency.",
            ]}
          />
        </SimplePublicSection>

        <SimplePublicSection
          title="Culture overview"
          description="These are the values that tend to matter most in the day-to-day working relationship."
        >
          <SimplePublicList items={careerValues} />
        </SimplePublicSection>

        <SimplePublicSection title="What good work looks like here">
          <SimplePublicList
            items={[
              "Clarity over theatre, with honest progress, clean tradeoff thinking, and useful updates over busy-looking activity.",
              "Craft with context, where implementation includes product judgment, communication quality, and respect for how work connects across the system.",
              "A steady pace that builds durable momentum instead of short bursts that create hidden cleanup later.",
            ]}
          />
        </SimplePublicSection>

        <SimplePublicSection
          title="Open roles"
          description="Current opportunities reflect the roles that help us strengthen product delivery, frontend quality, and operational clarity."
        >
          {careerRoles.map((role) => (
            <div key={role.id} style={styles.roleBlock}>
              <div style={styles.metaRow}>
                <span style={styles.roleMeta}>{role.location}</span>
                <span style={styles.roleMeta}>{role.type}</span>
              </div>
              <h3 style={styles.heading}>{role.title}</h3>
              <p style={styles.body}>{role.summary}</p>
              <SimplePublicList items={role.responsibilities} />
              <a
                href={`mailto:careers@websmith.dev?subject=Application%20for%20${encodeURIComponent(role.title)}`}
                style={styles.link}
                className="simple-public-link"
              >
                Apply for this role
              </a>
            </div>
          ))}
        </SimplePublicSection>

        <SimplePublicSection
          title="Application method"
          description="A concise, thoughtful application is more useful than a polished wall of buzzwords."
        >
          <p style={styles.body}>
            Send your portfolio, resume, and a short note to{" "}
            <a href="mailto:careers@websmith.dev" style={styles.inlineLink}>
              careers@websmith.dev
            </a>
            . We care more about clarity and evidence of craft than polished buzzwords.
          </p>
        </SimplePublicSection>
      </SimplePublicBody>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  roleBlock: { display: "grid", gap: "14px", paddingTop: "18px", borderTop: "1px solid var(--border-color)" },
  metaRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  roleMeta: { padding: "6px 10px", borderRadius: "999px", backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: "15px" },
  link: { color: "#007AFF", textDecoration: "none", fontWeight: 700, fontSize: "14px", width: "fit-content" },
  inlineLink: { color: "#007AFF" },
};
