import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "./settings.service.js";

describe("Optional analysis consent", () => {
  it.each([true, false])("persists consent choice %s through canonical user_consents", async (enabled) => {
    const operations: unknown[][] = [];
    const database = { from(table: string) {
      const query: any = {};
      for (const method of ["select", "eq", "update", "upsert"]) {
        query[method] = (...args: unknown[]) => { operations.push([table, method, ...args]); return query; };
      }
      query.single = async () => ({ data: { version: "current-v1" }, error: null });
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
      return query;
    } };
    const service = new SettingsService(database as any, {} as any);
    vi.spyOn(service, "get").mockResolvedValue({ privacy: { journalAiAnalysisEnabled: enabled } } as any);
    await expect(service.updatePrivacy("owner", { journalAiAnalysisEnabled: enabled })).resolves.toEqual({ journalAiAnalysisEnabled: enabled });
    expect(operations).toContainEqual(["user_consents", "eq", "user_id", "owner"]);
    expect(operations).toContainEqual(["user_consents", "eq", "consent_type", "journal_analysis"]);
    expect(operations).toContainEqual(["user_consents", "update", { accepted: false, revoked_at: expect.any(String) }]);
    const upsert = operations.find((op) => op[0] === "user_consents" && op[1] === "upsert");
    if (enabled) expect(upsert?.[2]).toMatchObject({ user_id: "owner", consent_version: "current-v1", accepted: true, revoked_at: null });
    else expect(upsert).toBeUndefined();
  });
});
