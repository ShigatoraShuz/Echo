"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  ChevronRight,
  HeartHandshake,
  Home,
  PenLine,
  Settings,
  ShieldAlert,
  Wind,
} from "lucide-react";
import { findActiveNavigation, appNavigation } from "@/config/navigation.config";
import { SyncStatus } from "@/components/echo/sync-status";
import { PrivacyNotice } from "@/components/echo/shared";
import { EchoMarketingFooter } from "@/components/ui/footer";

const publicLinks = [
  { href: "/about", label: "About" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/crisis-help", label: "Crisis help" },
];

const appLinks = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/buddy", label: "Buddy", icon: Bot },
  { href: "/insights/emotion", label: "Insights", icon: BarChart3 },
  { href: "/tools/grounding", label: "Grounding", icon: Wind },
  { href: "/support/find-help", label: "Find help", icon: HeartHandshake },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export function PublicNavbar() {
  return (
    <header className="border-b border-border/70 bg-background/90">
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-subtle">
            E
          </span>
          <span className="text-sm font-semibold text-foreground">ECHO</span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {publicLinks.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/login" className="echo-button-ghost h-10 px-4">
            Log in
          </Link>
          <Link href="/signup" className="echo-button-primary h-10 px-4">
            Start
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return <EchoMarketingFooter />;
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />
      <main id="main-content">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const activeId = findActiveNavigation(appNavigation, pathname);

  return (
    <aside className="min-w-0 border-b border-border/70 bg-secondary/20 px-4 py-4 sm:px-6 lg:min-h-screen lg:border-b-0 lg:px-5 lg:py-8">
      <div className="min-w-0 lg:sticky lg:top-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-subtle">
              E
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">ECHO</span>
              <span className="block text-xs text-muted-foreground">Private app</span>
            </span>
          </Link>
          <SyncStatus />
        </div>

        <div className="max-w-full min-w-0 pb-2 lg:pb-0">
          <nav className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {appLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.label.toLowerCase().replace(/\s+/g, "-") ||
                activeId === item.href.split("/").filter(Boolean)[0];

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-w-0 items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium shadow-subtle transition hover:bg-muted sm:text-sm lg:gap-3 lg:px-4 ${
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/70 bg-card text-foreground"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                  <ChevronRight className="ml-auto hidden h-4 w-4 text-muted-foreground lg:block" aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-5 hidden lg:block">
          <Link href="/crisis" className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-crisis-soft p-4 text-sm font-semibold text-foreground">
            <ShieldAlert className="h-5 w-5 text-danger" aria-hidden="true" />
            Crisis support
          </Link>
        </div>

        <div className="mt-5 hidden lg:block">
          <PrivacyNotice compact />
        </div>
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-w-0 max-w-[1440px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <AppSidebar />
        <main id="main-content" className="min-w-0 min-h-screen border-l border-border/70 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto min-w-0 max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AuthLinkCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background p-4 text-sm shadow-subtle hover:bg-muted">
      <span>
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-muted-foreground">{description}</span>
      </span>
      <PenLine className="h-4 w-4 text-primary" aria-hidden="true" />
    </Link>
  );
}

export function FloatingActionButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="echo-button-primary">
      <PenLine className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main id="main-content" className="mx-auto max-w-md px-4 py-12 sm:py-16">
        {children}
      </main>
    </div>
  );
}

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main id="main-content" className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}
