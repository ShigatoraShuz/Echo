import { Cloud, CloudOff, Loader2 } from "lucide-react";

interface JournalAutosaveStatusProps {
  isSaving: boolean;
  isAutosaving: boolean;
  hasSaved: boolean;
}

export function JournalAutosaveStatus({ isSaving, isAutosaving, hasSaved }: JournalAutosaveStatusProps) {
  if (isSaving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Saving...
      </span>
    );
  }

  if (isAutosaving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Cloud className="h-3 w-3" aria-hidden="true" />
        Saving draft...
      </span>
    );
  }

  if (hasSaved) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <CloudOff className="h-3 w-3" aria-hidden="true" />
        Saved locally
      </span>
    );
  }

  return null;
}
