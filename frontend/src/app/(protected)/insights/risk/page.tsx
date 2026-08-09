import { RiskInsightsView } from "@/features/insights";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function RiskInsightsPage() {
  return (
    <AppShell>
      <RiskInsightsView />
    </AppShell>
  );
}