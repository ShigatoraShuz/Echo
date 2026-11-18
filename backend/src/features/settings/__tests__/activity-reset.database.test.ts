import { beforeAll, beforeEach, afterEach, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDisposableDatabase } from "../../../../scripts/disposable-database.mjs";
let db: Awaited<ReturnType<typeof createDisposableDatabase>>;
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let journalA: string;
async function submit(user: string, key: string) {
  const result = await db.query(
    "select * from journal_service.submit_journal($1,'[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',false,'saved',null,'disabled','v1',$2,$2)",
    [user, key],
  );
  return String(result.rows[0].journal_id);
}
const reset = (user = a, key = requestId) =>
  db.query<{ result: { requestId: string; completed: boolean; imagePaths: string[] } }>(
    "select user_service.reset_account_activity($1,$2) as result",
    [user, key],
  );
beforeAll(async () => {
  db = await createDisposableDatabase();
  const fixture = await readFile(
    resolve(process.cwd(), "../supabase/tests/database/journal-analysis-transactions.test.sql"),
    "utf8",
  );
  await db.exec(fixture.slice(0, fixture.indexOf("create temp table test_jobs")) + "commit;");
}, 30000);
beforeEach(async () => {
  await db.exec("begin;");
  journalA = await submit(a, "journal-a");
  await submit(b, "journal-b");
  await db.exec("set request.jwt.claim.role='service_role';set role service_role;");
});
afterEach(async () => {
  await db.exec("rollback;reset role;");
});
afterAll(async () => {
  await db?.close();
});
describe("owner-scoped Start clean transaction", () => {
  it("clears only the selected owner's activity and retains login, profile, verification, contacts and preferences", async () => {
    await db.query(
      "insert into grounding_service.grounding_sessions(user_id,exercise_type,duration_seconds)values($1,'box-breathing',120),($2,'box-breathing',120)",
      [a, b],
    );
    const result = await reset();
    expect(result.rows[0].result.completed).toBe(false);
    expect((await db.query("select user_id from journal_service.journals")).rows).toEqual([{ user_id: b }]);
    expect((await db.query("select user_id from grounding_service.grounding_sessions")).rows).toEqual([{ user_id: b }]);
    await db.exec("reset role;");
    for (const table of [
      "auth.users",
      "user_service.profiles",
      "verification_service.identity_verifications",
      "user_service.trusted_contacts",
      "user_service.notification_preferences",
      "user_service.privacy_preferences",
    ]) {
      const column = table === "auth.users" ? "id" : "user_id";
      expect(
        (await db.query<{ count: number }>(`select count(*)::int count from ${table} where ${column}=$1`, [a])).rows[0]
          .count,
      ).toBeGreaterThan(0);
    }
  });
  it("blocks new activity while cleanup remains incomplete", async () => {
    await reset();
    await expect(submit(a, "new-journal")).rejects.toThrow("ACTIVITY_RESET_PENDING");
  });
  it("recovers the original receipt after an interrupted reset without losing its photo cleanup list", async () => {
    await db.exec("reset role;");
    await db.query("insert into journal_service.image_deletion_queue(storage_path)values($1)", [a + "/old-photo.png"]);
    await db.exec("set role service_role;");
    await reset();
    const retry = await reset(a, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(retry.rows[0].result).toMatchObject({ requestId, imagePaths: [a + "/old-photo.png"], completed: false });
  });
  it("does not erase newer activity when a completed request is replayed", async () => {
    await reset();
    await db.query("update user_service.activity_reset_receipts set completed=true where request_id=$1", [requestId]);
    const fresh = await submit(a, "fresh");
    expect((await reset()).rows[0].result.completed).toBe(true);
    expect((await db.query("select id from journal_service.journals where id=$1", [fresh])).rows).toHaveLength(1);
  });
  it("cannot reuse another owner's reset key", async () => {
    await reset();
    await expect(reset(b)).rejects.toThrow("RESET_CONFLICT");
  });
  it("is unavailable to an ordinary authenticated database client", async () => {
    await db.exec("set request.jwt.claim.role='authenticated';set role authenticated;");
    await expect(reset()).rejects.toThrow(/permission denied/);
  });
});
describe("notification delivery and invitation receipts", () => {
  it("deduplicates real local-analysis notices and respects insight preferences", async () => {
    const send = () =>
      db.query<{ sent: boolean }>(
        "select notification_service.record_activity_notice($1,'analysis_completed',$2) sent",
        [a, journalA],
      );
    expect((await send()).rows[0].sent).toBe(true);
    expect((await send()).rows[0].sent).toBe(false);
    expect(
      (
        await db.query(
          "select user_id from notification_service.notifications where notification_type='analysis_completed'",
        )
      ).rows,
    ).toEqual([{ user_id: a }]);
    await db.query(
      "update user_service.notification_preferences set insight_notifications_enabled=false where user_id=$1",
      [b],
    );
    const other = (await db.query<{ id: string }>("select id from journal_service.journals where user_id=$1", [b]))
      .rows[0].id;
    expect(
      (
        await db.query<{ sent: boolean }>(
          "select notification_service.record_activity_notice($1,'analysis_completed',$2) sent",
          [b, other],
        )
      ).rows[0].sent,
    ).toBe(false);
  });
  it("claims a Buddy prompt once per seven days with a useful notification target", async () => {
    const claim = () => db.query<{ shown: boolean }>("select insights_service.claim_buddy_invitation($1) shown", [a]);
    expect((await claim()).rows[0].shown).toBe(true);
    expect((await claim()).rows[0].shown).toBe(false);
    expect(
      (
        await db.query(
          "select resource_type from notification_service.notifications where user_id=$1 and notification_type='buddy_invitation'",
          [a],
        )
      ).rows,
    ).toEqual([{ resource_type: "buddy" }]);
    await db.query(
      "update insights_service.buddy_invitation_state set last_shown_at=now()-interval '8 days' where user_id=$1",
      [a],
    );
    expect((await claim()).rows[0].shown).toBe(true);
  });
  it("does not claim invitations without consent or during quiet hours", async () => {
    await db.query("update user_service.privacy_preferences set journal_ai_analysis_enabled=false where user_id=$1", [
      a,
    ]);
    expect(
      (await db.query<{ shown: boolean }>("select insights_service.claim_buddy_invitation($1) shown", [a])).rows[0]
        .shown,
    ).toBe(false);
    await db.query("update user_service.privacy_preferences set journal_ai_analysis_enabled=true where user_id=$1", [
      a,
    ]);
    await db.query(
      "update user_service.notification_preferences set reminder_time=null,quiet_hours_start='00:00',quiet_hours_end='23:59:59.999999' where user_id=$1",
      [a],
    );
    expect(
      (await db.query<{ shown: boolean }>("select insights_service.claim_buddy_invitation($1) shown", [a])).rows[0]
        .shown,
    ).toBe(false);
  });
});
