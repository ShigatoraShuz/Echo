import { PolicyBlock, PublicTextPage } from "@/features/public-content";

export default function PrivacyPolicyPage() {
  return (
    <PublicTextPage
      title="Privacy policy"
      description="A clear privacy baseline for a product that handles sensitive reflections."
      imageKey="plantDeskWarmLight"
    >
      <div className="space-y-4">
        <PolicyBlock title="Private reflections">
          Journal content is treated as private by default. Future backend storage should preserve explicit consent and export controls.
        </PolicyBlock>
        <PolicyBlock title="Signal summaries">
          Mood, distress, and facial analysis summaries are reflective signals only. They are not diagnosis or clinical assessment.
        </PolicyBlock>
        <PolicyBlock title="Control">
          Users should be able to review, export, and delete their information as backend services are connected.
        </PolicyBlock>
      </div>
    </PublicTextPage>
  );
}
