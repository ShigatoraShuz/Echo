import { it, expect, vi } from "vitest";
import { Attachments, validateImage } from "./attachments.js";
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
it.each([
  ["image/png", png],
  ["image/jpeg", Buffer.from([255, 216, 255, 224])],
  ["image/webp", Buffer.from("RIFF0000WEBP")],
])("accepts signature-matched %s", (mime, bytes) =>
  expect(() => validateImage(bytes as Buffer, mime as string)).not.toThrow(),
);
it.each([
  ["image/png", Buffer.from("fake")],
  ["image/svg+xml", Buffer.from("<svg/>")],
  ["image/jpeg", png],
  ["image/png", Buffer.alloc(5242881)],
  ["image/png", Buffer.alloc(0)],
])("rejects invalid image %s", (mime, bytes) => expect(() => validateImage(bytes as Buffer, mime as string)).toThrow());
function harness(parent: any) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: parent, error: null })),
  };
  const storage = { from: vi.fn() };
  return { query, storage, service: new Attachments({ from: () => query } as any, storage as any) };
}
it("denies cross-user image listing before creating a signed URL", async () => {
  const { service, query, storage } = harness(null);
  await expect(service.list("attacker", "other-journal")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(query.eq).toHaveBeenCalledWith("user_id", "attacker");
  expect(storage.from).not.toHaveBeenCalled();
});
it("denies cross-user draft upload before storing bytes", async () => {
  const { service, query, storage } = harness(null);
  await expect(service.upload("attacker", "other-draft", true, png, "image/png")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(query.eq).toHaveBeenCalledWith("user_id", "attacker");
  expect(storage.from).not.toHaveBeenCalled();
});
it("denies cross-user image removal", async () => {
  const { service, query, storage } = harness(null);
  await expect(service.remove("attacker", "other-image")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(query.eq).toHaveBeenCalledWith("user_id", "attacker");
  expect(storage.from).not.toHaveBeenCalled();
});
it("validates the actual bytes before a Storage write", async () => {
  const { service, storage } = harness({ id: "journal" });
  await expect(service.upload("owner", "journal", false, Buffer.from("bad"), "image/png")).rejects.toMatchObject({
    code: "INVALID_IMAGE",
  });
  expect(storage.from).not.toHaveBeenCalled();
});

it.each([false, true])("uploads privately and cleans up on metadata failure=%s", async (failMetadata) => {
  const upload = vi.fn().mockResolvedValue({ error: null }),
    remove = vi.fn().mockResolvedValue({ error: null });
  const signed = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.test/private-signed" }, error: null });
  let record: any;
  const query: any = {
    select: () => query,
    eq: () => query,
    is: () => query,
    maybeSingle: async () => ({ data: { id: "draft" }, error: null }),
    order: async () => ({ data: [record], error: null }),
    insert: async (value: any) => {
      record = value;
      return { error: failMetadata ? {} : null };
    },
  };
  const storage = { from: vi.fn(() => ({ upload, remove, createSignedUrl: signed })) };
  const service = new Attachments({ from: () => query } as any, storage as any);
  const result = service.upload("owner", "draft", true, png, "image/png");
  if (failMetadata) {
    await expect(result).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    expect(remove).toHaveBeenCalledWith([record.storage_path]);
  } else {
    expect(await result).toEqual([expect.objectContaining({ url: "https://storage.test/private-signed" })]);
    expect(signed).toHaveBeenCalledWith(record.storage_path, 300);
    expect(remove).not.toHaveBeenCalled();
  }
  expect(record.storage_path).toMatch(/^owner\/draft\//);
  expect(record).toMatchObject({ user_id: "owner", draft_id: "draft", mime_type: "image/png", size_bytes: 8 });
  expect(storage.from).toHaveBeenCalledWith("journal-images");
  expect(upload).toHaveBeenCalledWith(record.storage_path, png, { contentType: "image/png", upsert: false });
});
