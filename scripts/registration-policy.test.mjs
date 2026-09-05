import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260904010000_registration_onboarding_public_ownership.sql", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const seeded = [...migration.matchAll(/\$policy\$([\s\S]*?)\$policy\$/g)].map((match) => match[1]);
for (const [index, file] of ["terms-of-use", "privacy-notice", "ai-analysis-notice"].entries()) {
  test(`${file} review copy exactly matches its registration seed`, () => {
    const document = readFileSync(new URL(`../docs/policies/${file}.md`, import.meta.url), "utf8").replaceAll("\r\n", "\n").trimEnd();
    assert.equal(seeded[index], document);
    assert.ok(document.length > 2000, "preserve the expanded policy detail");
  });
}
