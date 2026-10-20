"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardList, Leaf, Mail, ShieldCheck, UsersRound } from "lucide-react";
import { AuthFormField } from "@/features/authentication/components/auth-form-field";
import { AuthStatusMessage } from "@/features/authentication/components/auth-status-message";
import { EmailOtpForm } from "@/features/authentication/components/email-otp-form";
import { AuthDivider } from "@/features/authentication/components/google-auth-button";
import { PasswordField } from "@/features/authentication/components/password-field";
import { SecureGoogleLoginButton } from "@/features/authentication/components/secure-google-login-button";
import { useLoginViewModel } from "@/features/authentication/view-model/use-login-view-model";
import { getAuthService } from "@/services/authentication/auth-service.factory";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCheckbox } from "@/shared/components/ui/echo-checkbox";
import authMountainLandscape from "../../../../assets/65d9d1e4-d8ca-4f30-9136-adc6924b5d82.png";
import { professionalReturnPath } from "../professional-return-path";

const routeMessages: Record<string, string> = {
  login_required: "Sign in to continue to your professional workspace.",
  auth_not_configured: "Sign-in is temporarily unavailable because authentication is not configured.",
  access_check_unavailable: "We could not verify access to your account. Please sign in again.",
  account_unavailable: "This account is currently unavailable. Contact support if you believe this is a mistake.",
  email_verification_required: "Verify your email address before signing in.",
  sign_in_session_expired: "Your sign-in session expired. Please sign in again.",
  google_account_exists: "This Google account already exists. Sign in with Google to continue.",
};
const linkStyle = "inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-[var(--landing-primary)] outline-none transition-colors hover:text-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]";

