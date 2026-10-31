import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, serviceRole } from "../../../../tests/fixtures/professional-database.js";
import { professionalNotificationDatabase, seedProfessionalNotifications } from "../../../../tests/fixtures/professional-notification-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalNotificationDatabase(["20261016150000_professional_events.sql"]); }, 30_000);
beforeEach(async () => seedProfessionalNotifications(db)); afterAll(async () => db?.close());
type Counts = { delivered: number; suppressed: number; failures: number };
const process = async () => (await db.query<{ result: Counts }>("select professional_service.process_events(100) result")).rows[0].result;
const enqueue = async () => (await db.query<{ count: number }>("select professional_service.enqueue_follow_up_reminders(100) count")).rows[0].count;
const dueTask = async () => {
  const f = (await db.query<{ id: string }>("select * from professional_service.create_follow_up($1,$2,$3,'2099-01-01',$4)", [ids.request, ids.actor, encryptedFixture, ids.owner])).rows[0];
  await db.exec("reset role"); await db.query("update professional_service.follow_ups set due_at=now()-interval '1 minute' where id=$1", [f.id]); await serviceRole(db); return f.id;
};
describe("durable professional event delivery and reminders", () => {
  it("commits events with business changes and delivers exactly once across repeated batches", async () => {
    expect(await process()).toEqual({ delivered: 1, suppressed: 0, failures: 0 }); expect((await process()).delivered).toBe(0);
    await db.exec("reset role"); expect((await db.query("select id from notification_service.notifications")).rows).toHaveLength(1);
  });
  it("does not enqueue an event for a rolled-back workflow", async () => {
    await process(); await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_event_rollback check(action<>'request.closed')");
    try { await serviceRole(db); await expect(db.query("select professional_service.close_case($1,$2,null)", [ids.request, ids.actor])).rejects.toThrow("synthetic_event_rollback"); expect((await process()).delivered).toBe(0); }
    finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_event_rollback"); }
  });
  it("retains failed delivery and recovers without duplicate notification or sensitive diagnostics", async () => {
    await db.exec("reset role; alter table notification_service.notifications add constraint synthetic_sink_failure check(notification_type<>'professional_update')");
    await serviceRole(db); expect((await process()).failures).toBe(1);
    await db.exec("reset role"); expect((await db.query("select status,attempts,last_error_code from professional_service.event_outbox")).rows[0]).toEqual({ status: "pending", attempts: 1, last_error_code: "DELIVERY_FAILED" });
    expect((await db.query("select id from notification_service.notifications")).rows).toHaveLength(0);
    await db.exec("alter table notification_service.notifications drop constraint synthetic_sink_failure; update professional_service.event_outbox set next_attempt_at=now()"); await serviceRole(db);
    expect((await process()).delivered).toBe(1); expect((await process()).delivered).toBe(0);
  });
  it("isolates a failing event and retains an explicit terminal failure for operator recovery", async () => {
    await db.exec("reset role; update professional_service.event_outbox set attempts=7; alter table notification_service.notifications add constraint synthetic_sink_failure check(notification_type<>'professional_update')");
    try { await serviceRole(db); expect((await process()).failures).toBe(1); await db.exec("reset role"); expect((await db.query("select status from professional_service.event_outbox")).rows[0]).toEqual({ status: "failed" }); }
    finally { await db.exec("reset role; alter table notification_service.notifications drop constraint synthetic_sink_failure"); }
    await serviceRole(db); expect((await db.query<{ count: number }>("select professional_service.retry_failed_events(100) count")).rows[0].count).toBe(1); expect((await process()).delivered).toBe(1);
  });
  it("suppresses old-recipient events after transfer and delivers only the new assignment event", async () => {
    await db.query("select professional_service.transfer_case($1,$2,$3,$4,$5)", [ids.request, ids.actor, ids.second, encryptedFixture, ids.owner]);
    expect(await process()).toEqual({ delivered: 1, suppressed: 1, failures: 0 });
    await db.exec("reset role"); expect((await db.query("select user_id from notification_service.notifications")).rows).toEqual([{ user_id: ids.second }]);
  });
  it("suppresses opted-out or newly suspended recipients", async () => {
    await db.exec("reset role"); await db.query("update user_service.notification_preferences set in_app_enabled=false where user_id=$1", [ids.actor]); await serviceRole(db); expect((await process()).suppressed).toBe(1);
    await db.query("select professional_service.create_follow_up($1,$2,$3,'2099-01-01',$4)", [ids.request, ids.actor, encryptedFixture, ids.owner]);
    await db.exec("reset role"); await db.query("update professional_service.memberships set status='suspended' where user_id=$1", [ids.actor]); await serviceRole(db); expect((await process()).suppressed).toBe(1);
  });
  it("enqueues a due reminder once per task revision without scheduling fictional future reminders", async () => {
    expect(await enqueue()).toBe(0); await dueTask(); expect(await enqueue()).toBe(1); expect(await enqueue()).toBe(0);
    expect((await process()).delivered).toBe(3); expect(await enqueue()).toBe(0);
  });
  it("suppresses reminders completed between enqueue and delivery", async () => {
    const id = await dueTask(); await enqueue(); await db.query("select professional_service.update_follow_up($1,$2,$3,1,true,null,null)", [ids.request, id, ids.actor]);
    const result = await process(); expect(result.suppressed).toBe(1); expect(result.delivered).toBe(3);
  });
  it("rechecks edited due dates and revisions before delivering a queued reminder", async () => {
    const id = await dueTask(); await enqueue(); await db.query("select professional_service.update_follow_up($1,$2,$3,1,false,$4,'2099-01-01')", [ids.request, id, ids.actor, encryptedFixture]);
    expect((await process()).suppressed).toBe(1); expect(await enqueue()).toBe(0);
  });
  it.each(["anon", "authenticated"])("denies %s even with a forged service role claim", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(process()).rejects.toThrow(/permission denied/); await expect(enqueue()).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from professional_service.event_outbox")).rejects.toThrow(/permission denied/);
  });
  it("bounds trusted maintenance batches", async () => {
    await expect(db.query("select professional_service.process_events(101)")).rejects.toThrow("INVALID_EVENT_BATCH"); await expect(db.query("select professional_service.enqueue_follow_up_reminders(0)")).rejects.toThrow("INVALID_EVENT_BATCH");
  });
});
