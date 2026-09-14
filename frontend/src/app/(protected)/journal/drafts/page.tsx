import { JournalDraftsView } from "@/features/journal/view/journal-drafts-view";
import { AppShell } from "@/shared/components/layout/echo-shells";
export default function JournalDraftsPage() {
  return (
    <AppShell>
      <JournalDraftsView />
    </AppShell>
  );
}
