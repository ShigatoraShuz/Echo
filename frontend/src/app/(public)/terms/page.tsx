import { PolicyBlock, PublicTextPage } from "@/features/public-content";

export default function TermsPage() {
  return (
    <PublicTextPage
      title="Terms of use"
      description="Version 2026-07-25 · Clear terms for a private reflection space with optional AI-assisted features."
      imageKey="calmChairPlant"
    >
      <div className="space-y-4">
        <PolicyBlock title="Supportive use, not clinical care">
          ECHO supports reflection, journaling, grounding, and wellbeing organization. It does not diagnose, treat, monitor emergencies, or replace a qualified professional, local emergency service, or crisis line.
        </PolicyBlock>
        <PolicyBlock title="AI-assisted features">
          Optional AI-assisted features are developed for the ECHO thesis project. They can provide reflective summaries only for entries you actively choose to analyze. Their outputs can be wrong or incomplete and must not be used as medical, emergency, or safety advice.
        </PolicyBlock>
        <PolicyBlock title="Your choices">
          You can journal without enabling AI analysis. You may review or change optional analysis consent in your settings. We record the version of these terms and your acknowledgement when you create an account.
        </PolicyBlock>
        <PolicyBlock title="Emergency situations">
          If you or someone else may be in immediate danger, call local emergency services or a verified crisis line now. Do not wait for a response from ECHO.
        </PolicyBlock>
      </div>
    </PublicTextPage>
  );
}
