import { beforeEach, expect, it, vi } from "vitest";
import FindHelpPage from "./page";
const auth = vi.hoisted(() => ({ configured: vi.fn(), claims: vi.fn() }));
vi.mock("@/infrastructure/supabase/config", () => ({ getSupabasePublicConfig: auth.configured }));
vi.mock("@/infrastructure/supabase/server-client", () => ({ createServerSupabaseClient: async () => ({ auth: { getClaims: auth.claims } }) }));
beforeEach(() => { auth.configured.mockReturnValue({}); auth.claims.mockResolvedValue({ data: { claims: { sub: "test-owner" } }, error: null }); });
it("uses the full application navigation for a verified signed-in session", async () => {
  expect((await FindHelpPage()).props.signedIn).toBe(true);
});
it("keeps the directory public without a session or when verification fails", async () => {
  auth.claims.mockResolvedValueOnce({data:{claims:null},error:null});
  expect((await FindHelpPage()).props.signedIn).toBe(false);
  auth.claims.mockRejectedValueOnce(new Error("Auth unavailable"));
  expect((await FindHelpPage()).props.signedIn).toBe(false);
});
it("does not initialize auth when Supabase is not configured", async () => {
  auth.configured.mockReturnValue(null);
  expect((await FindHelpPage()).props.signedIn).toBe(false);
  expect(auth.claims).not.toHaveBeenCalled();
});
