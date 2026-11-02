import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("aggregates only the authenticated owner's active journals", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema journal_service;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table journal_service.journals (
        user_id uuid not null, mood text not null,
        created_at timestamptz not null, deleted_at timestamptz
      );
      alter table journal_service.journals enable row level security;
      create policy owner_reads on journal_service.journals for select to authenticated
        using (auth.uid() = user_id);
      grant usage on schema auth, journal_service to authenticated;
      grant select on journal_service.journals to authenticated;
    `);
    await database.exec(readFileSync(resolve(process.cwd(),
      "../supabase/migrations/20261026090000_journal_emotion_insights_summary.sql"), "utf8"));

    const owner = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const older = new Date(today);
    older.setUTCDate(older.getUTCDate() - 8);
    const rows: Array<[string, string, string, string | null]> = [
      [owner, "calm", today.toISOString(), null],
      [owner, "happy", yesterday.toISOString(), null],
      [owner, "sad", older.toISOString(), null],
      [owner, "angry", today.toISOString(), today.toISOString()],
      [other, "angry", today.toISOString(), null],
    ];
    for (const row of rows) {
      await database.query("insert into journal_service.journals(user_id,mood,created_at,deleted_at) values ($1,$2,$3,$4)", row);
    }

    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    const result = await database.query<{ emotion_insights_summary: {
      total: number;
      mood_counts: Record<string, number>;
      daily_scores: Record<string, { count: number; sum: number }>;
    } }>("select journal_service.emotion_insights_summary()");
    const summary = result.rows[0].emotion_insights_summary;
    expect(summary.total).toBe(3);
    expect(summary.mood_counts).toEqual({ calm: 1, happy: 1, sad: 1 });
    expect(summary.daily_scores[today.toISOString().slice(0, 10)]).toEqual({ count: 1, sum: 82 });
    expect(summary.daily_scores[yesterday.toISOString().slice(0, 10)]).toEqual({ count: 1, sum: 92 });
    expect(summary.daily_scores[older.toISOString().slice(0, 10)]).toBeUndefined();

    await database.exec("reset role; set role anon");
    await expect(database.query("select journal_service.emotion_insights_summary()"))
      .rejects.toThrow();
  } finally {
    await database.close();
  }
}, 20_000);
