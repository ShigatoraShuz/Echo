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
      listSummaries: vi.fn().mockResolvedValue([
        { id: "entry-1", created_at: "2026-08-24T00:00:00.000Z", mood: "calm", tags: [], emotions: [] },
      ]),
      dashboardInsights: vi.fn().mockResolvedValue({ latest: null, emotionTrend: [], distressTrend: [] }),
      getJournalTitles: vi.fn().mockResolvedValue(new Map([["entry-1", "A quiet entry"]])),
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

describe("ExperienceService.buddyHistory", () => {
  it("searches only owner-scoped keyed whole words on the server", async () => {
    const rpc = vi.fn(async () => ({ data: [{ id: "owned", title: "Calm", total: 1 }], error: null }));
    const database = { schema: vi.fn(() => ({ rpc })) };
    const encryption = { searchHashes: vi.fn((word: string) => [`hash:${word}`]) } as unknown as EncryptionService;
    const service = new ExperienceService(database as never, {} as JournalService, encryption);

    const page = await service.buddyHistory("owner", { page: 2, pageSize: 20, query: "calm day" });
    expect(page.conversations[0]).toMatchObject({ id: "owned", title: "Calm" });
    expect(page.total).toBe(1);
    expect(rpc).toHaveBeenCalledWith("search_history", {
      p_user_id: "owner", p_hashes: ["hash:calm", "hash:day"], p_page: 2, p_page_size: 20,
    });
  });

  it("keeps history available when the pin migration has not been applied", async () => {
    const chain = {
      select: vi.fn(), eq: vi.fn(), order: vi.fn(),
      range: vi.fn()
        .mockResolvedValueOnce({ data: null, count: null, error: { code: "42703", message: "column buddy_conversations.pinned_at does not exist" } })
        .mockResolvedValueOnce({ data: [{ id: "owned" }], count: 1, error: null }),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => chain) })) };
    const service = new ExperienceService(database as never, {} as JournalService, {} as EncryptionService);

    const page = await service.buddyHistory("owner", { page: 1, pageSize: 20, query: "" });
    expect(page.conversations[0]).toMatchObject({ id: "owned", title: "Buddy conversation" });
    expect(page.pinsAvailable).toBe(false);
    expect(chain.select).toHaveBeenLastCalledWith("id, title, title_ciphertext, preview_ciphertext, archived, last_message_at, created_at", { count: "exact" });
    expect(chain.eq).toHaveBeenCalledTimes(2);
    expect(chain.eq).toHaveBeenNthCalledWith(2, "user_id", "owner");
  });
});

describe("ExperienceService.Buddy privacy", () => {
  it("orders tied exchange timestamps with the user message before Buddy's reply", async () => {
    const messages = {
      select: vi.fn(), eq: vi.fn(), order: vi.fn(),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }),
    };
    messages.select.mockReturnValue(messages);
    messages.eq.mockReturnValue(messages);
    messages.order.mockReturnValue(messages);
    const conversation = {
      select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { id: "conv-1", user_id: "owner" }, error: null })),
    };
    conversation.select.mockReturnValue(conversation);
    conversation.eq.mockReturnValue(conversation);
    const database = { schema: vi.fn(() => ({ from: vi.fn((table: string) => table === "buddy_messages" ? messages : conversation) })) };
    const service = new ExperienceService(database as never, {} as JournalService, {} as EncryptionService);
    await service.buddySession("owner", "conv-1");
    expect(messages.order.mock.calls).toEqual([
      ["created_at", { ascending: true }],
      ["role", { ascending: false }],
      ["id", { ascending: true }],
    ]);
  });

  it("does not reopen the latest saved conversation for an unselected session", async () => {
    const database = { schema: vi.fn() };
    const service = new ExperienceService(database as never, {} as JournalService, {} as EncryptionService);
    const result = await service.buddySession("owner");
    expect(result).toMatchObject({ conversationId: null, persisted: false });
    expect(database.schema).not.toHaveBeenCalled();
  });

  it("returns a temporary exchange without writing conversation records when saving is off", async () => {
    const privacy = {
      select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { buddy_history_enabled: false }, error: null })),
    };
    privacy.select.mockReturnValue(privacy);
    privacy.eq.mockReturnValue(privacy);
    const from = vi.fn((table: string) => {
      if (table !== "privacy_preferences") throw new Error(`Unexpected Buddy write: ${table}`);
      return privacy;
    });
    const database = { schema: vi.fn(() => ({ from })) };
    const service = new ExperienceService(database as never, {} as JournalService, {} as EncryptionService);
    const result = await service.sendBuddyMessage("owner", "I feel tired");
    expect(result).toMatchObject({ conversationId: null, persisted: false });
    expect(result.messages).toHaveLength(2);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("refuses to append to a saved chat when saving is off", async () => {
    const privacy = {
      select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { buddy_history_enabled: false }, error: null })),
    };
    privacy.select.mockReturnValue(privacy);
    privacy.eq.mockReturnValue(privacy);
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => privacy) })) };
    const service = new ExperienceService(database as never, {} as JournalService, {} as EncryptionService);
    await expect(service.sendBuddyMessage("owner", "Hello", "saved-id")).rejects.toMatchObject({ code: "BUDDY_HISTORY_DISABLED" });
  });
});

describe("ExperienceService.groundingHistory", () => {
  it("returns only completed sessions belonging to the user", async () => {
    const chain = {
      select: vi.fn(), eq: vi.fn(), order: vi.fn(),
      limit: vi.fn(async () => ({ data: [{ id: "one", exercise_type: "box-breathing", duration_seconds: 120, reflection: "gentle", completed_at: "2026-10-12T00:00:00Z" }], error: null })),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => chain) })) };
    const service = new ExperienceService(database as never, {} as JournalService, {} as EncryptionService);

    expect(await service.groundingHistory("owner-1")).toEqual([
      { id: "one", type: "box-breathing", duration: 120, pace: "gentle", completedAt: "2026-10-12T00:00:00Z" },
    ]);
    expect(chain.eq).toHaveBeenCalledWith("user_id", "owner-1");
    expect(chain.eq).toHaveBeenCalledWith("completed", true);
    expect(chain.limit).toHaveBeenCalledWith(250);
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
