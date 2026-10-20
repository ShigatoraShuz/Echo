import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService, encryptText } from "../../../infrastructure/encryption/encryption.service.js";
import { ProfessionalService } from "../professional.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
import { professionalWorkflowMigrations } from "../../../../tests/fixtures/professional-migrations.js";
import { installNotificationFixture } from "../../../../tests/fixtures/professional-notification-database.js";
import { professionalSqlClient } from "../../../../tests/fixtures/professional-sql-client.js";

let db: PGlite;
let app: ReturnType<typeof createApp>;
let afterSnapshot: (() => Promise<void>) | undefined;
const encryption = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1);
const base = "/api/v1/professional";
const post = (path: string, body: object = {}, actor = "actor") => request(app).post(base + path).set("Authorization", `Bearer ${actor}`).send(body);
const get = (path: string, actor = "actor") => request(app).get(base + path).set("Authorization", `Bearer ${actor}`);
beforeAll(async () => {
  db = await professionalDatabase(professionalWorkflowMigrations, installNotificationFixture);
  await db.exec("reset role; create schema insights_service; create table insights_service.phq8_assessments(id uuid primary key,user_id uuid,submission_id uuid,assessment_ciphertext text,completed_at timestamptz); grant usage on schema insights_service to service_role; grant select on insights_service.phq8_assessments to service_role");
}, 30_000);
beforeEach(async () => {
  afterSnapshot = undefined;
  await seedProfessionalDatabase(db);
  await db.exec("reset role; truncate insights_service.phq8_assessments");
  await db.query("insert into insights_service.phq8_assessments values($1,$1,$2,$3,now())", [ids.owner, randomUUID(), encryptText(JSON.stringify({ userId: ids.owner, score: 8, severity: "mild" }), encryption)]);
  await db.query("update professional_service.memberships set role='org_admin',credential_expires_at=null where user_id=$1", [ids.second]);
  await serviceRole(db);
  const service = new ProfessionalService(professionalSqlClient(db, async (name) => { if (name === "case_snapshot") await afterSnapshot?.(); }), encryption, { get: async () => ({ title: "Fictional selected reflection", body: "Fictional snapshot" }) } as unknown as JournalService);
  app = createApp({ v1: { professionals: { service, verifier: { getUser: async (token) => ({ id: token === "owner" ? ids.owner : token === "admin" ? ids.second : token === "outsider" ? ids.outsider : ids.actor, assuranceLevel: token === "aal1" ? "aal1" : "aal2" }) }, verificationService: {} as VerificationService } } });
});
afterAll(async () => db?.close());
async function createCase() {
  const created = await post("/my-requests", { submissionId: randomUUID(), organizationId: ids.org, preferredProfileId: null, summary: "Fictional user request for combined integration testing.", preferredTime: "Afternoon", consent: true, journalIds: [ids.owner], phq8Ids: [ids.owner] }, "owner");
  expect(created.status).toBe(201);
  const id = created.body.data.request.id as string;
  expect((await post(`/cases/${id}/claim`)).status).toBe(200);
  return id;
}
it("connects v2 owner snapshots to audited clinical reads, while keeping notes private and revocation effective", async () => {
  const id = await createCase();
  expect((await post(`/cases/${id}/notes`, { body: "Fictional restricted clinical note" })).status).toBe(201);
  const clinician = await get(`/cases/${id}`);
  expect(clinician.status).toBe(200);
  expect(clinician.body.data.sharedPhq8[0]).toMatchObject({ id: ids.owner, score: 8, severity: "mild" });
  expect(clinician.body.data.sharedJournals[0].body).toBe("Fictional snapshot");
  expect(clinician.body.data.notes[0].body).toBe("Fictional restricted clinical note");
  const owner = await get(`/my-requests/${id}`, "owner");
  expect(owner.status).toBe(200);
  expect(owner.body.data.notes).toEqual([]);
  expect(JSON.stringify(owner.body)).not.toContain("restricted clinical note");
  const share = (await db.query<{ id: string }>("select id from professional_service.case_shared_records where request_id=$1 and resource_type='phq8'", [id])).rows[0].id;
  const revoke = await request(app).delete(`${base}/my-requests/${id}/sharing/${share}`).set("Authorization", "Bearer owner");
  expect(revoke.status).toBe(200);
  const refreshed = await get(`/cases/${id}`);
  expect(refreshed.body.data.sharedPhq8).toEqual([]);
  expect(refreshed.body.data.sharedJournals).toHaveLength(1);
  await db.exec("reset role; update professional_service.case_shared_records set expires_at=now()-interval '1 second',granted_at=now()-interval '2 days' where resource_type='journal'");
  await serviceRole(db);
  expect((await get(`/cases/${id}`)).body.data.sharedJournals).toEqual([]);
});
it("keeps PHQ-8, notes and messages inaccessible to administrators, outsiders and AAL1 clinicians", async () => {
  const id = await createCase();
  expect((await post(`/my-requests/${id}/messages`, { clientMessageId: randomUUID(), body: "Fictional private conversation" }, "owner")).status).toBe(201);
  expect((await get(`/cases/${id}/messages`)).body.data.messages[0].body).toBe("Fictional private conversation");
  const clientMessageId = randomUUID();
  const reply = { clientMessageId, body: "Fictional idempotent reply" };
  expect((await post(`/cases/${id}/messages`, reply)).status).toBe(201);
  expect((await post(`/cases/${id}/messages`, reply)).status).toBe(201);
  expect((await post(`/cases/${id}/messages`, { ...reply, body: "Changed reply" })).status).toBe(409);
  for (const actor of ["admin", "outsider", "aal1"]) {
    for (const path of [`/cases/${id}`, `/cases/${id}/messages`]) {
      const denied = await get(path, actor);
      expect([403, 404]).toContain(denied.status);
      expect(JSON.stringify(denied.body)).not.toMatch(/Fictional private|Fictional snapshot|sharedPhq8|case_notes/);
    }
  }
  expect((await post(`/my-requests/${id}/revoke`, {}, "owner")).status).toBe(200);
  const revoked = await get(`/cases/${id}`);
  expect(revoked.body.data.request.summary).toBeNull();
  expect(revoked.body.data.sharedPhq8).toEqual([]);
  expect(revoked.body.data.sharedJournals).toEqual([]);
});
it("allows coordinator initial assignment without clinical access and refuses reassignment around the transfer workflow", async () => {
  const profile = (await db.query<{ id: string }>("select p.id from professional_service.practitioner_profiles p join professional_service.memberships m on m.id=p.membership_id where m.user_id=$1", [ids.actor])).rows[0].id;
  const assigned = await post(`/cases/${ids.request}/assign`, { profileId: profile }, "admin");
  expect(assigned.status).toBe(200);
  expect((await get(`/cases/${ids.request}`, "admin")).status).toBe(403);
  expect((await post(`/cases/${ids.request}/assign`, { profileId: profile }, "admin")).status).toBe(409);
  await expect(db.query("select professional_service.assign_request($1,$2,$3)", [ids.request, ids.second, profile])).rejects.toThrow("CASE_NOT_ACTIVE");
  await db.exec("reset role; set role authenticated");
  await expect(db.query("select professional_service.case_snapshot($1,$2)", [ids.request, ids.actor])).rejects.toThrow(/permission denied/);
  await serviceRole(db);
  // The twelve historical conflicts retain their exact feature-branch SQL;
  // the new bridge is separate and does not alter any browser grants.
  expect(await readFile(new URL("../../../../../supabase/migrations/20261020103920_professional_shared_case_snapshot.sql", import.meta.url), "utf8")).toContain("revoke all");
});

it("rechecks per-record consent if revocation commits after the audited SQL snapshot", async () => {
  const id = await createCase();
  afterSnapshot = async () => { await db.query("update professional_service.case_shared_records set revoked_at=now(),revoked_by=$1 where request_id=$2 and resource_type='phq8'", [ids.owner, id]); };
  const response = await get(`/cases/${id}`);
  expect(response.status).toBe(200);
  expect(response.body.data.sharedPhq8).toEqual([]);
  expect(response.body.data.sharedJournals).toHaveLength(1);
});
