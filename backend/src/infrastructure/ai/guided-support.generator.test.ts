import { describe, it, expect, vi } from "vitest";
import { GuidedSupportGenerator } from "./guided-support.generator.js";

describe("local guided responder", () => {
  it("returns deterministic prewritten support with honest provenance and no clinical scores", async () => {
    const verify = vi.fn(async () => {}), responder = new GuidedSupportGenerator(new Set(["fictional"]), verify);
    const first = await responder.generate("fictional", "A grounding exercise please", []);
    const second = await responder.generate("fictional", "A grounding exercise please", []);
    expect(first.result).toEqual(second.result);
    expect(first).toMatchObject({ executionState: "DEMO_FALLBACK", modelId: "echo-guided-support", executionMode: "synthetic" });
    expect(first.result?.disclaimer).toMatch(/No LLM/);
    expect(first.result?.text).toMatch(/stop whenever/);
    expect(verify).toHaveBeenCalledTimes(4);
  });
  it("rejects an account outside the local allowlist before verification", async () => {
    const verify = vi.fn();
    await expect(new GuidedSupportGenerator(new Set(["fictional"]), verify).generate("foreign", "hello", [])).rejects.toThrow();
    expect(verify).not.toHaveBeenCalled();
  });
  it("rechecks access before returning and never returns after revocation", async () => {
    const verify = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("revoked"));
    await expect(new GuidedSupportGenerator(new Set(["fictional"]), verify).generate("fictional", "journal", [])).rejects.toThrow("revoked");
  });
  it("offers distinct user-driven reflection and follow-up choices without echoing private input", async () => {
    const responder = new GuidedSupportGenerator(new Set(["fictional"]), async () => {});
    expect((await responder.generate("fictional", "journal", [])).result?.text).toMatch(/reflection prompt/);
    expect((await responder.generate("fictional", "PRIVATE_SENTINEL", [{ role: "user", content: "earlier" }])).result?.text).toMatch(/Which would be useful next/);
    expect((await responder.generate("fictional", "PRIVATE_SENTINEL", [])).result?.text).not.toContain("PRIVATE_SENTINEL");
  });
});
