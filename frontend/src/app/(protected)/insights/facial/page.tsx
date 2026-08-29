import { FacialInsightsView } from "@/features/insights";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { isFeatureEnabled } from "@/config/feature-flags.config";
import { redirect } from "next/navigation";

export default function FacialInsightsPage() {
  if (!isFeatureEnabled("facialAnalysis")) redirect("/insights/emotion");
  return (
    <AppShell>
      <FacialInsightsView />
    </AppShell>
  );
}
