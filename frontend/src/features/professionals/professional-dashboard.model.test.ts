import { describe, expect, it } from "vitest";
import type { QueueRequest } from "@/services/professionals/professional-api";
import { professionalDashboardOverview } from "./professional-dashboard.model";

const entry = (id: string, fields: Partial<QueueRequest> = {}): QueueRequest => ({
  id, organizationId: "synthetic-org", status: "submitted", assignedTo: null,
  createdAt: "2026-10-13T09:00:00Z", updatedAt: "2026-10-13T09:00:00Z", ...fields,
});

describe("professional dashboard queue projection", () => {
  it("counts pending and assigned active cases without closed, declined, other-user or other-organization records", () => {
    const result = professionalDashboardOverview([
      entry("pending"), entry("accepted", { status: "assigned", assignedTo: "me" }),
      entry("scheduled", { status: "scheduled", assignedTo: "me" }),
      entry("closed", { status: "closed", assignedTo: "me" }), entry("declined", { status: "declined", assignedTo: "me" }),
      entry("other-assignee", { status: "scheduled", assignedTo: "other" }),
      entry("already-assigned", { assignedTo: "me" }),
      entry("other-organization", { organizationId: "other-org" }),
    ], "synthetic-org", "me");
    expect(result.pendingCount).toBe(1);
    expect(result.activeCount).toBe(2);
    expect(result.scheduledCases.map((item) => item.id)).toEqual(["scheduled"]);
    expect(result.requests.map((item) => item.id)).not.toContain("other-organization");
  });

  it("puts oldest unassigned requests first, then own accepted/scheduled cases, then other and terminal records", () => {
    const items = [
      entry("closed", { status: "closed" }), entry("other", { status: "assigned", assignedTo: "other" }),
      entry("my-scheduled", { status: "scheduled", assignedTo: "me" }), entry("my-accepted", { status: "assigned", assignedTo: "me" }),
      entry("new-pending"), entry("old-pending", { createdAt: "2026-10-01T09:00:00Z" }),
    ];
    const previous = [...items];
    expect(professionalDashboardOverview(items, "synthetic-org", "me").requests.map((item) => item.id)).toEqual([
      "old-pending", "new-pending", "my-accepted", "my-scheduled", "other", "closed",
    ]);
    expect(items).toEqual(previous);
  });

  it("orders timestamps chronologically even with different offsets", () => {
    expect(professionalDashboardOverview([
      entry("later", { createdAt: "2026-10-13T08:00:00Z" }),
      entry("earlier", { createdAt: "2026-10-13T09:00:00+08:00" }),
    ], "synthetic-org", "me").requests.map((item) => item.id)).toEqual(["earlier", "later"]);
  });

  it("returns accurate empty counts without inventing appointment dates or tasks", () => {
    expect(professionalDashboardOverview([], "synthetic-org", "me")).toEqual({ requests: [], pendingCount: 0, activeCount: 0, scheduledCases: [] });
  });
});
