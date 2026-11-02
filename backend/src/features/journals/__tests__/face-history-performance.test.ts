import { expect, it, vi } from "vitest";
import { JournalService } from "../journals.service.js";
import {
  createEncryptionService,
  encryptText,
} from "../../../infrastructure/encryption/encryption.service.js";

it("batches ownership checks and never decrypts another user's or deleted journal's face result", async () => {
  const encryption = createEncryptionService(
    Buffer.alloc(32, 9).toString("base64"),
    1,
  );
  const result = {
    schemaVersion: "echo-face-expression-v1",
    status: "unavailable",
    reason: "no_usable_face",
  };
  const faceRows = [
    {
      journal_id: "owned",
      result_ciphertext: encryptText(JSON.stringify(result), encryption),
    },
    { journal_id: "other-user", result_ciphertext: "must-not-decrypt" },
    { journal_id: "deleted", result_ciphertext: "must-not-decrypt" },
  ];
  const filters: unknown[] = [];
  const owned = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((...args) => {
      filters.push(args);
      return owned;
    }),
    is: vi.fn((...args) => {
      filters.push(args);
      return owned;
    }),
    in: vi.fn(async () => ({ data: [{ id: "owned" }], error: null })),
  };
  const face = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({ data: faceRows, error: null })),
  };
  const get = vi.fn(() => {
    throw Error("Must not load full journals");
  });
  const service = Object.assign(Object.create(JournalService.prototype), {
    encryption,
    hasGlobalFacialConsent: async () => true,
    get,
    database: { schema: () => ({ from: () => face }) },
    userDatabase: () => ({ schema: () => ({ from: () => owned }) }),
  }) as JournalService;
  expect(await service.faceHistory("owner")).toEqual([
    { journalId: "owned", result },
  ]);
  expect(filters).toEqual([
    ["user_id", "owner"],
    ["deleted_at", null],
  ]);
  expect(owned.in).toHaveBeenCalledExactlyOnceWith("id", [
    "owned",
    "other-user",
    "deleted",
  ]);
  expect(get).not.toHaveBeenCalled();
  owned.in.mockResolvedValueOnce({
    data: [],
    error: { message: "fictional DB failure" },
  } as never);
  await expect(service.faceHistory("owner")).rejects.toThrow(
    "Face history could not be loaded",
  );
});
