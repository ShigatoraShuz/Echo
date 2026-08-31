import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createLocalWorkerRouter } from "./local-worker.routes.js";
import type { LocalWorkerService } from "./local-worker.service.js";
import { AuthorizationError } from "../../shared/errors/app-error.js";
import { errorMiddleware } from "../../shared/middleware/error.middleware.js";

describe("worker authentication boundary", () => {
  function app() {
    const service = {
      authenticate: vi.fn(() => {
        throw new AuthorizationError();
      }),
      protocolHealth: vi.fn(),
      progress: vi.fn(),
      safetyResult: vi.fn(),
      finalResult: vi.fn(),
      failure: vi.fn(),
    };
    const server = express();
    server.use(createLocalWorkerRouter(service as unknown as LocalWorkerService));
    server.get("/journals", (_req, res) => res.json({ ordinaryJournalRoute: true }));
    server.use(errorMiddleware);
    return { server, service };
  }
  it("requires authentication on the internal protocol", async () => {
    const { server, service } = app();
    expect((await request(server).get("/internal/ai/protocol-health")).status).toBe(403);
    expect(service.protocolHealth).not.toHaveBeenCalled();
  });
  it("never applies worker credentials to ordinary journal routes", async () => {
    const { server, service } = app();
    expect((await request(server).get("/journals")).status).toBe(200);
    expect(service.authenticate).not.toHaveBeenCalled();
  });
});
