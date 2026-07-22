import { PolicyBlock, PublicTextPage } from "@/features/public-content";

export default function TermsPage() {
  return (
    <PublicTextPage
      title="Terms of use"
      description="Simple use terms for the current ECHO interface and future backend-backed app."
      imageKey="calmChairPlant"
    >
      <div className="space-y-4">
        <PolicyBlock title="Supportive use">
          ECHO is intended for reflection, journaling, and wellbeing organization. It is not a diagnostic tool.
        </PolicyBlock>
        <PolicyBlock title="Emergency situations">
          If you or someone else may be in immediate danger, call emergency services or a local crisis line.
        </PolicyBlock>
        <PolicyBlock title="Mock data">
          The current routes use realistic sample content until live Supabase and FastAPI integrations are connected.
        </PolicyBlock>
      </div>
    </PublicTextPage>
  );
}
