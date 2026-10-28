import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createAuthMiddleware } from "./auth.middleware.js";

describe("request authentication reuse", () => {
  it("verifies the same bearer token once across independent guards", async () => {
    const verifier = { getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.test" }) };
    const app = express();
    const guard = createAuthMiddleware(verifier);
    app.get("/", guard, guard, guard, (_req, response) => response.status(204).end());

    expect((await request(app).get("/").set("Authorization", "Bearer valid-token")).status).toBe(204);
    expect(verifier.getUser).toHaveBeenCalledExactlyOnceWith("valid-token");
  });

  it("rejects a changed token instead of reusing the prior identity", async () => {
    const verifier = { getUser: vi.fn(async (token: string) => token === "valid-token" ? { id: "user-1" } : null) };
    const app = express();
    const guard = createAuthMiddleware(verifier);
    app.get("/", guard, (req, _res, next) => { req.headers.authorization = "Bearer changed-token"; next(); }, guard, (_req, response) => response.status(204).end());
    app.use((_error: unknown, _req: express.Request, response: express.Response, _next: express.NextFunction) => response.status(401).end());

    expect((await request(app).get("/").set("Authorization", "Bearer valid-token")).status).toBe(401);
    expect(verifier.getUser).toHaveBeenCalledTimes(2);
    expect(verifier.getUser).toHaveBeenLastCalledWith("changed-token");
  });

  it("runs a distinct route verifier even for the same token", async () => {
    const accepted = { getUser: vi.fn().mockResolvedValue({ id: "user-1" }) };
    const rejected = { getUser: vi.fn().mockResolvedValue(null) };
    const app = express();
    app.get("/", createAuthMiddleware(accepted), createAuthMiddleware(rejected), (_req, response) => response.status(204).end());
    app.use((_error: unknown, _req: express.Request, response: express.Response, _next: express.NextFunction) => response.status(401).end());

    expect((await request(app).get("/").set("Authorization", "Bearer valid-token")).status).toBe(401);
    expect(accepted.getUser).toHaveBeenCalledTimes(1);
    expect(rejected.getUser).toHaveBeenCalledTimes(1);
  });

  it("records verification time when the identity provider fails", async () => {
    const verifier = { getUser: vi.fn().mockRejectedValue(new Error("provider unavailable")) };
    const app = express();
    app.get("/", createAuthMiddleware(verifier), (_req, response) => response.status(204).end());
    app.use((_error: unknown, _req: express.Request, response: express.Response, _next: express.NextFunction) =>
      response.status(401).json({ authVerificationMs: response.locals.authVerificationMs }));

    const result = await request(app).get("/").set("Authorization", "Bearer valid-token");
    expect(result.status).toBe(401);
    expect(result.body.authVerificationMs).toEqual(expect.any(Number));
  });
});
