"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BrainCircuit, Database, Leaf, Mail, ShieldCheck, User } from "lucide-react";

import { AuthFormField } from "../components/auth-form-field";
import { AuthStatusMessage } from "../components/auth-status-message";
import { AuthDivider, GoogleAuthButton } from "../components/google-auth-button";
import { PasswordField } from "../components/password-field";
import { PasswordStrength } from "../components/password-strength";
import { useSignupViewModel } from "../view-model/use-signup-view-model";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCheckbox } from "@/shared/components/ui/echo-checkbox";

interface SignupViewProps {
  title: string;
  description: string;
}

export function SignupView({ title, description }: SignupViewProps) {
  const router = useRouter();
  const {
    name, email, password, confirmPassword,
    termsAccepted, privacyAcknowledged, dataProcessingAcknowledged, aiFeatureAcknowledged, journalAnalysisConsent, showPassword,
    passwordStrength, status, error, fieldErrors,
    setName, setEmail, setPassword, setConfirmPassword,
    setTermsAccepted, setPrivacyAcknowledged, setDataProcessingAcknowledged, setAiFeatureAcknowledged, setJournalAnalysisConsent, togglePasswordVisibility,
    submit,
  } = useSignupViewModel();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "submitting") return;
    const session = await submit();
    if (session) router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-[27rem] [font-family:var(--font-echo-sans)]">
      <EchoReveal direction="up">
        <section className="rounded-[1.75rem] border border-[rgba(83,103,51,0.16)] bg-[rgba(255,253,247,0.94)] px-5 py-4 text-[var(--landing-ink)] shadow-[0_24px_70px_rgba(41,49,27,0.16)] backdrop-blur-md sm:px-6 sm:py-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:backdrop-blur-none">

          {/* ── Header ──────────────────────────────────────────── */}
          <header className="flex items-center gap-3 lg:block lg:text-center">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[var(--landing-primary-15)] bg-[var(--landing-cream)] text-[var(--landing-primary)] shadow-[0_8px_18px_rgba(41,49,27,0.10)] lg:mx-auto">
              <Leaf className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
            </div>
            <div className="lg:mt-2">
              <h1 className="text-[clamp(1.4rem,4vw,1.85rem)] font-medium leading-none tracking-[-0.045em] [font-family:var(--font-echo-display)]">
                {title}
              </h1>
              <p className="mt-0.5 max-w-xs text-[11px] leading-4 text-[var(--landing-muted)] lg:mx-auto lg:max-w-sm lg:text-xs">
                {description}
              </p>
            </div>
          </header>

          {/* ── Google SSO ──────────────────────────────────────── */}
          <div className="mt-3 space-y-1.5">
            <GoogleAuthButton intent="signup" />
            <AuthDivider />
          </div>

          {/* ── Form ────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="mt-2.5 space-y-2" noValidate>
            <AuthStatusMessage status={status} error={error} />

            {/* Name + Email side by side on larger screens */}
            <div className="grid gap-2 sm:grid-cols-2">
              <AuthFormField
                label="Display name"
                placeholder="Mira"
                leadingIcon={<User className="h-3.5 w-3.5 text-[var(--landing-primary)]" aria-hidden="true" />}
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={fieldErrors.name?.[0]}
                autoComplete="name"
                required
              />
              <AuthFormField
                label="Email"
                type="email"
                placeholder="you@example.com"
                leadingIcon={<Mail className="h-3.5 w-3.5 text-[var(--landing-primary)]" aria-hidden="true" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email?.[0]}
                autoComplete="email"
                required
              />
            </div>

            {/* Password side by side */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <PasswordField
                  label="Password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  showPassword={showPassword}
                  onToggleVisibility={togglePasswordVisibility}
                  error={fieldErrors.password?.[0]}
                  autoComplete="new-password"
                  required
                />
                <PasswordStrength strength={passwordStrength} />
              </div>
              <PasswordField
                label="Confirm password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                showPassword={showPassword}
                onToggleVisibility={togglePasswordVisibility}
                error={fieldErrors.confirmPassword?.[0]}
                required
              />
            </div>

            {/* ── Privacy notice (compact) ────────────────────── */}
            <aside className="rounded-xl border border-[var(--landing-primary-15)] bg-[linear-gradient(135deg,rgba(226,237,220,0.7),rgba(255,253,247,0.85))] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--landing-primary)] text-white">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[11px] font-bold leading-4 text-[var(--landing-ink)]">Before you create your space</h2>
                  <p className="mt-0.5 text-[10px] leading-[1.45] text-[var(--landing-muted)]">
                    We collect account details, saved entries, settings, and security records to provide ECHO safely.
                  </p>
                </div>
              </div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                <p className="flex gap-1.5 text-[10px] leading-[1.4] text-[var(--landing-muted)]">
                  <Database className="mt-0.5 h-3 w-3 shrink-0 text-[var(--landing-primary)]" />
                  Journals are private and protected as sensitive content.
                </p>
                <p className="flex gap-1.5 text-[10px] leading-[1.4] text-[var(--landing-muted)]">
                  <BrainCircuit className="mt-0.5 h-3 w-3 shrink-0 text-[var(--landing-primary)]" />
                  AI reflection is optional and only runs for entries you choose.
                </p>
              </div>
            </aside>

            {/* ── Consent checkboxes (compact) ───────────────── */}
            <div className="space-y-1.5 pt-0.5">
              <EchoCheckbox
                label={<span className="text-[11px]">I accept the <Link href="/terms" target="_blank" className="text-[var(--landing-primary)] underline underline-offset-2">Terms of Use</Link> as versioned today</span>}
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                error={fieldErrors.termsAccepted?.[0]}
              />
              <EchoCheckbox
                label={<span className="text-[11px]">I have read the <Link href="/privacy-policy" target="_blank" className="text-[var(--landing-primary)] underline underline-offset-2">Privacy Notice</Link> and understand what ECHO collects</span>}
                checked={privacyAcknowledged}
                onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
                error={fieldErrors.privacyAcknowledged?.[0]}
              />
              <EchoCheckbox
                label={<span className="text-[11px]">I understand my account details, saved entries, and security activity are used to provide ECHO</span>}
                checked={dataProcessingAcknowledged}
                onChange={(e) => setDataProcessingAcknowledged(e.target.checked)}
                error={fieldErrors.dataProcessingAcknowledged?.[0]}
              />
              <EchoCheckbox
                label={<span className="text-[11px]">I understand ECHO's optional AI features are for this thesis, non-diagnostic, and not emergency monitoring</span>}
                checked={aiFeatureAcknowledged}
                onChange={(e) => setAiFeatureAcknowledged(e.target.checked)}
                error={fieldErrors.aiFeatureAcknowledged?.[0]}
              />
              <div className="border-t border-[var(--landing-primary-10)] pt-1.5">
                <EchoCheckbox
                  label={<span className="text-[11px]">Optional: allow AI analysis for journal entries I explicitly choose to analyze</span>}
                  description="You can change this later. Declining does not affect journaling or grounding tools."
                  checked={journalAnalysisConsent}
                  onChange={(e) => setJournalAnalysisConsent(e.target.checked)}
                />
              </div>
            </div>

            <EchoButton
              type="submit"
              variant="primary"
              size="medium"
              className="mt-1 h-10 w-full rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] shadow-[0_10px_20px_rgba(83,103,51,0.22)] hover:bg-[var(--landing-primary-hover)]"
              isLoading={status === "submitting"}
              loadingText="Creating account..."
              disabled={status === "success"}
            >
              Create private account
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </EchoButton>
          </form>

          <footer className="mt-2 text-center">
            <p className="text-xs text-[var(--landing-muted)]">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-[var(--landing-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]">
                Log in
              </Link>
            </p>
          </footer>
        </section>
      </EchoReveal>

      <Link href="/" className="mt-2 inline-flex w-full items-center justify-center gap-2 text-xs font-medium text-[var(--landing-muted)] outline-none transition-colors hover:text-[var(--landing-primary)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] lg:hidden">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Return home
      </Link>
    </div>
  );
}
