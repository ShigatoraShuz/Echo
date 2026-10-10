"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, HeartHandshake, LayoutDashboard, Leaf, LogOut, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import type { Membership } from "@/services/professionals/professional-api";
import { getAuthService } from "@/services/authentication/auth-service.factory";

const links = [
  { label: "Today", href: "/professional", icon: LayoutDashboard },
  { label: "Requests", href: "/professional#requests", icon: ClipboardList },
  { label: "Calendar", href: "/professional#calendar", icon: CalendarDays },
  { label: "Resources", href: "/support/find-help", icon: HeartHandshake },
];

export function ProfessionalShell({
  children,
  memberships,
  organizationId,
  onOrganizationChange,
}: {
  children: ReactNode;
  memberships?: Membership[];
  organizationId?: string;
  onOrganizationChange?: (id: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  async function signOut() {
    if (signingOut) return;
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
      setSigningOut(false);
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground [font-family:var(--font-echo-sans)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 flex-col bg-[#0d211a] px-5 py-7 text-white lg:flex">
          <Link
            href="/professional"
            className="mb-10 flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-[#8fc89a] text-[#0d211a]">
              <Leaf size={23} />
            </span>
            <span className="leading-tight">
              <strong className="block text-xl tracking-tight">ECHO</strong>
              <small className="text-xs text-white/65">Professional care</small>
            </span>
          </Link>
          <nav aria-label="Professional workspace" className="space-y-1">
            {links.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                aria-current={pathname === href && !href.includes("#") ? "page" : undefined}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/15 bg-white/5 p-4 text-xs leading-5 text-white/75">
            <ShieldCheck size={18} className="mb-2 text-[#8fc89a]" aria-hidden="true" />
            Access is limited to your assigned cases and active organization.
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link
                  href="/professional"
                  className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"
                  aria-label="ECHO professional home"
                >
                  <Leaf size={18} />
                </Link>
                <span className="text-sm font-semibold text-foreground">Professional workspace</span>
              </div>
              <div className="flex items-center gap-3">
                {memberships?.some((item) => item.accessState === "active") &&
                onOrganizationChange ? (
                  <label className="text-xs font-semibold text-muted-foreground">
                    <span className="sr-only">Active organization</span>
                    <select
                      className="min-h-10 max-w-[230px] rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground"
                      value={organizationId ?? ""}
                      onChange={(event) => onOrganizationChange(event.target.value)}
                    >
                      {memberships
                        .filter((item) => item.accessState === "active")
                        .map((item) => (
                          <option key={item.id} value={item.organizationId}>
                            {item.organization?.name ?? "Organization"}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                >
                  My ECHO
                </Link>
                <button type="button" onClick={() => void signOut()} disabled={signingOut} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50">
                  <LogOut size={15} aria-hidden="true" /> {signingOut ? "Signing out" : "Sign out"}
                </button>
              </div>
            </div>
            {signOutError ? <p role="alert" className="mt-2 text-xs text-danger">{signOutError}</p> : null}
            <nav aria-label="Professional mobile navigation" className="mt-3 flex gap-1 overflow-x-auto lg:hidden">
              {links.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-9 lg:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function ProfessionalSkeleton({ title = "Loading professional workspace" }: { title?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-6" aria-label={title}>
      <span className="sr-only">{title}</span>
      <div className="space-y-3">
        <EchoSkeleton className="h-3 w-32" />
        <EchoSkeleton className="h-11 max-w-sm" />
        <EchoSkeleton className="h-4 max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <EchoSkeleton key={item} variant="rectangular" className="h-28 w-full" />
        ))}
      </div>
      <div className="space-y-3 rounded-3xl border border-border bg-card p-5">
        {[0, 1, 2, 3].map((item) => (
          <EchoSkeleton key={item} variant="rectangular" className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function RequestStatus({ status }: { status: string }) {
  const label =
    status === "submitted"
      ? "New request"
      : status === "assigned"
        ? "Accepted"
        : status === "scheduled"
          ? "Scheduled"
          : status === "closed"
            ? "Closed"
            : "Declined";
  return (
    <span className="inline-flex rounded-full border border-primary/15 bg-secondary px-3 py-1 text-xs font-bold text-primary">
      {label}
    </span>
  );
}
