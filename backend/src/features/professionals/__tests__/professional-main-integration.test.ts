import { z } from "zod";
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
  await db.exec("reset role; create schema insights_service; create table insights_service.phq8_assessments(id uuid primary key,user_id uuid,submission_id uuid,assessment_ciphertext text,completed_at timestamptz); grant usage on schema insights_service to service_role; grant select on insights_service.phq8_assessments to service_role; grant usage on schema notification_service to service_role; grant select,insert on notification_service.notifications to service_role");
}, 30_000);
beforeEach(async () => {
  afterSnapshot = undefined;
  await seedProfessionalDatabase(db);
  await db.exec("reset role; truncate user_service.notification_preferences");
  await db.query("insert into user_service.notification_preferences(user_id) values($1),($2)", [ids.owner, ids.actor]);
  await db.exec("grant usage on schema user_service to service_role; grant select on user_service.notification_preferences to service_role");
  await db.exec("reset role; truncate insights_service.phq8_assessments");
  await db.query("insert into insights_service.phq8_assessments values($1,$1,$2,$3,now())", [ids.owner, randomUUID(), encryptText(JSON.stringify({ userId: ids.owner, score: 8, severity: "mild" }), encryption)]);
  await db.query("update professional_service.memberships set role='org_admin',credential_expires_at=null where user_id=$1", [ids.second]);
  await serviceRole(db);
  const service = new ProfessionalService(professionalSqlClient(db, async (name) => { if (name === "case_snapshot") await afterSnapshot?.(); }), encryption, { get: async () => ({ title: "Fictional selected reflection", body: "Fictional snapshot" }) } as unknown as JournalService);
  app = createApp({ v1: { professionals: { service, verifier: { getUser: async (token) => ({ id: token === "owner" || token === "owner-aal1" ? ids.owner : token === "admin" ? ids.second : token === "outsider" ? ids.outsider : ids.actor, assuranceLevel: ["aal1", "owner-aal1"].includes(token) ? "aal1" : "aal2" }) }, verificationService: {} as VerificationService } } });
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


it("keeps retry notifications idempotent for both participants", async () => {
  const id = await createCase();
  for (const actor of ["owner", "actor"]) {
    const input = { clientMessageId: randomUUID(), body: "Fictional retry delivery" };
    const path = actor === "owner" ? `/my-requests/${id}/messages` : `/cases/${id}/messages`;
    const first = await post(path, input, actor);
    expect(first.status).toBe(201);
    expect((await post(path, input, actor)).body.data.message.id).toBe(first.body.data.message.id);
  }
  const notices = await db.query<{ count: number }>("select count(*)::int count from notification_service.notifications where resource_id=$1 and notification_type='professional_case_message'", [id]);
  expect(notices.rows[0].count).toBe(2);
});

it("paginates tied timestamps without omissions in both directions", async () => {
  const id = await createCase();
  for (let index = 0; index < 5; index++) {
    expect((await post(`/cases/${id}/messages`, { clientMessageId: randomUUID(), body: `Fictional message ${index}` })).status).toBe(201);
  }
  await db.query("update professional_service.case_messages set created_at='2026-10-21T00:00:00.123456Z' where request_id=$1", [id]);
  for (const actor of ["owner", "actor"]) {
    const path = actor === "owner" ? `/my-requests/${id}/messages` : `/cases/${id}/messages`;
    const collected: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page++) {
      const response = await get(path + `?limit=2${cursor ? "&before=" + encodeURIComponent(cursor) : ""}`, actor);
      expect(response.status).toBe(200);
      collected.unshift(...response.body.data.messages.map((message: { id: string }) => message.id));
      cursor = response.body.data.nextCursor;
      if (!cursor) break;
    }
    expect(collected).toHaveLength(5);
    expect(new Set(collected).size).toBe(5);
    expect(collected).toEqual([...collected].sort());
    expect(cursor).toBeNull();
  }
});

it("binds per-record revocation to the case in the URL", async () => {
  const first = await createCase();
  const second = await createCase();
  const share = (await db.query<{ id: string }>("select id from professional_service.case_shared_records where request_id=$1 limit 1", [second])).rows[0].id;
  const response = await request(app).delete(`${base}/my-requests/${first}/sharing/${share}`).set("Authorization", "Bearer owner");
  expect(response.status).toBe(404);
  expect((await db.query<{ revoked_at: string | null }>("select revoked_at from professional_service.case_shared_records where id=$1", [share])).rows[0].revoked_at).toBeNull();
});

it("does not let clinicians use owner-only paths to avoid MFA", async () => {
  const id = await createCase();
  for (const suffix of ["messages", "sharing", "timeline"]) {
    expect((await get(`/my-requests/${id}/${suffix}`, "owner-aal1")).status).toBe(200);
    expect((await get(`/my-requests/${id}/${suffix}`, "aal1")).status).toBe(404);
  }
  expect((await post(`/my-requests/${id}/messages`, { clientMessageId: randomUUID(), body: "Disallowed owner-path send" }, "aal1")).status).toBe(404);
  expect((await request(app).patch(`${base}/my-requests/${id}/messages/read`).set("Authorization", "Bearer aal1").send({})).status).toBe(404);
  expect((await db.query<{ count: number }>("select count(*)::int count from professional_service.case_messages where request_id=$1", [id])).rows[0].count).toBe(0);
});

it("persists one v2 submission, delivers its metadata to the matching queue, and synchronizes appointment and two-way updates", async () => {
  const input = { submissionId: randomUUID(), organizationId: ids.org, summary: "Fictional complete User to Professional round trip.", preferredTime: "Afternoon", journalIds: [], phq8Ids: [], consent: true };
  const created = await post("/my-requests", input, "owner-aal1");
  expect(created.status).toBe(201);
  const id = created.body.data.request.id as string;
  expect((await post("/my-requests", input, "owner-aal1")).body.data.request.id).toBe(id);
  expect((await db.query<{ count: number }>("select count(*)::int count from professional_service.support_requests where submission_id=$1", [input.submissionId])).rows[0].count).toBe(1);
  expect((await get("/my-requests", "owner-aal1")).body.data.requests).toEqual(expect.arrayContaining([expect.objectContaining({ id, organizationId: ids.org, status: "submitted" })]));
  const intake = await get(`/organizations/${ids.org}/queue`, "admin");
  expect(intake.status).toBe(200);
  const metadata = intake.body.data.requests.find((row: { id: string }) => row.id === id);
  expect(Object.keys(metadata).sort()).toEqual(["assignedTo", "createdAt", "id", "organizationId", "status", "updatedAt"]);
  expect((await get(`/organizations/${ids.otherOrg}/queue`, "outsider")).body.data.requests).not.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  expect((await get(`/organizations/${ids.org}/queue`, "outsider")).status).toBe(403);
  const profile = (await db.query<{ id: string }>("select p.id from professional_service.practitioner_profiles p join professional_service.memberships m on m.id=p.membership_id where m.user_id=$1", [ids.actor])).rows[0].id;
  expect((await post(`/cases/${id}/assign`, { profileId: profile }, "admin")).status).toBe(200);
  const mine = await get(`/organizations/${ids.org}/queue?assignedTo=me`);
  expect(mine.body.data.requests).toEqual(expect.arrayContaining([expect.objectContaining({ id, assignedTo: ids.actor, status: "assigned" })]));
  expect((await get(`/cases/${id}`, "admin")).status).toBe(403);
  const offer = await post(`/cases/${id}/appointments`, { startsAt: "2099-01-02T10:00:00Z", endsAt: "2099-01-02T11:00:00Z", mode: "online", locationHint: "Fictional appointment" });
  expect(offer.status).toBe(201);
  const appointment = offer.body.data.appointmentId as string;
  const owner = await get(`/my-requests/${id}`, "owner-aal1");
  expect(owner.body.data.appointments).toEqual(expect.arrayContaining([expect.objectContaining({ id: appointment, status: "proposed" })]));
  expect((await post(`/appointments/${appointment}/respond`, { accept: true }, "owner-aal1")).body.data.status).toBe("confirmed");
  expect((await get(`/cases/${id}`)).body.data.request.status).toBe("scheduled");
  const paths = [["owner-aal1", `/my-requests/${id}/messages`], ["actor", `/cases/${id}/messages`]];
  for (const [actor, path] of paths) {
    expect((await post(path, { clientMessageId: randomUUID(), body: `Fictional ${actor} reply` }, actor)).status).toBe(201);
  }
  for (const [actor, path] of paths) {
    const messages = await get(path, actor);
    expect(messages.body.data.messages.map((message: { sender: string }) => message.sender)).toEqual(["user", "professional"]);
    expect((await request(app).patch(base + path + "/read").set("Authorization", `Bearer ${actor}`).send({})).status).toBe(200);
  }
  expect((await db.query<{ count: number }>("select count(*)::int count from professional_service.case_message_read_state where request_id=$1", [id])).rows[0].count).toBe(2);
  expect((await post(`/appointments/${appointment}/cancel`, {}, "owner-aal1")).status).toBe(200);
  expect((await post(`/cases/${id}/close`, { reason: "Fictional round trip completed" })).status).toBe(200);
  expect((await get(`/my-requests/${id}`, "owner-aal1")).body.data.request.status).toBe("closed");
});

it("rejects reuse of a request submission key for a different organization or intent", async () => {
  const input = { submissionId: randomUUID(), organizationId: ids.org, summary: "Fictional stable request submission intent.", preferredTime: "Afternoon", journalIds: [], phq8Ids: [], consent: true };
  const first = await post("/my-requests", input, "owner");
  expect(first.status).toBe(201);
  for (const change of [{ organizationId: ids.otherOrg }, { summary: "Fictional changed support request summary." }, { phq8Ids: [ids.owner] }]) {
    const response = await post("/my-requests", { ...input, ...change }, "owner");
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("REQUEST_SUBMISSION_CONFLICT");
  }
  expect((await db.query<{ count: number }>("select count(*)::int count from professional_service.support_requests where submission_id=$1", [input.submissionId])).rows[0].count).toBe(1);
});

it.each([true,false])('completes the isolated appointment round trip (accept=%s), calendars, notifications and access denial',async(accept)=>{
 const id=await createCase();await db.exec('reset role; truncate notification_service.notifications cascade; truncate user_service.notification_preferences');await db.query('insert into user_service.notification_preferences(user_id) values($1),($2)',[ids.owner,ids.actor]);await serviceRole(db);
 const input={startsAt:'2099-10-24T10:00:00Z',endsAt:'2099-10-24T11:00:00Z',mode:'online',locationHint:'Fictional test meeting'};
 const proposal=await post('/cases/'+id+'/appointments',input);expect(proposal.status).toBe(201);const appointmentId=proposal.body.data.appointmentId;
 expect((await post('/cases/'+id+'/appointments',input)).status).toBe(409);
 expect([403,404]).toContain((await post('/appointments/'+appointmentId+'/respond',{accept},'outsider')).status);
 const before=await get('/appointments','owner');expect(before.status).toBe(200);expect(before.body.data.appointments).toContainEqual(expect.objectContaining({id:appointmentId,status:'proposed',requestId:id}));
 const response=await post('/appointments/'+appointmentId+'/respond',{accept},'owner');expect(response.status).toBe(200);expect(response.body.data.status).toBe(accept?'confirmed':'canceled');
 expect((await post('/appointments/'+appointmentId+'/respond',{accept},'owner')).status).toBe(200);
 const clinician=await get('/cases/'+id);expect(clinician.body.data.request.status).toBe(accept?'scheduled':'assigned');expect(clinician.body.data.appointments).toContainEqual(expect.objectContaining({id:appointmentId,status:accept?'confirmed':'canceled'}));
 expect((await get('/appointments','owner')).body.data.appointments).toContainEqual(expect.objectContaining({id:appointmentId,status:accept?'confirmed':'canceled'}));
 const dashboard=await get('/organizations/'+ids.org+'/dashboard');expect(dashboard.status).toBe(200);expect(dashboard.body.data.appointments.some((a:{id:string})=>a.id===appointmentId)).toBe(accept);
 expect((await get('/appointments','admin')).body.data.appointments).toEqual([]);expect((await get('/cases/'+id,'admin')).status).toBe(403);
 await db.query('select professional_service.process_events(100)');
 const notices=await db.query<{user_id:string;id:string}>('select id,user_id from notification_service.notifications');expect(notices.rows.every(n=>z.uuid().safeParse(n.id).success)).toBe(true);expect(notices.rows.some(n=>n.user_id===ids.owner)).toBe(true);expect(notices.rows.some(n=>n.user_id===ids.actor)).toBe(true);
 const count=notices.rows.length;await db.query('select professional_service.process_events(100)');expect((await db.query('select id from notification_service.notifications')).rows).toHaveLength(count);
});
it('reports committed appointment partial success, retries durable delivery and does not duplicate on reschedule replay',async()=>{
 const id=await createCase();await db.exec('reset role; truncate user_service.notification_preferences');await db.query('insert into user_service.notification_preferences(user_id) values($1),($2)',[ids.owner,ids.actor]);await db.exec("truncate notification_service.notifications cascade; alter table notification_service.notifications add constraint synthetic_delivery_failure check(notification_type not in ('professional_appointment_proposed','professional_appointment_update')); alter table professional_service.case_events add constraint synthetic_history_failure check(event_type<>'appointment_proposed')");await serviceRole(db);
 const input={startsAt:'2099-10-24T10:00:00Z',endsAt:'2099-10-24T11:00:00Z',mode:'online',locationHint:'Fictional test meeting'};
 try { const result=await post('/cases/'+id+'/appointments',input);expect(result.status).toBe(201);expect(result.body.data.warning).toContain('appointment was saved');expect((await get('/cases/'+id)).body.data.appointments).toHaveLength(1);expect((await post('/cases/'+id+'/appointments',input)).status).toBe(409);await db.query('select professional_service.process_events(100)');await db.exec('reset role');expect((await db.query("select status from professional_service.event_outbox where audience='owner'")).rows[0]).toMatchObject({status:'pending'}); }
 finally {await db.exec('reset role; alter table notification_service.notifications drop constraint synthetic_delivery_failure; alter table professional_service.case_events drop constraint synthetic_history_failure; update professional_service.event_outbox set next_attempt_at=now()');await serviceRole(db);}
 await db.query('select professional_service.process_events(100)');const original=(await get('/cases/'+id)).body.data.appointments[0].id;
 const replacement={...input,startsAt:'2099-10-25T10:00:00Z',endsAt:'2099-10-25T11:00:00Z'};const changed=await post('/appointments/'+original+'/reschedule',replacement);expect(changed.status).toBe(200);expect((await post('/appointments/'+original+'/reschedule',replacement)).body.data.appointmentId).toBe(changed.body.data.appointmentId);
 const appointments=(await get('/cases/'+id)).body.data.appointments;expect(appointments).toHaveLength(2);expect(appointments.find((item:{id:string})=>item.id===changed.body.data.appointmentId)).toMatchObject({replacesAppointmentId:original});const events=await db.query("select event_type from professional_service.case_events where event_type='appointment_rescheduled'");expect(events.rows).toHaveLength(1);
});

it('drains only the authorized case and preserves unrelated pending deliveries',async()=>{
 const first=await createCase(),other=await createCase();await db.exec('reset role;truncate user_service.notification_preferences');await db.query('insert into user_service.notification_preferences(user_id) values($1),($2)',[ids.owner,ids.actor]);await serviceRole(db);
 const proposed=await post('/cases/'+first+'/appointments',{startsAt:'2099-10-24T10:00:00Z',endsAt:'2099-10-24T11:00:00Z',mode:'online',locationHint:''});expect(proposed.status).toBe(201);expect(proposed.body.data.warning).toBeUndefined();
 await db.exec('reset role');expect((await db.query("select id from professional_service.event_outbox where request_id=$1 and status='pending'",[first])).rows).toHaveLength(0);expect((await db.query("select id from professional_service.event_outbox where request_id=$1 and status='pending'",[other])).rows.length).toBeGreaterThan(0);
});

it('reports a saved appointment honestly when the deployed scoped delivery RPC is unavailable',async()=>{
 const id=await createCase();await db.exec('reset role;alter function professional_service.process_case_events(uuid,integer) rename to synthetic_held_delivery');await serviceRole(db);
 try{const result=await post('/cases/'+id+'/appointments',{startsAt:'2099-10-24T10:00:00Z',endsAt:'2099-10-24T11:00:00Z',mode:'online',locationHint:''});expect(result.status).toBe(201);expect(result.body.data.warning).toContain('appointment was saved');expect((await get('/cases/'+id)).body.data.appointments).toHaveLength(1);}finally{await db.exec('reset role;alter function professional_service.synthetic_held_delivery(uuid,integer) rename to process_case_events');await serviceRole(db);}
});
