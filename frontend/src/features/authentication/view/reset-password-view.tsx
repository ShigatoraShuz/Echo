"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useResetPasswordViewModel } from "../view-model/use-reset-password-view-model";
import { PasswordField } from "../components/password-field";
import { PasswordStrength } from "../components/password-strength";
import { AuthStatusMessage } from "../components/auth-status-message";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCard } from "@/shared/components/ui/echo-card";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

interface ResetPasswordViewProps {
  title: string;
  description: string;
}

export function ResetPasswordView({ title, description }: ResetPasswordViewProps) {
  const router = useRouter();
  const {
    password, confirmPassword, showPassword,
    passwordStrength, status, error, fieldErrors,
    setPassword, setConfirmPassword, togglePasswordVisibility,
    submit,
  } = useResetPasswordViewModel();

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
        </section>
      </EchoReveal>

      <EchoReveal direction="up" delay={150}>
        <EchoCard className="lg:mx-auto lg:w-full lg:max-w-md">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <AuthStatusMessage status={status} error={error} />

            <PasswordField
              label="New password"
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

            <EchoButton
              type="submit"
              variant="primary"
              size="large"
              className="w-full"
              isLoading={status === "submitting"}
              loadingText="Resetting..."
              disabled={status === "success"}
            >
              Reset password
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </EchoButton>
          </form>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>
              Remembered it? <Link href="/login" className="font-semibold text-primary">Return to login</Link>
            </p>
          </div>
        </EchoCard>
      </EchoReveal>
    </>
  );
}
