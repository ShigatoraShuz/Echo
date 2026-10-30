import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerificationService } from "../verification.service.js";
import { basicDocumentValidator, BASIC_DOCUMENT_VALIDATOR_VERSION } from "../../../infrastructure/security/basic-document-validator.js";

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Live network forbidden"); })));
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const application = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { id: "fictional-application", verification_status: "draft", is_minor: false }, error: null })) };
  application.select.mockReturnValue(application); application.eq.mockReturnValue(application);
  const documents = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: null, error: null })), upsert: vi.fn(async () => ({ error: null })) };
  documents.select.mockReturnValue(documents); documents.eq.mockReturnValue(documents);
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const database = { schema: vi.fn(() => ({ from: vi.fn((table: string) => {
    if (table === "identity_verifications") return application;
    if (table === "verification_documents") return documents;
    throw new Error(`Unexpected mocked table: ${table}`);
  }) })), storage: { from: vi.fn(() => ({ upload, remove })) } };
  return { database, upload, documents };
}

describe("VerificationService explicit basic validator injection", () => {
  it.each(["image/png", "image/jpeg", "application/pdf"])("valid %s uploads become review-eligible without approving the application", async mime => {
    let bytes: Buffer;
    if (mime === "application/pdf") {
      const pdf = await PDFDocument.create(); pdf.addPage(); bytes = Buffer.from(await pdf.save());
    } else bytes = await sharp({ create: { width: 256, height: 128, channels: 3, background: "white" } }).toFormat(mime === "image/png" ? "png" : "jpeg").toBuffer();
    const { database, upload, documents } = fixture();
    const service = new VerificationService(database as never, {} as never, basicDocumentValidator);
    vi.spyOn(service, "getStatus").mockResolvedValue({ status: "draft" } as never);
    await expect(service.uploadDocument("fictional-owner", "user_government_id", mime, bytes)).resolves.toMatchObject({ status: "draft" });
    expect(upload).toHaveBeenCalledOnce();
    expect(documents.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "fictional-owner", verification_id: "fictional-application", scan_status: "clean",
      scanned_at: expect.any(String), scanner_version: BASIC_DOCUMENT_VALIDATOR_VERSION,
    }), { onConflict: "verification_id,document_kind" });
    expect(documents.upsert.mock.calls[0][0]).not.toHaveProperty("verification_status");
  });

  it("does not upload or persist malformed document bytes", async () => {
    const { database, upload, documents } = fixture();
    const service = new VerificationService(database as never, {} as never, basicDocumentValidator);
    const broken = Buffer.from([0xff, 0xd8, 0xff, ...Buffer.alloc(20), 0xff, 0xd9]);
    await expect(service.uploadDocument("fictional-owner", "user_government_id", "image/jpeg", broken)).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled(); expect(documents.upsert).not.toHaveBeenCalled();
  });

  it("does not rescan existing quarantined documents or grant admin access", async () => {
    const signedUrl = vi.fn();
    const application = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { id: "fictional-application", user_id: "fictional-owner" }, error: null })) };
    application.select.mockReturnValue(application); application.eq.mockReturnValue(application);
    const quarantined = { id: "existing", scan_status: "quarantined", scanned_at: null, scanner_version: null };
    const documents = { select: vi.fn(), eq: vi.fn(), order: vi.fn(async () => ({ data: [quarantined], error: null })) };
    documents.select.mockReturnValue(documents); documents.eq.mockReturnValue(documents);
    const database = { schema: () => ({ from: (table: string) => table === "identity_verifications" ? application : documents }), storage: { from: () => ({ createSignedUrl: signedUrl }) } };
    const inspect = vi.fn(basicDocumentValidator.inspect);
    const service = new VerificationService(database as never, {} as never, { inspect });
    vi.spyOn(service, "assertAdmin").mockResolvedValue(undefined);
    await expect(service.getForAdmin("fictional-admin", "fictional-application")).rejects.toMatchObject({ code: "DOCUMENT_SCAN_PENDING" });
    expect(inspect).not.toHaveBeenCalled(); expect(signedUrl).not.toHaveBeenCalled();
    expect(quarantined.scan_status).toBe("quarantined");
    vi.mocked(service.assertAdmin).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(service.getForAdmin("unauthorized", "fictional-application")).rejects.toThrow("Unauthorized");
    expect(signedUrl).not.toHaveBeenCalled();
  });
});
