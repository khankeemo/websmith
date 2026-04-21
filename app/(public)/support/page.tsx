import Link from "next/link";
import type { CSSProperties } from "react";
import { supportFaqs, supportStatus } from "../../../core/config/publicSite";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody, SimplePublicList, SimplePublicSection } from "../_components/SimplePublicContent";

export default function SupportPage() {
  return (
    <PublicPage
      eyebrow="Support"
      title="Need help with delivery, access, billing, or a live issue?"
      description="Support is designed to give clients a clear next action, quick routing, and a response path that feels steady instead of confusing."
      cta={{ href: "/#contact", label: "Contact Support" }}
    >
      <SimplePublicBody>
        <SimplePublicSection
          title={supportStatus.label}
          description="A quick signal for the main support-facing systems and delivery operations."
        >
          <div style={styles.statusRow}>
            <span style={styles.statusPill}>{supportStatus.state}</span>
            <p style={styles.body}>{supportStatus.detail}</p>
          </div>
        </SimplePublicSection>

        <SimplePublicSection title="What support can help with">
          <SimplePublicList
            items={[
              "Client access and account issues, including login trouble, portal questions, access flow confusion, and workspace orientation.",
              "Billing and project coordination, including invoice follow-up, milestone clarification, delivery questions, and administrative support.",
              "Launch and live-product concerns, including escalations for active issues, release questions, and requests that need the right team quickly.",
            ]}
          />
        </SimplePublicSection>

        <SimplePublicSection title="Frequently asked questions">
          {supportFaqs.map((faq) => (
            <div key={faq.question} style={styles.faqBlock}>
              <h3 style={styles.heading}>{faq.question}</h3>
              <p style={styles.body}>{faq.answer}</p>
            </div>
          ))}
        </SimplePublicSection>

        <SimplePublicSection
          title="Contact support"
          description="If the answer is not already here, the landing-page form is the fastest way to route the request into the main support flow."
        >
          <p style={styles.body}>
            For account, billing, project, or launch support, use the landing page contact form or email{" "}
            <a href="mailto:support@websmith.dev" style={styles.link}>
              support@websmith.dev
            </a>
            .
          </p>
          <Link href="/#contact" style={styles.link} className="simple-public-link">
            Open the landing page contact form
          </Link>
        </SimplePublicSection>
      </SimplePublicBody>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  statusRow: { display: "grid", gap: "12px" },
  faqBlock: { display: "grid", gap: "10px", paddingTop: "18px", borderTop: "1px solid var(--border-color)" },
  statusPill: { display: "inline-flex", width: "fit-content", padding: "6px 10px", borderRadius: "999px", backgroundColor: "rgba(34, 197, 94, 0.14)", color: "#16A34A", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  body: { margin: 0, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: "15px" },
  link: { color: "#007AFF", textDecoration: "none", fontWeight: 700 },
};
