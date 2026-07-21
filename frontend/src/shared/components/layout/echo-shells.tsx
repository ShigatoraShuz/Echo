"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  HeartHandshake,
  Home,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Settings,
  ShieldAlert,
  UserRound,
  Wind,
} from "lucide-react";
import { findActiveNavigation, appNavigation } from "@/config/navigation.config";
import { SyncStatus } from "@/shared/components/feedback/echo-sync-status";
import { EchoMarketingFooter } from "@/shared/components/navigation/echo-marketing-footer";

const publicLinks = [
  { href: "/journal", label: "Journal" },
  { href: "/buddy", label: "Reflective Buddy" },
  { href: "/insights/emotion", label: "Insights", menu: true },
  { href: "/tools/grounding", label: "Resources", menu: true },
  { href: "/about", label: "About ECHO" },
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
  const pathname = usePathname();
  const overlaysHero = pathname === "/";

  return (
    <header
      className={
        overlaysHero
          ? "pointer-events-none absolute inset-x-0 top-0 z-50 px-4 pt-5 sm:px-8 sm:pt-8"
          : "relative z-50 border-b border-border/60 bg-background px-4 py-4 sm:px-8"
      }
    >
      <nav className="pointer-events-auto mx-auto flex min-h-[68px] max-w-[1240px] items-center justify-between gap-5 rounded-full border border-[var(--landing-primary-10)] bg-[var(--landing-cream-95)] px-3 py-2 pl-5 shadow-[0_12px_36px_rgba(41,49,27,0.12)] backdrop-blur-xl [font-family:var(--font-echo-sans)] sm:px-4 sm:pl-7">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-full text-[var(--landing-primary)] outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)]">
            <Leaf className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-xl font-extrabold tracking-[-0.04em] sm:text-2xl">ECHO</span>
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          {publicLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-[var(--landing-ink)] outline-none transition-colors duration-150 hover:bg-[var(--landing-primary-10)] hover:text-[var(--landing-primary)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] xl:px-4"
            >
              {item.label}
              {item.menu ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/support/find-help"
            className="hidden min-h-10 items-center justify-center rounded-full border border-[var(--landing-primary-40)] px-5 text-xs font-bold text-[var(--landing-primary)] outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--landing-primary-10)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97] sm:inline-flex"
          >
            Find support
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--landing-primary)] px-5 text-xs font-bold text-[var(--landing-inverse)] outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)] active:scale-[0.97] sm:px-6"
          >
            Start privately
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  const pathname = usePathname();

  return <EchoMarketingFooter variant={pathname === "/" ? "landing" : "default"} />;
}

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={`min-h-screen bg-background text-foreground ${pathname === "/" ? "[font-family:var(--font-echo-sans)]" : ""}`}>
      <PublicNavbar />
      <main id="main-content">{children}</main>
      <PublicFooter />
    </div>
  );
}

