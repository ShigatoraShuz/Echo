"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, HeartHandshake, LayoutDashboard, Leaf, LogOut, Menu, Settings, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import type { Membership } from "@/services/professionals/professional-api";
import { getAuthService } from "@/services/authentication/auth-service.factory";
import { ProfessionalOrganizationSelect } from "./professional-organization-selector";
import { ProfessionalAccessContext } from "../professional-access-context";
import { ProfessionalNotificationBell } from "./professional-notification-bell";
import { ProfessionalMessagesTrigger } from "./professional-messages-trigger";
import { ProfessionalAccountMenu } from "./professional-account-menu";
import "../professional-portal.css";

const links = [
  { label: "Today", href: "/professional", icon: LayoutDashboard },
  { label: "Requests", href: "/professional/requests", icon: ClipboardList },
  { label: "My cases", href: "/professional/my-cases", icon: UserRoundCheck },
  { label: "Calendar", href: "/professional/calendar", icon: CalendarDays },
  { label: "Resources", href: "/professional/resources", icon: HeartHandshake },
  { label: "Settings", href: "/professional/settings", icon: Settings },
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
  presentation,
}: {
  children: ReactNode;
  memberships?: Membership[];
  organizationId?: string;
  onOrganizationChange?: (id: string) => void;
  navigationItems?: typeof links;
  accountActions?: ReactNode;
  organizationDisabled?: boolean;
  /** Presentation slots only; never used for authentication or role authorization. */
  presentation?: { page: string; title: string; organization: ReactNode; commands: ReactNode; onNavigate: (href: string) => void };
}) {
  const pathname = usePathname();
  const access = useContext(ProfessionalAccessContext);
  const currentMembership = (memberships ?? access?.memberships)?.find(item => item.organizationId === organizationId);
  const settingsHref = `/professional/settings${organizationId ? `?organization=${encodeURIComponent(organizationId)}` : ""}`;
  const router = useRouter();
  const items = useMemo(() => navigationItems === links && organizationId
    ? links.map((item) => {
      if (!item.href.startsWith("/professional")) return item;
      const [path, fragment] = item.href.split("#");
      return { ...item, href: `${path}?organization=${encodeURIComponent(organizationId)}${fragment ? `#${fragment}` : ""}` };
    })
    : navigationItems, [navigationItems, organizationId]);
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
    presentation?.onNavigate(href);
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
    <div data-page={presentation?.page ?? (pathname === "/professional" ? "today" : pathname.split("/")[2])} className="professional-portal min-h-dvh bg-background text-foreground [font-family:var(--font-echo-sans)]">
      <a href="#professional-content" className={`skip-to-content ${focusStyles}`}>
        Skip to workspace content
      </a>
      <div className="flex min-h-dvh w-full">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col overflow-y-auto bg-[#0d211a] px-5 py-7 text-white lg:flex" data-lenis-prevent>
          <Link
            href={homeHref}
            onNavigate={() => syncNavigation(homeHref)}
            className="mb-8 flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
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
          <header className="pro-command-header">
            <div className="pro-command">
              <Link href={homeHref} onNavigate={() => syncNavigation(homeHref)} className="echo-focus-ring pro-command-brand" aria-label="ECHO professional home"><span><Leaf size={21} aria-hidden="true" /></span><strong>ECHO<small>Professional care</small></strong></Link>
              <div className="pro-command-context"><p>Professional workspace</p><strong>{presentation?.title ?? navigationItems.find(item => item.href.split("?")[0] === pathname)?.label ?? (pathname.includes("/cases/") ? "Case workspace" : "Professional care")}</strong></div>
              <div className="pro-command-organization">{presentation?.organization ?? (onOrganizationChange ? <ProfessionalOrganizationSelect compact memberships={memberships} organizationId={organizationId} onChange={onOrganizationChange} disabled={organizationDisabled} /> : null)}</div>
              <div className="pro-command-actions">
                {presentation?.commands}
                {accountActions === undefined && !signingOut ? <><ProfessionalMessagesTrigger key={"messages:" + organizationId + ":" + (access?.userId ?? "") + ":" + pathname} organizationId={organizationId ?? ""} userId={access?.userId ?? ""} role={currentMembership?.role ?? ""} /><ProfessionalNotificationBell key={"notifications:" + organizationId + ":" + (access?.userId ?? "") + ":" + pathname} organizationId={organizationId ?? ""} userId={access?.userId ?? ""} role={currentMembership?.role ?? ""} /></> : null}
                <div className="hidden lg:block">{accountActions === undefined ? <ProfessionalAccountMenu key={organizationId + ":" + pathname} name={currentMembership?.displayName ?? ""} role={currentMembership?.role ?? ""} settingsHref={settingsHref}>{actions}</ProfessionalAccountMenu> : actions}</div>
                <button type="button" aria-label="Open workspace menu" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="echo-focus-ring pro-command-icon lg:hidden"><Menu size={21} aria-hidden="true" /></button>
              </div>
            </div>
            {signOutError ? <p role="alert" className="mt-2 text-xs text-danger">{signOutError}</p> : null}
          </header>
          <div className="pro-bottom-navigation fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_24px_hsl(var(--foreground)/0.04)] backdrop-blur lg:hidden">
            <div className="mx-auto max-w-lg"><ProfessionalNavigation items={items.slice(0, 4)} activeItems={items} pathname={pathname} hash={hash} onNavigate={syncNavigation} mobile /></div>
          </div>
          <main id="professional-content" tabIndex={-1} className={`${focusStyles} mx-auto w-full scroll-mt-24 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-7 sm:px-6 lg:px-7 lg:py-6 xl:px-9`}>{signingOut ? <ProfessionalSkeleton title="Signing out of professional workspace" variant="content" /> : children}</main>
        </div>
      </div>
      <EchoDialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Your workspace" description={memberships?.find((item) => item.organizationId === organizationId)?.organization?.name ?? "Professional navigation and account"} size="small" className="rounded-3xl [font-family:var(--font-echo-sans)] [&_button[aria-label]]:min-h-11 [&_button[aria-label]]:min-w-11">
        <nav aria-label="Workspace menu" className="space-y-1">
          {items.map(({ label, href, icon: Icon }) => <Link key={label} href={href} onNavigate={() => syncNavigation(href)} aria-current={navigationState(href, pathname, hash, items)} className={`${focusStyles} flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-primary hover:bg-secondary aria-[current]:bg-secondary`}><Icon size={20} aria-hidden="true" />{label}</Link>)}
        </nav>
        <div className="mt-5 border-t border-border pt-4"><p className="mb-2 text-sm font-semibold">{currentMembership?.displayName}</p><div className="flex flex-wrap gap-2">{actions}</div></div>
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
