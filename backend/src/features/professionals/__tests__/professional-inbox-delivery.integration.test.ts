import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { professionalDatabase, seedProfessionalDatabase, ids, serviceRole, encryptedFixture } from "../../../../tests/fixtures/professional-database.js";
import { professionalWorkflowMigrations } from "../../../../tests/fixtures/professional-migrations.js";
import { installNotificationFixture } from "../../../../tests/fixtures/professional-notification-database.js";
import { professionalSqlClient } from "../../../../tests/fixtures/professional-sql-client.js";
import { ProfessionalService } from "../professional.service.js";
import { ProfessionalEventService } from "../professional-events.service.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";

type Page = { items: { id: string; kind: string; caseId: string; readAt: string | null }[]; total: number; unreadCount: number; inAppEnabled: boolean; hasMore: boolean };
let db: PGlite;
let service: ProfessionalService;
let events: ProfessionalEventService;
const list = (actor = ids.actor, org = ids.org, unread = false) => service.notifications.list(actor, org, unread) as Promise<Page>;
beforeAll(async () => {
  db = await professionalDatabase(professionalWorkflowMigrations, installNotificationFixture);
  await db.exec("reset role; grant usage on schema notification_service,user_service to service_role; grant select,insert on notification_service.notifications to service_role; grant select on user_service.notification_preferences to service_role");
}, 30_000);
beforeEach(async () => {
  await seedProfessionalDatabase(db);
  await db.exec("reset role; truncate notification_service.notifications cascade; truncate user_service.notification_preferences");
  await db.query("insert into user_service.notification_preferences(user_id) values($1),($2),($3)", [ids.actor, ids.second, ids.owner]);
  await serviceRole(db);
  await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]);
  const client = professionalSqlClient(db);
  service = new ProfessionalService(client, createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1), {} as JournalService);
  events = new ProfessionalEventService(client);
});
afterAll(async () => db?.close());

it("includes persisted inbound chat notices exactly once, with only scoped safe metadata", async () => {
  const id = randomUUID(), body = "Fictional private message - never a notification body";
  await service.sendMessage(ids.owner, ids.request, id, body, "owner");
  await service.sendMessage(ids.owner, ids.request, id, body, "owner");
  const page = await list();
  expect(page.items).toHaveLength(1);
  expect(page.items[0]).toMatchObject({ kind: "case_message", caseId: ids.request, readAt: null });
  expect(Object.keys(page.items[0]).sort()).toEqual(["caseId", "createdAt", "id", "kind", "readAt"]);
  expect(JSON.stringify(page)).not.toContain(body);
  expect(page.unreadCount).toBe(1);
  const read = await service.notifications.read(ids.actor, ids.org, page.items[0].id);
  expect(await service.notifications.read(ids.actor, ids.org, page.items[0].id)).toEqual(read);
  expect((await list()).unreadCount).toBe(0);
  expect((await list(ids.actor, ids.org, true)).items).toEqual([]);
});

it("honors opt-out for direct chat and queued events without modifying preferences", async () => {
  await db.exec("reset role");
  await db.query("update user_service.notification_preferences set in_app_enabled=false where user_id=$1", [ids.actor]);
  await serviceRole(db);
  await service.sendMessage(ids.owner, ids.request, randomUUID(), "Fictional muted update", "owner");
  expect((await events.runBatch()).suppressed).toBe(1);
  expect(await list()).toMatchObject({ items: [], unreadCount: 0, inAppEnabled: false });
  await db.exec("reset role");
  expect((await db.query("select in_app_enabled from user_service.notification_preferences where user_id=$1", [ids.actor])).rows[0]).toEqual({ in_app_enabled: false });
});

it("fails closed for missing preferences and still permits an opted-out account to read prior notices", async () => {
  await service.sendMessage(ids.owner, ids.request, randomUUID(), "Fictional earlier update", "owner");
  await db.exec("reset role");
  await db.query("delete from user_service.notification_preferences where user_id=$1", [ids.actor]);
  await serviceRole(db);
  await service.sendMessage(ids.owner, ids.request, randomUUID(), "Fictional later update", "owner");
  expect(await list()).toMatchObject({ total: 1, unreadCount: 1, inAppEnabled: false });
});

