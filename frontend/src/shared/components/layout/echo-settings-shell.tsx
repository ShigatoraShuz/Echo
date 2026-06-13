import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, ChevronRight, Download, KeyRound, Shield, UserRound, UsersRound } from "lucide-react";
import { ThemeControls } from "@/components/echo/theme-controls";

const settingsLinks = [
  { href: "/settings/profile", label: "Profile", icon: UserRound },
  { href: "/settings/privacy", label: "Privacy", icon: Shield },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/trusted-contacts", label: "Trusted contacts", icon: UsersRound },
  { href: "/settings/security", label: "Security", icon: KeyRound },
  { href: "/settings/export", label: "Export", icon: Download },
];

interface EchoSettingsShellProps {
  children: ReactNode;
}

export function EchoSettingsShell({ children }: EchoSettingsShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-border/70 bg-secondary/20 px-4 py-4 sm:px-6 lg:min-h-screen lg:border-b-0 lg:px-5 lg:py-8">
          <div className="lg:sticky lg:top-8">
            <Link href="/dashboard" className="mb-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-subtle">
                E
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">ECHO</span>
                <span className="block text-xs text-muted-foreground">Settings</span>
              </span>
            </Link>

            <nav className="flex gap-2 overflow-x-auto lg:grid lg:gap-2 lg:overflow-visible">
              {settingsLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-w-fit items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm font-medium text-foreground shadow-subtle transition hover:bg-muted lg:min-w-0"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {item.label}
                    <ChevronRight className="ml-auto hidden h-4 w-4 text-muted-foreground lg:block" />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-5 hidden lg:block">
              <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                <p className="text-xs leading-5 text-muted-foreground">
                  ECHO is private by design and is not a diagnostic tool.
                </p>
              </div>
            </div>
          </div>
        </aside>
        <main className="min-h-screen border-l border-border/70 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-4xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function EchoSettingsHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Settings</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      <div className="w-full shrink-0 rounded-2xl border border-border/70 bg-card p-4 shadow-subtle lg:w-[360px]">
        <ThemeControls compact />
      </div>
    </header>
  );
}
