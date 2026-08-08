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
    if (session) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="w-full max-w-[26rem] [font-family:var(--font-echo-sans)]">
      <EchoReveal direction="up">
        <section className="rounded-[1.75rem] border border-[rgba(83,103,51,0.16)] bg-[rgba(255,253,247,0.94)] px-5 py-4 text-[var(--landing-ink)] shadow-[0_24px_70px_rgba(41,49,27,0.16)] backdrop-blur-md sm:px-6 sm:py-5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:backdrop-blur-none">
          <header className="text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl border border-[var(--landing-primary-15)] bg-[var(--landing-cream)] text-[var(--landing-primary)] shadow-[0_10px_24px_rgba(41,49,27,0.1)]">
              <Leaf className="h-5 w-5" strokeWidth={2.1} aria-hidden="true" />
            </div>
            <h1 className="mt-3 text-[clamp(1.7rem,5vw,2.1rem)] font-medium leading-none tracking-[-0.045em] [font-family:var(--font-echo-display)]">
              {title}
            </h1>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[var(--landing-muted)]">{description}</p>
          </header>

          <div className="mt-4 space-y-2">
            <GoogleAuthButton intent="signup" />
            <AuthDivider />
          </div>

          <form onSubmit={handleSubmit} className="mt-3 space-y-2" noValidate>
            <AuthStatusMessage status={status} error={error} />

            <AuthFormField
              label="Display name"
              placeholder="Mira"
              leadingIcon={<User className="h-4 w-4 text-[var(--landing-primary)]" aria-hidden="true" />}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fieldErrors.name?.[0]}
              autoComplete="name"
              required
            />

            <AuthFormField
              label="Email"
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
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              showPassword={showPassword}
              onToggleVisibility={togglePasswordVisibility}
              error={fieldErrors.password?.[0]}
              autoComplete="new-password"
              required
            />
            <PasswordStrength strength={passwordStrength} />

            <PasswordField
              label="Confirm password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              showPassword={showPassword}
              onToggleVisibility={togglePasswordVisibility}
              error={fieldErrors.confirmPassword?.[0]}
              required
            />

            <aside className="rounded-2xl border border-[var(--landing-primary-15)] bg-[linear-gradient(135deg,rgba(226,237,220,0.8),rgba(255,253,247,0.9))] p-3.5">
              <div className="flex gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--landing-primary)] text-white">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xs font-bold text-[var(--landing-ink)]">Before you create your space</h2>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--landing-muted)]">
                    We collect your account details, entries you choose to save, settings, and essential security records to provide ECHO and keep your account safe.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p className="flex gap-1.5 text-[11px] leading-4 text-[var(--landing-muted)]"><Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--landing-primary)]" />Your journal remains private by default and is protected as sensitive content.</p>
                <p className="flex gap-1.5 text-[11px] leading-4 text-[var(--landing-muted)]"><BrainCircuit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--landing-primary)]" />AI-assisted reflection is optional, non-diagnostic, and only runs for entries you choose.</p>
              </div>
            </aside>

            <div className="space-y-2 pt-0.5">
              <EchoCheckbox
                label={<span>I accept the <Link href="/terms" target="_blank" className="text-[var(--landing-primary)] underline underline-offset-2">Terms of Use</Link> as versioned today</span>}
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                error={fieldErrors.termsAccepted?.[0]}
              />
              <EchoCheckbox
                label={<span>I have read the <Link href="/privacy-policy" target="_blank" className="text-[var(--landing-primary)] underline underline-offset-2">Privacy Notice</Link> and understand what ECHO collects</span>}
                checked={privacyAcknowledged}
                onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
                error={fieldErrors.privacyAcknowledged?.[0]}
              />
              <EchoCheckbox
                label="I understand my account details, saved entries, preferences, and security activity are used to provide and protect ECHO"
                checked={dataProcessingAcknowledged}
                onChange={(event) => setDataProcessingAcknowledged(event.target.checked)}
                error={fieldErrors.dataProcessingAcknowledged?.[0]}
              />
              <EchoCheckbox
                label="I understand ECHO’s optional AI-assisted features were developed for this thesis project, do not diagnose, and are not emergency monitoring"
                checked={aiFeatureAcknowledged}
                onChange={(event) => setAiFeatureAcknowledged(event.target.checked)}
                error={fieldErrors.aiFeatureAcknowledged?.[0]}
              />
              <div className="border-t border-[var(--landing-primary-10)] pt-2">
                <EchoCheckbox
                  label="Optional: allow AI-assisted analysis for journal entries I explicitly choose to analyze"
                  description="You can change this later. Declining does not affect private journaling or grounding tools."
                  checked={journalAnalysisConsent}
                  onChange={(event) => setJournalAnalysisConsent(event.target.checked)}
                />
              </div>
            </div>

            <EchoButton
              type="submit"
              variant="primary"
              size="medium"
              className="h-10 w-full rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] shadow-[0_12px_24px_rgba(83,103,51,0.24)] hover:bg-[var(--landing-primary-hover)]"
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
