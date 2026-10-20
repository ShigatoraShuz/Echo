import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261015100000_professional_case_snapshot.sql", "20261015110000_professional_consent.sql"]); }, 30_000);
beforeEach(async () => seedProfessionalDatabase(db));
afterAll(async () => db?.close());
const item = { journalId: ids.owner, titleEncrypted: encryptedFixture, bodyEncrypted: encryptedFixture };
const create = (items: unknown, version: string | null = "professional-request-v1") => db.query<{ id: string; consented_at: Date; sharing_expires_at: Date; shared_journal_ids: string[] }>(
  "select * from professional_service.create_request($1,$2,$3,$3,$4,$5::jsonb)", [ids.org, ids.owner, encryptedFixture, version, JSON.stringify(items)]);

describe("immutable scoped consent and retry-safe revocation", () => {
  it("records only selected IDs under the established 30-day consent version", async () => {
    const r = (await create([item])).rows[0];
    expect(r.shared_journal_ids).toEqual([ids.owner]);
    expect(new Date(r.sharing_expires_at).getTime()-new Date(r.consented_at).getTime()).toBe(30*86400000);
  });
  it.each([null, {}, [null], [{ journalId: "not-uuid" }], [item, item], [item, item, item, item], [{ ...item, phq8: 20 }], [{ ...item, bodyEncrypted: "plaintext" }]])("rejects malformed, expanded or duplicate scope %j", async (items) => {
    await expect(create(items)).rejects.toThrow(/INVALID_REQUEST|INVALID_SHARED_ITEM/);
    expect((await db.query("select id from professional_service.support_requests")).rows).toHaveLength(1);
  });
  it.each([null, "unapproved-version"])("requires the exact approved consent version (%s)", async (version) => {
    await expect(create([], version)).rejects.toThrow("INVALID_REQUEST");
  });
  it("revokes idempotently and blocks all subsequent professional shared-content reads", async () => {
    const r = (await create([item])).rows[0];
    await db.query("select professional_service.claim_request($1,$2)", [r.id, ids.actor]);
    const first = (await db.query("select * from professional_service.revoke_sharing($1,$2)", [r.id, ids.owner])).rows[0];
    const second = (await db.query("select * from professional_service.revoke_sharing($1,$2)", [r.id, ids.owner])).rows[0];
    expect(second).toEqual(first);
    expect((await db.query("select id from professional_service.audit_events where action='sharing.revoked' and request_id=$1", [r.id])).rows).toHaveLength(1);
    const result = (await db.query<{ payload: { request: { summary_encrypted: null }; sharedJournals: unknown[] } }>("select professional_service.case_snapshot($1,$2) payload", [r.id, ids.actor])).rows[0].payload;
    expect(result.request.summary_encrypted).toBeNull(); expect(result.sharedJournals).toEqual([]);
  });
  it.each([ids.actor, ids.outsider])("cannot revoke another owner's grant (%s)", async (actor) => {
    await expect(db.query("select professional_service.revoke_sharing($1,$2)", [ids.request, actor])).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it.each(["shared_journal_ids=array[gen_random_uuid()]", "consent_version='expanded'", "consented_at=now()+interval '1 day'", "sharing_expires_at=now()+interval '365 days'", "sharing_revoked_at=null"])("prevents renewal or modification through trusted SQL: %s", async (assignment) => {
    await db.query("select professional_service.revoke_sharing($1,$2)", [ids.request, ids.owner]);
    await db.exec("reset role");
    await expect(db.query(`update professional_service.support_requests set ${assignment} where id=$1`, [ids.request])).rejects.toThrow("CONSENT_IMMUTABLE");
  });
  it("rolls back revocation when its audit cannot commit", async () => {
    await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_revoke_audit_fail check(action<>'sharing.revoked')");
    try {
      await expect(db.query("select professional_service.revoke_sharing($1,$2)", [ids.request, ids.owner])).rejects.toThrow("synthetic_revoke_audit_fail");
      expect((await db.query<{ sharing_revoked_at: null }>("select sharing_revoked_at from professional_service.support_requests where id=$1", [ids.request])).rows[0].sharing_revoked_at).toBeNull();
    } finally { await db.exec("alter table professional_service.audit_events drop constraint synthetic_revoke_audit_fail"); }
  });
});
