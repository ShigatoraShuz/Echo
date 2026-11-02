import express from "express";
import request from "supertest";
import { expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createAccessGuard, createAccessRouter } from "./access.routes.js";
import type { AccessService } from "./access.service.js";

async function check(method: string, path: string) {
  const service = {
    hasPendingDeletion: vi.fn().mockResolvedValue(true),
    decide: vi.fn().mockResolvedValue({ decision: "DELETION_PENDING", onboardingStep: 0 }),
  } as unknown as AccessService;
  const next = vi.fn() as unknown as NextFunction;
  const request = { method, path, auth: { id: "test-user" } } as unknown as Request;
  await createAccessGuard(service)(request, { locals: {} } as Response, next);
  return { next, service };
}

it("allows only deletion status, cancellation and export for a pending account", async () => {
  for (const [method, path] of [
    ["GET", "/settings/account-deletion"],
    ["PATCH", "/settings/account-deletion/74000000-0000-4000-8000-000000000001/cancel"],
    ["POST", "/settings/data-exports"],
    ["GET", "/settings/data-exports/74000000-0000-4000-8000-000000000001/download"],
  ]) {
    const { next } = await check(method, path);
    expect(next).toHaveBeenCalledWith();
  }
  for (const [method, path] of [["GET", "/journals"], ["POST", "/buddy/messages"], ["PATCH", "/settings/privacy"], ["GET", "/settings/profile"]]) {
    const { next, service } = await check(method, path);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "RESOURCE_FORBIDDEN" }));
    if (path === "/journals") expect(service.decide).not.toHaveBeenCalled();
    else expect(service.hasPendingDeletion).not.toHaveBeenCalled();
  }
});

it("uses one access decision for ordinary protected routes", async () => {
  const service = {
    hasPendingDeletion: vi.fn(),
    decide: vi.fn().mockResolvedValue({ decision: "ACCESS_GRANTED", onboardingStep: 3 }),
  } as unknown as AccessService;
  const next = vi.fn() as unknown as NextFunction;
  const request = { method: "GET", path: "/dashboard", auth: { id: "test-user" } } as unknown as Request;
  await createAccessGuard(service)(request, { locals: {} } as Response, next);
  expect(service.decide).toHaveBeenCalledOnce();
  expect(service.hasPendingDeletion).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledWith();
});

it("records access time when the decision fails closed", async () => {
  const failure = new Error("database unavailable");
  const service = { decide: vi.fn().mockRejectedValue(failure) } as unknown as AccessService;
  const next = vi.fn() as unknown as NextFunction;
  const request = { method: "GET", path: "/dashboard", auth: { id: "test-user" } } as unknown as Request;
  const response = { locals: {} } as Response;

  await createAccessGuard(service)(request, response, next);

  expect(next).toHaveBeenCalledWith(failure);
  expect(response.locals.accessDecisionMs).toEqual(expect.any(Number));
});

it("records a failed access-status decision without granting access", async () => {
  const service = { decide: vi.fn().mockRejectedValue(new Error("database unavailable")) } as unknown as AccessService;
  const verifier = { getUser: vi.fn().mockResolvedValue({ id: "test-user", emailVerified: true }) };
  const app = express();
  app.use(createAccessRouter(service, verifier));
  app.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) =>
    response.status(503).json({ accessDecisionMs: response.locals.accessDecisionMs }));

  const result = await request(app).get("/access/status").set("Authorization", "Bearer valid-token");
  expect(result.status).toBe(503);
  expect(result.body.accessDecisionMs).toEqual(expect.any(Number));
});
