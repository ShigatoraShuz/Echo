import { describe, expect, it, vi } from "vitest";
import { DataExportService, decryptExportCollections } from "../../src/features/settings/data-export.service.js";
import {
  createEncryptionService,
  encryptText,
  decryptText,
} from "../../src/infrastructure/encryption/encryption.service.js";
const encryption = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1);
const user = "40000000-0000-4000-8000-000000000001";
const id = "41000000-0000-4000-8000-000000000001";
function harness(collections: Record<string, unknown[]> = {}) {
  let ciphertext: string | null = null;
  const updates = vi.fn();
  const eq = vi.fn();
  eq.mockReturnValue({
    eq,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  });
  const rpc = vi.fn(async (name: string, input?: Record<string, unknown>) => {
    if (name === "begin_data_export") return { data: id, error: null };
    if (name === "collect_user_export") return { data: collections, error: null };
    if (name === "finish_data_export") {
      ciphertext = input!.p_ciphertext as string;
      return { error: null };
    }
    if (name === "consume_data_export") {
      const data = input!.p_user_id === user ? ciphertext : null;
      if (data) ciphertext = null;
      return { data, error: null };
    }
    return { error: null };
  });
  const download = vi.fn().mockResolvedValue({ data: new Blob(["synthetic-image"]), error: null });
  const database = {
    schema: vi.fn(() => ({ rpc, from: vi.fn(() => ({ update: updates.mockReturnValue({ eq }) })) })),
    auth: {
      admin: {
        getUserById: vi
          .fn()
          .mockResolvedValue({
            data: { user: { id: user, email: "owner@example.test", created_at: "2026-09-20" } },
            error: null,
          }),
      },
    },
    storage: { from: vi.fn(() => ({ download })) },
  };
  return {
    service: new DataExportService(database as never, encryption),
    rpc,
    download,
    updates,
    getCiphertext: () => ciphertext,
    setCiphertext: (value: string) => {
      ciphertext = value;
    },
  };
}
describe("private account exports", () => {
  it("encrypts before persistence, binds the owner, and consumes the download once", async () => {
    const h = harness({ "buddy_service.buddy_messages": [{ content: encryptText("PRIVATE BUDDY", encryption) }] });
    expect(await h.service.prepare(user)).toBe(id);
    expect(h.getCiphertext()).not.toContain("PRIVATE BUDDY");
    expect(decryptText(h.getCiphertext(), encryption)).toContain("PRIVATE BUDDY");
    expect(h.rpc).toHaveBeenCalledWith("collect_user_export", { p_user_id: user });
    await expect(h.service.download("other-user", id)).rejects.toMatchObject({ statusCode: 404 });
    expect(JSON.parse(await h.service.download(user, id)).account.email).toBe("owner@example.test");
    await expect(h.service.download(user, id)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("rejects ciphertext for a different owner or request even if database metadata is substituted", async () => {
    const h = harness();
    h.setCiphertext(
      encryptText(JSON.stringify({ format: "echo-account-export-v1", userId: "other", requestId: id }), encryption),
    );
    await expect(h.service.download(user, id)).rejects.toMatchObject({ statusCode: 503 });
    h.setCiphertext("echo:encrypted:v1:corrupted");
    await expect(h.service.download(user, id)).rejects.toMatchObject({ statusCode: 503 });
  });
  it("decrypts journal fields without exporting encryption metadata", () => {
    const sealed = encryption.encrypt(JSON.stringify({ title: "Private", body: "Reflection" }));
    const collections = decryptExportCollections(
      {
        journals: [
          {
            content_ciphertext: "\\x" + Buffer.from(sealed.ciphertext, "base64").toString("hex"),
            encryption_iv: "\\x" + Buffer.from(sealed.iv, "base64").toString("hex"),
            encryption_auth_tag: "\\x" + Buffer.from(sealed.authenticationTag, "base64").toString("hex"),
            encryption_key_version: sealed.keyVersion,
          },
        ],
      },
      encryption,
    );
    expect(collections.journals[0]).toEqual({ content: { title: "Private", body: "Reflection" } });
  });
  it("includes clean attachments and does not download quarantined documents", async () => {
    const h = harness({
      "journal_service.journal_images": [
        { uploaded: true, storage_path: user + "/entry/image.png", mime_type: "image/png" },
      ],
      "verification_service.verification_documents": [
        { scan_status: "quarantined", storage_path: user + "/document.pdf", mime_type: "application/pdf" },
      ],
    });
    await h.service.prepare(user);
    expect(h.download).toHaveBeenCalledTimes(1);
    const output = JSON.parse(await h.service.download(user, id));
    expect(output.attachments).toHaveLength(1);
    expect(output.attachments[0].base64).toBe(Buffer.from("synthetic-image").toString("base64"));
  });
  it("fails before downloading a substituted path belonging to another account", async () => {
    const h = harness({ "journal_service.journal_images": [{ uploaded: true, storage_path: "other/account.png" }] });
    await expect(h.service.prepare(user)).rejects.toMatchObject({ statusCode: 503 });
    expect(h.download).not.toHaveBeenCalled();
    expect(h.getCiphertext()).toBeNull();
    expect(h.updates).toHaveBeenCalledWith({ request_status: "failed" });
  });
  it("never marks a partial export complete when storage fails", async () => {
    const h = harness({
      "journal_service.journal_images": [{ uploaded: true, storage_path: user + "/entry/image.png" }],
    });
    h.download.mockResolvedValue({ data: null, error: { message: "private provider diagnostic" } });
    await expect(h.service.prepare(user)).rejects.toMatchObject({
      statusCode: 503,
      message: "Your export could not be prepared. Please try again.",
    });
    expect(h.rpc.mock.calls.some(([name]) => name === "finish_data_export")).toBe(false);
  });
});
