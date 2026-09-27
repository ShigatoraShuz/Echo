import { test } from "node:test";
import assert from "node:assert/strict";
import { assertProjectUrl, AUTHORIZED_PROJECT_REF } from "./security-project-target.mjs";

test("accept only the authorized exact HTTPS origin", () => {
  assert.doesNotThrow(() => assertProjectUrl(`https://${AUTHORIZED_PROJECT_REF}.supabase.co`));
  for (const value of ["http://localhost:54321", "https://different.supabase.co", `https://${AUTHORIZED_PROJECT_REF}.supabase.co.evil.test`, `https://user:pass@${AUTHORIZED_PROJECT_REF}.supabase.co`, `https://${AUTHORIZED_PROJECT_REF}.supabase.co/?redirect=x`, "invalid"])
    assert.throws(() => assertProjectUrl(value));
});