export function ProfessionalLoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = professionalReturnPath(searchParams.get("next"));
  const destination = `/professional/access?next=${encodeURIComponent(next)}`;
  const [method, setMethod] = useState<"code" | "password">("code");
  const [unexpectedError, setUnexpectedError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const attempted = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const login = useLoginViewModel();
  const finished = login.status === "success";
  const routeError = searchParams.get("error") ?? "";
  const routeMessage = Object.hasOwn(routeMessages, routeError) ? routeMessages[routeError] : undefined;

  useEffect(() => {
    // An access failure must not bounce a cached session straight back to the failing gate.
    if (routeMessage) return;
    let active = true;
    void getAuthService().getCurrentSession().then((result) => {
      if (active && result.success && result.data && !result.data.isMockSession) router.replace(destination);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [destination, router, routeMessage]);

  useEffect(() => {
    if (!attempted.current || busy) return;
    if (Object.keys(login.fieldErrors).length) {
      form.current?.querySelector<HTMLInputElement>("[aria-invalid='true']")?.focus();
    } else if (unexpectedError || login.error) {
      errorSummary.current?.focus();
    }
  }, [busy, login.fieldErrors, login.error, unexpectedError]);

  function authenticated() {
    router.replace(destination);
    router.refresh();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || busy || finished) return;
    pending.current = true;
    setBusy(true);
    attempted.current = true;
    setUnexpectedError("");
    try {
      if (await login.submit()) authenticated();
    } catch {
      setUnexpectedError("We could not complete sign-in. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="echo-fixed-light echo-auth-surface flex min-h-dvh flex-col text-[var(--landing-ink)] [font-family:var(--font-echo-sans)]">
      <a href="#professional-login-content" className="sr-only z-50 rounded-xl bg-card p-3 text-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:echo-focus-ring">Skip to sign in</a>
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6 lg:px-12">
        <Link href="/" aria-label="ECHO home" className={`${linkStyle} gap-3 text-[var(--landing-ink)]`}>
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[var(--landing-primary-15)] bg-[var(--landing-cream)] text-[var(--landing-primary)]"><Leaf size={22} aria-hidden="true" /></span>
          <span><span className="block text-lg font-extrabold leading-5 tracking-tight">ECHO</span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--landing-muted)]">Professional</span></span>
        </Link>
        <Link href="/login" className={`${linkStyle} text-xs sm:text-sm`}>Personal sign in<ArrowRight size={15} aria-hidden="true" /></Link>
      </header>

      <main id="professional-login-content" tabIndex={-1} data-lenis-prevent className="mx-auto grid w-full max-w-[1320px] flex-1 items-center gap-10 px-5 pb-8 pt-2 outline-none sm:px-8 sm:pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14 lg:px-12 lg:py-8 xl:gap-20">
        <aside aria-label="Your professional workspace" className="relative hidden self-stretch overflow-hidden rounded-[2rem] bg-[var(--landing-footer)] text-[var(--landing-inverse)] lg:flex lg:min-h-[640px]">
          <Image src={authMountainLandscape} alt="" fill priority sizes="(min-width: 1024px) 50vw, 0px" className="object-cover opacity-30" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--landing-footer),transparent_24%,var(--landing-footer)_90%)]" />
          <div className="relative flex w-full flex-col justify-between gap-12 p-8 xl:p-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-[11px] font-semibold tracking-wide"><Leaf size={14} aria-hidden="true" />Professional care, the ECHO way</span>
              <p className="mt-12 max-w-sm text-5xl font-medium leading-[1.02] tracking-tight [font-family:var(--font-echo-display)] xl:text-6xl">Care, with room to focus.</p>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[var(--landing-inverse-80)]">A considered workspace for the people who support others. Keep requests, cases and appointments in one place.</p>
            </div>
            <div>
              <ul className="space-y-5">
                {[
                  { icon: ClipboardList, title: "A clear view of requests", description: "See what needs your attention." },
                  { icon: UsersRound, title: "Continuity across your cases", description: "Return to the work entrusted to you." },
                  { icon: CalendarDays, title: "Space for the next conversation", description: "Keep scheduled support in view." },
                ].map(({ icon: Icon, title, description }) => (
                  <li key={title} className="flex items-start gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5"><Icon size={18} aria-hidden="true" /></span>
                    <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--landing-inverse-80)]">{description}</p></div>
                  </li>
                ))}
              </ul>
              <p className="mt-8 border-t border-white/15 pt-5 text-xs leading-6 text-[var(--landing-inverse-80)]">For approved counselors, psychologists, social workers and organization teams.</p>
            </div>
          </div>
        </aside>

        <div className="mx-auto w-full min-w-0 max-w-[28rem] lg:py-4">
          <section aria-labelledby="professional-sign-in-title" className="rounded-3xl border border-[var(--landing-primary-15)] bg-card p-5 shadow-soft sm:p-8">
            <header>
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[var(--landing-primary)]">Your professional workspace</p>
              <h1 id="professional-sign-in-title" className="mt-3 text-4xl font-medium leading-tight tracking-tight [font-family:var(--font-echo-display)] sm:text-[2.75rem]">Professional sign in</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--landing-muted)]">Use the ECHO account linked to your professional membership.</p>
            </header>
            {routeMessage ? <EchoInlineMessage variant="error" message={routeMessage} className="mt-5" /> : null}

            <div className="mt-7 space-y-5 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-4 [&_button:focus-visible]:ring-primary/20" inert={busy || finished || undefined}>
              <SecureGoogleLoginButton successPath={destination} />
              <AuthDivider />
            </div>

            <div role="group" aria-label="Email sign-in method" className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-[var(--landing-primary-15)] bg-secondary/50 p-1">
              {(["code", "password"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={method === value} disabled={busy || finished}
                  onClick={() => { attempted.current = false; setUnexpectedError(""); setMethod(value); }}
                  className={`min-h-11 rounded-lg px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60 ${method === value ? "bg-card text-[var(--landing-primary)] shadow-subtle" : "text-[var(--landing-muted)] hover:text-[var(--landing-primary)]"}`}>
                  {value === "code" ? "Email code" : "Password"}
                </button>
              ))}
            </div>

            <div className="[&_input:not([type=checkbox])]:text-base [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-4 [&_button:focus-visible]:ring-primary/20 [&_label:has(input[type=checkbox]:focus-visible)]:rounded-lg [&_label:has(input[type=checkbox]:focus-visible)]:ring-4 [&_label:has(input[type=checkbox]:focus-visible)]:ring-primary/20">
              {method === "code" ? <EmailOtpForm onAuthenticated={authenticated} /> : (
                <form ref={form} onSubmit={submit} className="mt-5 space-y-4" aria-label="Password sign in" aria-busy={busy || undefined} noValidate>
                  <div ref={errorSummary} tabIndex={-1} className="rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                    <AuthStatusMessage status={login.status} error={login.error} successMessage="Signed in. Checking professional access…" />
                    {unexpectedError ? <EchoInlineMessage variant="error" message={unexpectedError} /> : null}
                  </div>
                  <fieldset disabled={busy || finished} className="min-w-0 space-y-4">
                    <legend className="sr-only">Email and password</legend>
                    <AuthFormField label="Email address" type="email" placeholder="you@example.com" leadingIcon={<Mail size={16} aria-hidden="true" />}
                      value={login.email} onChange={(event) => login.setEmail(event.target.value)} error={login.fieldErrors.email?.[0]} autoComplete="email" required />
                    <PasswordField label="Password" placeholder="Enter your password" value={login.password} onChange={(event) => login.setPassword(event.target.value)}
                      showPassword={login.showPassword} onToggleVisibility={login.togglePasswordVisibility} error={login.fieldErrors.password?.[0]} required />
                    <div className="flex flex-col items-start gap-1 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
                      <div className="flex min-h-11 items-center"><EchoCheckbox label="Remember me on this device" checked={login.rememberSession} onChange={(event) => login.setRememberSession(event.target.checked)} /></div>
                      <Link href="/forgot-password" className={`${linkStyle} shrink-0 text-xs`}>Forgot password?</Link>
                    </div>
                    <p className="text-[11px] leading-5 text-[var(--landing-muted)]">Leave unchecked on a shared device. Your session ends when this tab closes.</p>
                    <EchoButton type="submit" className="h-[3.25rem] w-full rounded-full" isLoading={busy} loadingText="Signing in…" disabled={finished}>
                      Sign in<ArrowRight size={16} aria-hidden="true" />
                    </EchoButton>
                  </fieldset>
                </form>
              )}
            </div>

            <div className="mt-6 flex items-start gap-3 border-t border-[var(--landing-primary-15)] pt-5">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--landing-primary)]" aria-hidden="true" />
              <p className="text-xs leading-6 text-[var(--landing-muted)]">Signing in confirms your identity. Professional access still requires approved membership and multi-factor verification.</p>
            </div>
          </section>
          <p className="mt-4 text-center text-xs leading-6 text-[var(--landing-muted)]">New to ECHO? <Link href="/signup" className={`${linkStyle} text-xs`}>Create an account<ArrowRight size={13} aria-hidden="true" /></Link></p>
          <div className="flex justify-center"><Link href="/" className={`${linkStyle} text-xs text-[var(--landing-muted)]`}><ArrowLeft size={14} aria-hidden="true" />Return home</Link></div>
        </div>
      </main>
    </div>
  );
}
