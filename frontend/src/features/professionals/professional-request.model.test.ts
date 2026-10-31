import { describe, expect, it } from "vitest";
import type { QueueRequest } from "@/services/professionals/professional-api";
import { defaultRequestFilters, filterProfessionalRequests, isMyCase, type ProfessionalRequestFilters } from "./professional-request.model";

const rows: QueueRequest[] = [
  { id: "PENDING1-demo", organizationId: "org", status: "submitted", assignedTo: null, createdAt: "2026-10-01T12:00:00", updatedAt: "2026-10-01T12:00:00" },
  { id: "MYCASE01-demo", organizationId: "org", status: "assigned", assignedTo: "me", createdAt: "2026-10-02T12:00:00", updatedAt: "2026-10-06T12:00:00" },
  { id: "OTHER001-demo", organizationId: "org", status: "scheduled", assignedTo: "other", createdAt: "2026-10-03T12:00:00", updatedAt: "2026-10-03T12:00:00" },
];
const select = (patch: Partial<ProfessionalRequestFilters> = {}) => filterProfessionalRequests(rows, "org", "me", { ...defaultRequestFilters, ...patch });

describe("FE-010 loaded metadata filters", () => {
  it("searches full or partial IDs case-insensitively and never searches restricted fields", () => {
    expect(select({ search: "  mycase  " }).visible.map((item) => item.id)).toEqual(["MYCASE01-demo"]);
    const result = filterProfessionalRequests([{ ...rows[0], summary: "Confidential query" } as QueueRequest], "org", "me", { ...defaultRequestFilters, search: "Confidential" });
    expect(result.visible).toEqual([]);
    expect(result.scoped[0]).not.toHaveProperty("summary");
  });

  it.each([[
    { status: "assigned" }, ["MYCASE01-demo"],
  ], [{ practitioner: "me" }, ["MYCASE01-demo"]], [{ practitioner: "unassigned" }, ["PENDING1-demo"]], [{ practitioner: "other" }, ["OTHER001-demo"]], [{ mineOnly: true }, ["MYCASE01-demo"]]])("filters the selected status or practitioner %j", (patch, expected) => {
    expect(select(patch).visible.map((item) => item.id)).toEqual(expected);
  });

  it("combines inclusive local submitted dates with status and practitioner", () => {
    expect(select({ from: "2026-10-02", to: "2026-10-03" }).visible.map((item) => item.id)).toEqual(["MYCASE01-demo", "OTHER001-demo"]);
    expect(select({ from: "2026-10-02", to: "2026-10-02", status: "assigned", practitioner: "me" }).visible.map((item) => item.id)).toEqual(["MYCASE01-demo"]);
    expect(select({ from: "2026-10-04" }).visible).toEqual([]);
  });

  it("reports a reversed date range without implying unfiltered results", () => {
    expect(select({ from: "2026-10-03", to: "2026-10-01" })).toMatchObject({ visible: [], dateError: "End date must be on or after start date.", applied: true });
  });

  it.each([
    ["attention", ["PENDING1-demo", "MYCASE01-demo", "OTHER001-demo"]],
    ["newest", ["OTHER001-demo", "MYCASE01-demo", "PENDING1-demo"]],
    ["oldest", ["PENDING1-demo", "MYCASE01-demo", "OTHER001-demo"]],
    ["updated", ["MYCASE01-demo", "OTHER001-demo", "PENDING1-demo"]],
  ] as const)("sorts %s without changing the source queue", (sort, expected) => {
    expect(select({ sort }).visible.map((item) => item.id)).toEqual(expected);
    expect(rows.map((item) => item.id)).toEqual(["PENDING1-demo", "MYCASE01-demo", "OTHER001-demo"]);
  });

  it("limits practitioners, search, and results to the current organization", () => {
    const result = filterProfessionalRequests([...rows, { ...rows[0], id: "FOREIGN", organizationId: "foreign", assignedTo: "foreign-user" }], "org", "me", defaultRequestFilters);
    expect(result.practitioners).toEqual(["other"]);
    expect(result.visible).toHaveLength(3);
    expect(result.applied).toBe(false);
  });

  it("limits My Cases to actual assigned lifecycle states, including own archived cases", () => {
    expect(isMyCase({ ...rows[1], status: "closed" }, "me")).toBe(true);
    expect(isMyCase({ ...rows[1], status: "declined" }, "me")).toBe(true);
    expect(isMyCase({ ...rows[0], assignedTo: "me" }, "me")).toBe(false);
    expect(filterProfessionalRequests(rows, "org", "me", defaultRequestFilters, true).visible.map((item) => item.id)).toEqual(["MYCASE01-demo"]);
  });
});
