"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, HeartHandshake, LayoutDashboard, Leaf, LogOut, Menu, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import type { Membership } from "@/services/professionals/professional-api";
import { getAuthService } from "@/services/authentication/auth-service.factory";
import { ProfessionalOrganizationSelect } from "./professional-organization-selector";

const links = [
  { label: "Today", href: "/professional", icon: LayoutDashboard },
  { label: "Requests", href: "/professional/requests", icon: ClipboardList },
  { label: "My cases", href: "/professional/my-cases", icon: UserRoundCheck },
  { label: "Calendar", href: "/professional/calendar", icon: CalendarDays },
  { label: "Resources", href: "/professional/resources", icon: HeartHandshake },
];

const focusStyles = "echo-focus-ring motion-reduce:transition-none";

function navigationState(href: string, pathname: string, hash: string, items: typeof links) {
  const [destination, fragment = ""] = href.split("#");
  const path = destination.split("?")[0];
  const legacyRequests = path === "/professional/requests" && pathname === "/professional" && hash === "#requests";
  const hasActiveFragment = items.some((item) => {
    const [target, anchor] = item.href.split("#");
    return anchor && target.split("?")[0] === pathname && hash === `#${anchor}`;
  });
  const active = legacyRequests || (pathname === path && (fragment ? hash === `#${fragment}` : !hasActiveFragment && !(path === "/professional" && hash === "#requests")));
  return active ? (fragment || legacyRequests ? "location" : "page") : undefined;
}

