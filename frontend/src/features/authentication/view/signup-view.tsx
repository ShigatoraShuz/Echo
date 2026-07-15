"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, User } from "lucide-react";
import { useSignupViewModel } from "../view-model/use-signup-view-model";
import { AuthFormField } from "../components/auth-form-field";
import { PasswordField } from "../components/password-field";
import { PasswordStrength } from "../components/password-strength";
import { AuthStatusMessage } from "../components/auth-status-message";
import { AuthPrivacyNote } from "../components/auth-privacy-note";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCheckbox } from "@/shared/components/ui/echo-checkbox";
import { EchoCard } from "@/shared/components/ui/echo-card";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

interface SignupViewProps {
  title: string;
  description: string;
}

export function SignupView({ title, description }: SignupViewProps) {
  const router = useRouter();
  const {
    name, email, password, confirmPassword,
    termsAccepted, privacyAcknowledged, showPassword,
    passwordStrength, status, error, fieldErrors,
    setName, setEmail, setPassword, setConfirmPassword,
    setTermsAccepted, setPrivacyAcknowledged, togglePasswordVisibility,
    submit,
  } = useSignupViewModel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    const session = await submit();
    if (session) {
      router.push("/dashboard");
    }
  };

  return (
    <>
      <EchoReveal direction="up" className="space-y-6">
        <section className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">{description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {["Private journal", "Gentle Buddy", "Clear controls"].map((item) => (
              <div key={item} className="rounded-2xl border border-border/70 bg-card p-4 shadow-subtle">
                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-success/20 text-success">
                  <span className="text-xs font-bold">✓</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </EchoReveal>

      <EchoReveal direction="up" delay={150}>
        <EchoCard className="lg:mx-auto lg:w-full lg:max-w-md">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <AuthStatusMessage status={status} error={error} />

            <AuthFormField
              label="Display name"
              placeholder="Mira"
              leadingIcon={<User className="h-4 w-4" aria-hidden="true" />}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name?.[0]}
              required
            />

            <AuthFormField
              label="Email"
              type="email"
              placeholder="you@example.com"
              leadingIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email?.[0]}
              required
            />

            <PasswordField
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showPassword={showPassword}
              onToggleVisibility={togglePasswordVisibility}
              error={fieldErrors.password?.[0]}
              required
            />
            <PasswordStrength strength={passwordStrength} />

            <PasswordField
              label="Confirm password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              showPassword={showPassword}
              onToggleVisibility={togglePasswordVisibility}
              error={fieldErrors.confirmPassword?.[0]}
              required
            />

            <div className="space-y-3">
              <EchoCheckbox
                label="I accept the terms of use"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                error={fieldErrors.termsAccepted?.[0]}
              />
              <EchoCheckbox
                label="I acknowledge the privacy policy"
                checked={privacyAcknowledged}
                onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
                error={fieldErrors.privacyAcknowledged?.[0]}
              />
            </div>

            <EchoButton
              type="submit"
              variant="primary"
              size="large"
              className="w-full"
              isLoading={status === "submitting"}
              loadingText="Creating account..."
              disabled={status === "success"}
            >
              Create private account
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </EchoButton>
          </form>

          <AuthPrivacyNote />

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Already have an account? <Link href="/login" className="font-semibold text-primary">Log in</Link>
            </p>
          </div>
        </EchoCard>
      </EchoReveal>
    </>
  );
}
