"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  HeartHandshake,
  Home,
  Leaf,
  PenLine,
  Settings,
  ShieldAlert,
  Wind,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { findActiveNavigation, appNavigation } from "@/config/navigation.config";
import { AppTopbar } from "@/shared/components/navigation/app-topbar";
import { EchoMarketingHeader } from "@/shared/components/navigation/echo-marketing-header";
import { EchoMarketingFooter } from "@/shared/components/navigation/echo-marketing-footer";
import { RadialBackground } from "@/shared/components/ui/light-theme-tailwind-css-background-snippet";
import { ReflectionCalendarModal } from "@/features/journal/components/reflection-calendar-modal";
import authMountainLandscape from "../../../../assets/65d9d1e4-d8ca-4f30-9136-adc6924b5d82.png";

const appLinks = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/buddy", label: "Buddy", icon: Bot },
  { href: "/insights/emotion", label: "Insights", icon: BarChart3 },
  { href: "/tools/grounding", label: "Grounding", icon: Wind },
  { href: "/support/find-help", label: "Find help", icon: HeartHandshake },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

// --- RESPONSIVE SIDEBAR ---
export function AppSidebar({
  isExpanded,
  isMobileOpen,
  onHover,
  onCloseMobile,
  preview = false,
}: {
  isExpanded: boolean;
  isMobileOpen: boolean;
  onHover: (state: boolean) => void;
  onCloseMobile: () => void;
  preview?: boolean;
}) {
  const pathname = usePathname();
  const activeId = findActiveNavigation(appNavigation, pathname);

  return (
    <>
      {/* MOBILE BACKDROP */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-[250] bg-[#0d211a]/40 backdrop-blur-sm lg:hidden" onClick={onCloseMobile} />
      )}

      <aside
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        className={`fixed left-0 top-0 z-[300] flex h-screen flex-col border-r border-white/10 bg-[#0d211a] text-white transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[25px_0_60px_rgba(0,0,0,0.25)] 
        /* Mobile logic */
        ${isMobileOpen ? "translate-x-0 w-[280px]" : "-translate-x-full lg:translate-x-0"} 
        /* Desktop logic */
        ${isExpanded ? "lg:w-72" : "lg:w-24"} 
        rounded-r-[2.5rem] lg:rounded-r-[3.5rem]`}
      >
        <div className="relative flex h-20 lg:h-24 shrink-0 items-center px-6">
          <Link href={preview ? "/dashboard-preview" : "/dashboard"} className="flex items-center gap-4 overflow-hidden">
            <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#8fc89a] text-[#0d211a] shadow-lg">
              <Leaf className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={2.5} />
            </div>
            <span
              className={`text-xl lg:text-2xl font-black tracking-tighter transition-all duration-300 ${isExpanded || isMobileOpen ? "opacity-100" : "opacity-0 invisible"}`}
            >
              ECHO
            </span>
          </Link>

          {/* Mobile Close Button */}
          <button onClick={onCloseMobile} className="absolute right-4 lg:hidden p-2 text-white/60">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-3 lg:px-4 py-6 lg:py-8 overflow-y-auto overflow-x-hidden scrollbar-none">
          {appLinks.map((item) => {
            const Icon = item.icon;
            const itemId = item.label.toLowerCase().replace(/\s+/g, "-");
            const isActive = (preview && item.href === "/dashboard") || activeId === itemId || activeId === item.href.split("/").filter(Boolean)[0];
            return (
              <Link
                key={item.href}
                href={preview && item.href === "/dashboard" ? "/dashboard-preview" : item.href}
                onClick={onCloseMobile}
                className={`group relative flex h-12 items-center rounded-2xl px-4 transition-all ${isActive ? "bg-[#8fc89a] text-[#0d211a]" : "text-white/40 hover:bg-white/5"}`}
              >
                {isActive && <div className="absolute left-0 h-6 w-1 rounded-r-full bg-white lg:block hidden" />}
                <Icon className="h-5 w-5 shrink-0" />
                <span
                  className={`ml-4 text-sm font-bold transition-all duration-300 ${isExpanded || isMobileOpen ? "opacity-100" : "opacity-0 invisible"}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
          {!preview && (
            <div className="pt-6">
              <ReflectionCalendarModal collapsed={!isExpanded && !isMobileOpen} />
            </div>
          )}
        </nav>

        <div className="shrink-0 px-4 pb-8 lg:pb-12 space-y-4">
          <Link
            href="/crisis"
            className="flex h-12 items-center px-4 text-[#ff9b8d] hover:bg-red-500/10 rounded-2xl transition-all"
          >
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span
              className={`ml-4 text-[11px] font-black uppercase tracking-widest transition-all ${isExpanded || isMobileOpen ? "opacity-100" : "opacity-0 invisible"}`}
            >
              Crisis Support
            </span>
          </Link>
          <Link
            href="/settings/privacy"
            className="group flex items-center gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-2 transition-all"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbf7ee] text-[#0d211a]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div
              className={`flex flex-col transition-all duration-300 ${isExpanded || isMobileOpen ? "opacity-100" : "opacity-0 invisible"}`}
            >
              <span className="text-[10px] font-black text-white uppercase">Private</span>
              <span className="text-[9px] font-medium text-[#8fc89a]/80">Encrypted</span>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}

// --- UPDATED APP SHELL ---
export function AppShell({
  children,
  preview = false,
  containedViewport = false,
  publicAccess = false,
}: {
  children: ReactNode;
  preview?: boolean;
  containedViewport?: boolean;
  publicAccess?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div
      data-echo-app-shell
      className={`relative bg-[#fcfaf6] ${containedViewport ? "h-[100dvh] overflow-hidden" : "min-h-screen"}`}
    >
      <div className="fixed inset-0 z-0">
        <RadialBackground />
      </div>

      <AppSidebar
        isExpanded={isHovered}
        isMobileOpen={isMobileOpen}
        onHover={setIsHovered}
        onCloseMobile={() => setIsMobileOpen(false)}
        preview={preview}
      />

      {/* 
          LAYOUT LOGIC:
          - Mobile: pl-0 (Sidebar is hidden/overlay)
          - Desktop: pl-24 (Static space for sidebar)
      */}
      <div
        className={`relative z-10 flex flex-col transition-[padding] duration-500 lg:pl-24 ${
          containedViewport ? "h-full min-h-0" : "min-h-screen"
        }`}
      >
        {/* MOBILE TOP BAR (Trigger) */}
        <div className="sticky top-0 z-[200] flex shrink-0 items-center justify-between border-b border-black/5 bg-[#fcfaf6]/80 px-4 py-3 backdrop-blur-md lg:hidden">
          <button onClick={() => setIsMobileOpen(true)} className="p-2 text-emerald-950">
            <Menu size={24} />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900 text-white">
            <Leaf size={18} />
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* DESKTOP TOP BAR */}
        <div className="sticky top-0 z-[200] hidden shrink-0 bg-[#fcfaf6]/80 backdrop-blur-md lg:block">
          <AppTopbar preview={preview} publicAccess={publicAccess} />
        </div>

        {preview && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 bg-secondary px-4 py-2 text-xs text-foreground lg:px-16">
            <span><strong>Dashboard preview</strong> · Sample data only. Other private pages require sign-in.</span>
            <Link href="/" className="font-semibold text-primary underline">Exit preview</Link>
          </div>
        )}

        <main
          className={`min-h-0 flex-1 px-4 lg:px-16 ${
            containedViewport ? "overflow-hidden py-3 lg:py-3" : "py-6 lg:py-8"
          }`}
        >
          <div className={`mx-auto w-full max-w-[1440px] ${containedViewport ? "h-full min-h-0" : ""}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

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
        <div className="w-full max-w-md">{children}</div>
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
        className="flex min-h-[100dvh] items-start justify-center px-5 py-7 sm:px-8 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-12 lg:py-8 xl:px-16"
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
