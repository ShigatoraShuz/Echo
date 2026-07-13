import { JournalEditorView } from "@/features/journal/view/journal-editor-view";
import { AppShell } from "@/components/echo/shells";

export default function NewJournalEntryPage() {
  return (
    <AppShell>
      <JournalEditorView />
    </AppShell>
  );
}
