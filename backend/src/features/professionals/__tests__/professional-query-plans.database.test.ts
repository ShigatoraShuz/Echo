import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
type Plan = { "Total Cost": number; "Node Type": string; "Index Name"?: string; Plans?: Plan[] };
const queries = {
  queue: `select id,organization_id,status,assigned_to,created_at,updated_at from professional_service.support_requests where organization_id='${ids.org}' order by created_at desc,id limit 20`,
  updated: `select id,organization_id,status,assigned_to,created_at,updated_at from professional_service.support_requests where organization_id='${ids.org}' order by updated_at desc,id limit 20`,
  myCases: `select id,status,updated_at from professional_service.support_requests where organization_id='${ids.org}' and assigned_to='${ids.actor}' order by updated_at desc,id limit 20`,
  appointments: `select id,starts_at,status from professional_service.appointments where request_id='${ids.request}' order by created_at desc,id limit 20`,
  timeline: `select id,action,created_at from professional_service.audit_events where request_id='${ids.request}' and organization_id='${ids.org}' and action in ('request.created','request.updated','request.withdrawn','request.claimed','request.closed','request.declined','request.transferred','sharing.revoked','appointment.proposed','appointment.confirmed','appointment.declined','appointment.canceled','appointment.rescheduled','note.created','note.finalized','referral.created') order by created_at desc,id desc limit 20`,
  reminders: "select id,due_at from professional_service.follow_ups where status='pending' and due_at<=now() order by due_at,id limit 20",
};
const before: Record<string, Plan> = {};
const plan = async (sql: string) => (await db.query<{ "QUERY PLAN": Array<{ Plan: Plan }> }>(`explain (analyze,buffers,format json) ${sql}`)).rows[0]["QUERY PLAN"][0].Plan;
beforeAll(async () => {
  db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261016120000_professional_follow_ups.sql"]);
  await seedProfessionalDatabase(db); await db.exec("reset role");
  await db.query(`insert into professional_service.support_requests(organization_id,user_id,summary_encrypted,preferred_time_encrypted,consent_version,created_at,updated_at)
    select case when n%10=0 then $1::uuid else $2::uuid end,$3,$4,$4,'professional-request-v1',
      now()-make_interval(secs=>n),now()-make_interval(secs=>n*2) from generate_series(1,12000) n`, [ids.org, ids.otherOrg, ids.owner, encryptedFixture]);
  await serviceRole(db);
  await db.query("select professional_service.claim_request(id,$1) from professional_service.support_requests where organization_id=$2", [ids.actor, ids.org]);
  await db.exec("reset role");
  await db.query(`insert into professional_service.appointments(request_id,professional_user_id,starts_at,ends_at,mode,location_hint_encrypted,status,created_at)
    select case when n%10=0 then $1::uuid else (select id from professional_service.support_requests where organization_id=$2 limit 1) end,$3,
      now()+make_interval(secs=>n*3600),now()+make_interval(secs=>n*3600+1800),'online',$4,'canceled',now()-make_interval(secs=>n) from generate_series(1,6000) n`, [ids.request, ids.otherOrg, ids.actor, encryptedFixture]);
  await db.query("insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action,created_at) select $1,$2,$3,case when n%100=0 then 'request.updated' else 'case.opened' end,now()-make_interval(secs=>n) from generate_series(1,6000) n", [ids.org, ids.request, ids.actor]);
  await db.query("insert into professional_service.follow_ups(request_id,organization_id,created_by,responsible_user_id,title_encrypted,due_at,submission_id) select $1,$2,$3,$3,$4,now()-make_interval(secs=>n),gen_random_uuid() from generate_series(1,6000) n", [ids.request, ids.org, ids.actor, encryptedFixture]);
  await db.exec("analyze professional_service.support_requests; analyze professional_service.appointments; analyze professional_service.audit_events; analyze professional_service.follow_ups");
  for (const [name, sql] of Object.entries(queries)) before[name] = await plan(sql);
  await db.exec(await readFile(new URL("../../../../../supabase/migrations/20261016160000_professional_query_indexes.sql", import.meta.url), "utf8"));
  await db.exec("analyze professional_service.support_requests; analyze professional_service.appointments; analyze professional_service.audit_events; analyze professional_service.follow_ups");
}, 30_000);
afterAll(async () => db?.close());
describe("BE-028 synthetic PostgreSQL query plans", () => {
  it.each(Object.entries(queries))("reduces estimated bounded-query cost for %s without changing data", async (name, sql) => {
    const after = await plan(sql);
    expect(after["Total Cost"]).toBeLessThan(before[name]["Total Cost"]);
    const indexes: Record<string, string> = { queue: "professional_queue_recent_idx", updated: "professional_queue_updated_idx", myCases: "professional_assignee_updated_idx", appointments: "professional_appointment_history_idx", timeline: "professional_case_timeline_idx", reminders: "professional_follow_up_reminder_idx" };
    expect(JSON.stringify(after)).toContain(indexes[name]);
    expect((await db.query(sql)).rows).toHaveLength(20);
    process.stdout.write(`Synthetic ${name} estimated cost: ${before[name]["Total Cost"]} -> ${after["Total Cost"]}\n`);
  });
  it("retains existing membership, appointment conflict and tenant-filtered count contracts", async () => {
    expect((await db.query<{ count: number }>("select count(*)::integer count from professional_service.support_requests where organization_id=$1", [ids.org])).rows[0].count).toBe(1201);
    const indexes = await db.query<{ indexname: string }>("select indexname from pg_indexes where schemaname='professional_service'");
    expect(indexes.rows.map(r => r.indexname)).toEqual(expect.arrayContaining(["memberships_organization_id_user_id_key", "appointments_one_active_per_request_idx", "professional_case_timeline_idx", "professional_follow_up_reminder_idx"]));
  });
});
