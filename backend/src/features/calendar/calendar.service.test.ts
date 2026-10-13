import { describe, expect, it, vi } from "vitest";
import { createEncryptionService, decryptText } from "../../infrastructure/encryption/encryption.service.js";
import { CalendarService } from "./calendar.service.js";

describe("CalendarService", () => {
  it("reads only items in the requested user's date range", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      then: (resolve: (result: { data: []; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    for (const key of ["select", "eq", "gte", "lte", "order"] as const) query[key].mockReturnValue(query);
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => query) })) };
    const service = new CalendarService(database as never, {} as never);

    expect(await service.list("owner-1", "2026-10-01", "2026-10-31")).toEqual([]);
    expect(query.eq).toHaveBeenCalledWith("user_id", "owner-1");
    expect(query.gte).toHaveBeenCalledWith("scheduled_on", "2026-10-01");
    expect(query.lte).toHaveBeenCalledWith("scheduled_on", "2026-10-31");
  });

  it("encrypts saved content and scopes the write to the owner", async () => {
    const encryption = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1);
    let inserted: Record<string, unknown> = {};
    const row = {
      id: "item-1",
      scheduled_on: "2026-10-12",
      scheduled_time: "09:30:00",
      kind: "reminder",
      completed_at: null,
    };
    const query = {
      insert: vi.fn((value: Record<string, unknown>) => {
        inserted = value;
        return query;
      }),
      select: vi.fn(() => query),
      single: vi.fn(async () => ({ data: { ...row, content_ciphertext: inserted.content_ciphertext }, error: null })),
    };
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => query) })) };
    const service = new CalendarService(database as never, encryption);

    const result = await service.create("owner-1", {
      scheduledOn: "2026-10-12",
      scheduledTime: "09:30",
      kind: "reminder",
      content: "Private appointment",
    });

    expect(inserted.user_id).toBe("owner-1");
    expect(inserted).not.toHaveProperty("content");
    expect(decryptText(inserted.content_ciphertext, encryption)).toBe("Private appointment");
    expect(result).toMatchObject({ id: "item-1", content: "Private appointment", scheduledTime: "09:30" });
  });
});
