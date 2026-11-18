import { describe, it, expect, vi } from "vitest";
import { ExperienceService } from "../experience.service.js";
function harness(data: Record<string, unknown>, storageError = false) {
  const chain = {
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    then: (resolve: (x: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  const rpc = vi.fn().mockResolvedValue({ data, error: null }),
    remove = vi.fn().mockResolvedValue({ error: storageError ? { message: "offline" } : null });
  const database = { schema: () => ({ rpc, from: () => chain }), storage: { from: () => ({ remove }) } };
  const service = new ExperienceService(database as never, {} as never, {} as never);
  const clear = vi.spyOn(service, "clearLocal").mockResolvedValue();
  return { service, rpc, remove, clear, chain };
}
describe("activity reset orchestration", () => {
  it("does not clear newer local activity when an already-completed request is replayed", async () => {
    const h = harness({ completed: true });
    await h.service.resetActivity("owner", "request");
    expect(h.clear).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });
  it("clears local state and photos only for the authenticated owner", async () => {
    const h = harness({ completed: false, imagePaths: ["owner/image.png"] });
    await h.service.resetActivity("owner", "request");
    expect(h.rpc).toHaveBeenCalledWith("reset_account_activity", { p_user_id: "owner", p_request_id: "request" });
    expect(h.clear).toHaveBeenCalledWith("owner");
    expect(h.remove).toHaveBeenCalledWith(["owner/image.png"]);
    expect(h.chain.eq).toHaveBeenCalledWith("user_id", "owner");
  });
  it("retains an incomplete receipt if photo deletion fails, so retry can finish", async () => {
    const h = harness({ completed: false, imagePaths: ["owner/image.png"] }, true);
    await expect(h.service.resetActivity("owner", "request")).rejects.toMatchObject({ code: "RESET_CLEANUP_PENDING" });
    expect(h.chain.update).not.toHaveBeenCalled();
  });
  it("never removes another owner's storage path", async () => {
    const h = harness({ completed: false, imagePaths: ["other/image.png"] });
    await expect(h.service.resetActivity("owner", "request")).rejects.toMatchObject({ code: "RESET_UNAVAILABLE" });
    expect(h.remove).not.toHaveBeenCalled();
  });
  it("finishes the original receipt when recovering an interrupted reset", async () => {
    const h = harness({ completed: false, imagePaths: [], requestId: "original" });
    await h.service.resetActivity("owner", "new-request");
    expect(h.chain.eq).toHaveBeenCalledWith("request_id", "original");
  });
});


describe("private runtime cleanup", () => {
  it("clears pending voice and text for this owner while retaining another owner's state", async () => {
    const service = new ExperienceService({} as never, { cancelLocalWork: vi.fn() } as never, {} as never);
    const state = service as unknown as Record<string, Map<string, unknown>>;
    for (const name of ["temporary", "approvedVoice", "hostedTurns"]) {
      state[name].set("owner:turn", { content: "private" });
      state[name].set("other:turn", { content: "other" });
    }
    await service.clearLocal("owner");
    for (const name of ["temporary", "approvedVoice", "hostedTurns"]) {
      expect([...state[name].keys()]).toEqual(["other:turn"]);
    }
  });
});
