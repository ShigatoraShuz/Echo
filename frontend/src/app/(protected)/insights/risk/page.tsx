import { RiskInsightsView } from "@/features/insights";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { isFeatureEnabled } from "@/config/feature-flags.config";
import { redirect } from "next/navigation";

export default function RiskInsightsPage() {
  if (!isFeatureEnabled("riskInsights")) redirect("/insights/emotion");
  return (
    <AppShell>
      <RiskInsightsView />
    </AppShell>
  );
}
