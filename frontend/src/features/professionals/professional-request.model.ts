import type { QueueRequest } from "@/services/professionals/professional-api";
import { isMyActiveCase, professionalDashboardOverview } from "./professional-dashboard.model";
import { normalizeError } from "@/shared/errors/normalize-error";
import { professionalAccessFailure, type ProfessionalAccessFailure } from "./professional-access-feedback";

/** Whitelist metadata. Never carry case summaries, journals or notes into queue state. */
export function scopedRequestMetadata(items: QueueRequest[], organizationId: string): QueueRequest[] {
  return items.filter((item) => item.organizationId === organizationId).map((item) => ({
    id: item.id, organizationId: item.organizationId, status: item.status, assignedTo: item.assignedTo,
    createdAt: item.createdAt, updatedAt: item.updatedAt,
  }));
}

export const requestDate = (value: string) => Number.isNaN(Date.parse(value)) ? "Date unavailable"
  : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export const professionalCaseHref = (id: string, organizationId: string) =>
  `/professional/cases/${encodeURIComponent(id)}?organization=${encodeURIComponent(organizationId)}`;

export const isMyCase = (item: QueueRequest, userId: string) => item.assignedTo === userId
  && ["assigned", "scheduled", "closed", "declined"].includes(item.status);

export function professionalClaimFailure(reason: unknown): ProfessionalAccessFailure {
  const error = normalizeError(reason);
  if (error.statusCode === 409 || String(error.code) === "REQUEST_ALREADY_ASSIGNED") return {
    kind: "validation", title: "Request already accepted or changed", retry: true, conceal: false,
    message: "Another professional may have accepted this request, or its status changed. Refresh the queue before choosing an available request.",
  };
  const failure = professionalAccessFailure(reason);
  if (["network", "server", "unknown"].includes(failure.kind)) return {
    ...failure, message: "Acceptance could not be confirmed. Refresh the queue to check the current assignment before trying again. No success has been reported.",
  };
  if (failure.kind === "validation") return { ...failure, retry: true, message: "This request cannot be accepted in its current state. Refresh the queue to check its availability." };
  return failure;
}

export interface ProfessionalRequestFilters {
  search: string; status: string; from: string; to: string; practitioner: string;
  sort: "attention" | "newest" | "oldest" | "updated"; mineOnly: boolean;
}
export const defaultRequestFilters: ProfessionalRequestFilters = {
  search: "", status: "all", from: "", to: "", practitioner: "all", sort: "attention", mineOnly: false,
};

/** Dates match the local calendar used to display submitted timestamps. */
function localRequestDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function filterProfessionalRequests(items: QueueRequest[], organizationId: string, userId: string, filters: ProfessionalRequestFilters, myCases = false) {
  const scoped = scopedRequestMetadata(items, organizationId).filter((item) => !myCases || isMyCase(item, userId));
  const dateError = filters.from && filters.to && filters.from > filters.to ? "End date must be on or after start date." : "";
  const query = filters.search.trim().toLowerCase();
  const matches = dateError ? [] : scoped.filter((item) => {
    const day = localRequestDay(item.createdAt);
    const practitioner = filters.practitioner === "all" || (filters.practitioner === "unassigned" ? item.assignedTo === null
      : filters.practitioner === "me" ? item.assignedTo === userId : item.assignedTo === filters.practitioner);
    return item.id.toLowerCase().includes(query) && (filters.status === "all" || item.status === filters.status)
      && (!filters.from || !!day && day >= filters.from) && (!filters.to || !!day && day <= filters.to)
      && practitioner && (!filters.mineOnly || isMyActiveCase(item, userId));
  });
  const visible = filters.sort === "attention" ? professionalDashboardOverview(matches, organizationId, userId).requests
    : matches.sort((a, b) => {
      const timestamp = (value: string) => Date.parse(value) || 0;
      const order = filters.sort === "oldest" ? timestamp(a.createdAt) - timestamp(b.createdAt)
        : filters.sort === "newest" ? timestamp(b.createdAt) - timestamp(a.createdAt) : timestamp(b.updatedAt) - timestamp(a.updatedAt);
      return order || a.id.localeCompare(b.id);
    });
  const practitioners = [...new Set(scoped.flatMap((item) => item.assignedTo && item.assignedTo !== userId ? [item.assignedTo] : []))].sort();
  const applied = Object.keys(defaultRequestFilters).some((key) => filters[key as keyof ProfessionalRequestFilters] !== defaultRequestFilters[key as keyof ProfessionalRequestFilters]);
  return { scoped, visible, practitioners, applied, dateError };
}
