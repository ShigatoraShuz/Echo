import { describe, expect, it, vi } from "vitest";
import { ExperienceService } from "../experience.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { EncryptionService } from "../../../infrastructure/encryption/encryption.service.js";

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

describe("ExperienceService.dashboard", () => {
  it("loads dashboard profile data from the user_service schema", async () => {
    const profileChain = createChain();
    const preferenceChain = createChain();
    const userSchema = {
      from: vi.fn((table: string) => {
        if (table === "profiles") return profileChain;
        if (table === "notification_preferences") return preferenceChain;
        throw new Error(`Unexpected user_service table: ${table}`);
      }),
    };
    const database = {
      schema: vi.fn((schema: string) => {
        if (schema === "user_service") return userSchema;
        throw new Error(`Unexpected schema: ${schema}`);
      }),
    };
    const journals = {
      list: vi.fn().mockResolvedValue([
        { id: "entry-1", created_at: "2026-08-24T00:00:00.000Z", mood: "calm", tags: [], emotions: [] },
      ]),
    };
    const encryption = {} as EncryptionService;
    const service = new ExperienceService(database as any, journals as unknown as JournalService, encryption);

    const result = await service.dashboard("user-1");

    expect(result.userProfile.name).toBe("Friend");
    expect(database.schema).toHaveBeenCalledWith("user_service");
    expect(userSchema.from).toHaveBeenCalledWith("profiles");
    expect(userSchema.from).toHaveBeenCalledWith("notification_preferences");
    expect(profileChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(preferenceChain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
