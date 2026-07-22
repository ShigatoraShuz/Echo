import { JournalListView } from "@/features/journal/view/journal-list-view";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function JournalPage() {
  return (
    <AppShell>
      <JournalListView />
    </AppShell>
  );
}
