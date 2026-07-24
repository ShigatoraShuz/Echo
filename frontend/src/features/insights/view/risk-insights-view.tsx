"use client";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";
import { RiskCurrentSignal } from "../components/risk-current-signal";
import { RiskBandHistory } from "../components/risk-band-history";
import { SupportingFactors } from "../components/supporting-factors";
import { InsightExplanation } from "../components/insight-explanation";
import { InsightsEmptyState } from "../components/insights-empty-state";
import { InsightsPrivacyBanner } from "../components/insights-privacy-banner";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { EchoSectionHeading } from "@/shared/components/data-display/echo-section-heading";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";

export function RiskInsightsView() {
  const vm = useInsightsViewModel();

  if (vm.isLoading) return <EchoLoadingState variant="skeleton" text="Loading risk assessment..." />;
  if (vm.error) return <EchoErrorState message={vm.error} onRetry={vm.retry} />;
  if (!vm.riskSignal) return <InsightsEmptyState />;

  return (
    <div className="space-y-6">
      <EchoMotionSurface as="div" tilt={false} className="rounded-[2rem] border border-border bg-card p-6 shadow-subtle sm:p-8">
        <EchoSectionHeading title="Risk assessment" description="Monitoring signals of distress over time" />
      </EchoMotionSurface>

      <InsightsPrivacyBanner message="Risk signals are calculated from your journal entries. This is not a clinical assessment or diagnostic tool." />
      <InsightExplanation hasData={true} riskBand={vm.riskSignal.band} />

      <div className="grid gap-6 md:grid-cols-2">
        <RiskCurrentSignal score={vm.riskSignal.score} band={vm.riskSignal.band} label={vm.riskSignal.label} />
        <RiskBandHistory history={vm.riskSignal.history} />
      </div>

      <SupportingFactors factors={vm.riskSignal.supportingFactors} />
    </div>
  );
}