it("excludes transferred cases, wrong organizations, other users and wrong generic resource types", async () => {
  await service.sendMessage(ids.owner, ids.request, randomUUID(), "Fictional transfer message", "owner");
  const notice = (await list()).items[0];
  await expect(list(ids.actor, ids.otherOrg)).rejects.toMatchObject({ statusCode: 403 });
  await expect(service.notifications.read(ids.second, ids.org, notice.id)).rejects.toMatchObject({ statusCode: 404 });
  await db.query("select professional_service.transfer_case($1,$2,$3,$4,$5)", [ids.request, ids.actor, ids.second, encryptedFixture, randomUUID()]);
  expect((await list()).items).toEqual([]);
  await expect(service.notifications.read(ids.actor, ids.org, notice.id)).rejects.toMatchObject({ statusCode: 404 });
  await db.exec("reset role");
  await db.query("insert into notification_service.notifications(user_id,notification_type,title,message,resource_type,resource_id) values($1,'professional_case_message','Fictional','Wrong routing type','personal',$2)", [ids.second, ids.request]);
  await serviceRole(db);
  expect((await list(ids.second)).items).toEqual([]);
});

it("includes legacy chat notification IDs without requiring a fabricated message foreign key", async () => {
  await db.exec("reset role");
  const id = randomUUID();
  await db.query("insert into notification_service.notifications(id,user_id,notification_type,title,message,resource_type,resource_id) values($1,$2,'professional_case_message','Legacy fictional','Excluded message text','professional_case',$3)", [id, ids.actor, ids.request]);
  await serviceRole(db);
  expect((await list()).items).toEqual([expect.objectContaining({ id, kind: "case_message", caseId: ids.request })]);
  expect(JSON.stringify(await list())).not.toContain("Excluded message text");
});

it("isolates two organizations even when the same clinician is active in both", async () => {
  const credential = (await db.query<{ id: string }>("select * from professional_service.submit_credential($1,$2,'counselor','Synthetic credential',current_date+1,$3)", [ids.otherOrg, ids.actor, encryptedFixture])).rows[0];
  await db.query("select professional_service.review_credential($1,$2,$3,'approved',null)", [ids.otherOrg, credential.id, ids.admin]);
  await db.query("insert into professional_service.memberships(organization_id,user_id,role,status,display_name,credential_label,credential_expires_at,approved_at,approved_by,approved_credential_id) values($1,$2,'counselor','active','Synthetic practitioner','Synthetic credential',current_date+1,now(),$3,$4)", [ids.otherOrg, ids.actor, ids.admin, credential.id]);
  await db.exec("reset role");
  const request = randomUUID(), notice = randomUUID();
  await db.query("insert into professional_service.support_requests(id,organization_id,user_id,summary_encrypted,preferred_time_encrypted,consent_version) values($1,$2,$3,$4,$4,'professional-request-v1')", [request, ids.otherOrg, ids.owner, encryptedFixture]);
  await serviceRole(db);
  await db.query("select professional_service.claim_request($1,$2)", [request, ids.actor]);
  await db.query("insert into notification_service.notifications(id,user_id,notification_type,title,message,resource_type,resource_id) values($1,$2,'professional_case_message','Synthetic','Synthetic','professional_case',$3)", [notice, ids.actor, request]);
  expect((await list()).items).toEqual([]);
  expect((await list(ids.actor, ids.otherOrg)).items).toEqual([expect.objectContaining({ id: notice, caseId: request })]);
  await expect(service.notifications.read(ids.actor, ids.org, notice)).rejects.toMatchObject({ statusCode: 404 });
});

it("rejects suspended/administrative membership and browser RPC execution", async () => {
  await db.exec("reset role");
  await db.query("update professional_service.memberships set role='org_admin',credential_expires_at=null where user_id=$1", [ids.second]);
  await serviceRole(db);
  await expect(list(ids.second)).rejects.toMatchObject({ statusCode: 403 });
  await db.exec("reset role");
  await db.query("update professional_service.memberships set status='suspended' where user_id=$1", [ids.actor]);
  await serviceRole(db);
  await expect(list()).rejects.toMatchObject({ statusCode: 403 });
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(db.query("select professional_service.list_notifications($1,$2,false)", [ids.org, ids.actor])).rejects.toThrow(/permission denied/);
    await expect(db.query("select professional_service.read_notification($1,$2,$3)", [ids.org, randomUUID(), ids.actor])).rejects.toThrow(/permission denied/);
  }
});

it("reports exact unread totals beyond the bounded page for mixed message and queued appointment notices", async () => {
  await events.runBatch();
  for (let i = 0; i < 52; i++) await service.sendMessage(ids.owner, ids.request, randomUUID(), `Fictional message ${i}`, "owner");
  await db.query("select professional_service.propose_appointment($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour','online',$3)", [ids.request, ids.actor, encryptedFixture]);
  expect((await events.runBatch()).delivered).toBe(2); // assigned clinician + owner
  expect((await events.runBatch()).delivered).toBe(0);
  const page = await list();
  expect(page).toMatchObject({ total: 54, unreadCount: 54, hasMore: true });
  expect(page.items).toHaveLength(50);
  expect(page.items.some(item => item.kind === "appointment_changed")).toBe(true);
});
