"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bell,
  BadgeCheck,
  ChevronRight,
  Download,
  KeyRound,
  Lock,
  Shield,
  UserRound,
  UsersRound,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { ThemeControls } from "@/shared/theme";

const settingsLinks = [
  { href: "/settings/profile", label: "Profile", description: "Identity and appearance", icon: UserRound },
  { href: "/settings/verification", label: "Verification", description: "Unlock Buddy and AI", icon: BadgeCheck },
  { href: "/settings/privacy", label: "Privacy", description: "Private-by-design controls", icon: Shield },
  { href: "/settings/notifications", label: "Notifications", description: "Gentle reminder choices", icon: Bell },
  { href: "/settings/trusted-contacts", label: "Trusted contacts", description: "Your support circle", icon: UsersRound },
  { href: "/settings/security", label: "Security", description: "Password and sign-ins", icon: KeyRound },
  { href: "/settings/export", label: "Data & account", description: "Export or delete data", icon: Download },
];

export function SettingsShell({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="grid min-w-0 gap-5 2xl:grid-cols-[248px_minmax(0,1fr)]">
        <SettingsSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}
export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="self-start rounded-[1.6rem] border border-border/65 bg-card/88 p-3 shadow-card backdrop-blur-xl 2xl:sticky 2xl:top-[108px]">
      <div className="px-3 pb-3 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Settings</p>
        <p className="mt-1 text-sm text-muted-foreground">Shape your private ECHO space.</p>
      </div>
      <nav
        className="flex gap-2 overflow-x-auto pb-1 2xl:grid 2xl:overflow-visible"
        aria-label="Settings sections"
      >
        {settingsLinks.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-w-[190px] items-center gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-[background-color,color,transform] duration-200 hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.98] 2xl:min-w-0",
                active ? "bg-primary text-primary-foreground shadow-subtle" : "text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
                  active ? "bg-white/14 text-primary-foreground" : "bg-secondary text-primary",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[11px]",
                    active ? "text-primary-foreground/72" : "text-muted-foreground",
                  )}
                >
                  {item.description}
                </span>
              </span>
              <ChevronRight
                className={cn(
                  "ml-auto hidden h-4 w-4 shrink-0 2xl:block",
                  active ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </nav>
      <div className="mt-3 hidden rounded-2xl border border-primary/10 bg-secondary/55 p-4 2xl:block">
        <div className="flex gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-xs leading-5 text-muted-foreground">
            Changes are stored with your authenticated account and protected by owner-only database rules.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function SettingsHeader({
  id,
  title,
  description,
  showThemeControls = false,
}: {
  id?: string;
  title: string;
  description: string;
  showThemeControls?: boolean;
}) {
  return (
    <header
      id={id}
      className="mb-5 flex scroll-mt-24 flex-col gap-4 rounded-[1.6rem] border border-border/65 bg-card/82 p-5 shadow-subtle backdrop-blur-xl sm:p-6 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">ECHO settings</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {showThemeControls ? (
        <div className="w-full shrink-0 rounded-2xl border border-border/70 bg-background/75 p-4 lg:w-[370px]">
          <ThemeControls compact />
        </div>
      ) : null}
    </header>
  );
}

export function SettingsSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-[1.6rem] border border-border/65 bg-card/88 p-5 shadow-card backdrop-blur-xl sm:p-6",
        className,
      )}
    >
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-[-0.025em] text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
