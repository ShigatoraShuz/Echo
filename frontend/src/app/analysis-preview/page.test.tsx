import { afterEach, expect, it, vi } from "vitest";
import AnalysisPreview from "./page";
import DashboardPreview from "../dashboard-preview/page";
import InsightsPreview from "../insights-preview/page";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/features/journal/view/journal-analysis-preview-view", () => ({ JournalAnalysisPreviewView: () => null }));
vi.mock("@/features/dashboard/view/dashboard-view", () => ({ DashboardView: () => null }));
vi.mock("@/features/insights", () => ({ EmotionInsightsView: () => null }));
vi.mock("@/shared/components/layout/echo-shells", () => ({ AppShell: () => null }));
afterEach(() => vi.unstubAllEnvs());
it.each([AnalysisPreview, DashboardPreview, InsightsPreview])("blocks sample-data pages in normal development: %s", Page => {
 vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYSIS_PREVIEW", "false");
 expect(() => Page()).toThrow("NOT_FOUND");
});
it.each([AnalysisPreview, DashboardPreview, InsightsPreview])("requires explicit development opt-in: %s", Page => {
 vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYSIS_PREVIEW", "true");
 expect(() => Page()).not.toThrow();
 vi.stubEnv("NODE_ENV", "production"); expect(() => Page()).toThrow("NOT_FOUND");
});
