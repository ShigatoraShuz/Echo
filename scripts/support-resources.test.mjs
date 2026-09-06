import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const snapshot = JSON.parse(
  readFileSync(new URL("../frontend/src/services/support-resources/verified-resources.json", import.meta.url), "utf8"),
);
const migration = readFileSync(
  new URL("../supabase/migrations/20260906020000_verified_support_resources.sql", import.meta.url),
  "utf8",
);
test("offline hotline records match the forward migration", () => {
  assert.equal(snapshot.length, 16);
  assert.equal(new Set(snapshot.map((item) => item.id)).size, 16);
  for (const item of snapshot) {
    const line = migration.split("\n").find((line) => line.startsWith("('" + item.id + "'"));
    assert.ok(line, item.id);
    for (const value of [item.phoneNumber, item.availability, item.verificationSource, item.lastVerifiedAt])
      assert.ok(line.includes("'" + value.replaceAll("'", "''") + "'"), item.name + ": " + value);
  }
});
test("emergency and outpatient labels remain distinct", () => {
  assert.equal(snapshot.find((item) => item.organizationName === "Philippine Red Cross").phoneNumber, "143");
  assert.ok(
    snapshot
      .filter((item) => item.organizationName === "Cavite Center for Mental Health")
      .every((item) => item.type === "mental_health_facility" && !item.availability.includes("24/7")),
  );
  assert.equal(snapshot.find((item) => item.phoneNumber === "2919").organizationName, "HOPELINE PH");
});
