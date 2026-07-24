"use client";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";
import { TimeRangeSelector } from "../components/time-range-selector";
import { EmotionOverviewCard } from "../components/emotion-overview-card";
import { EmotionTrendChart } from "../components/emotion-trend-chart";
import { EmotionDistributionWheel } from "../components/emotion-distribution-wheel";
import { JournalSourceBreakdownChart } from "../components/journal-source-breakdown";
import { MostFrequentEmotions } from "../components/most-frequent-emotions";
import { PositiveDifficultBalance } from "../components/positive-difficult-balance";
import { InsightExplanation } from "../components/insight-explanation";
import { InsightsPrivacyBanner } from "../components/insights-privacy-banner";
import { InsightsEmptyState } from "../components/insights-empty-state";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { EchoSectionHeading } from "@/shared/components/data-display/echo-section-heading";

export function EmotionInsightsView() {
  const vm = useInsightsViewModel();

  if (vm.isLoading) return <EchoLoadingState variant="skeleton" text="Loading insights..." />;
  if (vm.error) return <EchoErrorState message={vm.error} onRetry={vm.retry} />;
  if (!vm.emotionSummary) return <InsightsEmptyState />;

  return (
    <div className="space-y-6">
      <EchoMotionSurface as="div" tilt={false} className="rounded-[2rem] border border-border bg-card p-6 shadow-subtle sm:p-8">
        <EchoSectionHeading title="Emotion insights" description="Understand your emotional patterns over time" />
        <div className="mt-4">
          <TimeRangeSelector value={vm.timeRange} onChange={vm.setTimeRange} />
        </div>
      </EchoMotionSurface>

      <InsightsPrivacyBanner />
      <InsightExplanation hasData={true} riskBand={vm.riskSignal?.band} emotionCount={vm.emotionSummary.mostFrequentEmotions.length} />

      <div className="grid gap-6 md:grid-cols-2">
        <EmotionOverviewCard summary={vm.emotionSummary} />
        <EmotionTrendChart points={vm.emotionSummary.moodTrend} timeRange={vm.timeRange} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <EmotionDistributionWheel distributions={vm.emotionSummary.emotionWheel} />
        <MostFrequentEmotions emotions={vm.emotionSummary.mostFrequentEmotions} />
      </div>

      <PositiveDifficultBalance positive={vm.emotionSummary.positiveVsDifficult.positive} difficult={vm.emotionSummary.positiveVsDifficult.difficult} />
      <JournalSourceBreakdownChart sources={vm.journalBreakdown} />
    </div>
  );
}
