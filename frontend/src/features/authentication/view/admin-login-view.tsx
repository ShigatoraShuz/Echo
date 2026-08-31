"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { getAuthService } from "@/services/authentication/auth-service.factory";
import { verificationApi } from "@/services/verification/verification-api";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCheckbox } from "@/shared/components/ui/echo-checkbox";
import { AuthFormField } from "../components/auth-form-field";
import { PasswordField } from "../components/password-field";
import { validateLoginInput } from "../model/auth.schema";

export function AdminLoginView() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || complete) return;
    setError(null);
    const input = { email: email.trim(), password, rememberSession };
    const validation = validateLoginInput(input);
    setFieldErrors(validation.errors);
    if (!validation.valid) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await getAuthService().login(input);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      if (result.data.isMockSession) {
        setError(
          "Administrator sign-in requires a connected ECHO account. Demo sessions cannot access this workspace.",
        );
        return;
      }
      // This check improves navigation only; every admin API still enforces its own role check.
      const access = await verificationApi.reviewerAccess();
      if (access.canReview !== true) {
        setError(
          "This account does not have administrator access. Use your assigned reviewer account or contact the ECHO project owner.",
        );
        return;
      }
      setPassword("");
      setComplete(true);
      // A fixed destination cannot be redirected by untrusted query parameters.
      // The existing route gate still requires age, policies, and onboarding.
      router.replace("/admin/verifications");
      router.refresh();
    } catch {
      setError("Administrator access could not be checked. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[26rem] py-4 text-[var(--landing-ink)] [font-family:var(--font-echo-sans)] sm:py-8">
      <EchoReveal direction="down" duration={260}>
        <section
          aria-labelledby="admin-login-title"
          className="rounded-[1.75rem] border border-[var(--landing-primary-15)] bg-white/70 p-6 shadow-[0_20px_60px_rgba(41,49,27,0.08)] sm:p-8"
        >
          <header className="text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--landing-primary-10)] text-[var(--landing-primary)]">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--landing-primary)]">
              ECHO · Admin workspace
            </p>
            <h1
              id="admin-login-title"
              className="mt-2 text-4xl leading-tight tracking-tight [font-family:var(--font-echo-display)]"
            >
              Admin sign in
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--landing-muted)]">
              A dedicated space for authorized reviewers to manage account verifications.
            </p>
          </header>
          <form onSubmit={signIn} noValidate aria-busy={busy} className="mt-6 space-y-4">
            {error && <EchoInlineMessage variant="error" message={error} />}
            {complete && (
              <p role="status" className="text-sm text-[var(--landing-primary)]">
                Access confirmed. Opening your workspace…
              </p>
            )}
            <fieldset disabled={busy || complete} className="space-y-4 disabled:opacity-70">
              <AuthFormField
                label="Admin email"
                type="email"
                placeholder="Your administrator email"
                autoComplete="username"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                error={fieldErrors.email?.[0]}
                leadingIcon={<Mail className="size-4" aria-hidden="true" />}
                required
              />
              <PasswordField
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
                showPassword={showPassword}
                onToggleVisibility={() => setShowPassword((value) => !value)}
                error={fieldErrors.password?.[0]}
                required
              />
              <EchoCheckbox
                label="Remember me on this device"
                checked={rememberSession}
                onChange={(event) => setRememberSession(event.target.checked)}
              />
            </fieldset>
            <p className="text-xs leading-5 text-[var(--landing-muted)]">
              Leave unchecked on shared devices. Your session ends when you close this tab.
            </p>
            <EchoButton
              type="submit"
              variant="primary"
              className="min-h-12 w-full rounded-full"
              isLoading={busy}
              loadingText="Checking access…"
              disabled={complete}
            >
              Sign in as admin <ArrowRight className="size-4" aria-hidden="true" />
            </EchoButton>
            <Link
              href="/forgot-password"
              className="flex min-h-11 items-center justify-center rounded-full text-sm font-semibold text-[var(--landing-primary)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]"
            >
              Forgot password?
            </Link>
          </form>
          <p className="mt-4 border-t border-[var(--landing-primary-15)] pt-4 text-center text-xs leading-6 text-[var(--landing-muted)]">
            Administrator accounts are assigned by the ECHO project owner. Public sign-up does not grant admin access.
          </p>
        </section>
      </EchoReveal>
      <Link
        href="/signup"
        className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-[var(--landing-primary)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to sign up
      </Link>
      <Link
        href="/login"
        className="flex min-h-11 items-center justify-center rounded-full text-sm text-[var(--landing-muted)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]"
      >
        Regular account sign in
      </Link>
    </div>
  );
}
