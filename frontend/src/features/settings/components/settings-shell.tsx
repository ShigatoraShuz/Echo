"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bell,
  BadgeCheck,
  Download,
  KeyRound,
  Lock,
  Shield,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

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
  return children;
}

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <div className="echo-workspace-enter min-w-0 shrink-0 border-b border-border/70 pb-1">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Your space</p>
          <h1 className="mt-0.5 font-[family-name:var(--font-echo-display)] text-[1.8rem] leading-tight text-foreground">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">Shape your private ECHO space.</p>
      </div>
      <nav
        className="flex max-w-full snap-x gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                "group inline-flex min-h-10 shrink-0 snap-start items-center gap-2 border-b-2 px-3 text-sm font-semibold outline-none transition-colors hover:text-primary focus-visible:ring-4 focus-visible:ring-ring/20",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SettingsHeader({
  id,
  title,
  description,
}: {
  id?: string;
  title: string;
  description: string;
}) {
  return (
    <header
      id={id}
        className="echo-workspace-enter mb-3 flex min-w-0 scroll-mt-24 flex-col gap-3 overflow-hidden rounded-[1.35rem] border border-border/65 bg-card/82 p-4 shadow-subtle backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">ECHO settings</p>
        <h1 className="mt-1 break-words font-serif text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] text-foreground">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl break-words text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
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
        "echo-workspace-enter min-w-0 scroll-mt-24 overflow-hidden rounded-[1.35rem] border border-border/65 bg-card/88 p-4 shadow-card backdrop-blur-xl sm:rounded-[1.6rem] sm:p-5",
        className,
      )}
    >
      <div className="mb-3">
        <h2 className="text-lg font-semibold tracking-[-0.025em] text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SettingsRow({
  icon,
  title,
  description,
  action,
}: {
  icon: "profile" | "verification" | "privacy" | "notifications" | "controls" | "contacts" | "security" | "export";
  title: string;
  description: string;
  action: ReactNode;
}) {
  const iconMap = {
    profile: UserRound,
    verification: BadgeCheck,
    privacy: Lock,
    notifications: Bell,
    controls: SlidersHorizontal,
    contacts: UsersRound,
    security: KeyRound,
    export: Download,
  };
  const Icon = iconMap[icon];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/72 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0 sm:max-w-[58%]">{action}</div>
    </div>
  );
}
