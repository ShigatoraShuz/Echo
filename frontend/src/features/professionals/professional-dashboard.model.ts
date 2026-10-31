import type { QueueRequest } from "@/services/professionals/professional-api";

export const isMyActiveCase = (item: QueueRequest, userId: string) =>
  item.assignedTo === userId && (item.status === "assigned" || item.status === "scheduled");

export const isPendingRequest = (item: QueueRequest) => item.status === "submitted" && item.assignedTo === null;

/** Counts describe the returned queue (currently capped at 100), not organization-wide totals. */
export function professionalDashboardOverview(items: QueueRequest[], organizationId: string, userId: string) {
  const priority = (item: QueueRequest) => isPendingRequest(item) ? 0
    : isMyActiveCase(item, userId) ? (item.status === "assigned" ? 1 : 2)
    : item.status === "closed" || item.status === "declined" ? 4 : 3;
  const requests = items.filter((item) => item.organizationId === organizationId).sort((a, b) => {
    const rank = priority(a) - priority(b);
    if (rank) return rank;
    // Oldest pending requests first; remaining entries retain recent-request ordering.
    const timestamp = (value: string) => Date.parse(value) || 0;
    const date = priority(a) === 0 ? timestamp(a.createdAt) - timestamp(b.createdAt) : timestamp(b.createdAt) - timestamp(a.createdAt);
    return date || a.id.localeCompare(b.id);
  });
  return {
    requests,
    pendingCount: requests.filter(isPendingRequest).length,
    activeCount: requests.filter((item) => isMyActiveCase(item, userId)).length,
    scheduledCases: requests.filter((item) => item.status === "scheduled" && item.assignedTo === userId),
  };
}
