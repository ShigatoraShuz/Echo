"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { useLoginViewModel } from "../view-model/use-login-view-model";
import { AuthFormField } from "../components/auth-form-field";
import { PasswordField } from "../components/password-field";
import { AuthStatusMessage } from "../components/auth-status-message";
import { AuthPrivacyNote } from "../components/auth-privacy-note";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCheckbox } from "@/shared/components/ui/echo-checkbox";
import { EchoCard } from "@/shared/components/ui/echo-card";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

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

            <EchoCheckbox
              label="Remember this session"
              description="Stay logged in on this device"
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
            />

            <EchoButton
              type="submit"
              variant="primary"
              size="large"
              className="w-full"
              isLoading={status === "submitting"}
              loadingText="Logging in..."
              disabled={status === "success"}
            >
              Log in
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </EchoButton>
          </form>

          <AuthPrivacyNote />

          <div className="space-y-2 text-sm text-muted-foreground">
            <Link href="/forgot-password" className="font-semibold text-primary">Forgot password?</Link>
            <p>
              New to ECHO? <Link href="/signup" className="font-semibold text-primary">Create an account</Link>
            </p>
          </div>
        </EchoCard>
      </EchoReveal>
    </>
  );
}
