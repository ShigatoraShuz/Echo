import { JournalDetailView } from "@/features/journal/view/journal-detail-view";
import { AppShell } from "@/components/echo/shells";

export function generateStaticParams() {
  return [{ id: "morning-static" }, { id: "meeting-aftercare" }, { id: "evening-window" }];
}

export default async function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <JournalDetailView id={id} />
    </AppShell>
  );
}
