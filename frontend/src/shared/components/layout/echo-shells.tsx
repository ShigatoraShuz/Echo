"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  HeartHandshake,
  Home,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Settings,
  ShieldAlert,
  Wind,
} from "lucide-react";
import { findActiveNavigation, appNavigation } from "@/config/navigation.config";
import { EchoMarketingFooter } from "@/shared/components/navigation/echo-marketing-footer";
import { AppTopbar } from "@/shared/components/navigation/app-topbar";
import { RadialBackground } from "@/shared/components/ui/light-theme-tailwind-css-background-snippet";
import { ReflectionCalendarModal } from "@/features/journal/components/reflection-calendar-modal";
import authMountainLandscape from "../../../../assets/65d9d1e4-d8ca-4f30-9136-adc6924b5d82.png";

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
          ? "pointer-events-none fixed inset-x-0 top-0 z-[60] px-4 pt-5 sm:px-8 sm:pt-8"
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
            href="/signup"
            className="hidden min-h-10 items-center justify-center rounded-full border border-[var(--landing-primary-40)] px-5 text-xs font-bold text-[var(--landing-primary)] outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--landing-primary-10)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97] sm:inline-flex"
          >
            Create account
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

const SIDEBAR_STORAGE_KEY = "echo-sidebar-collapsed-v2";

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const activeId = findActiveNavigation(appNavigation, pathname);
  const isVisuallyCollapsed = collapsed;

  return (
    <div className="echo-app-sidebar-shell">
      <aside
        className={`echo-app-sidebar ${isVisuallyCollapsed ? "echo-app-sidebar--collapsed" : ""}`}
        data-sidebar-state={isVisuallyCollapsed ? "collapsed" : "expanded"}
      >
        <div className="relative flex h-[112px] shrink-0 items-start border-b border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),transparent)] px-4 pt-6">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            aria-label="ECHO dashboard"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#8fc89a] text-[var(--landing-footer)] shadow-subtle">
              <Leaf className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span
              className={`echo-app-sidebar__brand-label whitespace-nowrap text-lg font-bold tracking-[-0.04em] text-[var(--landing-inverse)] transition-[opacity,transform] duration-150 motion-reduce:transition-none ${
                isVisuallyCollapsed ? "pointer-events-none -translate-x-2 opacity-0" : "translate-x-0 opacity-100"
              }`}
            >
              ECHO
            </span>
          </Link>

          <button
            type="button"
            onClick={onToggle}
            className={`echo-app-sidebar__toggle absolute top-7 flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[var(--landing-inverse)] outline-none transition-[background-color,border-color,transform] duration-150 ease-out hover:border-white/25 hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/25 active:scale-[0.97] ${
              isVisuallyCollapsed ? "right-[22px] top-[70px]" : "right-3"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isVisuallyCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 py-5" aria-label="Primary navigation">
          {appLinks.map((item) => {
            const Icon = item.icon;
            const itemId = item.label.toLowerCase().replace(/\s+/g, "-");
            const isActive = activeId === itemId || activeId === item.href.split("/").filter(Boolean)[0];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`echo-app-sidebar__nav-link group relative flex h-11 items-center rounded-xl outline-none transition-[background-color,color,transform] duration-150 ease-out hover:translate-x-0.5 focus-visible:ring-4 focus-visible:ring-ring/20 ${
                  isVisuallyCollapsed ? "justify-center px-0" : "gap-3 px-4"
                } ${
                  isActive
                    ? "bg-[#8fc89a] text-[var(--landing-footer)]"
                    : "text-[var(--landing-inverse-80)] hover:bg-white/10 hover:text-[var(--landing-inverse)]"
                }`}
                aria-current={isActive ? "page" : undefined}
                title={isVisuallyCollapsed ? item.label : undefined}
              >
                {isActive ? <span className="absolute left-0 h-6 w-0.5 rounded-full bg-[var(--landing-inverse)]" aria-hidden="true" /> : null}
                <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span
                  className={`echo-app-sidebar__nav-label whitespace-nowrap text-sm font-medium transition-[opacity,transform] duration-150 motion-reduce:transition-none ${
                    isVisuallyCollapsed ? "pointer-events-none absolute -translate-x-2 opacity-0" : "translate-x-0 opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
          <ReflectionCalendarModal collapsed={isVisuallyCollapsed} />
        </nav>

        <div className="shrink-0 px-3 pb-4">
          <div className="mb-3 border-t border-white/10" />
          <Link
            href="/crisis"
            className={`echo-app-sidebar__footer-link mb-2 flex h-10 items-center rounded-xl text-[#ff9b8d] outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/10 hover:text-[#ffb4a8] focus-visible:ring-4 focus-visible:ring-[#ff9b8d]/25 active:scale-[0.97] ${isVisuallyCollapsed ? "justify-center" : "gap-3 px-4"}`}
            title={isVisuallyCollapsed ? "Crisis support" : undefined}
          >
            <ShieldAlert className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span className={`echo-app-sidebar__footer-label whitespace-nowrap text-sm font-medium transition-opacity duration-150 ${isVisuallyCollapsed ? "pointer-events-none absolute opacity-0" : "opacity-100"}`}>
              Crisis support
            </span>
          </Link>
          <Link
            href="/settings/privacy"
            className={`echo-app-sidebar__footer-link flex h-12 items-center rounded-xl border border-white/10 bg-white/10 text-[var(--landing-inverse)] outline-none transition-[background-color,border-color,transform] duration-150 ease-out hover:border-white/20 hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/25 active:scale-[0.97] ${isVisuallyCollapsed ? "justify-center" : "gap-3 px-3"}`}
            title={isVisuallyCollapsed ? "Private by design" : undefined}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--landing-cream)] text-[var(--landing-footer)] shadow-subtle">
              <ShieldAlert className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className={`echo-app-sidebar__footer-label min-w-0 transition-[opacity,transform] duration-150 ${isVisuallyCollapsed ? "pointer-events-none absolute -translate-x-2 opacity-0" : "translate-x-0 opacity-100"}`}>
              <span className="block truncate text-sm font-semibold">Private by design</span>
              <span className="block truncate text-[11px] text-[var(--landing-inverse-80)]">Your words stay yours</span>
            </span>
          </Link>
        </div>
      </aside>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  useEffect(() => {
    try {
      const savedState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setIsSidebarCollapsed(savedState === null ? true : savedState === "true");
    } catch {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // The sidebar still works when storage is unavailable.
      }
      return next;
    });
  };

  return (
    <div className="echo-app-canvas relative isolate min-h-screen overflow-x-clip text-foreground [font-family:var(--font-echo-sans)]">
      <RadialBackground />
      <div className="flex min-w-0">
        <AppSidebar collapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
        <div className="min-w-0 flex-1">
          <AppTopbar />
          <main id="main-content" className="echo-app-main min-w-0 px-4 py-5 sm:px-6 sm:py-7 lg:px-7 lg:py-8 xl:px-8">
            <div className="mx-auto min-w-0 max-w-[1440px]">{children}</div>
          </main>
        </div>
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
  const pathname = usePathname();
  const usesImmersiveAuthLayout = pathname === "/login" || pathname === "/signup";

  if (usesImmersiveAuthLayout) {
    return (
      <div className="min-h-screen overflow-hidden bg-[var(--landing-cream)] text-[var(--landing-ink)] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <aside className="relative hidden min-h-screen overflow-hidden lg:block" aria-label="ECHO welcome">
          <Image
            src={authMountainLandscape}
            alt="A quiet mountain valley and evergreen forest"
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 0px"
            className="object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(13,39,51,0.18)_0%,rgba(13,39,51,0.04)_38%,rgba(13,39,51,0.42)_100%)]" aria-hidden="true" />

          <div className="relative z-10 flex min-h-screen flex-col justify-between p-10 xl:p-14 [font-family:var(--font-echo-sans)]">
            <Link href="/" className="inline-flex w-fit items-center gap-2 rounded-full bg-[rgba(255,253,247,0.92)] px-4 py-2.5 text-[var(--landing-primary)] shadow-[0_12px_30px_rgba(15,41,49,0.14)] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-white/70">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)]">
                <Leaf className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-lg font-extrabold tracking-[-0.04em]">ECHO</span>
            </Link>

            <div className="max-w-md text-[var(--landing-inverse)] [text-shadow:0_2px_18px_rgba(8,30,44,0.36)]">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/80">A gentle beginning</p>
              <p className="mt-3 text-4xl font-medium leading-[0.98] tracking-[-0.045em] [font-family:var(--font-echo-display)] xl:text-5xl">
                Take one quiet step toward yourself.
              </p>
            </div>
          </div>
        </aside>

        <div className="relative flex min-h-screen min-w-0 items-center justify-center overflow-hidden bg-[#fbf8f1] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-0 xl:px-12">
          <Image
            src={authMountainLandscape}
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 0px"
            className="pointer-events-none object-cover object-[center_52%] lg:hidden"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(17,48,41,0.38)_0%,rgba(28,58,45,0.16)_45%,rgba(17,48,41,0.42)_100%)] lg:hidden" aria-hidden="true" />
          <main id="main-content" className="relative z-10 flex w-full justify-center lg:py-0">
            {children}
          </main>
        </div>
      </div>
    );
  }

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
