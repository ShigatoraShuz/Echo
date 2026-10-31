import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261015100000_professional_case_snapshot.sql", "20261015110000_professional_consent.sql", "20261015120000_professional_notes.sql", "20261015130000_professional_case_handover.sql", "20261016120000_professional_follow_ups.sql"]); }, 30_000);
beforeEach(async () => { await seedProfessionalDatabase(db); await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]); });
afterAll(async () => db?.close());
type FollowUp = { id: string; status: string; revision: number; responsible_user_id: string; title_encrypted: string; due_at: Date; completed_by: string | null };
const create = async (actor = ids.actor, due = "2099-01-01T12:00:00Z") => (await db.query<FollowUp>("select * from professional_service.create_follow_up($1,$2,$3,$4,$5)", [ids.request, actor, encryptedFixture, due, ids.owner])).rows[0];
const update = async (id: string, complete = true, revision = 1, actor = ids.actor) => (await db.query<FollowUp>("select * from professional_service.update_follow_up($1,$2,$3,$4,$5,$6,$7)", [ids.request, id, actor, revision, complete, complete ? null : encryptedFixture, complete ? null : "2099-02-01T12:00:00Z"])).rows[0];
const list = async (actor = ids.actor) => (await db.query<{ result: { items: FollowUp[]; total: number; hasMore: boolean } }>("select professional_service.list_follow_ups($1,$2) result", [ids.request, actor])).rows[0].result;

describe("case follow-up database contracts", () => {
  it("creates, retrieves, edits and completes with audited retry safety", async () => {
    const item = await create(); expect(item).toMatchObject({ status: "pending", responsible_user_id: ids.actor, revision: 1 });
    expect((await create()).id).toBe(item.id); expect((await list()).total).toBe(1);
    expect((await update(item.id, false)).revision).toBe(2);
    await expect(update(item.id)).rejects.toThrow("FOLLOW_UP_CONFLICT");
    const completed = await update(item.id, true, 2); expect(completed).toMatchObject({ status: "completed", completed_by: ids.actor, revision: 3 });
    expect(await update(item.id, true, 2)).toEqual(completed);
    expect((await db.query("select id from professional_service.audit_events where action='followup.completed'")).rows).toHaveLength(1);
  });
  it.each([ids.owner, ids.second, ids.outsider])("denies unassigned/cross-organization actor %s", async (actor) => {
    const item = await create(); await expect(create(actor)).rejects.toThrow("REQUEST_NOT_FOUND");
    await expect(list(actor)).rejects.toThrow("REQUEST_NOT_FOUND"); await expect(update(item.id, true, 1, actor)).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it("denies suspended membership and profile after prior successful reads", async () => {
    await create(); await list(); await db.exec("reset role");
    await db.query("update user_service.profiles set account_status='suspended' where user_id=$1", [ids.actor]); await serviceRole(db);
    await expect(list()).rejects.toThrow("MEMBERSHIP_REQUIRED");
  });
  it.each(["2000-01-01", "infinity", "-infinity"])("rejects past/nonfinite due date %s", async (due) => {
    await expect(create(ids.actor, due)).rejects.toThrow("INVALID_FOLLOW_UP");
  });
  it("allows completing existing work after closure but no new task or edit", async () => {
    const item = await create(); await db.query("select professional_service.close_case($1,$2,null)", [ids.request, ids.actor]);
    await expect(update(item.id, false)).rejects.toThrow("INVALID_CASE_TRANSITION");
    await expect(db.query("select professional_service.create_follow_up($1,$2,$3,'2099-01-01',$4)", [ids.request, ids.actor, encryptedFixture, ids.second])).rejects.toThrow("INVALID_CASE_TRANSITION");
    expect((await update(item.id)).status).toBe("completed");
  });
  it("transfers pending responsibility atomically and denies previous assignee", async () => {
    const item = await create();
    await db.query("select professional_service.transfer_case($1,$2,$3,$4,$5)", [ids.request, ids.actor, ids.second, encryptedFixture, ids.owner]);
    await expect(list()).rejects.toThrow("REQUEST_NOT_FOUND");
    expect((await list(ids.second)).items[0]).toMatchObject({ responsible_user_id: ids.second, revision: 2 });
    expect((await update(item.id, true, 2, ids.second)).status).toBe("completed");
  });
  it("does not disclose tasks from another case", async () => {
    const item = await create();
    await expect(db.query("select professional_service.update_follow_up($1,$2,$3,1,true,null,null)", [ids.otherOrg, item.id, ids.actor])).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it("rolls back mutation and denies read when auditing fails", async () => {
    await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_followup_fail check(action not like 'followup.%')");
    try {
      await serviceRole(db); await expect(create()).rejects.toThrow("synthetic_followup_fail"); await expect(list()).rejects.toThrow("synthetic_followup_fail");
      await db.exec("reset role"); expect((await db.query("select id from professional_service.follow_ups")).rows).toEqual([]);
    } finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_followup_fail"); }
  });
  it("bounds reads with exact totals", async () => {
    await db.exec("reset role");
    await db.query("insert into professional_service.follow_ups(request_id,organization_id,created_by,responsible_user_id,title_encrypted,due_at,submission_id) select $1,$2,$3,$3,$4,'2099-01-01',gen_random_uuid() from generate_series(1,101)", [ids.request, ids.org, ids.actor, encryptedFixture]); await serviceRole(db);
    const page = await list(); expect(page.items).toHaveLength(100); expect(page).toMatchObject({ total: 101, hasMore: true });
  });
  it.each(["anon", "authenticated", "service_role"])("denies %s direct sensitive table access", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(db.query("select * from professional_service.follow_ups")).rejects.toThrow(/permission denied/);
    if (role !== "service_role") { await expect(create()).rejects.toThrow(/permission denied/); await expect(list()).rejects.toThrow(/permission denied/); }
  });
});
