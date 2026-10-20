import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, serviceRole } from "../../../../tests/fixtures/professional-database.js";
import { professionalNotificationDatabase, seedProfessionalNotifications } from "../../../../tests/fixtures/professional-notification-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalNotificationDatabase(); }, 30_000);
beforeEach(async () => seedProfessionalNotifications(db)); afterAll(async () => db?.close());
type Item = { id: string; kind: string; caseId: string; readAt: string | null };
const list = async (actor = ids.actor, org = ids.org, unread = false) => (await db.query<{ result: { items: Item[]; total: number } }>("select professional_service.list_notifications($1,$2,$3) result", [org, actor, unread])).rows[0].result;
const read = async (id: string, actor = ids.actor, org = ids.org) => (await db.query("select professional_service.read_notification($1,$2,$3) result", [org, id, actor])).rows[0];
describe("professional notifications in the existing notification module", () => {
  it("records generic inbox text with no protected identifiers, while MFA API context remains scoped", async () => {
    const page = await list(); expect(page.total).toBe(1); expect(page.items[0]).toMatchObject({ kind: "case_updated", caseId: ids.request });
    await db.exec("reset role"); const row = (await db.query("select title,message,resource_id,resource_type from notification_service.notifications")).rows[0];
    expect(row).toMatchObject({ resource_id: null, resource_type: null }); expect(JSON.stringify(row)).not.toContain(ids.request); expect(JSON.stringify(row)).not.toContain(encryptedFixture);
  });
  it("preserves read timestamp on retry and filters unread items", async () => {
    const item = (await list()).items[0]; const first = await read(item.id); expect(await read(item.id)).toEqual(first); expect((await list(ids.actor, ids.org, true)).total).toBe(0);
  });
  it("never returns personal/unrelated notifications", async () => {
    await db.exec("reset role"); await db.query("insert into notification_service.notifications(user_id,notification_type,title,message) values($1,'synthetic_personal','Private synthetic','Personal synthetic')", [ids.actor]); await serviceRole(db);
    expect((await list()).total).toBe(1);
  });
  it("enforces current assignment after transfer", async () => {
    const old = (await list()).items[0]; await db.query("select professional_service.transfer_case($1,$2,$3,$4,$5)", [ids.request, ids.actor, ids.second, encryptedFixture, ids.owner]);
    expect((await list()).items).toEqual([]); await expect(read(old.id)).rejects.toThrow("REQUEST_NOT_FOUND"); expect((await list(ids.second)).total).toBe(1);
  });
  it("denies suspended membership and other organizations, not merely notification ownership", async () => {
    const item = (await list()).items[0]; await expect(list(ids.outsider)).rejects.toThrow("MEMBERSHIP_REQUIRED"); await expect(read(item.id, ids.outsider, ids.otherOrg)).rejects.toThrow("REQUEST_NOT_FOUND");
    await db.exec("reset role"); await db.query("update professional_service.memberships set status='suspended' where user_id=$1", [ids.actor]); await serviceRole(db);
    await expect(list()).rejects.toThrow("MEMBERSHIP_REQUIRED"); await expect(read(item.id)).rejects.toThrow("MEMBERSHIP_REQUIRED");
  });
  it("honors opt-out and does not invent preferences", async () => {
    await db.exec("reset role; truncate notification_service.notifications cascade"); await db.query("update user_service.notification_preferences set in_app_enabled=false where user_id=$1", [ids.actor]); await serviceRole(db);
    await db.query("select professional_service.create_follow_up($1,$2,$3,'2099-01-01',$4)", [ids.request, ids.actor, encryptedFixture, ids.owner]); expect((await list()).total).toBe(0);
  });
  it("supports appointment, referral and follow-up events without exposing content", async () => {
    await db.query("select professional_service.propose_appointment($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour','online',$3)", [ids.request, ids.actor, encryptedFixture]);
    await db.query("select professional_service.record_referral($1,$2,'Synthetic service',null,$3)", [ids.request, ids.actor, ids.owner]);
    await db.query("select professional_service.create_follow_up($1,$2,$3,'2099-01-01',$4)", [ids.request, ids.actor, encryptedFixture, ids.owner]);
    const page = await list(); expect(page.items.map(i => i.kind).sort()).toEqual(["appointment_changed", "case_updated", "follow_up", "referral_updated"]); expect(JSON.stringify(page)).not.toContain("Synthetic service");
  });
  it("retains exactly one notification after a retried workflow", async () => {
    await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]); expect((await list()).total).toBe(1);
  });
  it("rolls back business mutation if synchronous notification persistence fails", async () => {
    await db.exec("reset role; alter table notification_service.notifications add constraint synthetic_notification_failure check(notification_type<>'professional_update') not valid");
    try { await serviceRole(db); await expect(db.query("select professional_service.close_case($1,$2,null)", [ids.request, ids.actor])).rejects.toThrow("synthetic_notification_failure");
      expect((await db.query<{ status: string }>("select status from professional_service.support_requests where id=$1", [ids.request])).rows[0].status).toBe("assigned");
    } finally { await db.exec("reset role; alter table notification_service.notifications drop constraint synthetic_notification_failure"); }
  });
  it.each(["anon", "authenticated", "service_role"])("denies %s direct protected mapping access", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(db.query("select * from professional_service.notification_links")).rejects.toThrow(/permission denied/);
    if (role !== "service_role") await expect(list()).rejects.toThrow(/permission denied/);
  });
});
