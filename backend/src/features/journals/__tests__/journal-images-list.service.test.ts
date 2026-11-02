import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { JournalImagesService } from "../journal-images.service.js";

function setup(rows: Array<{ id: string; storage_path: string; journal_id?: string }>) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  const createSignedUrls = vi.fn().mockResolvedValue({
    data: rows.map((row) => ({ path: row.storage_path, signedUrl: `https://storage.test/${row.id}`, error: null })),
    error: null,
  });
  const database = {
    schema: vi.fn(() => ({ from: vi.fn(() => query) })),
    storage: { from: vi.fn(() => ({ createSignedUrls })) },
  } as unknown as SupabaseClient;
  return { service: new JournalImagesService(database), query, createSignedUrls };
}

describe("journal photo listing", () => {
  it("signs an owner-scoped journal page in one storage request and keeps its order", async () => {
    const rows = [
      { id: "photo-a", journal_id: "journal-1", storage_path: "owner/journal-1/a" },
      { id: "photo-b", journal_id: "journal-2", storage_path: "owner/journal-2/b" },
      { id: "photo-c", journal_id: "journal-1", storage_path: "owner/journal-1/c" },
    ];
    const { service, query, createSignedUrls } = setup(rows);

    const result = await service.listForJournals("owner", ["journal-1", "journal-2"]);

    expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(query.in).toHaveBeenCalledWith("journal_id", ["journal-1", "journal-2"]);
    expect(createSignedUrls).toHaveBeenCalledExactlyOnceWith(rows.map((row) => row.storage_path), 300);
    expect(result.get("journal-1")).toEqual([
      { id: "photo-a", url: "https://storage.test/photo-a" },
      { id: "photo-c", url: "https://storage.test/photo-c" },
    ]);
    expect(result.get("journal-2")).toEqual([{ id: "photo-b", url: "https://storage.test/photo-b" }]);
  });

  it("omits a failed journal photo without exposing another path", async () => {
    const { service, createSignedUrls } = setup([
      { id: "photo-a", journal_id: "journal-1", storage_path: "owner/a" },
      { id: "photo-b", journal_id: "journal-1", storage_path: "owner/b" },
    ]);
    createSignedUrls.mockResolvedValue({ data: [
      { path: "owner/a", signedUrl: "https://storage.test/a", error: null },
      { path: "owner/b", signedUrl: null, error: "unavailable" },
      { path: "other-user/private", signedUrl: "https://storage.test/private", error: null },
    ], error: null });

    expect(await service.list("owner", "journal-1")).toEqual([{ id: "photo-a", url: "https://storage.test/a" }]);
  });

  it("keeps draft photos unavailable if any signed URL fails", async () => {
    const { service, createSignedUrls } = setup([
      { id: "draft-a", storage_path: "owner/draft-a" },
      { id: "draft-b", storage_path: "owner/draft-b" },
    ]);
    createSignedUrls.mockResolvedValue({ data: [
      { path: "owner/draft-a", signedUrl: "https://storage.test/a", error: null },
      { path: "owner/draft-b", signedUrl: null, error: "unavailable" },
    ], error: null });

    await expect(service.listDraft("owner")).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
  });

  it("returns all draft photos after one successful batch signing request", async () => {
    const { service, query, createSignedUrls } = setup([
      { id: "draft-a", storage_path: "owner/draft-a" },
      { id: "draft-b", storage_path: "owner/draft-b" },
    ]);

    expect(await service.listDraft("owner")).toEqual([
      { id: "draft-a", url: "https://storage.test/draft-a" },
      { id: "draft-b", url: "https://storage.test/draft-b" },
    ]);
    expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(createSignedUrls).toHaveBeenCalledOnce();
  });

  it("does not contact Storage when there are no photos", async () => {
    const { service, createSignedUrls } = setup([]);
    expect(await service.listForJournals("owner", ["journal-1"])).toEqual(new Map());
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});
