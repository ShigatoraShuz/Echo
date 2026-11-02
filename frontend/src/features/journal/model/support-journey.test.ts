import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  acknowledgeSupportOffer,
  beginSupportVisit,
  clearSupportJourney,
  completeSupportVisit,
  supportVisitToken,
  getSupportReturn, markSupportVisitArrived, acknowledgeSupportReturn,
  shouldOfferSupport,
  SUPPORT_JOURNEY_KEY,
} from "./support-journey";
const session = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({ auth: session }),
}));
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ids = [1, 2, 3, 4, 5, 6].map(
  (n) => `00000000-0000-4000-8000-00000000000${n}`,
);
const state = {
  ownerId: owner,
  eligible: true,
  recentJournalIds: ids.slice(0, 3),
};
beforeEach(() => {
  clearSupportJourney();
  localStorage.clear();
  session.getSession.mockResolvedValue({
    data: { session: { user: { id: owner } } },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  clearSupportJourney();
});
it("offers once for three distinct flags, ignoring reloads and overlapping windows", () => {
  expect(shouldOfferSupport({ ...state, eligible: false })).toBe(false);
  expect(
    shouldOfferSupport({
      ...state,
      recentJournalIds: [ids[0], ids[0], ids[0]],
    }),
  ).toBe(false);
  expect(shouldOfferSupport(state)).toBe(true);
  acknowledgeSupportOffer(state);
  expect(shouldOfferSupport(state)).toBe(false);
  expect(
    shouldOfferSupport({ ...state, recentJournalIds: ids.slice(1, 4) }),
  ).toBe(false);
  expect(
    shouldOfferSupport({ ...state, recentJournalIds: ids.slice(3, 6) }),
  ).toBe(true);
});
it("records only the selected visit and consumes the return once without asserting completion", async () => {
  await beginSupportVisit("professional"); markSupportVisitArrived("professional");
  expect(getSupportReturn(owner)).toMatchObject({
    destination: "professional",
    completed: false,
  });
  expect(getSupportReturn(owner)).not.toBeNull();
  expect(acknowledgeSupportReturn(state, getSupportReturn(owner)!.id)).toBe(true);
  expect(getSupportReturn(owner)).toBeNull();
  await beginSupportVisit("grounding"); markSupportVisitArrived("grounding");
  completeSupportVisit("professional", supportVisitToken("professional"));
  expect(getSupportReturn(owner)?.completed).toBe(false);
  await beginSupportVisit("grounding"); markSupportVisitArrived("grounding");
  completeSupportVisit("grounding", supportVisitToken("grounding"));
  expect(getSupportReturn(owner)).toMatchObject({
    destination: "grounding",
    completed: true,
  });
});
it("isolates another account and clears on logout", async () => {
  await beginSupportVisit("professional"); markSupportVisitArrived("professional");
  expect(getSupportReturn(other)).toBeNull();
  acknowledgeSupportOffer(state);
  window.dispatchEvent(new Event("echo:sensitive-state-cleared"));
  expect(sessionStorage.getItem(SUPPORT_JOURNEY_KEY)).toBeNull();
  expect(shouldOfferSupport(state)).toBe(true);
});
it("expires old/corrupt markers and never writes a timed-out or logged-out session later", async () => {
  sessionStorage.setItem(SUPPORT_JOURNEY_KEY, "not-json");
  expect(getSupportReturn(owner)).toBeNull();
  vi.useFakeTimers();
  await beginSupportVisit("professional"); markSupportVisitArrived("professional");
  vi.advanceTimersByTime(25 * 3600000);
  expect(getSupportReturn(owner)).toBeNull();
  let resolve!: (value: unknown) => void;
  session.getSession.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const pending = beginSupportVisit("professional");
  await vi.advanceTimersByTimeAsync(1600);
  await pending;
  resolve({ data: { session: { user: { id: owner } } } });
  await Promise.resolve();
  expect(getSupportReturn(owner)).toBeNull();
  session.getSession.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const logout = beginSupportVisit("grounding");
  window.dispatchEvent(new Event("echo:sensitive-state-cleared"));
  resolve({ data: { session: { user: { id: owner } } } });
  await logout;
  expect(getSupportReturn(owner)).toBeNull();
});
it("still handles choices when browser storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  await beginSupportVisit("grounding"); markSupportVisitArrived("grounding");
  completeSupportVisit("grounding", supportVisitToken("grounding"));
  expect(getSupportReturn(owner)?.completed).toBe(true);
});

it("does not let an old completion mark a later support visit complete", async () => {
  await beginSupportVisit("professional"); markSupportVisitArrived("professional");
  const old = supportVisitToken("professional");
  await beginSupportVisit("professional"); markSupportVisitArrived("professional");
  completeSupportVisit("professional", old);
  expect(getSupportReturn(owner)?.completed).toBe(false);
});

it("requires arrival and explicit readiness acknowledgement instead of consuming on read", async () => {
  await beginSupportVisit("grounding");
  expect(getSupportReturn(owner)).toBeNull();
  expect(acknowledgeSupportReturn(state, supportVisitToken("grounding")!)).toBe(false);
  markSupportVisitArrived("grounding");
  const visit = getSupportReturn(owner)!;
  expect(getSupportReturn(owner)?.id).toBe(visit.id);
  expect(acknowledgeSupportReturn(state, "wrong-visit")).toBe(false);
  expect(acknowledgeSupportReturn(state, visit.id)).toBe(true);
  expect(getSupportReturn(owner)).toBeNull();
  expect(shouldOfferSupport(state)).toBe(false);
});
