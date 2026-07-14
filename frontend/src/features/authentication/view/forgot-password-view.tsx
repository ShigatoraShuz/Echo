"use client";

import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { useForgotPasswordViewModel } from "../view-model/use-forgot-password-view-model";
import { AuthFormField } from "../components/auth-form-field";
import { AuthStatusMessage } from "../components/auth-status-message";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCard } from "@/shared/components/ui/echo-card";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

interface ForgotPasswordViewProps {
  title: string;
  description: string;
}

export function ForgotPasswordView({ title, description }: ForgotPasswordViewProps) {
  const {
    email, status, error, fieldErrors, successMessage,
    setEmail, submit,
  } = useForgotPasswordViewModel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    await submit();
  };

  const handleResend = async () => {
    if (status === "submitting") return;
    await submit();
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
          {status === "success" && successMessage ? (
            <div className="space-y-4">
              <EchoInlineMessage variant="success" message={successMessage} />
              <EchoButton
                variant="ghost"
                size="medium"
                onClick={handleResend}
              >
                Resend email
              </EchoButton>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <AuthStatusMessage status={status} error={error} />

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

              <EchoButton
                type="submit"
                variant="primary"
                size="large"
                className="w-full"
                isLoading={status === "submitting"}
                loadingText="Sending..."
                disabled={status === "success"}
              >
                Send reset link
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </EchoButton>
            </form>
          )}

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
