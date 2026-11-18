"use client";

import { useEffect, useState } from "react";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { DefaultJournalFilters, type JournalEntry } from "../model/journal.model";

export function JournalExportDialog({ onClose }: { onClose: () => void }) {
  const service = getJournalService();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    void service.listEntries(DefaultJournalFilters, page, 20, abort.signal).then(result => {
      if (abort.signal.aborted) return;
      if (!result.success) { setError(result.error.message); return; }
      setEntries(previous => page === 1 ? result.data.entries : [...previous.filter(entry => !result.data.entries.some(next => next.id === entry.id)), ...result.data.entries]);
      setTotalPages(result.data.pagination.totalPages);
    }).catch(() => { if (!abort.signal.aborted) setError("Could not load journals. Please try again."); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [service, page, retry]);
  async function exportSelected() {
    if (exporting || !selected.length) return;
    setExporting(true);
    setError("");
    try {
      const sources: Blob[] = [];
      for (const [index, id] of selected.entries()) {
        setProgress(`Preparing journal ${index + 1} of ${selected.length}…`);
        const result = await service.exportEntry(id);
        if (!result.success) throw Error(result.error.message);
        sources.push(result.data.pdf);
      }
      let blob = sources[0];
      if (sources.length > 1) {
        const { PDFDocument } = await import("pdf-lib");
        const combined = await PDFDocument.create();
        combined.setTitle("ECHO - Selected reflections");
        combined.setAuthor("ECHO");
        for (const source of sources) {
          const pdf = await PDFDocument.load(await source.arrayBuffer());
          const pages = await combined.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => combined.addPage(page));
        }
        blob = new Blob([(await combined.save()).slice().buffer], { type: "application/pdf" });
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `echo-journals-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setProgress("Your PDF is ready. Download started.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The journals could not be exported. Please try again.");
      setProgress("");
    } finally { setExporting(false); }
  }
  return (
    <EchoDialog open onClose={onClose} dismissible={!exporting} title="Export journals" description="Choose saved reflections for one PDF, including their available saved analysis results." size="large">
      <p className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">Includes reflection text, emotion results, PHQ-8 estimates, suggested next steps, and facial results when available. Photos and live camera images are excluded.</p>
      <div className="my-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{selected.length} selected</span>
        <button type="button" className="font-semibold text-primary underline" disabled={exporting || !entries.length} onClick={() => setSelected(selected.length ? [] : entries.map(entry => entry.id))}>
          {selected.length ? "Clear selection" : "Select loaded journals"}
        </button>
      </div>
      <div className="max-h-[40vh] space-y-2 overflow-y-auto" aria-label="Journals to export" aria-busy={loading}>
        {entries.map(entry => (
          <label key={entry.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-secondary/40">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={selected.includes(entry.id)} disabled={exporting} onChange={event => { setProgress(""); setSelected(ids => event.target.checked ? [...ids, entry.id] : ids.filter(id => id !== entry.id)); }} />
            <span className="min-w-0"><strong className="block break-words text-sm">{entry.title || "Untitled reflection"}</strong><span className="mt-1 block text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()} · Saved reflection</span></span>
          </label>
        ))}
        {loading && <p role="status" className="p-3 text-sm">Loading journals…</p>}
        {!loading && !entries.length && !error && <p className="p-3 text-sm text-muted-foreground">No saved journals to export yet.</p>}
      </div>
      {!loading && page < totalPages && !error && <button type="button" disabled={exporting} className="echo-button-secondary mt-3" onClick={() => setPage(page + 1)}>Load more journals</button>}
      {error && <div className="mt-4 text-sm text-danger" role="alert">{error}{!exporting && <button type="button" className="ml-2 underline" onClick={() => setRetry(value => value + 1)}>Reload list</button>}</div>}
      {progress && <p role="status" className="mt-4 text-sm text-primary">{progress}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" className="echo-button-secondary" disabled={exporting} onClick={onClose}>Close</button>
        <button type="button" className="echo-button-primary" disabled={exporting || !selected.length} onClick={() => void exportSelected()}>{exporting ? "Preparing PDF…" : `Export PDF${selected.length ? ` (${selected.length})` : ""}`}</button>
      </div>
    </EchoDialog>
  );
}
