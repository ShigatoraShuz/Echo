"use client";

import { useId } from "react";
import { ArrowRight, Building2, Check, ShieldCheck } from "lucide-react";
import type { Membership } from "@/services/professionals/professional-api";
import { approvedOrganizations, organizationAccessLabel, professionalRoleLabel } from "../professional-organizations";
import { ProfessionalPanel } from "./professional-ui";

export function ProfessionalOrganizationSelect({ memberships, organizationId, onChange, disabled = false, compact = false }: {
  memberships?: Membership[]; organizationId?: string; onChange: (id: string) => void; disabled?: boolean; compact?: boolean;
}) {
  const id = useId();
  const approved = approvedOrganizations(memberships ?? []);
  const selected = approved.find((item) => item.organizationId === organizationId);
  const loading = memberships === undefined;
  return (
    <div className={compact ? "pro-organization" : "w-full min-w-0 sm:w-[250px]"}>
      <label htmlFor={id} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Active organization</label>
      <select id={id} className="echo-focus-ring min-h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground disabled:cursor-default disabled:opacity-70"
        value={selected?.organizationId ?? ""} disabled={disabled || loading || approved.length < 2} aria-describedby={`${id}-context`} aria-busy={loading || undefined}
        onChange={(event) => { if (!disabled && approved.some((item) => item.organizationId === event.target.value)) onChange(event.target.value); }}>
        {!selected ? <option value="">{loading ? "Loading organizations…" : approved.length ? "Choose an approved organization" : "No approved organizations"}</option> : null}
        {approved.map((item) => <option key={item.id} value={item.organizationId}>{item.organization!.name} · {professionalRoleLabel(item.role)}</option>)}
      </select>
      <p id={`${id}-context`} className={compact ? "sr-only" : "mt-1.5 flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground"}>
        {selected ? <><ShieldCheck size={13} className="shrink-0 text-primary" aria-hidden="true" />{professionalRoleLabel(selected.role)} · Approved{approved.length === 1 ? " · Only organization" : ""}</> : loading ? "Checking your memberships." : "Only approved, available memberships can be selected."}
      </p>
    </div>
  );
}

/** Choice changes workspace context only; membership and case authority stay server-side. */
export function ProfessionalOrganizationChooser({ memberships, organizationId, onChange, disabled = false }: {
  memberships: Membership[]; organizationId?: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const approved = approvedOrganizations(memberships);
  return (
    <ProfessionalPanel title="Choose an organization" icon={Building2} description="Choose the organization you are working with. Each workspace shows its own requests and cases.">
      <div className="grid gap-3 sm:grid-cols-2">
        {memberships.map((item) => {
          const available = approved.some((member) => member.id === item.id);
          const current = available && item.organizationId === organizationId;
          return <button key={item.id} type="button" disabled={disabled || !available} aria-pressed={current}
            onClick={() => { if (!disabled && available && !current) onChange(item.organizationId); }}
            className={`echo-focus-ring flex min-h-36 min-w-0 flex-col items-start rounded-2xl border p-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${current ? "border-primary/40 bg-secondary/60" : "border-border bg-background enabled:hover:bg-secondary/50"}`}>
            <span className="mb-4 flex w-full items-center justify-between gap-3"><Building2 size={19} className="shrink-0 text-primary" aria-hidden="true" /><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">{current ? <Check size={14} aria-hidden="true" /> : null}{current ? "Active organization" : organizationAccessLabel(item)}</span></span>
            <span className="break-words text-sm font-semibold text-foreground">{item.organization?.name ?? "Organization unavailable"}</span>
            <span className="mt-2 text-xs leading-5 text-muted-foreground">{professionalRoleLabel(item.role)}</span>
            {item.organization?.serviceHours ? <span className="mt-2 break-words text-xs leading-5 text-muted-foreground">{item.organization.serviceHours}</span> : null}
            {available && !current ? <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary">Enter workspace<ArrowRight size={14} aria-hidden="true" /></span> : null}
          </button>;
        })}
      </div>
      {approved.length === 0 ? <p role="status" className="mt-4 text-sm leading-6 text-muted-foreground">No approved organization is available. Check your application status with your organization or ECHO administrator.</p> : null}
      <p className="mt-5 border-t border-border/70 pt-4 text-xs leading-6 text-muted-foreground">Changing organization does not approve membership or expand case access. Suspended, pending and expired memberships stay unavailable.</p>
    </ProfessionalPanel>
  );
}
