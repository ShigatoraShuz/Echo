import { mkdtemp, writeFile, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { assertAiEnabled } from "../../src/infrastructure/security/runtime-controls.js";

describe("emergency controls and content-free audit", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reloads shutdown controls without process restart and fails closed on malformed configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "echo-security-test-"));
    const file = join(directory, "controls.json"); vi.stubEnv("ECHO_SECURITY_CONTROLS_FILE", file);
    try {
      await writeFile(file, JSON.stringify({ aiEnabled: false, uploadsEnabled: false, disabledRoutePrefixes: [] }));
      await expect(assertAiEnabled()).rejects.toMatchObject({ code: "AI_DISABLED" });
      expect((await request(createApp()).put("/api/v1/verification/documents/user_government_id")).status).toBe(503);
      await writeFile(file, JSON.stringify({ aiEnabled: true, uploadsEnabled: true, disabledRoutePrefixes: [] }));
      await expect(assertAiEnabled()).resolves.toBeUndefined();
      await writeFile(file, "invalid");
      await expect(assertAiEnabled()).rejects.toMatchObject({ code: "SECURITY_CONTROLS_UNAVAILABLE" });
    } finally { await rm(file, { force: true }); await rmdir(directory); }
  });
  it("audits denials without copying payloads, credentials or supplied URLs", async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ allowedOrigin: "https://echo.example", securityAuditSink: sink });
    await request(app).post("/private-journal-text").set("Origin", "https://evil.example").set("Authorization", "Bearer private-token").send({ body: "private reflection" });
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ event: "authorization.denied", outcome: "denied", statusCode: 403 }));
    expect(JSON.stringify(sink.mock.calls)).not.toMatch(/private-token|private reflection|private-journal-text|evil\.example/);
  });
});
