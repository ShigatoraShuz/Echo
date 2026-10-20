import { notFound } from "next/navigation";
import { EmotionInsightsView } from "@/features/insights";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function InsightsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShell staticAccountControls>
      <EmotionInsightsView preview />
    </AppShell>
  );
}
