import { describe, expect, it, vi } from "vitest";
import { WellnessService } from "./wellness.service.js";

describe("WellnessService conversation ownership", () => {
  it("rejects a conversation not owned by the authenticated user", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const ownerEq = vi.fn(() => ({ maybeSingle }));
    const conversationEq = vi.fn(() => ({ eq: ownerEq }));
    const select = vi.fn(() => ({ eq: conversationEq }));
    const database = { from: vi.fn(() => ({ select })) } as any;
    const service = new WellnessService(database, {} as any, vi.fn());

    await expect(service.session("user-1", "conversation-1")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
    expect(conversationEq).toHaveBeenCalledWith("id", "conversation-1");
    expect(ownerEq).toHaveBeenCalledWith("user_id", "user-1");
  });
});

it("returns urgent support even when message persistence fails", async () => {
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { conversation_status: "active" }, error: null }),
    insert: async () => ({ error: { message: "unavailable" } }),
  };
  const encryption = { encrypt: () => ({ ciphertext: "YQ==", iv: "YQ==", authenticationTag: "YQ==", keyVersion: 1 }) };
  const service = new WellnessService({ from: () => query } as any, encryption as any, vi.fn());
  const result = await service.send("owner", "conversation", "I want to die", {});
  expect(result.messages[0].safety.kind).toBe("immediate");
  expect(result.messages[0].content).toContain("could not confirm");
});
