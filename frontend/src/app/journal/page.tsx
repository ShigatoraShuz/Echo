import { JournalListView } from "@/features/journal/view/journal-list-view";
import { AppShell } from "@/components/echo/shells";

export default function JournalPage() {
  return (
    <AppShell>
      <JournalListView />
    </AppShell>
  );
}
