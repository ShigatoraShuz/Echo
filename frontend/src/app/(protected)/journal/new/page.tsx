import { JournalEditorView } from "@/features/journal/view/journal-editor-view";
import { AppShell } from "@/shared/components/layout/echo-shells";

export default function NewJournalEntryPage() {
  return (
    <AppShell>
      <JournalEditorView />
    </AppShell>
  );
}
