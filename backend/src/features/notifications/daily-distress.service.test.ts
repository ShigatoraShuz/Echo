import { createClient } from "@supabase/supabase-js";
import { createEncryptionService, encryptText } from "../../infrastructure/encryption/encryption.service.js";
import { expect, it, vi } from "vitest";
import { DailyDistressService, reachesSupportStreak } from "./daily-distress.service.js";

const today = "2026-11-12";
const timezone = "Asia/Manila";
const ratings = new Map([
  ["2026-11-10", "high"], ["2026-11-11", "high"], [today, "high"],
] as const);
const reports = [
  { entryAt: "2026-11-09T18:00:00Z", emotion: "sadness" },
  { entryAt: "2026-11-10T18:00:00Z", emotion: "fear" },
  { entryAt: "2026-11-11T18:00:00Z", emotion: "anger" },
];

it("suggests support on day three using local dates across UTC midnight", () => {
  expect(reachesSupportStreak(today, timezone, ratings, reports)).toBe(true);
});

it("requires a high rating and difficult emotion on every consecutive day", () => {
  expect(reachesSupportStreak(today, timezone, ratings, reports.slice(0, 2))).toBe(false);
  expect(reachesSupportStreak(today, timezone, new Map([[today, "high"]]), reports)).toBe(false);
  expect(reachesSupportStreak(today, timezone, new Map([...ratings, [today, "moderate"]]), reports)).toBe(false);
  expect(reachesSupportStreak(today, timezone, ratings, [...reports, { ...reports[2], emotion: "joy" }])).toBe(false);
  expect(reachesSupportStreak(today, timezone, ratings, [...reports, { ...reports[2], emotion: null }])).toBe(false);
});

it("does not repeat on a fourth day in the same streak", () => {
  expect(reachesSupportStreak(today, timezone, new Map([...ratings, ["2026-11-09", "high"]]), [
    ...reports, { entryAt: "2026-11-09T12:00:00Z", emotion: "fear" },
  ])).toBe(false);
});


it("saves an encrypted answer and only queues one in-app notice after all three days match", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T04:00:00Z"));
  try {
    const encryption = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1);
    const stored = new Map([...ratings].slice(0, 2).map(([day, rating]) => [day, encryptText(rating, encryption)]));
    const notices: Record<string, unknown>[] = [];
    let inAppEnabled = false;
    const userId = "11111111-1111-4111-8111-111111111111";
    const fetchFixture: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1);
      const inserted = init?.body ? JSON.parse(String(init.body)) : null;
      expect(inserted?.user_id ?? url.searchParams.get("user_id")).toBe(inserted ? userId : `eq.${userId}`);
      if (table === "profiles") return Response.json([{ timezone }]);
      if (table === "notification_preferences") return Response.json([{ in_app_enabled: inAppEnabled }]);
      if (table === "daily_distress_checkins") {
        if (inserted) {
          expect(inserted.rating_ciphertext).toMatch(/^echo:encrypted:v1:/);
          expect(inserted.local_date).toBe(today);
          stored.set(inserted.local_date, inserted.rating_ciphertext);
          return new Response(null, { status: 201 });
        }
        const date = url.searchParams.get("local_date");
        return Response.json([...stored].filter(([day]) => date !== `eq.${today}` || day === today)
          .map(([local_date, rating_ciphertext]) => ({ local_date, rating_ciphertext })));
      }
      expect(table).toBe("notifications");
      if (!inserted) return Response.json(notices);
      expect(url.searchParams.get("on_conflict")).toBe("user_id,notification_type,reminder_local_date");
      expect(new Headers(init?.headers).get("prefer")).toContain("resolution=ignore-duplicates");
      notices.push(inserted);
      return new Response(null, { status: 201 });
    };
    const database = createClient("https://synthetic.invalid", "synthetic-test-key", {
      global: { fetch: fetchFixture }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const readEmotions = vi.fn().mockResolvedValue(reports);
    const service = new DailyDistressService(database, encryption, readEmotions);
    await service.suggest(userId);
    expect(notices).toHaveLength(0);
    await service.save(userId, "high");
    expect(await service.get(userId)).toEqual({ rating: "high" });
    await service.suggest(userId);
    expect(readEmotions).not.toHaveBeenCalled();
    inAppEnabled = true;
    await service.suggest(userId);
    await service.suggest(userId);
    expect(readEmotions).toHaveBeenCalledExactlyOnceWith(userId, "2026-11-08T00:00:00Z", "2026-11-12T04:00:00.000Z");
    expect(notices).toEqual([expect.objectContaining({ notification_type: "daily_distress_suggestion", reminder_local_date: today })]);
  } finally {
    vi.useRealTimers();
  }
});
