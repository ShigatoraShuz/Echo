import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("queues only opted-in channels, claims once, and carries the masking preference", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema user_service; create schema notification_service;
      create function auth.role() returns text language sql as 'select ''service_role''::text';
      create table auth.users(id uuid primary key);
      create table user_service.profiles(user_id uuid primary key, account_status text);
      create table user_service.notification_preferences(user_id uuid primary key, email_enabled boolean, push_enabled boolean);
      create table user_service.privacy_preferences(user_id uuid primary key, lock_screen_private boolean);
      create table notification_service.notifications(
        id uuid primary key default gen_random_uuid(), user_id uuid, notification_type text,
        created_at timestamptz not null default now()
      );
      create table notification_service.notification_logs(
        id uuid primary key default gen_random_uuid(), notification_id uuid, channel text,
        delivery_status text not null default 'pending', provider_message_id text,
        sent_at timestamptz, created_at timestamptz not null default now()
      );
    `);
    await db.exec(readFileSync(resolve(process.cwd(), "../supabase/migrations/20261018130000_notification_channel_delivery.sql"), "utf8"));
    const user = "11111111-1111-4111-8111-111111111111";
    await db.query("insert into auth.users(id) values($1)", [user]);
    await db.query("insert into user_service.profiles values($1,'active')", [user]);
    await db.query("insert into user_service.notification_preferences values($1,true,true)", [user]);
    await db.query("insert into user_service.privacy_preferences values($1,true)", [user]);
    await db.query("insert into notification_service.push_subscriptions(user_id,endpoint_hash,subscription_ciphertext) values($1,$2,$3)",
      [user, "a".repeat(64), "encrypted"]);
    await db.query("insert into notification_service.notifications(user_id,notification_type) values($1,'journal_reminder')", [user]);
    const logs = await db.query<{ channel: string }>("select channel from notification_service.notification_logs order by channel");
    expect(logs.rows.map((row) => row.channel)).toEqual(["email", "push"]);
    const claimed = await db.query<{ channel: string; enabled: boolean; lock_screen_private: boolean }>(
      "select channel,enabled,lock_screen_private from notification_service.claim_notification_deliveries(20) order by channel",
    );
    expect(claimed.rows).toEqual([
      expect.objectContaining({ channel: "email", enabled: true, lock_screen_private: true }),
      expect.objectContaining({ channel: "push", enabled: true, lock_screen_private: true }),
    ]);
    expect((await db.query("select * from notification_service.claim_notification_deliveries(20)")).rows).toHaveLength(0);
    await db.query("update user_service.notification_preferences set email_enabled=false,push_enabled=false where user_id=$1", [user]);
    await db.query("insert into notification_service.notifications(user_id,notification_type) values($1,'grounding_reminder')", [user]);
    expect((await db.query("select * from notification_service.notification_logs")).rows).toHaveLength(2);
    await db.exec(readFileSync(resolve(process.cwd(), "../supabase/migrations/20261018131000_push_endpoint_single_owner.sql"), "utf8"));
    const secondUser = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into auth.users(id) values($1)", [secondUser]);
    await db.query(`insert into notification_service.push_subscriptions(user_id,endpoint_hash,subscription_ciphertext)
      values($1,$2,'new-encrypted') on conflict(endpoint_hash) do update
      set user_id=excluded.user_id,subscription_ciphertext=excluded.subscription_ciphertext`, [secondUser, "a".repeat(64)]);
    const owners = await db.query<{ user_id: string }>("select user_id from notification_service.push_subscriptions");
    expect(owners.rows.map((row) => row.user_id)).toEqual([secondUser]);
  } finally {
    await db.close();
  }
}, 20_000);
