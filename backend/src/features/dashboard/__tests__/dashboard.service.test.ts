import { describe, expect, it, vi } from "vitest";
import { DashboardService } from "../dashboard.service.js";
import type { JournalService } from "../../journals/journals.service.js";

function createChain() {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    is: vi.fn(() => chain),
  };
  return chain;
}

describe("DashboardService.dashboard", () => {
  it("loads the dashboard from the public profile and notification tables", async () => {
    const profileChain = createChain();
    const preferenceChain = createChain();
    const database = {
      from: vi.fn((table: string) => {
        if (table === "profiles") return profileChain;
        if (table === "notification_preferences") return preferenceChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const journals = {
      list: vi.fn().mockResolvedValue([
        { id: "entry-1", created_at: "2026-08-24T00:00:00.000Z", mood: "calm", tags: [], emotions: [] },
      ]),
    };
    const service = new DashboardService(database as any, journals as unknown as JournalService);

    const result = await service.dashboard("user-1");

    expect(result.userProfile.name).toBe("Friend");
    expect(database.from).toHaveBeenCalledWith("profiles");
    expect(database.from).toHaveBeenCalledWith("notification_preferences");
    expect(profileChain.eq).toHaveBeenCalledWith("id", "user-1");
    expect(preferenceChain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});

