import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createJournalsRouter } from "../journals.routes.js";
import { errorMiddleware } from "../../../shared/middleware/error.middleware.js";
import type { JournalService } from "../journals.service.js";

const owner = "40000000-0000-4000-8000-000000000001";
const image = "40000000-0000-4000-8000-000000000002";
const journal = "40000000-0000-4000-8000-000000000003";

function harness() {
  const service = {
    listDraftImages: vi.fn().mockResolvedValue([]),
    uploadDraftImage: vi.fn().mockResolvedValue({ id: image }),
    removeDraftImage: vi.fn().mockResolvedValue(undefined),
    attachDraftImages: vi.fn().mockResolvedValue({ attached: 1 }),
  };
  const verifier = { getUser: vi.fn(async (token: string) => token === "owner" ? { id: owner } : null) };
  const app = express();
  app.use(createJournalsRouter(service as unknown as JournalService, verifier, { assertAiAccess: vi.fn() } as never));
  app.use(errorMiddleware);
  return { app, service };
}

describe("journal draft photo routes", () => {
  it("requires authentication and a valid image ID before upload", async () => {
    const { app, service } = harness();
    expect((await request(app).get("/journals/draft/images")).status).toBe(401);
    expect((await request(app).put("/journals/draft/images/not-a-uuid")
      .set("Authorization", "Bearer owner").set("Content-Type", "image/png").send(Buffer.alloc(12))).status).toBe(400);
    expect(service.uploadDraftImage).not.toHaveBeenCalled();
  });

  it("forwards the authenticated owner to list, upload, remove and attach", async () => {
    const { app, service } = harness();
    const auth = "Bearer owner";
    expect((await request(app).get("/journals/draft/images").set("Authorization", auth)).status).toBe(200);
    expect(service.listDraftImages).toHaveBeenCalledWith(owner);
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const uploaded = await request(app).put(`/journals/draft/images/${image}`)
      .set("Authorization", auth).set("Content-Type", "image/png").send(bytes);
    expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(200);
    expect(service.uploadDraftImage).toHaveBeenCalledWith(owner, image, expect.any(Buffer), "image/png");
    expect((await request(app).post(`/journals/${journal}/draft-images/attach`).set("Authorization", auth)).status).toBe(200);
    expect(service.attachDraftImages).toHaveBeenCalledWith(owner, journal);
    expect((await request(app).delete(`/journals/draft/images/${image}`).set("Authorization", auth)).status).toBe(204);
    expect(service.removeDraftImage).toHaveBeenCalledWith(owner, image);
  });
});
