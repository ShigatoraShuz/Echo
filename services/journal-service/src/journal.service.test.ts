import { describe, expect, it } from "vitest";
import { createEncryption } from "./encryption.js";
import { JournalService } from "./journal.service.js";

const encryption = createEncryption(Buffer.alloc(32, 3).toString("base64"), 1);
const bytea = (value: string) => `\\x${Buffer.from(value, "base64").toString("hex")}`;

function row(id: string, title: string, body: string, mood: string, createdAt: string, entryDate: string) {
  const protectedContent = encryption.encrypt(JSON.stringify({ title, body }));
  return {
    id,
    user_id: "00000000-0000-4000-8000-000000000001",
    content_ciphertext: bytea(protectedContent.ciphertext),
    encryption_iv: bytea(protectedContent.iv),
    encryption_auth_tag: bytea(protectedContent.authenticationTag),
    encryption_key_version: protectedContent.keyVersion,
    mood,
    emotions: ["steady"],
    tags: ["work"],
    privacy_status: "private",
    analysis_consent: false,
    entry_date: entryDate,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function listDatabase(rows: unknown[]) {
  const query: any = {
    select: () => query,
    eq: () => query,
    is: () => query,
    order: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
  };
  return { from: () => query };
}

describe("JournalService listing", () => {
  it("decrypts, searches, filters, sorts, and paginates owner-scoped rows", async () => {
    const rows = [
      row("00000000-0000-4000-8000-000000000002", "Second", "calm evening", "calm", "2026-08-02T10:00:00.000Z", "2026-08-02"),
      row("00000000-0000-4000-8000-000000000003", "First", "work reflection", "happy", "2026-08-01T10:00:00.000Z", "2026-08-01"),
      row("00000000-0000-4000-8000-000000000004", "Third", "work follow-up", "happy", "2026-08-03T10:00:00.000Z", "2026-08-03"),
    ];
    const service = new JournalService(listDatabase(rows) as any, encryption);
    const result = await service.list("00000000-0000-4000-8000-000000000001", {
      page: 2,
      pageSize: 1,
      query: "work",
      mood: "happy",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-03",
      sort: "oldest",
    });
    expect(result).toMatchObject({ total: 2, page: 2, page_size: 1 });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ title: "Third", body: "work follow-up" });
  });
});
