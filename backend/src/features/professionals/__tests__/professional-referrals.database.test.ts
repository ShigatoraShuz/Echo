import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261015100000_professional_case_snapshot.sql", "20261015110000_professional_consent.sql", "20261015120000_professional_notes.sql", "20261015130000_professional_case_handover.sql", "20261016120000_professional_follow_ups.sql", "20261016130000_professional_referral_lifecycle.sql"]); }, 30_000);
beforeEach(async () => { await seedProfessionalDatabase(db); await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]); });
afterAll(async () => db?.close());
type Referral = { id: string; status: string; revision: number };
const create = async (actor = ids.actor, name = "Synthetic service", url: string | null = "https://synthetic.invalid/resource") => (await db.query<Referral>("select * from professional_service.record_referral($1,$2,$3,$4,$5)", [ids.request, actor, name, url, ids.owner])).rows[0];
const update = async (id: string, status = "completed", revision = 1, actor = ids.actor) => (await db.query<Referral>("select * from professional_service.set_referral_status($1,$2,$3,$4,$5)", [ids.request, id, actor, status, revision])).rows[0];
const list = async (actor = ids.actor) => (await db.query<{ result: { items: Array<{ delivery: string; history: Array<{ status: string }> }>; total: number } }>("select professional_service.list_referrals($1,$2) result", [ids.request, actor])).rows[0].result;
describe("internal referral lifecycle", () => {
  it("records and completes once with truthful delivery state and immutable history", async () => {
    const f = await create(); expect(f).toMatchObject({ status: "recorded", revision: 1 }); expect(await create()).toEqual(f);
    const done = await update(f.id); expect(done).toMatchObject({ status: "completed", revision: 2 }); expect(await update(f.id)).toEqual(done);
    const page = await list(); expect(page.total).toBe(1); expect(page.items[0].delivery).toBe("not_integrated"); expect(page.items[0].history.map(h => h.status)).toEqual(["recorded", "completed"]);
    await expect(update(f.id, "canceled", 2)).rejects.toThrow("REFERRAL_CONFLICT");
  });
  it("rejects reused submissions with altered resource details", async () => {
    await create(); await expect(create(ids.actor, "Different service")).rejects.toThrow("REFERRAL_CONFLICT");
  });
  it.each([ids.owner, ids.second, ids.outsider])("denies actor %s on reads and writes", async (actor) => {
    const f = await create(); await expect(create(actor)).rejects.toThrow("REQUEST_NOT_FOUND"); await expect(list(actor)).rejects.toThrow("REQUEST_NOT_FOUND"); await expect(update(f.id, "completed", 1, actor)).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it("uses current assignee after handover and never transfers to an external destination", async () => {
    const f = await create(); await db.query("select professional_service.transfer_case($1,$2,$3,$4,$5)", [ids.request, ids.actor, ids.second, encryptedFixture, ids.owner]);
    await expect(list()).rejects.toThrow("REQUEST_NOT_FOUND"); expect((await update(f.id, "canceled", 1, ids.second)).status).toBe("canceled");
  });
  it("permits resolving existing records after case closure without allowing creation", async () => {
    const f = await create(); await db.query("select professional_service.close_case($1,$2,null)", [ids.request, ids.actor]);
    expect((await update(f.id, "canceled")).status).toBe("canceled");
    await expect(db.query("select professional_service.record_referral($1,$2,'Synthetic service',null,$3)", [ids.request, ids.actor, ids.second])).rejects.toThrow("INVALID_CASE_TRANSITION");
  });
  it.each(["delivered", "accepted", "recorded"])("rejects unsupported state %s", async (status) => {
    const f = await create(); await expect(update(f.id, status)).rejects.toThrow("INVALID_REFERRAL");
  });
  it("denies insecure URLs and stale revisions", async () => {
    await expect(create(ids.actor, "Synthetic service", "javascript:alert(1)")).rejects.toThrow("INVALID_REFERRAL");
    const f = await create(); await expect(update(f.id, "completed", 5)).rejects.toThrow("REFERRAL_CONFLICT");
  });
  it("fails closed after eligibility loss", async () => {
    await create(); await db.exec("reset role"); await db.query("update professional_service.memberships set status='suspended' where user_id=$1", [ids.actor]); await serviceRole(db);
    await expect(list()).rejects.toThrow("MEMBERSHIP_REQUIRED");
  });
  it("rolls back lifecycle and history if auditing fails", async () => {
    const f = await create(); await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_referral_fail check(action<>'referral.completed')");
    try {
      await serviceRole(db); await expect(update(f.id)).rejects.toThrow("synthetic_referral_fail");
      expect((await list()).items[0].history.map(h => h.status)).toEqual(["recorded"]);
    } finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_referral_fail"); }
  });
  it.each(["anon", "authenticated", "service_role"])("prevents %s bypassing lifecycle writes/history", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(db.query("insert into professional_service.referrals(request_id,author_user_id,resource_name) values($1,$2,'Synthetic')", [ids.request, ids.actor])).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from professional_service.referral_history")).rejects.toThrow(/permission denied/);
    if (role !== "service_role") await expect(create()).rejects.toThrow(/permission denied/);
  });
});
