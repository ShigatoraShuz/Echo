import { EmotionInsightsView } from "@/features/insights";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function EmotionInsightsPage() {
  return (
    <AppShell>
      <EmotionInsightsView />
    </AppShell>
  );
}