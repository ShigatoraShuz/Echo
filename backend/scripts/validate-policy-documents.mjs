// Isolated PostgreSQL/WASM validation; never connects to Supabase or modifies a real database.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = new URL("../../", import.meta.url);
const original = await readFile(
  new URL("supabase/migrations/20260829120000_secure_auth_registration.sql", root),
  "utf8",
);
const update = await readFile(
  new URL("supabase/migrations/20260831010000_expanded_review_documents.sql", root),
  "utf8",
);
const database = new PGlite({ extensions: { pgcrypto } });
try {
  await database.exec(`create schema auth_provisioning; create schema extensions;
    create role anon; create role authenticated;
    create extension pgcrypto with schema extensions;`);
  // Exercise the actual existing table/index and activation function, not approximations.
  await database.exec(
    original.slice(
      original.indexOf("create table auth_provisioning.policy_documents"),
      original.indexOf("create table auth_provisioning.signup_drafts"),
    ),
  );
  await database.exec(
    original.slice(
      original.indexOf("create or replace function auth_provisioning.activate_policy_set"),
      original.indexOf("create or replace function public.echo_google_identity_status"),
    ),
  );
  await database.exec(`insert into auth_provisioning.policy_documents
    (document_type,version,title,summary,sanitized_markdown,content_sha256,effective_at,is_active)
    select kind,'historical','Old notice','Old summary','Original acknowledged text',repeat('a',64),now(),true
    from unnest(array['terms_of_use','privacy_notice','ai_analysis_notice']) as kind;`);
  const before = (
    await database.query(
      "select id,version,sanitized_markdown,content_sha256 from auth_provisioning.policy_documents order by id",
    )
  ).rows;
  await database.exec(`begin; ${update} commit;`);
  const after = (
    await database.query(
      "select id,version,sanitized_markdown,content_sha256 from auth_provisioning.policy_documents where version='historical' order by id",
    )
  ).rows;
  assert.deepEqual(after, before, "Historical text, IDs and hashes must remain unchanged");
  const current = (
    await database.query("select * from auth_provisioning.policy_documents where is_active order by document_type")
  ).rows;
  assert.equal(current.length, 3);
  for (const row of current) {
    const file = `${row.document_type.replaceAll("_", "-")}.md`;
    const source = (await readFile(new URL(`docs/policies/${file}`, root), "utf8")).replaceAll("\r\n", "\n").trim();
    assert.equal(row.sanitized_markdown, source, `${file} must match the migration exactly`);
    assert.equal(row.content_sha256, createHash("sha256").update(source).digest("hex"));
    assert.equal(row.version, "2026-08-31.1");
    assert.ok(source.split(/\s+/).length >= 900, "Each required document must be substantive");
    assert.ok(source.length < 80000, "Backend policy sanitizer must not truncate the notice");
    assert.ok(source.split("\n").filter((line) => line.startsWith("## ")).length >= 8);
    console.info(`PASS ${file}: ${source.split(/\s+/).length} words, content hash and version verified`);
  }
  assert.equal(
    (
      await database.query(
        "select count(*)::integer as count from auth_provisioning.policy_documents where version='historical' and not is_active and retired_at is not null",
      )
    ).rows[0].count,
    3,
  );
  await assert.rejects(database.exec(`begin; ${update} commit;`), /duplicate key/);
  await database.exec("rollback");
  assert.equal(
    (await database.query("select count(*)::integer as count from auth_provisioning.policy_documents where is_active"))
      .rows[0].count,
    3,
  );
  console.info("PASS historical preservation, complete activation, and rollback on duplicate migration");
} finally {
  await database.close();
}
