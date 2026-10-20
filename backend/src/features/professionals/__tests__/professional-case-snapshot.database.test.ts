import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";

let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261015100000_professional_case_snapshot.sql"]); }, 30_000);
beforeEach(async () => {
  await seedProfessionalDatabase(db);
  await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]);
});
afterAll(async () => db?.close());
interface Snapshot { request: Record<string, unknown>; sharedJournals: unknown[]; notes: unknown[]; timeline: { events: Array<{ id: string; action: string; at: string }>; hasMore: boolean; limit: number } }
const read = async (actor = ids.actor, requestId = ids.request) => (await db.query<{ result: Snapshot }>("select professional_service.case_snapshot($1,$2) result", [requestId, actor])).rows[0].result;

describe("transactional professional case reads", () => {
  it("returns only selected snapshots and safe recorded activity, with a committed read audit", async () => {
    await db.exec("reset role");
    await db.query("update professional_service.support_requests set shared_journal_ids=array[$1::uuid] where id=$2", [ids.owner, ids.request]);
    await db.query("insert into professional_service.shared_journals values($1,$2,$4,$4),($1,$3,$4,$4)", [ids.request, ids.owner, ids.outsider, encryptedFixture]);
    await serviceRole(db);
    await db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,$3)", [ids.request, ids.actor, encryptedFixture]);
    await db.query("insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action) values($1,$2,$3,'internal.private-diagnostic')", [ids.org, ids.request, ids.actor]);
    const result = await read();
    expect(result.request.summary_encrypted).toBe(encryptedFixture); expect(result.sharedJournals).toHaveLength(1); expect(result.notes).toHaveLength(1);
    expect(result.timeline.events.map((e) => e.action)).toEqual(expect.arrayContaining(["request.claimed", "note.created"]));
    expect(JSON.stringify(result.timeline)).not.toMatch(/private|ciphertext|actor|subject|case.opened/);
    expect(result.request).not.toHaveProperty("user_id");
    expect((await db.query("select id from professional_service.audit_events where action='case.opened'")).rows).toHaveLength(1);
  });
  it.each(["revoked", "expired"])("omits shared ciphertext when consent is %s", async (state) => {
    if (state === "revoked") await db.query("select professional_service.revoke_sharing($1,$2)", [ids.request, ids.owner]);
    else { await db.exec("reset role"); await db.query("update professional_service.support_requests set sharing_expires_at=now()-interval '1 second' where id=$1", [ids.request]); await serviceRole(db); }
    const result = await read();
    expect(result.request.summary_encrypted).toBeNull(); expect(result.request.preferred_time_encrypted).toBeNull(); expect(result.sharedJournals).toEqual([]);
  });
  it.each([ids.owner, ids.second, ids.outsider])("denies owner, unassigned and cross-tenant identities (%s)", async (actor) => {
    await expect(read(actor)).rejects.toThrow("REQUEST_NOT_FOUND");
    expect((await db.query("select id from professional_service.audit_events where action='case.opened'")).rows).toEqual([]);
  });
  it.each(["membership", "organization", "profile"])("denies changed %s eligibility", async (kind) => {
    await db.exec("reset role");
    if (kind === "membership") await db.query("update professional_service.memberships set status='suspended' where user_id=$1", [ids.actor]);
    if (kind === "organization") await db.query("update professional_service.organizations set status='suspended' where id=$1", [ids.org]);
    if (kind === "profile") await db.query("update user_service.profiles set account_status='suspended' where user_id=$1", [ids.actor]);
    await serviceRole(db); await expect(read()).rejects.toThrow("MEMBERSHIP_REQUIRED");
  });
  it("bounds history and explicitly reports truncation", async () => {
    await db.query("insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action) select $1,$2,$3,'request.updated' from generate_series(1,205)", [ids.org, ids.request, ids.owner]);
    const result = await read(); expect(result.timeline.events).toHaveLength(200); expect(result.timeline.hasMore).toBe(true);
  });
  it("never returns the snapshot when auditing fails", async () => {
    await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_read_audit_fail check(action<>'case.opened')");
    try { await serviceRole(db); await expect(read()).rejects.toThrow("synthetic_read_audit_fail"); }
    finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_read_audit_fail"); }
  });
  it.each(["anon", "authenticated"])("denies direct %s invocation despite a forged role claim", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(read()).rejects.toThrow(/permission denied/);
  });
});
