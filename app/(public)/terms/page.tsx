import { termsSections } from "../../../core/config/publicSite";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody, SimplePublicList, SimplePublicSection } from "../_components/SimplePublicContent";

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="Terms of Service"
      title="The baseline rules for using Websmith services and the platform."
      description="These terms summarize responsibilities, payment expectations, and liability boundaries for using the service and working with the team."
    >
      <SimplePublicBody>
        <SimplePublicSection title="Terms at a glance" description="A quick summary before the detailed policy sections.">
          <SimplePublicList
            items={[
              "Use the platform responsibly with accurate information and reasonable attention to security.",
              "Commercial terms matter, including project scope, payment timing, and refund expectations tied to the agreed arrangement.",
              "Liability is limited rather than open-ended for every downstream outcome.",
            ]}
          />
        </SimplePublicSection>

        {termsSections.map((section) => (
          <SimplePublicSection
            key={section.title}
            title={section.title}
            description="These points summarize the current baseline for this area of the service relationship."
          >
            <SimplePublicList items={section.points} />
          </SimplePublicSection>
        ))}
      </SimplePublicBody>
    </PublicPage>
  );
}
