import { describe, it, expect } from "vitest";
import { validateCreateJournalInput } from "./journal.schema";

describe("validateCreateJournalInput", () => {
  it("accepts valid input", () => {
    const result = validateCreateJournalInput({
      title: "My day",
      body: "It was a good day.",
      mood: "calm",
      privacyStatus: "private",
    });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("rejects empty title", () => {
    const result = validateCreateJournalInput({
      title: "",
      body: "It was a good day.",
      mood: "calm",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBeDefined();
  });

  it("rejects empty body", () => {
    const result = validateCreateJournalInput({
      title: "My day",
      body: "",
      mood: "calm",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.body).toBeDefined();
  });

  it("rejects title exceeding max length", () => {
    const result = validateCreateJournalInput({
      title: "A".repeat(201),
      body: "It was a good day.",
      mood: "calm",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBeDefined();
  });

  it("rejects invalid mood", () => {
    const result = validateCreateJournalInput({
      title: "My day",
      body: "It was a good day.",
      mood: "invalid-mood",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.mood).toBeDefined();
  });

  it("accepts valid privacy status", () => {
    const result = validateCreateJournalInput({
      title: "My day",
      body: "It was a good day.",
      mood: "calm",
      privacyStatus: "shared",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid privacy status", () => {
    const result = validateCreateJournalInput({
      title: "My day",
      body: "It was a good day.",
      mood: "calm",
      privacyStatus: "public",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.privacyStatus).toBeDefined();
  });
});
