import { Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react";
import type { AutosaveStatus } from "../view-model/use-journal-editor-view-model";

interface JournalAutosaveStatusProps {
  autosaveStatus: AutosaveStatus;
  isSaving: boolean;
}

export function JournalAutosaveStatus({ autosaveStatus, isSaving }: JournalAutosaveStatusProps) {
  if (isSaving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Saving...
      </span>
    );
  }

  switch (autosaveStatus) {
    case "unsaved":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <CloudOff className="h-3 w-3" aria-hidden="true" />
          Unsaved changes
        </span>
      );
    case "saving":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Saving draft...
        </span>
      );
    case "saved":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-success" aria-live="polite">
          <Cloud className="h-3 w-3" aria-hidden="true" />
          Draft saved
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-danger" aria-live="assertive">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          Draft save failed
        </span>
      );
    default:
      return null;
  }
}
