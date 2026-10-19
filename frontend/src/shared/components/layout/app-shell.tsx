"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Bot,
  HeartHandshake,
  Home,
  Leaf,
  Settings,
  ShieldAlert,
  Wind,
  ShieldCheck,
  Stethoscope,
  Menu,
  X,
} from "lucide-react";
import { findActiveNavigation, appNavigation } from "@/config/navigation.config";
import { AppTopbar } from "@/shared/components/navigation/app-topbar";
import { NotificationBell } from "@/shared/components/navigation/notification-bell";
import { RadialBackground } from "@/shared/components/ui/light-theme-tailwind-css-background-snippet";

const navigationIcons = {
  home: Home,
  bookOpen: BookOpen,
  calendarDays: CalendarDays,
  bot: Bot,
  barChart3: BarChart3,
  wind: Wind,
  stethoscope: Stethoscope,
  heartHandshake: HeartHandshake,
  settings: Settings,
} as const;

const appLinks = appNavigation.map((item) => ({
  ...item,
  icon: navigationIcons[item.iconKey as keyof typeof navigationIcons],
}));

// --- RESPONSIVE SIDEBAR ---
export function AppSidebar({
  isExpanded,
  isMobileOpen,
  onHover,
  onCloseMobile,
  preview = false,
  publicAccess = false,
}: {
  isExpanded: boolean;
  isMobileOpen: boolean;
  onHover: (state: boolean) => void;
  onCloseMobile: () => void;
  preview?: boolean;
  publicAccess?: boolean;
}) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/settings") ? "settings" : findActiveNavigation(appNavigation, pathname);
  const visibleLinks =
    preview || publicAccess
      ? appLinks.filter((item) => item.id === "find-help" || (preview && item.id === "dashboard"))
      : appLinks;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseMobile();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

  return (
    <>
      {/* MOBILE BACKDROP */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-[250] bg-[#0d211a]/40 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        ref={sidebarRef}
        id="echo-mobile-navigation"
        role={isMobileOpen ? "dialog" : undefined}
        aria-modal={isMobileOpen ? true : undefined}
        aria-label="App navigation"
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocusCapture={() => onHover(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) onHover(false);
        }}
        className={`fixed left-0 top-0 z-[300] flex h-screen flex-col border-r border-white/10 bg-[#0d211a] text-white shadow-[25px_0_60px_rgba(0,0,0,0.25)] transition-[width,transform,border-radius] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]
        /* Mobile logic */
        ${isMobileOpen ? "visible translate-x-0 w-[280px]" : "invisible -translate-x-full lg:visible lg:translate-x-0"}
        /* Desktop logic */
        ${isExpanded ? "lg:w-72" : "lg:w-24"}
        rounded-r-[2.5rem] lg:rounded-r-[3.5rem]`}
      >
        <div className="relative flex h-20 lg:h-24 shrink-0 items-center px-6">
          <Link
            href={preview ? "/dashboard-preview" : "/dashboard"}
            className="flex items-center gap-4 overflow-hidden"
          >
            <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#8fc89a] text-[#0d211a] shadow-lg">
              <Leaf className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={2.5} />
            </div>
            <span
              className={`text-xl lg:text-2xl font-black tracking-tighter transition-opacity duration-150 ${isExpanded || isMobileOpen ? "opacity-100" : "opacity-0"}`}
            >
              ECHO
            </span>
          </Link>

          {/* Mobile Close Button */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="absolute right-4 grid h-11 w-11 place-items-center rounded-full text-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8fc89a] lg:hidden"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-3 lg:px-4 py-6 lg:py-8 overflow-y-auto overflow-x-hidden scrollbar-none">
          {visibleLinks.map((item) => {
            const Icon = item.icon;
            const isActive = (preview && item.href === "/dashboard") || activeId === item.id;
            return (
              <Link
                key={item.href}
                href={
                  preview && item.href === "/dashboard"
                    ? "/dashboard-preview"
                    : item.id === "settings" && isMobileOpen
                      ? "/settings"
                      : item.href
                }
                onClick={onCloseMobile}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex h-12 items-center rounded-2xl px-4 transition-[background-color,color,box-shadow] duration-200 ease-out ${isActive ? "bg-[#8fc89a] text-[#0d211a] shadow-[0_8px_22px_rgba(143,200,154,0.16)]" : "text-white/65 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white"}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="echo-sidebar-active-indicator"
                    className="absolute left-0 hidden h-6 w-1 rounded-r-full bg-white lg:block"
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <Icon className="h-5 w-5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5" />
                <span
                  className={`ml-4 text-sm font-bold transition-[opacity] duration-150 ease-out ${isExpanded || isMobileOpen ? "opacity-100" : "opacity-0"}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
          {(preview || publicAccess) && (
            <>
              <Link
                href="/login"
                onClick={onCloseMobile}
                className="flex h-12 items-center rounded-2xl px-4 text-sm font-bold text-white/85 hover:bg-white/10"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={onCloseMobile}
                className="flex h-12 items-center rounded-2xl px-4 text-sm font-bold text-white/85 hover:bg-white/10"
              >
                Create account
              </Link>
            </>
          )}
        </nav>

        <div className="shrink-0 px-4 pb-8 lg:pb-12 space-y-4">
          <Link
            href="/crisis"
            onClick={onCloseMobile}
            className="flex h-12 items-center px-4 text-[#ff9b8d] hover:bg-red-500/10 rounded-2xl transition-all"
          >
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span
              className={`ml-4 text-[11px] font-black uppercase tracking-widest transition-opacity duration-150 ${isExpanded || isMobileOpen ? "opacity-100" : "opacity-0"}`}
            >
              Crisis Support
            </span>
          </Link>
          {!preview && !publicAccess && (
            <Link
              href="/settings/privacy"
              onClick={onCloseMobile}
              className="group flex items-center gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-2 transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbf7ee] text-[#0d211a]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div
                className={`flex flex-col transition-opacity duration-150 ${isExpanded || isMobileOpen ? "opacity-100" : "opacity-0"}`}
              >
                <span className="text-[10px] font-black text-white uppercase">Private</span>
                <span className="text-[9px] font-medium text-[#8fc89a]/80">Encrypted</span>
              </div>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

// --- UPDATED APP SHELL ---
export function AppShell({
  children,
  preview = false,
  staticAccountControls = false,
  containedViewport = false,
  publicAccess = false,
}: {
  children: ReactNode;
  preview?: boolean;
  staticAccountControls?: boolean;
  containedViewport?: boolean;
  publicAccess?: boolean;
}) {
  const pathname = usePathname();
  const workspaceRoute =
    !preview && /^\/(journal|buddy|calendar|settings|tools\/grounding|professional-support)(\/|$)/.test(pathname);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [menuReady, setMenuReady] = useState(false);
  const [notificationViewport, setNotificationViewport] = useState<"mobile" | "desktop" | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const restoreMenuFocusRef = useRef(false);
  const closeMobileNavigation = useCallback(() => {
    restoreMenuFocusRef.current = true;
    setIsMobileOpen(false);
  }, []);
  const currentSection = pathname.startsWith("/settings")
    ? "Settings"
    : (appLinks.find((item) => item.id === findActiveNavigation(appNavigation, pathname))?.label ?? "ECHO");

  useEffect(() => setMenuReady(true), []);

  useEffect(() => setIsMobileOpen(false), [pathname]);
  useEffect(() => {
    if (preview || publicAccess || staticAccountControls) return;
    if (typeof window.matchMedia !== "function") {
      setNotificationViewport("desktop");
      return;
    }
    const media = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => setNotificationViewport(media.matches ? "mobile" : "desktop");
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, [preview, publicAccess, staticAccountControls]);
  useEffect(() => {
    if (!isMobileOpen && restoreMenuFocusRef.current) {
      restoreMenuFocusRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [isMobileOpen]);

  return (
    <div
      data-echo-app-shell
      className={`relative bg-[#fcfaf6] ${containedViewport ? "h-[100dvh] overflow-hidden" : "min-h-screen"} ${workspaceRoute ? "echo-workspace-shell" : ""}`}
    >
      <div className="fixed inset-0 z-0">
        <RadialBackground />
      </div>

      <AppSidebar
        isExpanded={isHovered}
        isMobileOpen={isMobileOpen}
        onHover={setIsHovered}
        onCloseMobile={closeMobileNavigation}
        preview={preview}
        publicAccess={publicAccess}
      />

      {/*
          LAYOUT LOGIC:
          - Mobile: pl-0 (Sidebar is hidden/overlay)
          - Desktop: pl-24 (Static space for sidebar)
      */}
      <div
        inert={isMobileOpen}
        className={`echo-workspace-content relative z-10 flex flex-col transition-[padding] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${isHovered ? "lg:pl-72" : "lg:pl-24"} ${
          containedViewport ? "h-full min-h-0" : "min-h-screen"
        }`}
      >
        {/* MOBILE TOP BAR (Trigger) */}
        <div className="sticky top-0 z-[200] grid shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 border-b border-black/5 bg-[#fcfaf6]/90 px-4 py-2 backdrop-blur-md lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            disabled={!menuReady}
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={isMobileOpen}
            aria-controls="echo-mobile-navigation"
            className="grid h-11 w-11 place-items-center rounded-full text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Menu size={24} aria-hidden="true" />
          </button>
          <span className="truncate text-center text-sm font-bold text-[#0d211a]">
            {preview ? "Dashboard preview" : currentSection}
          </span>
          {!preview && !publicAccess && !staticAccountControls ? (
            notificationViewport === "mobile" ? <NotificationBell /> : <span aria-hidden="true" />
          ) : (
            <Link
              href="/crisis"
              aria-label="Crisis support"
              className="grid h-11 w-11 place-items-center rounded-full text-[#a84443] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ShieldAlert size={20} aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* DESKTOP TOP BAR */}
        <div className="sticky top-0 z-[200] hidden shrink-0 bg-[#fcfaf6]/80 backdrop-blur-md lg:block">
          <AppTopbar
            preview={preview || staticAccountControls}
            publicAccess={publicAccess}
            showNotifications={notificationViewport === "desktop"}
          />
        </div>

        {preview && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 bg-secondary px-4 py-2 text-xs text-foreground lg:px-16"
          >
            <span>
              <strong>Dashboard preview</strong> · Sample data only. Other private pages require sign-in.
            </span>
            <Link href="/" className="font-semibold text-primary underline">
              Exit preview
            </Link>
          </div>
        )}

        <main
          className={`echo-workspace-main min-h-0 flex-1 px-4 ${workspaceRoute ? "py-3 lg:px-6 lg:py-4" : "lg:px-16"} ${
            containedViewport
              ? "overflow-hidden py-3 lg:py-3"
              : workspaceRoute
                ? ""
                : `py-6 ${preview || pathname === "/dashboard" ? "lg:py-5" : "lg:py-8"}`
          }`}
        >
          <div
            key={pathname}
            className={`echo-workspace-page mx-auto w-full ${workspaceRoute ? "max-w-none" : "max-w-[1440px]"} ${containedViewport ? "h-full min-h-0" : ""} ${
              pathname === "/dashboard" || pathname === "/dashboard-preview" ? "" : "echo-app-page-enter"
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
