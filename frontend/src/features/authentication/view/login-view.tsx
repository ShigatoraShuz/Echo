"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Leaf, Mail, ShieldCheck } from "lucide-react";

import { AuthFormField } from "../components/auth-form-field";
import { AuthStatusMessage } from "../components/auth-status-message";
import { AuthDivider, GoogleAuthButton } from "../components/google-auth-button";
import { PasswordField } from "../components/password-field";
import { useLoginViewModel } from "../view-model/use-login-view-model";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCheckbox } from "@/shared/components/ui/echo-checkbox";
import { safeRedirectPath } from "@/shared/lib/safe-redirect";

interface LoginViewProps {
  title: string;
  description: string;
}

export function LoginView({ title, description }: LoginViewProps) {
  const router = useRouter();
  const {
    email, password, rememberSession, showPassword,
    status, error, fieldErrors,
    setEmail, setPassword, setRememberSession, togglePasswordVisibility,
    submit,
  } = useLoginViewModel();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "submitting") return;

    const session = await submit();
    if (session) {
      const next =
        typeof window === "undefined"
          ? "/dashboard"
          : safeRedirectPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(next);
      router.refresh();
    }
  };

  const googleNext =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next");

  return (
    <div className="w-full max-w-[26rem] [font-family:var(--font-echo-sans)]">
      <EchoReveal direction="up">
        <section className="rounded-[1.75rem] border border-[rgba(83,103,51,0.16)] bg-[rgba(255,253,247,0.94)] px-5 py-5 text-[var(--landing-ink)] shadow-[0_24px_70px_rgba(41,49,27,0.16)] backdrop-blur-md sm:px-6 sm:py-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:backdrop-blur-none">
          <header className="text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl border border-[var(--landing-primary-15)] bg-[var(--landing-cream)] text-[var(--landing-primary)] shadow-[0_10px_24px_rgba(41,49,27,0.1)]">
              <Leaf className="h-5 w-5" strokeWidth={2.1} aria-hidden="true" />
            </div>
            <h1 className="mt-3 text-[clamp(1.75rem,6vw,2.2rem)] font-medium leading-none tracking-[-0.045em] [font-family:var(--font-echo-display)]">
              {title}
            </h1>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-[var(--landing-muted)]">{description}</p>
          </header>

          <div className="mt-4 space-y-2">
            <GoogleAuthButton intent="login" next={googleNext} />
            <AuthDivider />
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-2" noValidate>
            <AuthStatusMessage status={status} error={error} />

            <AuthFormField
              label="Email address"
              type="email"
              placeholder="you@example.com"
              leadingIcon={<Mail className="h-4 w-4 text-[var(--landing-primary)]" aria-hidden="true" />}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email?.[0]}
              autoComplete="email"
              required
            />

            <PasswordField
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              showPassword={showPassword}
              onToggleVisibility={togglePasswordVisibility}
              error={fieldErrors.password?.[0]}
              required
            />

            <div className="flex items-center justify-between gap-4 pt-0.5">
              <EchoCheckbox
                label="Remember me on this device"
                checked={rememberSession}
                onChange={(event) => setRememberSession(event.target.checked)}
              />
              <Link href="/forgot-password" className="shrink-0 text-sm font-bold text-[var(--landing-primary)] outline-none transition-colors hover:text-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]">
                Forgot password?
              </Link>
            </div>
            <p className="text-[11px] leading-4 text-[var(--landing-muted)]">
              Unchecked means the session ends when you close this tab.
            </p>

            <EchoButton
              type="submit"
              variant="primary"
              size="medium"
              className="h-10 w-full rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] shadow-[0_12px_24px_rgba(83,103,51,0.24)] hover:bg-[var(--landing-primary-hover)]"
              isLoading={status === "submitting"}
              loadingText="Logging in..."
              disabled={status === "success"}
            >
              Log in
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </EchoButton>
          </form>

          <footer className="mt-3 border-t border-[rgba(83,103,51,0.14)] pt-3 text-center">
            <div className="inline-flex items-center gap-2 text-[11px] leading-4 text-[var(--landing-muted)]">
              <ShieldCheck className="h-4 w-4 text-[var(--landing-primary)]" aria-hidden="true" />
              Private by design. Not a diagnostic tool.
            </div>
            <p className="mt-2 text-xs text-[var(--landing-muted)]">
              New to ECHO?{" "}
              <Link href="/signup" className="font-bold text-[var(--landing-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]">
                Create an account
              </Link>
            </p>
          </footer>
        </section>
      </EchoReveal>

      <Link href="/" className="mt-2 inline-flex w-full items-center justify-center gap-2 text-xs font-medium text-[var(--landing-muted)] outline-none transition-colors hover:text-[var(--landing-primary)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Return home
      </Link>
    </div>
  );
}
