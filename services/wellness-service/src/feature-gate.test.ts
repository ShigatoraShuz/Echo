import request from "supertest";
import { afterEach, it, expect, vi } from "vitest";
import { gatewayUserHeaders } from "@echo/service-core";
import { createWellnessApp } from "./app.js";
afterEach(() => vi.unstubAllGlobals());
it.each(["verification", "trusted_contact"])("blocks Buddy server-side when %s is missing", async (missing) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "FEATURE_REQUIREMENTS_NOT_MET", message: "Complete " + missing },
          }),
          { status: 403 },
        ),
    ),
  );
  const sendActive = vi.fn();
  const options = {
    serviceToken: "w".repeat(32),
    userServiceToken: "u".repeat(32),
    userServiceUrl: "http://user",
    timeoutMs: 100,
  };
  const response = await request(createWellnessApp({ sendActive } as any, options))
    .post("/api/v1/buddy/messages")
    .set(
      gatewayUserHeaders({
        requestId: "00000000-0000-4000-8000-000000000001",
        userId: "00000000-0000-4000-8000-000000000002",
        secret: options.serviceToken,
      }),
    )
    .send({ content: "Reflect with me" });
  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe("FEATURE_REQUIREMENTS_NOT_MET");
  expect(sendActive).not.toHaveBeenCalled();
});
