"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { requireSupabasePublicConfig } from "@/infrastructure/supabase/config";

interface GoogleMigrationAccount { id: string; email: string }

function verificationClient() {
  const { url, publishableKey } = requireSupabasePublicConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function GoogleEmailMigration({ account }: { account: GoogleMigrationAccount }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [step, setStep] = useState<"password" | "code" | "complete">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setEmailPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      setError("Use at least 8 characters with lowercase, uppercase, and a number.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const current = createBrowserSupabaseClient();
      const { data: signedIn, error: userError } = await current.auth.getUser();
      if (userError || signedIn.user?.id !== account.id) throw new Error("Your session changed. Sign in again before continuing.");
      const { error: updateError } = await current.auth.updateUser({ password });
      if (updateError) throw updateError;

      const verifier = verificationClient();
      const { data: login, error: loginError } = await verifier.auth.signInWithPassword({ email: account.email, password });
      await verifier.auth.signOut({ scope: "local" });
      if (loginError || !login.session || login.user?.id !== account.id) {
        throw new Error("Password was saved, but email login could not be verified on this account. Keep Google sign-in available and contact support.");
      }
      setPassword("");
      setConfirmation("");
      setStep("code");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Email password could not be set.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const { error: sendError } = await verificationClient().auth.signInWithOtp({
        email: account.email,
        options: { shouldCreateUser: false },
      });
      if (sendError) throw sendError;
      setCodeSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Email code could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codeSent || busy) return;
    setError("");
    setBusy(true);
    try {
      const verifier = verificationClient();
      const { data, error: verifyError } = await verifier.auth.verifyOtp({
        email: account.email,
        token: code.trim(),
        type: "email",
      });
      await verifier.auth.signOut({ scope: "local" });
      if (verifyError || !data.session || data.user?.id !== account.id) {
        throw new Error("Email code did not verify this account. Google sign-in must stay available until this is resolved.");
      }
      setCode("");
      setStep("complete");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Email code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <h3 className="text-base font-semibold text-foreground">Move your Google sign-in to email</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Set a password for {account.email}, then confirm an email code. Your ECHO account and data stay the same.
      </p>
      {step === "password" ? (
        <form onSubmit={setEmailPassword} className="mt-4 grid gap-3">
          <label className="text-sm font-medium">New email password
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5" required />
          </label>
          <label className="text-sm font-medium">Confirm email password
            <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5" required />
          </label>
          <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Verifying password…" : "Set and verify password"}
          </button>
        </form>
      ) : step === "code" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-foreground">Password login works on your existing account. Now verify email code sign-in.</p>
          <button type="button" onClick={() => void sendCode()} disabled={busy} className="min-h-11 rounded-full border border-primary px-5 text-sm font-semibold text-primary disabled:opacity-50">{codeSent ? "Resend email code" : "Send email code"}</button>
          {codeSent ? <p role="status" className="text-sm text-muted-foreground">If email delivery is available, enter the code sent to {account.email}.</p> : null}
          {codeSent ? <form onSubmit={verifyCode} className="grid gap-3">
            <label className="text-sm font-medium">Email code
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5" required />
            </label>
            <button type="submit" disabled={busy || !code.trim()} className="min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Verify email code</button>
          </form> : null}
        </div>
      ) : (
        <p role="status" className="mt-4 text-sm font-semibold text-primary">Password and email code both reached your original ECHO account. You can now sign in with email.</p>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
