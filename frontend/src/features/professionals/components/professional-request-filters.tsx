"use client";

import { EchoButton } from "@/shared/components/ui/echo-button";
import { useId } from "react";
import { defaultRequestFilters, type ProfessionalRequestFilters } from "../professional-request.model";

export function ProfessionalRequestFilterControls({ filters, onChange, practitioners, disabled, applied, dateError, myCases = false }: {
  filters: ProfessionalRequestFilters; onChange: (filters: ProfessionalRequestFilters) => void;
  practitioners: string[]; disabled: boolean; applied: boolean; dateError: string; myCases?: boolean;
}) {
  const update = (patch: Partial<ProfessionalRequestFilters>) => onChange({ ...filters, ...patch });
  const dateErrorId = useId();
  return <fieldset disabled={disabled} className="min-w-0 space-y-4">
    <legend className="sr-only">Search and filter loaded request metadata</legend>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="min-w-0 text-xs font-semibold">Search request ID<input type="search" className="echo-input mt-2 min-h-11" maxLength={100} placeholder="Full or partial request ID" value={filters.search} onChange={(event) => update({ search: event.target.value })} /></label>
      <label className="min-w-0 text-xs font-semibold">Submitted from<input type="date" className="echo-input mt-2 min-h-11" value={filters.from} onChange={(event) => update({ from: event.target.value })} /></label>
      <label className="min-w-0 text-xs font-semibold">Submitted through<input type="date" className="echo-input mt-2 min-h-11" min={filters.from || undefined} value={filters.to} aria-invalid={!!dateError} aria-describedby={dateError ? dateErrorId : undefined} onChange={(event) => update({ to: event.target.value })} /></label>
      {!myCases ? <label className="min-w-0 text-xs font-semibold">Assigned practitioner<select className="echo-input mt-2 min-h-11" value={filters.practitioner} onChange={(event) => update({ practitioner: event.target.value })}>
        <option value="all">All practitioners</option><option value="unassigned">Unassigned</option><option value="me">Assigned to me</option>
        {practitioners.map((id) => <option key={id} value={id}>Practitioner ID {id}</option>)}
      </select></label> : null}
      <label className="min-w-0 text-xs font-semibold">Sort requests<select className="echo-input mt-2 min-h-11" value={filters.sort} onChange={(event) => update({ sort: event.target.value as ProfessionalRequestFilters["sort"] })}>
        <option value="attention">Needs attention first</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="updated">Recently updated</option>
      </select></label>
      <div className="flex items-end"><EchoButton type="button" size="small" variant="outline" className="min-h-11" disabled={!applied} onClick={() => onChange({ ...defaultRequestFilters })}>Clear filters</EchoButton></div>
    </div>
    {dateError ? <p id={dateErrorId} role="alert" className="text-sm text-danger">{dateError}</p> : null}
    <p className="text-xs leading-6 text-muted-foreground">Search, dates, practitioners and sorting apply only to the loaded requests, up to the latest 100. Older records may be outside this view.{!myCases ? " Practitioner names are not supplied here; other assignees are identified by ID." : ""}</p>
  </fieldset>;
}
