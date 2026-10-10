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

describe("ExperienceService.supportResources", () => {
  it("excludes entries without a usable HTTPS source and review date", async () => {
    const rows = [
      { id: "legacy", verification_source: "OpenAI Hotline Directory", last_verified_at: "2026-08-25T00:00:00Z" },
      { id: "undated", verification_source: "https://pia.gov.ph/ncmh", last_verified_at: "not-a-date" },
      { id: "reviewed", verification_source: "https://pia.gov.ph/ncmh", last_verified_at: "2026-09-29T00:00:00Z" },
    ];
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      then: (resolve: (result: { data: typeof rows; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => chain) })) };
    const service = new ExperienceService(database as unknown as ConstructorParameters<typeof ExperienceService>[0], {} as JournalService, {} as EncryptionService);

    const result = await service.supportResources(undefined, "crisis_hotline", "PH");

    expect(result.map((resource) => resource.id)).toEqual(["reviewed"]);
    expect(chain.eq).toHaveBeenCalledWith("is_verified", true);
    expect(chain.eq).toHaveBeenCalledWith("country_code", "PH");
  });
});
