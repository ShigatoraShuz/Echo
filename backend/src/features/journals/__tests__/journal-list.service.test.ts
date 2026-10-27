import { describe, expect, it, vi } from "vitest";
import { JournalImagesService } from "../journal-images.service.js";
import { JournalService } from "../journals.service.js";

function row(id: number, userId = "owner") {
  return {
    id: `journal-${id}`, user_id: userId, deleted_at: null,
    mood: id % 2 ? "calm" : "sad", emotions: [], tags: id === 2 ? ["focus"] : [],
    privacy_status: "private", analysis_consent: false,
    created_at: new Date(Date.UTC(2026, 9, 1, 0, 0, id)).toISOString(),
    updated_at: new Date(Date.UTC(2026, 9, 1, 0, 0, id)).toISOString(),
    content_ciphertext: Buffer.from(JSON.stringify({ title: `Title ${id}`, body: `Body ${id}` })).toString("base64"),
    encryption_iv: "aXY=", encryption_auth_tag: "dGFn", encryption_key_version: 1,
  };
}

function harness(rows: ReturnType<typeof row>[]) {
  const calls: Array<{ table: string; filters: Record<string, unknown>; start?: number; end?: number }> = [];
  const createQuery = (table: string) => {
    const filters: Record<string, unknown> = {};
    let ascending = false;
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => { filters[field] = value; return query; },
      is: (field: string, value: unknown) => { filters[field] = value; return query; },
      gte: (field: string, value: unknown) => { filters[`${field}:gte`] = value; return query; },
      lt: (field: string, value: unknown) => { filters[`${field}:lt`] = value; return query; },
      in: (field: string, value: unknown) => { filters[field] = value; return query; },
      order: (field: string, options: { ascending: boolean }) => { if (field === "created_at") ascending = options.ascending; return query; },
      range: (start: number, end: number) => {
        calls.push({ table, filters: { ...filters }, start, end });
        const matched = rows.filter((item) =>
          item.user_id === filters.user_id && item.deleted_at === filters.deleted_at &&
          (!filters.mood || item.mood === filters.mood) &&
          (!filters["created_at:gte"] || item.created_at >= String(filters["created_at:gte"])) &&
          (!filters["created_at:lt"] || item.created_at < String(filters["created_at:lt"])));
        matched.sort((a, b) => ascending ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
        return Promise.resolve({ data: matched.slice(start, end + 1), count: matched.length, error: null });
      },
      maybeSingle: () => Promise.resolve({
        data: rows.find((item) => item.id === filters.id && item.user_id === filters.user_id && item.deleted_at === filters.deleted_at) ?? null,
        error: null,
      }),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
        calls.push({ table, filters: { ...filters } });
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return query;
  };
  const database = {
    schema: (_schema: string) => ({ from: (table: string) => createQuery(table) }),
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  };
  const encryption = { decrypt: ({ ciphertext }: { ciphertext: string }) => Buffer.from(ciphertext, "base64").toString("utf8") };
  const service = new JournalService(database as never, encryption as never, {} as never);
  return { service, calls };
}

describe("journal list", () => {
  it("returns an empty first page without analysis or photo reads", async () => {
    const { service, calls } = harness([]);
    expect(await service.listPage("owner", { page: 1, pageSize: 10, query: "", sort: "newest" })).toEqual({
      entries: [], total: 0, page: 1, page_size: 10,
    });
    expect(calls.map((call) => call.table)).toEqual(["journals"]);
  });

  it("starts owned journal analysis and photo reads together", async () => {
    const { service } = harness([row(1)]);
    let finishAnalysis!: (value: null) => void;
    const analysis = new Promise<null>((resolve) => { finishAnalysis = resolve; });
    const latestAnalysis = vi.spyOn(service as unknown as { latestAnalysis: () => Promise<null> }, "latestAnalysis")
      .mockReturnValue(analysis);
    const photos = vi.spyOn(JournalImagesService.prototype, "list").mockResolvedValue([]);
    try {
      const result = service.get("owner", "journal-1");
      await vi.waitFor(() => expect(photos).toHaveBeenCalledWith("owner", "journal-1"));
      expect(latestAnalysis).toHaveBeenCalledWith("journal-1", "owner");
      finishAnalysis(null);
      await expect(result).resolves.toMatchObject({ id: "journal-1", images: [] });
    } finally {
      latestAnalysis.mockRestore();
      photos.mockRestore();
    }
  });

  it("returns exactly ten entries for a full first page", async () => {
    const { service } = harness(Array.from({ length: 10 }, (_, index) => row(index + 1)));
    const result = await service.listPage("owner", { page: 1, pageSize: 10, query: "", sort: "oldest" });
    expect(result.total).toBe(10);
    expect(result.entries).toHaveLength(10);
    expect(result.entries[0].id).toBe("journal-1");
  });

  it("applies mood and inclusive UTC date filters before counting and sorting", async () => {
    const { service, calls } = harness([row(1), row(2), row(3)]);
    const result = await service.listPage("owner", {
      page: 1, pageSize: 10, query: "", mood: "calm",
      dateFrom: "2026-10-01", dateTo: "2026-10-01", sort: "oldest",
    });
    expect(result.entries.map((entry) => entry.id)).toEqual(["journal-1", "journal-3"]);
    expect(result.total).toBe(2);
    expect(calls[0].filters).toMatchObject({ mood: "calm", "created_at:gte": "2026-10-01T00:00:00.000Z", "created_at:lt": "2026-10-02T00:00:00.000Z" });
  });

  it("paginates owner-scoped records before loading analysis and photos", async () => {
    const { service, calls } = harness([...Array.from({ length: 110 }, (_, index) => row(index + 1)), row(999, "other")]);
    const result = await service.listPage("owner", { page: 2, pageSize: 10, query: "", sort: "newest" });
    expect(result).toMatchObject({ total: 110, page: 2, page_size: 10 });
    expect(result.entries).toHaveLength(10);
    expect(result.entries[0].id).toBe("journal-100");
    expect(result.entries.every((entry) => entry.risk_score === null && entry.risk_band === null)).toBe(true);
    expect(calls.find((call) => call.table === "journals")).toMatchObject({ start: 10, end: 19, filters: { user_id: "owner" } });
    expect(calls.filter((call) => call.table === "analysis_results")).toHaveLength(1);
    expect(calls.filter((call) => call.table === "journal_images")).toHaveLength(1);
  });

  it("searches encrypted title, body, and tags without returning other owners' records", async () => {
    const { service } = harness([row(1), row(2), row(3, "other")]);
    const options = { page: 1, pageSize: 10, sort: "newest" as const };
    expect((await service.listPage("owner", { ...options, query: "title 1" })).entries.map((entry) => entry.id)).toEqual(["journal-1"]);
    expect((await service.listPage("owner", { ...options, query: "body 2" })).entries.map((entry) => entry.id)).toEqual(["journal-2"]);
    expect((await service.listPage("owner", { ...options, query: "focus" })).entries.map((entry) => entry.id)).toEqual(["journal-2"]);
  });
});
