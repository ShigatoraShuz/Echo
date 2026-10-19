import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

const databases: PGlite[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()));
});

async function reminderDatabase() {
  const database = new PGlite();
  databases.push(database);
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema user_service;
    create schema notification_service;
    create function auth.role() returns text language sql as 'select ''service_role''::text';
    create table user_service.notification_preferences (
      user_id uuid primary key,
      in_app_enabled boolean not null,
      journal_reminders_enabled boolean not null,
      wellbeing_reminders_enabled boolean not null,
      reminder_time time,
      reminder_timezone text
    );
    create table notification_service.notifications (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      notification_type text not null,
      title text not null,
      message text not null,
      resource_type text,
      resource_id uuid,
      created_at timestamptz not null default now()
    );
  `);
  const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/20261017120000_in_app_reminder_delivery.sql"), "utf8");
  await database.exec(migration);
  return database;
}

describe("in-app reminder migration", () => {
  it("grants authenticated Settings writes to both quiet-hour columns", async () => {
    const database = await reminderDatabase();
    const grantMigration = readFileSync(resolve(process.cwd(), "../supabase/migrations/20261018120000_notification_quiet_hours_grants.sql"), "utf8");
    await database.exec(grantMigration);
    const { rows } = await database.query<{ start_allowed: boolean; end_allowed: boolean }>(`
      select has_column_privilege('authenticated', 'user_service.notification_preferences', 'quiet_hours_start', 'UPDATE') as start_allowed,
             has_column_privilege('authenticated', 'user_service.notification_preferences', 'quiet_hours_end', 'UPDATE') as end_allowed
    `);
    expect(rows[0]).toEqual({ start_allowed: true, end_allowed: true });
  }, 20_000);

  it("sends at the user's local time, deduplicates retries, and honors opt-out", async () => {
    const database = await reminderDatabase();
    const user = "11111111-1111-4111-8111-111111111111";
    await database.query(`insert into user_service.notification_preferences
      (user_id, in_app_enabled, journal_reminders_enabled, wellbeing_reminders_enabled, reminder_time, reminder_timezone)
      values ($1, true, true, true, '08:00', 'Asia/Manila')`, [user]);
    const run = (at: string) => database.query<{ enqueue_due_in_app_reminders: number }>(
      "select notification_service.enqueue_due_in_app_reminders($1::timestamptz)", [at],
    );

    expect((await run("2026-10-16T23:59:00Z")).rows[0].enqueue_due_in_app_reminders).toBe(0);
    expect((await run("2026-10-17T00:00:00Z")).rows[0].enqueue_due_in_app_reminders).toBe(2);
    expect((await run("2026-10-17T00:01:00Z")).rows[0].enqueue_due_in_app_reminders).toBe(0);
    expect((await run("2026-10-18T00:00:00Z")).rows[0].enqueue_due_in_app_reminders).toBe(2);
    await database.query("update user_service.notification_preferences set in_app_enabled=false where user_id=$1", [user]);
    expect((await run("2026-10-19T00:00:00Z")).rows[0].enqueue_due_in_app_reminders).toBe(0);
    const { rows } = await database.query<{ title: string; message: string; reminder_local_date: string }>(
      "select title,message,reminder_local_date from notification_service.notifications order by reminder_local_date,title",
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => !row.message.includes(user))).toBe(true);
  }, 20_000);

  it("creates only one reminder across a repeated daylight-saving hour", async () => {
    const database = await reminderDatabase();
    await database.query(`insert into user_service.notification_preferences
      (user_id, in_app_enabled, journal_reminders_enabled, wellbeing_reminders_enabled, reminder_time, reminder_timezone) values
      ('22222222-2222-4222-8222-222222222222', true, true, false, '01:30', 'America/New_York')`);
    const run = (at: string) => database.query<{ enqueue_due_in_app_reminders: number }>(
      "select notification_service.enqueue_due_in_app_reminders($1::timestamptz)", [at],
    );
    expect((await run("2026-11-01T05:30:00Z")).rows[0].enqueue_due_in_app_reminders).toBe(1);
    expect((await run("2026-11-01T06:30:00Z")).rows[0].enqueue_due_in_app_reminders).toBe(0);
  }, 20_000);

  it("rejects a non-service caller and skips invalid legacy timezones", async () => {
    const database = await reminderDatabase();
    await database.query(`insert into user_service.notification_preferences
      (user_id, in_app_enabled, journal_reminders_enabled, wellbeing_reminders_enabled, reminder_time, reminder_timezone) values
      ('33333333-3333-4333-8333-333333333333', true, true, false, '08:00', 'Invalid/Zone')`);
    const at = "2026-10-17T12:00:00Z";
    expect((await database.query<{ enqueue_due_in_app_reminders: number }>(
      "select notification_service.enqueue_due_in_app_reminders($1::timestamptz)", [at],
    )).rows[0].enqueue_due_in_app_reminders).toBe(0);
    await database.exec("create or replace function auth.role() returns text language sql as 'select ''authenticated''::text'");
    await expect(database.query(
      "select notification_service.enqueue_due_in_app_reminders($1::timestamptz)", [at],
    )).rejects.toThrow("Reminder delivery requires the service role");
  }, 20_000);

  it("suppresses reminders during quiet hours, including a window across midnight", async () => {
    const database = await reminderDatabase();
    const user = "44444444-4444-4444-8444-444444444444";
    await database.query(`insert into user_service.notification_preferences
      (user_id, in_app_enabled, journal_reminders_enabled, wellbeing_reminders_enabled,
       reminder_time, reminder_timezone, quiet_hours_start, quiet_hours_end)
      values ($1, true, true, false, '21:00', 'UTC', '22:00', '07:00')`, [user]);
    const run = async (at: string) => (await database.query<{ enqueue_due_in_app_reminders: number }>(
      "select notification_service.enqueue_due_in_app_reminders($1::timestamptz)", [at],
    )).rows[0].enqueue_due_in_app_reminders;

    expect(await run("2026-10-17T21:59:00Z")).toBe(1);
    await database.query("delete from notification_service.notifications where user_id=$1", [user]);
    expect(await run("2026-10-17T22:00:00Z")).toBe(0);
    expect(await run("2026-10-18T06:59:00Z")).toBe(0);
    expect(await run("2026-10-18T07:00:00Z")).toBe(0);
    expect(await run("2026-10-18T21:00:00Z")).toBe(1);
    await expect(database.query(`update user_service.notification_preferences
      set reminder_time='23:00' where user_id=$1`, [user]))
      .rejects.toThrow("notification_reminder_outside_quiet_check");
  }, 20_000);
});
