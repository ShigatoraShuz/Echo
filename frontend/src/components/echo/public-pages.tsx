"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useState,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Mail,
  Shield,
} from "lucide-react";
import { EchoCard, EchoImage, PrivacyNotice } from "@/components/echo/shared";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCheckbox } from "@/shared/components/ui/echo-checkbox";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { EchoInput } from "@/shared/components/ui/echo-input";
import { PublicShell } from "@/components/echo/shells";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { getAuthService } from "@/features/authentication/services";
import type { AuthServiceError } from "@/features/authentication/model";
import type { EchoImageKey } from "@/lib/unsplash-images";

export function PublicTextPage({
  title,
  description,
  imageKey,
  children,
}: {
  title: string;
  description: string;
  imageKey: EchoImageKey;
  children: ReactNode;
}) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <EchoReveal direction="up" className="space-y-6">
            <div className="space-y-3">
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
            </div>
            <PrivacyNotice />
            <EchoImage imageKey={imageKey} className="aspect-[4/3]" priority />
          </EchoReveal>

          <EchoReveal direction="up" delay={150}>
            <EchoCard>{children}</EchoCard>
          </EchoReveal>
        </div>
      </main>
    </PublicShell>
  );
}

const authImageKey: Record<string, EchoImageKey> = {
  signup: "calmChairPlant",
  login: "cozyChairWindow",
  forgot: "meditationRoomPlant",
  reset: "plantDeskWarmLight",
};

const loadingLabel: Record<string, string> = {
  signup: "Creating account...",
  login: "Logging in...",
  forgot: "Sending...",
  reset: "Resetting...",
};

const submitLabel: Record<string, string> = {
  signup: "Create private account",
  login: "Log in",
  forgot: "Send reset link",
  reset: "Reset password",
};

export function AuthPage({
  title,
  description,
  mode,
}: {
  title: string;
  description: string;
  mode: "signup" | "login" | "forgot" | "reset";
}) {
  const router = useRouter();

  const isSignup = mode === "signup";
  const isLogin = mode === "login";
  const isReset = mode === "reset";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthServiceError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fieldError = (field: string): string | undefined =>
    error?.fieldErrors?.[field]?.[0];

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const authService = getAuthService();
        let result;

        if (mode === "login") {
          result = await authService.login({ email, password, rememberSession });
        } else if (mode === "signup") {
          result = await authService.signup({
            name,
            email,
            password,
            confirmPassword,
            termsAccepted,
            privacyAcknowledged,
          });
        } else if (mode === "forgot") {
          result = await authService.forgotPassword({ email });
          if (result.success) {
            setSuccessMessage(result.data.message);
            setLoading(false);
            return;
          }
        } else {
          const token =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("token") ?? ""
              : "";
          result = await authService.resetPassword({
            token,
            password,
            confirmPassword,
          });
        }

        if (result.success) {
          router.push("/dashboard");
        } else {
          setError(result.error);
        }
      } catch {
        setError({
          code: "UNKNOWN",
          message: "Something went wrong. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      mode,
      email,
      password,
      name,
      confirmPassword,
      rememberSession,
      termsAccepted,
      privacyAcknowledged,
      router,
    ],
  );

  return (
    <PublicShell>
      <main className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-[1440px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8 xl:px-10">
        <EchoReveal direction="up" className="space-y-6">
          <section className="space-y-6">
            <div className="space-y-3">
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">{description}</p>
            </div>
            {!isReset ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {["Private journal", "Gentle Buddy", "Clear controls"].map((item) => (
                  <div key={item} className="rounded-2xl border border-border/70 bg-card p-4 shadow-subtle">
                    <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <EchoImage imageKey={authImageKey[mode]} className="aspect-[16/9]" priority />
          </section>
        </EchoReveal>

        <EchoReveal direction="up" delay={150}>
          <EchoCard className="lg:mx-auto lg:w-full lg:max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {successMessage ? (
                <EchoInlineMessage variant="success" message={successMessage} />
              ) : null}

              {error && !error.fieldErrors ? (
                <EchoInlineMessage variant="error" message={error.message} />
              ) : null}

              {isSignup ? (
                <EchoInput
                  label="Display name"
                  placeholder="Mira"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={fieldError("name")}
                  required
                />
              ) : null}

              <EchoInput
                label="Email"
                type="email"
                placeholder="you@example.com"
                leadingIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldError("email")}
                required
              />

              {isLogin || isSignup || isReset ? (
                <EchoInput
                  label={isReset ? "New password" : "Password"}
                  type="password"
                  placeholder="••••••••"
                  leadingIcon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldError("password")}
                  required
                />
              ) : null}

              {isSignup || isReset ? (
                <EchoInput
                  label="Confirm password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={fieldError("confirmPassword")}
                  required
                />
              ) : null}

              {isLogin ? (
                <EchoCheckbox
                  label="Remember this session"
                  description="Stay logged in on this device"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                />
              ) : null}

              {isSignup ? (
                <div className="space-y-3">
                  <EchoCheckbox
                    label="I accept the terms of use"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    error={fieldError("termsAccepted")}
                  />
                  <EchoCheckbox
                    label="I acknowledge the privacy policy"
                    checked={privacyAcknowledged}
                    onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
                    error={fieldError("privacyAcknowledged")}
                  />
                </div>
              ) : null}

              <EchoButton
                type="submit"
                variant="primary"
                size="large"
                className="w-full"
                isLoading={loading}
                loadingText={loadingLabel[mode]}
                disabled={!!successMessage}
              >
                {submitLabel[mode]}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </EchoButton>
            </form>

            <PrivacyNotice compact />

            <div className="space-y-2 text-sm text-muted-foreground">
              {isLogin ? (
                <>
                  <Link href="/forgot-password" className="font-semibold text-primary">Forgot password?</Link>
                  <p>
                    New to ECHO? <Link href="/signup" className="font-semibold text-primary">Create an account</Link>
                  </p>
                </>
              ) : isSignup ? (
                <p>
                  Already have an account? <Link href="/login" className="font-semibold text-primary">Log in</Link>
                </p>
              ) : (
                <p>
                  Remembered it? <Link href="/login" className="font-semibold text-primary">Return to login</Link>
                </p>
              )}
            </div>
          </EchoCard>
        </EchoReveal>
      </main>
    </PublicShell>
  );
}

export function PolicyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-background p-5">
      <div className="flex gap-3">
        <Shield className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
      </div>
    </section>
  );
}
