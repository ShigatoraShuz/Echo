import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createJournalsRouter } from "../journals.routes.js";
import type { JournalService } from "../journals.service.js";
import { errorMiddleware } from "../../../shared/middleware/error.middleware.js";
import { AuthorizationError } from "../../../shared/errors/app-error.js";

const verifier = {
  getUser: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", emailVerified: true }),
};
const verification = { assertAiAccess: vi.fn() };
const input = {
  title: "Private title",
  body: "Private body",
  mood: "calm",
  emotions: [],
  tags: [],
  privacyStatus: "private",
  analysisConsent: true,
};

function appWith(create: ReturnType<typeof vi.fn>, status = vi.fn()) {
  const service = { create, getAnalysisStatus: status } as unknown as JournalService;
  const app = express();
  app.use(express.json());
  app.use(createJournalsRouter(service, verifier, verification as never));
  app.use(errorMiddleware);
  return app;
}

describe("journal analysis submission routes", () => {
  it("returns the canonical 202 response and forwards protected development fixture selection", async () => {
    const create = vi.fn().mockResolvedValue({
      kind: "analysis",
      replayed: false,
      submission: {
        journalId: "00000000-0000-4000-8000-000000000002",
        analysisJobId: "00000000-0000-4000-8000-000000000003",
        status: "queued",
      },
    });
    const response = await request(appWith(create))
      .post("/journals")
      .set("Authorization", "Bearer token")
      .set("Idempotency-Key", "1234567890123456")
      .set("X-ECHO-ANALYSIS-FIXTURE", "slow_processing")
      .send(input);
    expect(response.status).toBe(202);
    expect(response.body.data).toEqual(expect.objectContaining({ status: "queued" }));
    expect(create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ analysisConsent: true }),
      "1234567890123456",
      "slow_processing",
    );
  });

  it("returns 201 only for an explicit private save", async () => {
    const journal = { id: "00000000-0000-4000-8000-000000000002", ...input, analysis_consent: false };
    const response = await request(
      appWith(vi.fn().mockResolvedValue({ kind: "private", replayed: false, journalId: journal.id })),
    )
      .post("/journals")
      .set("Authorization", "Bearer token")
      .set("Idempotency-Key", "1234567890123456")
      .send({ ...input, analysisConsent: false });
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ journalId: journal.id, status: "saved" });
  });

  it("does not silently save after an analysis-specific gate error", async () => {
    const create = vi.fn().mockRejectedValue(new AuthorizationError("Current analysis consent is required."));
    const response = await request(appWith(create))
      .post("/journals")
      .set("Authorization", "Bearer token")
      .set("Idempotency-Key", "1234567890123456")
      .send(input);
    expect(response.status).toBe(403);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
