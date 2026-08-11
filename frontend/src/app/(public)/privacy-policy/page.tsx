import { PolicyBlock, PublicTextPage } from "@/features/public-content";

export default function PrivacyPolicyPage() {
  return (
    <PublicTextPage
      title="Privacy policy"
      description="Version 2026-07-25 · A plain-language summary of the information ECHO needs to provide a private reflection space."
      imageKey="plantDeskWarmLight"
    >
      <div className="space-y-4">
        <PolicyBlock title="Information we collect">
          We collect account details, the journal and check-in content you choose to save, preferences, trusted-contact details you add, and limited security and activity records needed to operate, protect, and improve your ECHO experience.
        </PolicyBlock>
        <PolicyBlock title="Optional AI analysis">
          AI-assisted reflection is optional. It only processes an entry when you explicitly opt in. The feature was developed for the ECHO thesis project and is not a diagnostic, emergency-monitoring, or clinical decision tool. Your private entries are not used to train the feature without separate consent.
        </PolicyBlock>
        <PolicyBlock title="Your control">
          You can review your choices, withdraw optional analysis consent, request an export, or request account deletion through ECHO settings. Some security and consent records may be retained where necessary to protect the service and document your choices.
        </PolicyBlock>
        <PolicyBlock title="Safety and sharing">
          ECHO does not sell journal content. Crisis support is not a monitoring service: if there is immediate danger, contact local emergency services or a verified crisis line.
        </PolicyBlock>
      </div>
    </PublicTextPage>
  );
}