function ProfessionalNavigation({
  items,
  pathname,
  hash,
  onNavigate,
  mobile = false,
  activeItems = items,
}: {
  items: typeof links;
  pathname: string;
  hash: string;
  onNavigate: (href: string) => void;
  mobile?: boolean;
  activeItems?: typeof links;
}) {
  return (
    <nav
      aria-label={mobile ? "Professional mobile navigation" : "Professional workspace"}
      className={mobile ? "grid grid-cols-4 gap-1" : "space-y-1"}
    >
      {items.map(({ label, href, icon: Icon }) => {
        const active = navigationState(href, pathname, hash, activeItems);
        return (
          <Link
            key={label}
            href={href}
            onNavigate={() => onNavigate(href)}
            aria-current={active}
            className={`flex min-h-11 font-semibold ${
              mobile
                ? `${focusStyles} min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] text-primary hover:bg-secondary`
                : "items-center gap-3 rounded-xl px-3 text-sm hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            } ${
              mobile
                ? active ? "bg-secondary" : ""
                : active ? "bg-white/10 text-white" : "text-white/75"
            }`}
          >
            <Icon size={mobile ? 20 : 18} className="shrink-0" aria-hidden="true" />
            <span className="break-words text-center">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ProfessionalShell({
  children,
  memberships,
  organizationId,
  onOrganizationChange,
  navigationItems = links,
  accountActions,
  organizationDisabled = false,
}: {
  children: ReactNode;
  memberships?: Membership[];
  organizationId?: string;
  onOrganizationChange?: (id: string) => void;
  navigationItems?: typeof links;
  accountActions?: ReactNode;
  organizationDisabled?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navigationItems === links && organizationId
    ? links.map((item) => {
      if (!item.href.startsWith("/professional")) return item;
      const [path, fragment] = item.href.split("#");
      return { ...item, href: `${path}?organization=${encodeURIComponent(organizationId)}${fragment ? `#${fragment}` : ""}` };
    })
    : navigationItems;
  const homeHref = items[0]?.href ?? "/professional";
  const [hash, setHash] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const logoutInFlight = useRef(false);
  const [signOutError, setSignOutError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    const onResize = () => { if (window.innerWidth >= 1024) closeMenu(); };
    window.addEventListener("popstate", closeMenu);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("popstate", closeMenu);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, [pathname]);

  function syncNavigation(href: string) {
    setMenuOpen(false);
    // Next Link uses pushState for same-page anchors, which emits no hashchange.
    // onNavigate excludes modified clicks and leaves Next's routing/scroll intact.
    const [destination, fragment = ""] = href.split("#");
    const path = destination.split("?")[0];
    if (path === pathname) setHash(fragment ? `#${fragment}` : "");
  }

  async function signOut() {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setSigningOut(true);
    setSignOutError("");
    try {
      const result = await getAuthService().logout();
      if (!result.success) throw new Error(result.error.message);
      router.replace("/professional/login");
      router.refresh();
    } catch {
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      logoutInFlight.current = false;
      setSigningOut(false);
    }
  }
  const actions = accountActions === undefined ? <>
    <Link href="/dashboard" className={`${focusStyles} inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary hover:bg-secondary`}>My ECHO</Link>
    <button type="button" onClick={() => void signOut()} disabled={signingOut} className={`${focusStyles} inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-secondary disabled:opacity-50`}>
      <LogOut size={17} aria-hidden="true" /> {signingOut ? "Signing out" : "Sign out"}
    </button>
  </> : accountActions;
  return (
    <div className="min-h-dvh bg-background text-foreground [font-family:var(--font-echo-sans)]">
      <a href="#professional-content" className={`skip-to-content ${focusStyles}`}>
        Skip to workspace content
      </a>
      <div className="flex min-h-dvh w-full">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto bg-[#0d211a] px-5 py-7 text-white lg:flex" data-lenis-prevent>
          <Link
            href={homeHref}
            onNavigate={() => syncNavigation(homeHref)}
            className="mb-10 flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-[#8fc89a] text-[#0d211a]">
              <Leaf size={23} aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <strong className="block text-xl tracking-tight">ECHO</strong>
              <small className="text-xs text-white/65">Professional care</small>
            </span>
          </Link>
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/50">Workspace</p>
          <ProfessionalNavigation items={items} pathname={pathname} hash={hash} onNavigate={syncNavigation} />
          <div className="mt-auto pt-8">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-xs leading-5 text-white/75">
              <ShieldCheck size={18} className="mb-2 text-[#8fc89a]" aria-hidden="true" />
              Access is limited to your assigned cases and active organization.
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="border-b border-border/70 bg-background/95 px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-6 lg:sticky lg:top-0 lg:z-20 lg:px-9 lg:py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href={homeHref}
                  onNavigate={() => syncNavigation(homeHref)}
                  className={`${focusStyles} flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl text-primary lg:hidden`}
                  aria-label="ECHO professional home"
                >
                  <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Leaf size={21} aria-hidden="true" /></span>
                  <span className="text-left leading-tight"><strong className="block text-xl tracking-tight">ECHO</strong><span className="text-[11px] font-medium text-muted-foreground">Professional care</span></span>
                </Link>
                <span className="hidden text-sm font-semibold text-foreground lg:inline">Professional workspace</span>
              </div>
              <button type="button" aria-label="Open workspace menu" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className={`${focusStyles} grid size-11 place-items-center rounded-2xl border border-border/70 bg-card text-primary lg:hidden ${items.slice(4).some((item) => navigationState(item.href, pathname, hash, items)) ? "bg-secondary ring-1 ring-primary/20" : ""}`}><Menu size={21} aria-hidden="true" /></button>
              <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:w-auto">
                {onOrganizationChange ? <ProfessionalOrganizationSelect memberships={memberships} organizationId={organizationId} onChange={onOrganizationChange} disabled={organizationDisabled} /> : null}
                <div className="hidden items-center gap-1 lg:flex">{actions}</div>
              </div>
            </div>
            {signOutError ? <p role="alert" className="mt-2 text-xs text-danger">{signOutError}</p> : null}
          </header>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_24px_hsl(var(--foreground)/0.04)] backdrop-blur lg:hidden">
            <div className="mx-auto max-w-lg"><ProfessionalNavigation items={items.slice(0, 4)} activeItems={items} pathname={pathname} hash={hash} onNavigate={syncNavigation} mobile /></div>
          </div>
          <main id="professional-content" tabIndex={-1} className={`${focusStyles} mx-auto max-w-[1320px] scroll-mt-24 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-7 sm:px-6 lg:px-9 lg:py-9`}>{children}</main>
        </div>
      </div>
      <EchoDialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Your workspace" description={memberships?.find((item) => item.organizationId === organizationId)?.organization?.name ?? "Professional navigation and account"} size="small" className="rounded-3xl [font-family:var(--font-echo-sans)] [&_button[aria-label]]:min-h-11 [&_button[aria-label]]:min-w-11">
        <nav aria-label="Workspace menu" className="space-y-1">
          {items.map(({ label, href, icon: Icon }) => <Link key={label} href={href} onNavigate={() => syncNavigation(href)} aria-current={navigationState(href, pathname, hash, items)} className={`${focusStyles} flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-primary hover:bg-secondary aria-[current]:bg-secondary`}><Icon size={20} aria-hidden="true" />{label}</Link>)}
        </nav>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">{actions}</div>
        {signOutError ? <p role="alert" className="mt-3 text-sm text-danger">{signOutError}</p> : null}
      </EchoDialog>
    </div>
  );
}

export function ProfessionalSkeleton({ title = "Loading professional workspace", variant = "page" }: { title?: string; variant?: "page" | "content" }) {
  return (
    <div role="status" aria-busy="true" className="space-y-6" aria-label={title}>
      <span className="sr-only">{title}</span>
      {variant === "page" ? (
        <>
          <div className="space-y-3">
            <EchoSkeleton className="h-3 w-32" />
            <EchoSkeleton className="h-11 max-w-sm" />
            <EchoSkeleton className="h-4 max-w-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {[0, 1, 2].map((item) => (
              <EchoSkeleton key={item} variant="rectangular" className={item === 0 ? "col-span-2 h-28 w-full sm:col-span-1" : "h-28 w-full"} />
            ))}
          </div>
        </>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-border/70 bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-border/70 pb-5">
            <EchoSkeleton className="size-9 rounded-xl" />
            <EchoSkeleton className="h-5 w-40" />
          </div>
          <div className="space-y-4">
            {[0, 1, 2, 3].map((item) => (
              <EchoSkeleton key={item} variant="rectangular" className="h-14 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-5 sm:p-6">
          <EchoSkeleton className="h-5 w-32" />
          <EchoSkeleton className="h-3 w-full" />
          <EchoSkeleton variant="rectangular" className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

export function RequestStatus({ status }: { status: string }) {
  const label =
    status === "submitted"
      ? "Pending"
      : status === "assigned"
        ? "Assigned"
        : status === "scheduled"
          ? "Scheduled"
          : status === "closed"
            ? "Closed"
            : status === "withdrawn"
              ? "Withdrawn"
            : "Declined";
  return (
    <span className="inline-flex rounded-full border border-primary/15 bg-secondary px-3 py-1 text-xs font-bold text-primary">
      {label}
    </span>
  );
}
