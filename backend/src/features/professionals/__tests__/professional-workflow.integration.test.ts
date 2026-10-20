import type { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import { ProfessionalService } from "../professional.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
import { installNotificationFixture } from "../../../../tests/fixtures/professional-notification-database.js";
import { professionalWorkflowMigrations } from "../../../../tests/fixtures/professional-migrations.js";
import { professionalSqlClient } from "../../../../tests/fixtures/professional-sql-client.js";

let db: PGlite; let app: ReturnType<typeof createApp>;
beforeAll(async () => { db = await professionalDatabase(professionalWorkflowMigrations, installNotificationFixture); }, 30_000);
beforeEach(async () => {
  await seedProfessionalDatabase(db);
  await db.exec("reset role; truncate notification_service.notifications cascade; truncate user_service.notification_preferences");
  await db.query("insert into user_service.notification_preferences(user_id) values($1),($2)", [ids.actor, ids.second]); await serviceRole(db);
  const journals = { get: async () => ({ title: "Synthetic selected journal", body: "Synthetic journal body" }) } as unknown as JournalService;
  const service = new ProfessionalService(professionalSqlClient(db), createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1), journals);
  app = createApp({ v1: { professionals: { service, verifier: { getUser: async token => token === "revoked" ? null : { id: token === "owner" ? ids.owner : token === "second" ? ids.second : token === "outsider" ? ids.outsider : ids.actor, assuranceLevel: token === "no-mfa" ? "aal1" : "aal2" } }, verificationService: {} as VerificationService } } });
});
afterAll(async () => db?.close());
const base = "/api/v1/professional";
const post = (path: string, body: object = {}, actor = "actor") => request(app).post(`${base}${path}`).set("Authorization", `Bearer ${actor}`).send(body);
const get = (path: string, actor = "actor") => request(app).get(`${base}${path}`).set("Authorization", `Bearer ${actor}`);
async function createCase() {
  const response = await post("/my-requests", { organizationId: ids.org, summary: "Synthetic request for integrated testing.", preferredTime: "Synthetic preference", consent: true, journalIds: [ids.owner] }, "owner");
  expect(response.status).toBe(201); const id = response.body.data.request.id as string;
  expect((await post(`/cases/${id}/claim`)).status).toBe(200); return id;
}
describe("BE-029 real router/service/encryption/SQL workflows with synthetic Auth transport", () => {
  it("integrates consented case, notes, follow-ups, referrals, owner appointments, transfer and closure", async () => {
    const id = await createCase(); const path = `/cases/${id}`;
    const detail = await get(path); expect(detail.status).toBe(200); expect(detail.body.data.sharedJournals[0].title).toBe("Synthetic selected journal");
    expect(JSON.stringify(detail.body)).not.toContain("echo:encrypted");
    const note = await post(`${path}/notes`, { body: "Synthetic final clinical note", submissionId: ids.owner }); expect(note.status).toBe(201);
    expect((await post(`${path}/notes`, { body: "Synthetic final clinical note", submissionId: ids.owner })).body.data.noteId).toBe(note.body.data.noteId);
    const follow = await post(`${path}/follow-ups`, { title: "Synthetic follow-up task", dueAt: "2099-01-01T12:00:00Z", submissionId: ids.owner }); expect(follow.status).toBe(201);
    const referral = await post(`${path}/referrals`, { resourceName: "Synthetic resource", resourceUrl: "https://example.invalid/resource", submissionId: ids.owner }); expect(referral.status).toBe(201); expect(referral.body.data.delivery).toBe("not_integrated");
    const offer = await post(`${path}/appointments`, { startsAt: "2099-01-02T10:00:00Z", endsAt: "2099-01-02T11:00:00Z", mode: "online", locationHint: "Synthetic meeting" }); expect(offer.status).toBe(201);
    const appointment = offer.body.data.appointmentId as string;
    expect((await post(`/appointments/${appointment}/respond`, { accept: true }, "owner")).status).toBe(200);
    expect((await get(`/organizations/${ids.org}/dashboard`)).body.data.counts.scheduledCount).toBe(1);
    expect((await post(`${path}/close`)).status).toBe(409);
    expect((await post(`/appointments/${appointment}/cancel`, {}, "owner")).status).toBe(200);
    expect((await post(`${path}/transfer`, { targetUserId: ids.second, reason: "Synthetic continuity of care", submissionId: ids.owner })).status).toBe(200);
    expect((await get(path)).status).toBe(403); expect((await get(`${path}/follow-ups`)).status).toBe(404);
    const transferred = await get(`${path}/follow-ups`, "second"); expect(transferred.body.data.items[0]).toMatchObject({ responsibleUserId: ids.second, revision: 2 });
    expect((await post(`${path}/follow-ups/${follow.body.data.followUp.id}/complete`, { expectedRevision: 2 }, "second")).status).toBe(200);
    const resolved = await request(app).patch(`${base}${path}/referrals/${referral.body.data.referralId}`).set("Authorization", "Bearer second").send({ status: "completed", expectedRevision: 1 }); expect(resolved.status).toBe(200);
    expect((await post(`/my-requests/${id}/revoke`, {}, "owner")).status).toBe(200);
    const revoked = await get(path, "second"); expect(revoked.status).toBe(200); expect(revoked.body.data.sharedJournals).toEqual([]); expect(revoked.body.data.request.summary).toBeNull(); expect(revoked.body.data.notes[0].body).toBe("Synthetic final clinical note");
    expect((await post(`${path}/close`, { reason: "Synthetic support completed" }, "second")).status).toBe(200);
    expect((await post(`${path}/notes`, { body: "Disallowed new note" }, "second")).status).toBe(409);
    await db.query("select professional_service.process_events(100)");
    expect((await get(`/organizations/${ids.org}/notifications`)).body.data.total).toBe(0);
    expect((await get(`/organizations/${ids.org}/notifications`, "second")).body.data.total).toBeGreaterThan(0);
    await db.exec("reset role"); const stored = await db.query("select title,message,resource_id from notification_service.notifications");
    expect(JSON.stringify(stored.rows)).not.toMatch(/Synthetic final|Synthetic selected|Synthetic meeting|Synthetic continuity/);
  });
  it("rejects cross-tenant and expired sessions before revealing content, and responds to membership loss", async () => {
    const id = await createCase(); const path = `/cases/${id}`;
    for (const actor of ["outsider", "no-mfa", "revoked"]) {
      const denied = await get(path, actor); expect([401, 403]).toContain(denied.status); expect(JSON.stringify(denied.body)).not.toContain("Synthetic selected journal");
    }
    await db.query("select professional_service.suspend_member(id,$1) from professional_service.memberships where user_id=$2", [ids.admin, ids.actor]);
    expect((await get(path)).status).toBe(403); expect((await post(`${path}/follow-ups`, { title: "Synthetic task", dueAt: "2099-01-01T00:00:00Z", submissionId: ids.owner })).status).toBe(403);
    expect((await get(`/organizations/${ids.org}/notifications`)).status).toBe(403);
  });
  it("rolls back failed writes, maps database errors safely and supports a deliberate retry", async () => {
    const id = await createCase(); await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_integrated_failure check(action<>'followup.created')");
    const input = { title: "Synthetic task", dueAt: "2099-01-01T00:00:00Z", submissionId: ids.owner };
    try {
      await serviceRole(db); const failed = await post(`/cases/${id}/follow-ups`, input); expect(failed.status).toBe(503); expect(JSON.stringify(failed.body)).not.toContain("synthetic_integrated_failure");
      expect((await get(`/cases/${id}/follow-ups`)).body.data.total).toBe(0);
    } finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_integrated_failure"); await serviceRole(db); }
    const saved = await post(`/cases/${id}/follow-ups`, input); expect(saved.status).toBe(201);
    expect((await post(`/cases/${id}/follow-ups`, input)).body.data.followUp.id).toBe(saved.body.data.followUp.id);
  });
});
