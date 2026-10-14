"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Download, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { settingsService } from "@/services/settings/settings.service";
import type { DeletionCenter } from "@/features/settings/model/settings.model";
import { normalizeError } from "@/shared/errors/normalize-error";

export default function DeletionPage() {
  const router = useRouter();
  const [center, setCenter] = useState<DeletionCenter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setCenter(await settingsService.getDeletionCenter());
      setError(null);
    } catch (cause) {
      setError(normalizeError(cause).userMessage);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function cancel() {
    if (!center?.deletionRequest || busy) return;
    setBusy(true);
    try {
      await settingsService.cancelDeletion(center.deletionRequest.id);
      router.replace("/settings/privacy");
      router.refresh();
    } catch (cause) {
      setError(normalizeError(cause).userMessage);
    } finally {
      setBusy(false);
    }
  }

  async function requestExport() {
    setBusy(true);
    try {
      await settingsService.requestExport();
      await refresh();
    } catch (cause) {
      setError(normalizeError(cause).userMessage);
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    setBusy(true);
    try {
      const blob = await settingsService.downloadExport(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "echo-account-export.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await refresh();
    } catch (cause) {
      setError(normalizeError(cause).userMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-xl sm:p-10">
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck aria-hidden="true" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Account privacy</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Your deletion request</h1>
        {!center && !error && <p className="mt-5 flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading your request…</p>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
        {center?.deletionRequest && (
          <>
            <p className="mt-5 leading-7 text-muted-foreground">
              Your account is {center.deletionRequest.status === "pending" ? "scheduled for deletion" : "being deleted"}.
              {center.deletionRequest.scheduledFor && <> The 30-day cancellation window ends {new Date(center.deletionRequest.scheduledFor).toLocaleString()}.</>}
              {" "}New activity and processing are paused. You can export your data or cancel while the request is pending.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {center.deletionRequest.status === "pending" && <button type="button" disabled={busy} onClick={() => void cancel()} className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Cancel deletion</button>}
              {center.deletionRequest.status === "pending" && <button type="button" disabled={busy} onClick={() => void requestExport()} className="rounded-full border border-border px-5 py-3 text-sm font-semibold disabled:opacity-50"><Download className="mr-2 inline h-4 w-4" />Request export</button>}
            </div>
          </>
        )}
        {center && !center.deletionRequest && <p className="mt-5 text-sm text-muted-foreground">There is no active deletion request. Return to Settings to manage your account.</p>}
        {center && center.exportHistory.length > 0 && (
          <section className="mt-9 border-t border-border pt-6" aria-label="Data exports">
            <h2 className="font-serif text-xl">Your exports</h2>
            <ul className="mt-3 space-y-3">{center.exportHistory.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-4 text-sm"><span>Requested {new Date(item.requestedAt).toLocaleString()} · {item.status}</span>{item.status === "completed" && <button type="button" disabled={busy} onClick={() => void download(item.id)} className="font-semibold text-primary underline">Download</button>}</li>)}</ul>
          </section>
        )}
        <div className="mt-9 border-t border-border pt-6 text-sm text-muted-foreground">
          <p><Trash2 className="mr-2 inline h-4 w-4" />After deletion, live account data is removed. Provider backups and restricted content-free audit records follow the periods in the Privacy Notice.</p>
          <div className="mt-5 flex flex-wrap gap-5"><Link href="/settings/privacy" className="text-primary underline">Settings</Link><Link href="/crisis" className="text-primary underline">Crisis support</Link><button type="button" onClick={() => void createBrowserSupabaseClient().auth.signOut().then(() => router.replace("/login"))} className="text-primary underline">Sign out</button></div>
        </div>
      </div>
    </main>
  );
}
