import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("stores professional HTTP outcomes without widening browser permissions or accepting arbitrary events", async () => {
  const db = new PGlite();
  try {
    await db.exec("create schema user_service; create role anon; create role authenticated; create role service_role bypassrls;");
    for (const name of ["20260917014000_security_audit_events.sql", "20261018150000_security_professional_http_audit.sql"]) {
      await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8"));
    }
    const insert = "insert into user_service.security_events(event_type,request_id,outcome,status_code) values($1,gen_random_uuid(),'allowed',200)";
    await db.query(insert, ["professional.request"]);
    await db.query(insert, ["account.security"]);
    await expect(db.query(insert, ["arbitrary.event"])).rejects.toThrow(/security_events_event_type_check/);
    expect((await db.query("select relrowsecurity from pg_class where oid='user_service.security_events'::regclass")).rows[0]).toEqual({ relrowsecurity: true });
    expect((await db.query("select has_table_privilege('authenticated','user_service.security_events','SELECT') allowed")).rows[0]).toEqual({ allowed: false });
    expect((await db.query("select has_table_privilege('service_role','user_service.security_events','INSERT') allowed")).rows[0]).toEqual({ allowed: true });
  } finally { await db.close(); }
}, 30_000);
