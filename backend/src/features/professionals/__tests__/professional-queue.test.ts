import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
type Row = Record<string, unknown>;
function harness() {
  const rows: Row[] = Array.from({ length: 205 }, (_, i) => ({ id: `synthetic-${i.toString().padStart(3, "0")}`, organization_id: ids.org,
    assigned_to: i % 2 ? ids.actor : null, status: i % 2 ? "assigned" : "submitted",
    created_at: i < 100 ? "2026-10-01T12:00:00.000Z" : "2026-10-02T12:00:00.000Z", updated_at: "2026-10-03T12:00:00.000Z",
    user_id: ids.owner, summary_encrypted: "synthetic-private-ciphertext", preferred_time_encrypted: "synthetic-private-preference" }));
  rows.push({ ...rows[0], id: "other-tenant", organization_id: ids.otherOrg, assigned_to: ids.outsider });
  const select = vi.fn(); const from = vi.fn((table: string) => {
    const source = table === "memberships" ? [{ id: ids.actor, user_id: ids.actor, organization_id: ids.org, role: "counselor", status: "active", credential_expires_at: "2099-12-31" }]
      : table === "organizations" ? [{ id: ids.org, status: "active" }] : table === "support_requests" ? rows : [];
    const filters: ((row: Row) => boolean)[] = [];
    const sorting: [string, boolean][] = []; let first = 0, last = Infinity;
    const filtered = () => source.filter((row) => filters.every((filter) => filter(row)));
    const query = {
      select: (fields: string, options?: unknown) => { select(table, fields, options); return query; },
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      is: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      gte: (key: string, value: string) => { filters.push((row) => String(row[key]) >= value); return query; },
      lt: (key: string, value: string) => { filters.push((row) => String(row[key]) < value); return query; },
      order: (key: string, options: { ascending: boolean }) => { sorting.push([key, options.ascending]); return query; },
      range: (start: number, end: number) => { first = start; last = end; return query; },
      insert: () => query,
      maybeSingle: async () => ({ data: filtered()[0] ?? null, error: null }),
      then: (resolve: (result: { data: Row[]; error: null; count: number }) => unknown) => {
        const all = filtered().sort((a, b) => {
          for (const [key, ascending] of sorting) { const delta = String(a[key]).localeCompare(String(b[key])); if (delta) return ascending ? delta : -delta; }
          return 0;
        });
        return Promise.resolve({ data: all.slice(first, last + 1), count: all.length, error: null }).then(resolve);
      },
    };
    return query;
  });
  const service = new ProfessionalService({ schema: () => ({ from }) } as unknown as SupabaseClient, createEncryptionService(Buffer.alloc(32, 4).toString("base64"), 1), {} as JournalService);
  const app = createApp({ v1: { professionals: { service, verifier: { getUser: async () => ({ id: ids.actor, assuranceLevel: "aal2" }) }, verificationService: {} as VerificationService } } });
  return { app, service, select, from };
}
const path = `/api/v1/professional/organizations/${ids.org}/queue`;
describe("BE-012 server-scoped queue filters", () => {
  it("returns a bounded page with an exact matching total, excluding other organizations and sensitive fields", async () => {
    const h = harness(); const result = await h.service.listQueue(ids.actor, ids.org);
    expect(result.requests).toHaveLength(100); expect(result.page).toEqual({ offset: 0, limit: 100, total: 205, hasMore: true });
    expect(JSON.stringify(result)).not.toMatch(/other-tenant|synthetic-private|user_id/);
    expect(h.select).toHaveBeenCalledWith("support_requests", "id,organization_id,status,assigned_to,created_at,updated_at", { count: "exact" });
  });
  it("combines UTC date, status and authenticated-assignee filters without broadening tenant scope", async () => {
    const h = harness(); const response = await request(h.app).get(path).query({ status: "assigned", assignedTo: "me", createdFrom: "2026-10-02", createdThrough: "2026-10-02", limit: 10, offset: 50, sort: "oldest" }).set("Authorization", "Bearer synthetic");
    expect(response.status).toBe(200);
    expect(response.body.data.page).toEqual({ offset: 50, limit: 10, total: 52, hasMore: false });
    expect(response.body.data.requests).toHaveLength(2);
    expect(response.body.data.requests.every((row: { organizationId: string; assignedTo: string }) => row.organizationId === ids.org && row.assignedTo === ids.actor)).toBe(true);
  });
  it("supports unassigned filters, stable tie-breaking and an empty page beyond the end", async () => {
    const h = harness();
    const first = await h.service.listQueue(ids.actor, ids.org, { assignedTo: "unassigned", limit: 2, sort: "oldest" });
    expect(first.requests.map((item) => item.id)).toEqual(["synthetic-000", "synthetic-002"]);
    expect(first.page.total).toBe(103);
    const empty = await h.service.listQueue(ids.actor, ids.org, { offset: 300 });
    expect(empty.requests).toEqual([]); expect(empty.page).toMatchObject({ total: 205, hasMore: false });
    expect((await h.service.listQueue(ids.actor, ids.org, { assignedTo: ids.outsider })).requests).toEqual([]);
  });
  it.each([
    { organizationId: ids.otherOrg }, { userId: ids.owner }, { status: "canceled" }, { assignedTo: "invalid" },
    { limit: 101 }, { limit: 0 }, { offset: -1 }, { offset: 10001 },
    { createdFrom: "2026-02-31" }, { createdFrom: "2026-10-03", createdThrough: "2026-10-02" },
    { status: ["assigned", "closed"] },
  ])("rejects invalid or overposted filters %j before querying records", async (query) => {
    const h = harness(); const response = await request(h.app).get(path).query(query).set("Authorization", "Bearer synthetic");
    expect(response.status).toBe(400); expect(h.from).not.toHaveBeenCalled();
  });
});
