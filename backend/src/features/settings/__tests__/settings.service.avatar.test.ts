import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "../settings.service.js";

function createDatabaseWithStorageError() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn();
  const eq = vi.fn().mockResolvedValue({ error: null });
  update.mockReturnValue({ eq });
  const from = vi.fn((table: string) => table === "profiles" ? { upsert, update } : { upsert });
  const schema = vi.fn(() => ({ from }));
  const upload = vi.fn().mockResolvedValue({
    error: { code: "bucket_not_found", message: "Bucket not found", status: 404 },
  });
  const getPublicUrl = vi.fn();
  return {
    database: {
      schema,
      storage: {
        from: vi.fn(() => ({ upload, getPublicUrl })),
      },
    },
    upload,
    update,
  };
}

describe("SettingsService avatar uploads", () => {
  it("returns a storage-specific 503 when Supabase Storage is unavailable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mocks = createDatabaseWithStorageError();
    const service = new SettingsService(mocks.database as never);

    await expect(service.uploadAvatar("user-1", {
      contents: Buffer.from("avatar"),
      mimeType: "image/png",
      sizeBytes: 6,
    })).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      statusCode: 503,
      message: "Profile photo storage is not available. Please try again after setup is complete.",
    });

    expect(mocks.upload).toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("bucket_not_found"));
    consoleError.mockRestore();
  });
});
