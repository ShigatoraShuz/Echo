"use client";
import { useEffect, useRef, useState } from "react";
import { getAuthService } from "@/services/authentication/auth-service.factory";
import { AuthFormField } from "./auth-form-field";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCheckbox } from "@/shared/components/ui/echo-checkbox";

export function EmailOtpForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  const cooldownUntil = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const timer = setInterval(
      () => setRemaining(Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  async function send() {
    if (pending.current || cooldownUntil.current > Date.now()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const service = getAuthService();
      if (!service.sendLoginCode) throw new Error("Email codes require configured Supabase authentication.");
      const result = await service.sendLoginCode(email.trim());
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSent(true);
      setCode("");
      cooldownUntil.current = Date.now() + 60_000;
      setRemaining(60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The code could not be sent. Please retry.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function verify() {
    if (pending.current) return;
    if (!/^\d{6,10}$/.test(code)) {
      setError("Enter the numeric code from your email.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await getAuthService().verifyLoginCode?.({ email: email.trim(), code, rememberSession: remember });
      if (!result?.success) {
        setError(result && !result.success ? result.error.message : "Code verification is unavailable.");
        return;
      }
      onAuthenticated();
    } catch {
      setError("We could not verify this code. Please retry.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void (sent ? verify() : send());
      }}
    >
      <AuthFormField
        label="Email address"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={sent || busy}
        autoComplete="email"
        required
      />
      {sent && (
        <>
          <p role="status" className="text-sm text-[var(--landing-muted)]">
            If this email has an ECHO account, a sign-in code is on its way. Check your inbox and spam folder.
          </p>
          <AuthFormField
            label="Email sign-in code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={busy}
            required
          />
        </>
      )}
      <EchoCheckbox
        label="Remember me on this device"
        checked={remember}
        onChange={(event) => setRemember(event.target.checked)}
      />
      {error && (
        <p role="alert" className="text-sm text-[var(--landing-ink)]">
          {error}
        </p>
      )}
      <EchoButton type="submit" className="w-full" isLoading={busy} loadingText={sent ? "Verifying…" : "Sending…"}>
        {sent ? "Verify code and log in" : "Send sign-in code"}
      </EchoButton>
      {sent && (
        <div className="flex justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={busy || remaining > 0}
            onClick={() => void send()}
            className="underline disabled:opacity-60"
          >
            {remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode("");
              setError("");
            }}
            className="underline"
          >
            Change email
          </button>
        </div>
      )}
    </form>
  );
}
