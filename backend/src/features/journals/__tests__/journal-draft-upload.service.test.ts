import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { JournalImagesService } from "../journal-images.service.js";

const userId = "40000000-0000-4000-8000-000000000001";
const imageId = "40000000-0000-4000-8000-000000000002";
const path = `${userId}/draft/${imageId}`;

describe("draft photo upload recovery", () => {
  it("releases a failed reservation and retries with the same photo ID", async () => {
    let uploaded = false;
    let queryKind: "read" | "update" = "read";
    const updates: Array<Record<string, unknown>> = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      update: vi.fn((value: Record<string, unknown>) => {
        updates.push(value);
        queryKind = "update";
        return query;
      }),
      maybeSingle: vi.fn(async () => {
        if (queryKind === "update") {
          uploaded = true;
          queryKind = "read";
          return { data: { id: imageId }, error: null };
        }
        return { data: { uploaded }, error: null };
      }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    const upload = vi.fn()
      .mockResolvedValueOnce({ error: { message: "storage unavailable" } })
      .mockResolvedValueOnce({ error: null });
    const database = {
      schema: vi.fn(() => ({
        rpc: vi.fn(async () => ({ data: path, error: null })),
        from: vi.fn(() => query),
      })),
      storage: { from: vi.fn(() => ({ upload, remove: vi.fn() })) },
    };
    const service = new JournalImagesService(database as never);
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer();

    await expect(service.uploadDraft(userId, imageId, bytes, "image/png"))
      .rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
    expect(updates.some((value) => "reservation_expires_at" in value)).toBe(true);
    await expect(service.uploadDraft(userId, imageId, bytes, "image/png"))
      .resolves.toEqual({ id: imageId });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls.every(([storagePath]) => storagePath === path)).toBe(true);
  });
});
