"use client";
import { useRef, useState } from "react";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { resetAccountActivity, reauthenticateActivityReset } from "@/services/settings/account-activity";
import { clearSensitiveBrowserState } from "@/infrastructure/security/clear-sensitive-state";
import { invalidateNavigationReads } from "@/infrastructure/api/navigation-read-cache";
import { normalizeError } from "@/shared/errors/normalize-error";
export function StartCleanControls() {
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const requestId = useRef<string | null>(null);
  const running = useRef(false);
  async function reset() {
    if (running.current || confirmation !== "START CLEAN" || !password) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const actor = await reauthenticateActivityReset(password);
      requestId.current ??= crypto.randomUUID();
      await resetAccountActivity(requestId.current);
      clearSensitiveBrowserState({ unsubscribePush: false });
      invalidateNavigationReads();
      window.dispatchEvent(new Event("echo:journal-changed"));
      try {
        window.localStorage.setItem("echo:activity-reset", JSON.stringify({ actor, at: Date.now() }));
      } catch {}
      window.location.assign("/dashboard?reset=complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : normalizeError(cause).userMessage);
      running.current = false;
      setBusy(false);
    } finally {
      setPassword("");
    }
  }
  return (
    <section className="my-6 rounded-2xl border border-danger/20 bg-card p-5">
      <h2 className="text-lg font-semibold">Start clean</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Clear saved reflections, photos, analysis, Buddy conversations, check-ins, grounding activity, calendar entries,
        notifications, and export history. Professional support requests and appointments are also removed.
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Your login, profile, approved verification, contacts, consent and preferences stay. Restricted security audit
        records and provider backups follow their retention policies.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 min-h-11 rounded-full border border-danger/30 px-5 text-sm font-semibold text-danger"
      >
        Clear my activity
      </button>
      <EchoDialog
        open={open}
        dismissible={!busy}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Start with a clean account?"
        description="This permanently clears your app activity. It cannot be undone. Export anything you want to keep first."
      >
        <label className="block text-sm font-medium">
          Type START CLEAN to confirm
          <input
            autoComplete="off"
            value={confirmation}
            disabled={busy}
            onChange={(e) => setConfirmation(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Confirm your current password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          A recent sign-in is required. Keep this page open until cleanup finishes. If cleanup is interrupted, retry to
          finish it.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-full border border-border px-4"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || confirmation !== "START CLEAN" || !password}
            onClick={() => void reset()}
            className="min-h-11 rounded-full bg-danger px-5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Clearing activity..." : "Start clean"}
          </button>
        </div>
      </EchoDialog>
    </section>
  );
}
