import { privacySections } from "../../../core/config/publicSite";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody, SimplePublicList, SimplePublicSection } from "../_components/SimplePublicContent";

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Privacy Policy"
      title="How Websmith handles data, cookies, and third-party services."
      description="This page explains the kinds of information we collect, why we use it, and how supporting providers fit into the platform experience."
    >
      <SimplePublicBody>
        <SimplePublicSection title="Privacy at a glance" description="A short summary before the detailed sections below.">
          <SimplePublicList
            items={[
              "We collect information required to operate the platform, support delivery work, and maintain client communication.",
              "Internal access is meant to follow operational need rather than broad visibility by default.",
              "When third-party tools are involved, they should only receive the data necessary for their specific role.",
            ]}
          />
        </SimplePublicSection>

        {privacySections.map((section) => (
          <SimplePublicSection
            key={section.title}
            title={section.title}
            description="Summary points describing the current policy intent for this area."
          >
            <SimplePublicList items={section.points} />
          </SimplePublicSection>
        ))}
      </SimplePublicBody>
    </PublicPage>
  );
}