const SIDEBAR_STORAGE_KEY = "echo-sidebar-collapsed";

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const activeId = findActiveNavigation(appNavigation, pathname);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [isFocusExpanded, setIsFocusExpanded] = useState(false);
  const isVisuallyCollapsed = collapsed && !isHoverExpanded && !isFocusExpanded;

  return (
    <>
      <aside className="min-w-0 border-b border-border/70 bg-secondary/20 px-4 py-4 sm:px-6 lg:hidden">
        <div className="min-w-0">
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

        </div>
      </aside>

      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-emerald-200/10 bg-[#071611] text-white shadow-[12px_0_40px_rgba(5,28,21,0.12)] [transition-property:width] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] lg:flex motion-reduce:transition-none ${
          isVisuallyCollapsed ? "w-[84px]" : "w-[264px]"
        }`}
        data-sidebar-state={isVisuallyCollapsed ? "collapsed" : "expanded"}
        onMouseEnter={() => {
          if (collapsed) setIsHoverExpanded(true);
        }}
        onMouseLeave={() => setIsHoverExpanded(false)}
        onFocusCapture={() => {
          if (collapsed) setIsFocusExpanded(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsFocusExpanded(false);
          }
        }}
      >
        <div className="relative flex h-[132px] shrink-0 items-start bg-[radial-gradient(circle_at_18%_0%,rgba(91,193,145,0.38),transparent_62%),linear-gradient(180deg,#174c38_0%,#0b2119_100%)] px-5 pt-7">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80"
            aria-label="ECHO dashboard"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-emerald-50 shadow-[0_10px_28px_rgba(0,0,0,0.16)] backdrop-blur-sm">
              <Leaf className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span
              className={`whitespace-nowrap text-xl font-semibold tracking-[-0.03em] text-white transition-[opacity,transform] duration-150 motion-reduce:transition-none ${
                isVisuallyCollapsed ? "pointer-events-none -translate-x-2 opacity-0" : "translate-x-0 opacity-100"
              }`}
            >
              ECHO
            </span>
          </Link>

          <button
            type="button"
            onClick={onToggle}
            className={`absolute top-8 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/15 text-emerald-50 outline-none transition-[background-color,border-color] duration-150 hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-200/80 ${
              isVisuallyCollapsed ? "right-[23px] top-[82px]" : "right-4"
            }`}
            aria-label={collapsed ? (isVisuallyCollapsed ? "Expand sidebar" : "Keep sidebar expanded") : "Collapse sidebar"}
            aria-expanded={!isVisuallyCollapsed}
            title={collapsed ? (isVisuallyCollapsed ? "Expand sidebar" : "Keep sidebar expanded") : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 py-7" aria-label="Primary navigation">
          {appLinks.map((item) => {
            const Icon = item.icon;
            const itemId = item.label.toLowerCase().replace(/\s+/g, "-");
            const isActive = activeId === itemId || activeId === item.href.split("/").filter(Boolean)[0];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex h-12 items-center rounded-xl outline-none transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${
                  isVisuallyCollapsed ? "justify-center px-0" : "gap-3 px-4"
                } ${
                  isActive
                    ? "bg-emerald-300/14 text-emerald-100"
                    : "text-emerald-50/58 hover:bg-white/[0.06] hover:text-emerald-50"
                }`}
                aria-current={isActive ? "page" : undefined}
                title={isVisuallyCollapsed ? item.label : undefined}
              >
                {isActive ? <span className="absolute left-0 h-6 w-0.5 rounded-full bg-emerald-300" aria-hidden="true" /> : null}
                <Icon className="h-[21px] w-[21px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span
                  className={`whitespace-nowrap text-[15px] font-medium transition-[opacity,transform] duration-150 motion-reduce:transition-none ${
                    isVisuallyCollapsed ? "pointer-events-none absolute -translate-x-2 opacity-0" : "translate-x-0 opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 px-3 pb-4">
          <div className="mb-3 border-t border-white/10" />
          <Link
            href="/crisis"
            className={`mb-2 flex h-11 items-center rounded-xl text-rose-200/80 outline-none transition-[background-color,color] duration-150 hover:bg-rose-300/10 hover:text-rose-100 focus-visible:ring-2 focus-visible:ring-rose-200/70 ${isVisuallyCollapsed ? "justify-center" : "gap-3 px-4"}`}
            title={isVisuallyCollapsed ? "Crisis support" : undefined}
          >
            <ShieldAlert className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span className={`whitespace-nowrap text-sm font-medium transition-opacity duration-150 ${isVisuallyCollapsed ? "pointer-events-none absolute opacity-0" : "opacity-100"}`}>
              Crisis support
            </span>
          </Link>
          <Link
            href="/settings/profile"
            className={`flex h-14 items-center rounded-xl border border-white/10 bg-white/[0.035] text-emerald-50 outline-none transition-[background-color,border-color] duration-150 hover:border-white/20 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${isVisuallyCollapsed ? "justify-center" : "gap-3 px-3"}`}
            title={isVisuallyCollapsed ? "Your profile" : undefined}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-[#0b2b20]">
              <UserRound className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className={`min-w-0 transition-[opacity,transform] duration-150 ${isVisuallyCollapsed ? "pointer-events-none absolute -translate-x-2 opacity-0" : "translate-x-0 opacity-100"}`}>
              <span className="block truncate text-sm font-semibold">Your profile</span>
              <span className="block truncate text-[11px] text-emerald-50/45">Private space</span>
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    setIsSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-w-0 flex-col lg:flex-row">
        <AppSidebar collapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
        <main id="main-content" className="min-h-screen min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
