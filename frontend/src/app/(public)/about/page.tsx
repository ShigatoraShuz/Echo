import { PolicyBlock, PublicTextPage } from "@/features/public-content";

export default function AboutPage() {
  return (
    <PublicTextPage
      title="Built for reflective privacy"
      description="ECHO combines journaling, Buddy prompts, and wellbeing pattern summaries in a calm, safety-aware interface."
      imageKey="wellnessInteriorPlantsChair"
    >
      <div className="space-y-4">
        <PolicyBlock title="What ECHO does">
          ECHO helps people write private reflections, notice recurring emotional patterns, and find practical next steps.
        </PolicyBlock>
        <PolicyBlock title="What ECHO does not do">
          ECHO is not a diagnostic tool and does not replace therapy, clinical care, emergency services, or a trusted support person.
        </PolicyBlock>
        <PolicyBlock title="How the app is structured">
          The current implementation uses mock data and route-ready structure for future Supabase and FastAPI integration.
        </PolicyBlock>
      </div>
    </PublicTextPage>
  );
}
