import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, Shield } from "lucide-react";
import { EchoCard, EchoImage, PrivacyNotice } from "@/components/echo/shared";
import { PublicShell } from "@/components/echo/shells";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
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

export function AuthPage({
  title,
  description,
  mode,
}: {
  title: string;
  description: string;
  mode: "signup" | "login" | "forgot" | "reset";
}) {
  const isSignup = mode === "signup";
  const isLogin = mode === "login";
  const isReset = mode === "reset";

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
            <form className="space-y-4">
              {isSignup ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Display name</span>
                  <input className="echo-input" placeholder="Mira" />
                </label>
              ) : null}
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Email</span>
                <span className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                  <input className="echo-input pl-10" placeholder="you@example.com" type="email" />
                </span>
              </label>
              {isLogin || isSignup || isReset ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">{isReset ? "New password" : "Password"}</span>
                  <span className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                    <input className="echo-input pl-10" placeholder="••••••••" type="password" />
                  </span>
                </label>
              ) : null}
              {isReset ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Confirm password</span>
                  <input className="echo-input" placeholder="••••••••" type="password" />
                </label>
              ) : null}
              <button type="button" className="echo-button-primary w-full">
                {isSignup ? "Create private account" : isLogin ? "Log in" : isReset ? "Reset password" : "Send reset link"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
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
