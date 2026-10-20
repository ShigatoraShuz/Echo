"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Leaf, PenLine, ShieldCheck } from "lucide-react";
import { EchoMarketingHeader } from "@/shared/components/navigation/echo-marketing-header";
import { EchoMarketingFooter } from "@/shared/components/navigation/echo-marketing-footer";
import authMountainLandscape from "../../../../assets/65d9d1e4-d8ca-4f30-9136-adc6924b5d82.png";

export { AppShell, AppSidebar } from "./app-shell";

// --- OTHER EXPORTS TO PREVENT ERRORS ---
export function AuthLinkCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background p-4 text-sm shadow-subtle hover:bg-muted"
    >
      <span>
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-muted-foreground">{description}</span>
      </span>
      <PenLine className="h-4 w-4 text-primary" />
    </Link>
  );
}

export function FloatingActionButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 flex items-center gap-2 rounded-full bg-emerald-900 px-6 py-3 text-sm font-bold text-white shadow-2xl z-50 transition-transform active:scale-95"
    >
      <PenLine className="h-4 w-4" /> {label}
    </Link>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const usesImmersive = pathname === "/login" || pathname === "/signup" || pathname === "/admin-login";
  if (!usesImmersive)
    return (
      <div className="echo-fixed-light echo-auth-surface grid min-h-[100dvh] place-items-center px-4 py-12">
        <div className="min-w-0 w-full max-w-md">{children}</div>
      </div>
    );
  return (
    <div className="echo-fixed-light echo-auth-surface grid min-h-[100dvh] lg:h-[100dvh] lg:grid-cols-[44%_56%] lg:overflow-hidden">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src={authMountainLandscape}
          alt="A quiet mountain and forest landscape"
          fill
          sizes="44vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,35,24,0.22),rgba(10,35,24,0.36)_48%,rgba(9,31,21,0.84))]" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-8 xl:p-10">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-full text-white outline-none focus-visible:ring-4 focus-visible:ring-white/25"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur-md">
              <Leaf className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-extrabold tracking-[-0.04em]">ECHO</span>
          </Link>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
            Private by design
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-8 text-white xl:p-10">
          <div className="max-w-md rounded-[1.5rem] border border-white/15 bg-[#102718]/45 p-6 backdrop-blur-md">
            <ShieldCheck className="h-5 w-5 text-[#cfdda7]" aria-hidden="true" />
            <p className="mt-4 text-[clamp(2rem,3.3vw,3.6rem)] font-medium leading-[0.92] tracking-[-0.045em] [font-family:var(--font-echo-display)]">
              A quieter place to come back to yourself.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/72">
              Journal privately, notice patterns, and choose one gentle next step at your own pace.
            </p>
          </div>
        </div>
      </aside>
      <main
        data-lenis-prevent
        className="flex min-h-[100dvh] min-w-0 items-start justify-center px-5 py-7 sm:px-8 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-12 lg:py-8 xl:px-16"
      >
        {children}
      </main>
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="echo-fixed-light echo-public-surface flex min-h-screen flex-col">
      <EchoMarketingHeader />
      <main className="flex-1">{children}</main>
      <EchoMarketingFooter variant="landing" compact={pathname === "/privacy-policy" || pathname === "/about"} />
    </div>
  );
}

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="echo-fixed-light echo-onboarding-surface min-h-[100dvh] overflow-x-hidden">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1440px] items-center px-3 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        {children}
      </div>
    </div>
  );
}
