import { readFile, readdir } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
import { professionalWorkflowMigrations } from "../../../../tests/fixtures/professional-migrations.js";
import { installNotificationFixture } from "../../../../tests/fixtures/professional-notification-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(professionalWorkflowMigrations, installNotificationFixture); await seedProfessionalDatabase(db); }, 30_000);
afterAll(async () => db?.close());
describe("BE-030 migration and release prerequisites", () => {
  it("accounts for every professional proposal and recovered cloud baseline dependency", async () => {
    const files = (await readdir(new URL("../../../../../supabase/migrations/", import.meta.url))).filter(name => /^\d+_professional_.*\.sql$/.test(name)).sort();
    // Recovered account-erasure history needs the full platform schema. The
    // separate real-PostgreSQL release runner executes that authentic baseline;
    // this synthetic fixture executes the pending proposals and their core base.
    const manifest = JSON.parse(await readFile(new URL("../../../../../docs/releases/professional-cloud-manifest.json", import.meta.url), "utf8"));
    const recovered = manifest.baseline.filter((entry: { recoveredFromRemote?: boolean; file: string }) => entry.recoveredFromRemote && /^\d+_professional_.*\.sql$/.test(entry.file)).map((entry: { file: string }) => entry.file);
    expect(files).toEqual(["20261010090000_professional_support_portal.sql", "20261012160000_professional_credential_reviews.sql", ...recovered, "20261014100000_professional_owner_request_actions.sql", ...professionalWorkflowMigrations].sort());
  });
  it("runs the read-only preflight and confirms private grants/RLS/constraints on the combined schema", async () => {
    await db.exec("reset role");
    const sql = await readFile(new URL("../../../../scripts/professional-preflight.sql", import.meta.url), "utf8");
    const results = await db.exec(sql);
    const report = results.flatMap(r => r.rows).find((r) => "report" in (r as object)) as { report: Record<string, unknown> };
    expect(report.report).toMatchObject({ activeClinicalWithoutCredentialLink: 0, nonfiniteAppointments: 0, overlappingActiveAppointments: 0, invalidAssignmentStates: 0,
      tablesWithoutRls: 0, browserSchemaAccess: 0, browserTablePrivileges: 0, browserFunctionPrivileges: 0,
      btreeGistInstalled: true, appointmentExclusionValidated: true, caseSnapshotAvailable: true, followUpsAvailable: true, eventProcessingAvailable: true, eventHealthAvailable: true });
    expect((await db.query<{ count: number }>("select count(*)::integer count from professional_service.support_requests")).rows[0].count).toBe(1);
  });
  it("exposes only aggregate event health to trusted maintenance, including failed backlog", async () => {
    await serviceRole(db); await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]);
    const health = (await db.query<{ result: Record<string, unknown> }>("select professional_service.event_health() result")).rows[0].result;
    expect(health).toMatchObject({ pending: 1, ready: 1, failed: 0 }); expect(Object.keys(health).sort()).toEqual(["failed", "oldestPendingAt", "pending", "ready"]);
    expect(JSON.stringify(health)).not.toContain(ids.request);
    await db.exec("reset role; update professional_service.event_outbox set status='failed'"); await serviceRole(db);
    expect((await db.query<{ result: Record<string, unknown> }>("select professional_service.event_health() result")).rows[0].result).toMatchObject({ pending: 0, failed: 1, oldestPendingAt: null });
  });
  it.each(["anon", "authenticated"])("denies %s the operational health RPC", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(db.query("select professional_service.event_health()")).rejects.toThrow(/permission denied/);
  });
});
