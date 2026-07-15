"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { EchoCrisisBanner } from "../crisis/echo-crisis-banner";

const appLinks = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/buddy", label: "Buddy", icon: Bot },
  { href: "/insights/emotion", label: "Insights", icon: BarChart3 },
  { href: "/tools/grounding", label: "Grounding", icon: Wind },
  { href: "/support/find-help", label: "Find help", icon: HeartHandshake },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export function EchoSidebar() {
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
              const isActive =
                activeId === item.label.toLowerCase().replace(/\s+/g, "-") ||
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
