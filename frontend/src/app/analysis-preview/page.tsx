import { notFound } from "next/navigation";
import { JournalAnalysisPreviewView } from "@/features/journal/view/journal-analysis-preview-view";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function JournalAnalysisPreviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_ENABLE_ANALYSIS_PREVIEW !== "true") notFound();

  return (
    <AppShell>
      <JournalAnalysisPreviewView />
    </AppShell>
  );
}
