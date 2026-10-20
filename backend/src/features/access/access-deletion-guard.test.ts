import { expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createAccessGuard } from "./access.routes.js";
import type { AccessService } from "./access.service.js";

async function check(method: string, path: string) {
  const service = {
    hasPendingDeletion: vi.fn().mockResolvedValue(true),
    decide: vi.fn(),
  } as unknown as AccessService;
  const next = vi.fn() as unknown as NextFunction;
  const request = { method, path, auth: { id: "test-user" } } as unknown as Request;
  await createAccessGuard(service)(request, {} as Response, next);
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
  for (const [method, path] of [["GET", "/journals"], ["POST", "/buddy/messages"], ["PATCH", "/settings/privacy"]]) {
    const { next, service } = await check(method, path);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "RESOURCE_FORBIDDEN" }));
    expect(service.decide).not.toHaveBeenCalled();
  }
});
