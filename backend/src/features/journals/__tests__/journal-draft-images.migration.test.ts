import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("reserves five private draft photos, transfers them once, and queues abandoned photos for deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema journal_service;
      create function auth.role() returns text language sql as 'select ''service_role''::text';
      create table auth.users(id uuid primary key);
      create table journal_service.journal_drafts(user_id uuid primary key references auth.users(id) on delete cascade);
      create table journal_service.journals(id uuid primary key, user_id uuid not null, deleted_at timestamptz);
      create table journal_service.journal_images(
        id uuid primary key, journal_id uuid not null, user_id uuid not null,
        storage_path text unique not null, content_hash text not null, mime_type text not null,
        uploaded boolean not null default false
      );
      create table journal_service.image_deletion_queue(storage_path text primary key);
    `);
    await db.exec(readFileSync(resolve(process.cwd(), "../supabase/migrations/20261018140000_journal_draft_images.sql"), "utf8"));
    const owner = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    const journal = "33333333-3333-4333-8333-333333333333";
    await db.query("insert into auth.users(id) values ($1),($2)", [owner, other]);
    await db.query("insert into journal_service.journal_drafts(user_id) values ($1),($2)", [owner, other]);
    await db.query("insert into journal_service.journals(id,user_id) values ($1,$2)", [journal, owner]);
    for (let index = 1; index <= 5; index += 1) {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      const reserved = await db.query<{ reserve_journal_draft_image: string }>(
        "select journal_service.reserve_journal_draft_image($1,$2,$3,'image/png')",
        [owner, id, "a".repeat(64)],
      );
      expect(reserved.rows[0].reserve_journal_draft_image).toContain(`/${id}`);
      await db.query("update journal_service.journal_draft_images set uploaded=true where id=$1", [id]);
    }
    await expect(db.query("select journal_service.reserve_journal_draft_image($1,$2,$3,'image/png')",
      [owner, "00000000-0000-4000-8000-000000000006", "a".repeat(64)])).rejects.toThrow("IMAGE_LIMIT");
    await expect(db.query("select journal_service.attach_journal_draft_images($1,$2)", [other, journal]))
      .rejects.toThrow("JOURNAL_NOT_FOUND");
    const attached = await db.query<{ attach_journal_draft_images: number }>(
      "select journal_service.attach_journal_draft_images($1,$2)", [owner, journal],
    );
    expect(attached.rows[0].attach_journal_draft_images).toBe(5);
    expect((await db.query("select id from journal_service.journal_images")).rows).toHaveLength(5);
    expect((await db.query("select id from journal_service.journal_draft_images")).rows).toHaveLength(0);
    expect((await db.query("select * from journal_service.image_deletion_queue")).rows).toHaveLength(0);

    const abandoned = "00000000-0000-4000-8000-000000000007";
    await db.query("select journal_service.reserve_journal_draft_image($1,$2,$3,'image/png')",
      [other, abandoned, "b".repeat(64)]);
    await db.query("delete from journal_service.journal_draft_images where id=$1", [abandoned]);
    expect((await db.query("select storage_path from journal_service.image_deletion_queue")).rows).toHaveLength(1);
  } finally {
    await db.close();
  }
}, 20_000);
