import { act, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createProfessionalReads, ProfessionalReadScope, useProfessionalRead, useProfessionalRefresh } from "./professional-read-scope";

afterEach(() => vi.restoreAllMocks());
it("deduplicates concurrent reads, retains metadata only for its requested lease, and never caches errors", async () => {
  const reads = createProfessionalReads(), load = vi.fn(async () => ({ unreadCount: 1 }));
  const first = reads.read("actor:org:role", load, 1000);
  expect(reads.read("actor:org:role", load, 1000)).toBe(first);
  await first; await reads.read("actor:org:role", load, 1000);
  expect(load).toHaveBeenCalledTimes(1);
  reads.clear(); await reads.read("actor:org:role", load, 1000);
  expect(load).toHaveBeenCalledTimes(2);
  const fail = vi.fn(async () => { throw new Error("synthetic failure"); });
  await expect(reads.read("fail", fail)).rejects.toThrow();
  await expect(reads.read("fail", fail)).rejects.toThrow();
  expect(fail).toHaveBeenCalledTimes(2);
});
it("late responses cannot repopulate a cleared scope; actor, organization and role keys never share", async () => {
  const reads = createProfessionalReads();
  let done!: (value: object) => void;
  const old = reads.read("actor:one:counselor", () => new Promise<object>(resolve => { done = resolve; }), 1000);
  await Promise.resolve(); reads.clear(); done({ unreadCount: 99 }); await old;
  const fresh = vi.fn(async () => ({ unreadCount: 0 }));
  await reads.read("actor:one:counselor", fresh, 1000);
  await reads.read("actor:two:counselor", fresh, 1000);
  await reads.read("other:one:counselor", fresh, 1000);
  await reads.read("actor:one:org_admin", fresh, 1000);
  expect(fresh).toHaveBeenCalledTimes(4);
});
it("expires bounded metadata and does not retain clinical reads after settlement", async () => {
  const reads = createProfessionalReads(), load = vi.fn(async () => ({}));
  const now = vi.spyOn(Date, "now").mockReturnValue(100);
  await reads.read("notifications", load, 1000);
  now.mockReturnValue(1101); await reads.read("notifications", load, 1000);
  await reads.read("clinical", load); await reads.read("clinical", load);
  expect(load).toHaveBeenCalledTimes(4);
});
it("pauses refresh and immediately purges the old organization before router navigation completes", async () => {
  const reads = createProfessionalReads(), load = vi.fn(async () => ({})), callback = vi.fn();
  await reads.read("notifications:old", load, 1000);
  reads.subscribe(callback, "notifications"); reads.pause();
  reads.refresh(new Set(["notifications"])); expect(callback).not.toHaveBeenCalled();
  reads.resume(); await reads.read("notifications:old", load, 1000);
  expect(load).toHaveBeenCalledTimes(2);
});
it("coordinates panel/badge invalidations, excludes chat from calendar refresh, pauses hidden tabs and stops on access loss", async () => {
  const fetch = vi.fn(async () => ({})), calendar = vi.fn();
  const visible = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  function Consumer() {
    const read = useProfessionalRead();
    useProfessionalRefresh(() => { void read("notifications:actor:org:role", fetch, 1000); }, "actor:org:role", () => {}, "notifications");
    return null;
  }
  function Calendar() { useProfessionalRefresh(calendar, "actor:org:role", () => {}, "appointments"); return null; }
  const view = render(<ProfessionalReadScope><Consumer /><Consumer /><Calendar /></ProfessionalReadScope>);
  await act(async () => {
    window.dispatchEvent(new Event("echo:appointments-changed"));
    window.dispatchEvent(new Event("echo:notifications-changed"));
  });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1)); expect(calendar).toHaveBeenCalledTimes(1);
  await act(async () => window.dispatchEvent(new Event("echo:notifications-changed")));
  expect(fetch).toHaveBeenCalledTimes(2); expect(calendar).toHaveBeenCalledTimes(1);
  visible.mockReturnValue("hidden");
  await act(async () => window.dispatchEvent(new Event("echo:appointments-changed")));
  expect(fetch).toHaveBeenCalledTimes(2);
  visible.mockReturnValue("visible");
  await act(async () => window.dispatchEvent(new Event("echo:professional-access-lost")));
  await act(async () => window.dispatchEvent(new Event("echo:notifications-changed")));
  expect(fetch).toHaveBeenCalledTimes(2);
  view.unmount();
});
