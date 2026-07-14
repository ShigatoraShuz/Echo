import { describe, it, expect, beforeEach } from "vitest";
import { createJournalMockAdapter } from "./journal.mock-adapter";
import type { JournalService } from "./journal.service";

describe("JournalMockAdapter", () => {
  let adapter: JournalService;

  beforeEach(() => {
    adapter = createJournalMockAdapter();
  });

  it("listEntries returns paginated results", async () => {
    const result = await adapter.listEntries(
      { query: "", mood: null, dateFrom: null, dateTo: null, sort: "newest" },
      1,
      9
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.entries)).toBe(true);
      expect(result.data.pagination.totalItems).toBeGreaterThan(0);
    }
  });

  it("listEntries filters by mood", async () => {
    const result = await adapter.listEntries(
      { query: "", mood: "calm", dateFrom: null, dateTo: null, sort: "newest" },
      1,
      9
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries.every((e) => e.mood === "calm")).toBe(true);
    }
  });

  it("listEntries searches by keyword", async () => {
    const result = await adapter.listEntries(
      { query: "morning", mood: null, dateFrom: null, dateTo: null, sort: "newest" },
      1,
      9
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries.length).toBeGreaterThan(0);
    }
  });

  it("listEntries sorts by newest", async () => {
    const result = await adapter.listEntries(
      { query: "", mood: null, dateFrom: null, dateTo: null, sort: "newest" },
      1,
      9
    );
    expect(result.success).toBe(true);
    if (result.success && result.data.entries.length > 1) {
      for (let i = 1; i < result.data.entries.length; i++) {
        expect(result.data.entries[i - 1].createdAt >= result.data.entries[i].createdAt).toBe(true);
      }
    }
  });

  it("listEntries handles pagination", async () => {
    const result = await adapter.listEntries(
      { query: "", mood: null, dateFrom: null, dateTo: null, sort: "newest" },
      1,
      1
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries.length).toBeLessThanOrEqual(1);
    }
  });

  it("getEntry returns entry by valid id", async () => {
    const result = await adapter.getEntry("morning-static");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("morning-static");
    }
  });

  it("getEntry returns NOT_FOUND for invalid id", async () => {
    const result = await adapter.getEntry("invalid-id");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("createEntry creates and returns entry", async () => {
    const result = await adapter.createEntry({
      title: "Test entry",
      body: "Test body content",
      mood: "happy",
      emotions: ["grateful"],
      tags: ["test"],
      privacyStatus: "private",
      analysisConsent: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Test entry");
      expect(result.data.mood).toBe("happy");
    }
  });

  it("updateEntry updates entry fields", async () => {
    const result = await adapter.updateEntry("morning-static", {
      title: "Updated title",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Updated title");
    }
  });

  it("deleteEntry removes entry", async () => {
    const before = await adapter.listEntries(
      { query: "", mood: null, dateFrom: null, dateTo: null, sort: "newest" },
      1,
      9
    );
    const countBefore = before.success ? before.data.pagination.totalItems : 0;

    await adapter.deleteEntry("morning-static");

    const after = await adapter.listEntries(
      { query: "", mood: null, dateFrom: null, dateTo: null, sort: "newest" },
      1,
      9
    );
    expect(after.success).toBe(true);
    if (after.success) {
      expect(after.data.pagination.totalItems).toBe(countBefore - 1);
    }
  });

  it("saveDraft saves and retrieves draft", async () => {
    const draftResult = await adapter.saveDraft({
      id: "draft-1",
      title: "Draft title",
      body: "Draft body",
      mood: "calm",
      emotions: [],
      tags: [],
      privacyStatus: "private",
      analysisConsent: false,
      updatedAt: "",
    });
    expect(draftResult.success).toBe(true);

    const getResult = await adapter.getDraft("draft-1");
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data?.title).toBe("Draft title");
    }
  });

  it("deleteDraft removes draft", async () => {
    await adapter.saveDraft({
      id: "draft-to-delete",
      title: "To delete",
      body: "Body",
      mood: "calm",
      emotions: [],
      tags: [],
      privacyStatus: "private",
      analysisConsent: false,
      updatedAt: "",
    });
    await adapter.deleteDraft("draft-to-delete");
    const getResult = await adapter.getDraft("draft-to-delete");
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data).toBeNull();
    }
  });

  it("analysis request returns demo-labeled data", async () => {
    const createResult = await adapter.createEntry({
      title: "Analysis test",
      body: "Test body",
      mood: "calm",
      emotions: [],
      tags: [],
      privacyStatus: "private",
      analysisConsent: true,
    });
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const result = await adapter.requestAnalysis(createResult.data.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDemoData).toBe(true);
    }
  });
});
