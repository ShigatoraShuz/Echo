"use client";
import Link from "next/link";

/** Development entry; production aliases this entire module to an empty component. */
export function ProfessionalPreviewEntry({ role, organizationId }: { role: string; organizationId: string }) {
  if (process.env.NODE_ENV !== "development" || role !== "org_admin") return null;
  return <section aria-label="Clinician demonstration" className="mb-5 rounded-2xl border border-primary/20 bg-secondary/50 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-primary">Local development only</p><h2 className="mt-2 text-2xl [font-family:var(--font-echo-display)]">See the care workspace</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Explore fictional clinician screens. Your administrator role and clinical access stay unchanged.</p><Link prefetch={false} href={"/dev/professional-preview?returnOrganization=" + encodeURIComponent(organizationId)} className="echo-focus-ring mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Preview as Professional</Link></section>;
}
