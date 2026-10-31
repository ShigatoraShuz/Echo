"use client";

import { useId, type FormEvent } from "react";
import { EchoButton } from "@/shared/components/ui/echo-button";

export function ProfessionalCaseNoteEditor({ value, onChange, onSubmit, busy = false, disabled = false, error = "", preview = false }: {
  value: string; onChange: (value: string) => void; onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  busy?: boolean; disabled?: boolean; error?: string; preview?: boolean;
}) {
  const id = useId();
  return <form onSubmit={(event) => { event.preventDefault(); if (!preview && !busy && !disabled) onSubmit?.(event); }} noValidate className="mt-6 border-t border-border/70 pt-5">
    <label htmlFor={id} className="mb-2 block text-xs font-semibold text-foreground">New case note</label>
    <textarea id={id} required minLength={2} maxLength={4000} rows={5} className="echo-input" placeholder="Document the follow-up needed. Avoid unnecessary personal details."
      value={value} onChange={(event) => onChange(event.target.value)} disabled={busy || disabled} aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`} />
    <div id={`${id}-help`} className="mt-2 space-y-1 text-xs leading-6 text-muted-foreground">
      <p>{value.trim().length.toLocaleString()} / 4,000 characters. Minimum 2 after trimming spaces.</p>
      <p>Unsaved text stays in memory only and is discarded on navigation, refresh or hiding this page. This editor saves a final note immediately. Editing and server draft controls are not available in this editor.</p>
      {preview ? <p>Synthetic editor only. Saving is disabled; nothing is sent or stored.</p> : null}
    </div>
    {error ? <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
    {busy ? <p role="status" className="mt-2 text-sm text-muted-foreground">Saving note. Wait for confirmation before leaving.</p> : null}
    <EchoButton type="submit" size="small" className="mt-3 min-h-11" disabled={preview || disabled || !onSubmit} isLoading={busy} loadingText="Saving">Save note</EchoButton>
  </form>;
}
