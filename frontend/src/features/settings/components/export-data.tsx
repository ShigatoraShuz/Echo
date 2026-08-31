"use client";

import { useState, useRef } from "react";
import {
  Download,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  BookOpen,
  BarChart3,
  Brain,
  Sparkles,
} from "lucide-react";

import type { JournalEntry } from "@/features/journal/model/journal.model";
import type { ProfileSettings, ExportRequest } from "../model/settings.model";

type ExportStatus = "idle" | "fetching" | "generating" | "done" | "error";

interface ExportDataProps {
  /** Called to record the export server-side and retrieve the request record */
  onRequestExport: () => Promise<ExportRequest>;
  profile: ProfileSettings | null;
  /** Pass journal entries so we can embed them in the PDF */
  loadJournalEntries: () => Promise<JournalEntry[]>;
}

export function ExportDataSection({
  onRequestExport,
  profile,
  loadJournalEntries,
}: ExportDataProps) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  async function handleExport() {
    if (status !== "idle" && status !== "error") return;
    abortRef.current = false;
    setStatus("fetching");
    setError(null);

    try {
      // 1. Record the request server-side
      await onRequestExport();

      if (abortRef.current) return;
      setStatus("generating");

      // 2. Load all journal entries
      const entries = await loadJournalEntries();
      if (abortRef.current) return;

      // 3. Dynamically generate the PDF
      const { generateEchoPdfExport } = await import(
        "../utils/export-pdf-generator"
      );
      await generateEchoPdfExport({
        profile: profile ?? {
          displayName: "ECHO User",
          timezone: "UTC",
          themeVariant: "echo-calm",
          themeMode: "light",
        },
        entries,
      });

      setStatus("done");
      setTimeout(() => setStatus("idle"), 7000);
    } catch (err) {
      console.error("[ExportDataSection] PDF export failed:", err);
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate your export. Please try again.",
      );
    }
  }

  return (
    <div className="space-y-5">
      {/* What's included */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Export your data as a PDF
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A private, watermarked report only visible to you.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              icon: BookOpen,
              label: "Full journal history",
              sub: "All entries & excerpts",
            },
            {
              icon: Brain,
              label: "AI perspectives",
              sub: "ECHO analysis per entry",
            },
            {
              icon: BarChart3,
              label: "Distress & mood trends",
              sub: "Journal mood and distress trends",
            },
          ].map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2.5"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
              <div>
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action area */}
      {status === "idle" && (
        <button
          type="button"
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-95"
        >
          <Download className="h-4 w-4" />
          Download PDF Report
        </button>
      )}

      {(status === "fetching" || status === "generating") && (
        <div className="flex items-center gap-3 rounded-2xl bg-primary/6 px-4 py-3 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>
            {status === "fetching"
              ? "Preparing your data…"
              : "Building your PDF report…"}
          </span>
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-primary">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">PDF downloaded!</p>
            <p className="text-xs text-muted-foreground">
              Check your Downloads folder for the report.
            </p>
          </div>
          <Sparkles className="ml-auto h-4 w-4 opacity-50" />
        </div>
      )}

      {status === "error" && error && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              Export failed
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="shrink-0 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90"
          >
            Retry
          </button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/70">
        Your data never leaves your device during PDF generation. The report is
        generated locally in your browser.
      </p>
    </div>
  );
}
