"use client";
import { useState } from "react";
import { Download, FileText, Clock } from "lucide-react";

type ExportStatus = "idle" | "preparing" | "ready" | "error";

interface ExportDataProps {
  onRequestExport: () => Promise<void>;
}

export function ExportDataSection({ onRequestExport }: ExportDataProps) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setStatus("preparing");
    setError(null);
    try {
      await onRequestExport();
      setStatus("ready");
      setTimeout(() => setStatus("idle"), 5000);
    } catch {
      setStatus("error");
      setError("Failed to prepare export. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Export your data</p>
          <p className="text-xs text-muted-foreground">Download a copy of your journal entries, mood history, and settings.</p>
        </div>
      </div>

      {status === "idle" && (
        <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          <Download className="h-4 w-4" /> Prepare export
        </button>
      )}
      {status === "preparing" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-spin" /> Preparing your data...
        </div>
      )}
      {status === "ready" && (
        <p className="text-sm font-medium text-success">Export is ready. Check your downloads.</p>
      )}
      {status === "error" && error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
