import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { expect, it } from "vitest";

it("matches every baseline/release file hash and keeps the cloud audit version unique", async () => {
  const root = new URL("../../../", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("docs/releases/professional-cloud-manifest.json", root), "utf8"));
  expect(manifest.projectRef).toBe("lruciislmmqvcwweqjop");
  expect(manifest.baseline).toHaveLength(72);
  expect(manifest.baseline.filter((entry: { recoveredFromRemote: boolean }) => entry.recoveredFromRemote)).toHaveLength(14);
  expect(manifest.applyInOrder).toHaveLength(18);
  const entries = [...manifest.baseline, ...manifest.applyInOrder];
  expect(new Set(entries.map((entry) => entry.version)).size).toBe(90);
  for (const entry of entries) {
    const contents = await readFile(new URL(`supabase/migrations/${entry.file}`, root));
    expect(createHash("sha256").update(contents).digest("hex"), entry.file).toBe(entry.sha256);
  }
  const files = await readdir(new URL("supabase/migrations/", root));
  expect(files).toContain("20261018140000_journal_draft_images.sql");
  expect(files).not.toContain("20261018140000_security_professional_http_audit.sql");
  expect(manifest.applyInOrder.at(-2).file).toBe("20261018150000_security_professional_http_audit.sql");
  expect(manifest.applyInOrder.at(-1).file).toBe("20261019090000_professional_withdrawal_compatibility.sql");
});

it("requires actual before/after withdrawal and denial checks before release", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../../docs/releases/professional-cloud-manifest.json", import.meta.url), "utf8"));
  expect(manifest.validation.reproducedBeforeFix).toBe("INVALID_CASE_TRANSITION");
  expect(manifest.validation.cloudOwnerWithdrawalBefore).toBe("PASS");
  expect(manifest.validation.cloudOwnerWithdrawalAfter).toBe("PASS");
  expect(manifest.validation.freshOwnerWithdrawal).toBe("PASS");
  expect(manifest.validation.withdrawalGuards).toBe("PASS");
});
